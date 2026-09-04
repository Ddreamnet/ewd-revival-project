/**
 * İstanbul gezisi günlüğünün veri katmanı.
 *
 * Üç tablo (`trip_days`, `trip_activities`, `trip_photos`) tek seferde
 * okunuyor — on günlük kişisel bir günlük, sayfalamaya gerek yok. Fotoğraflar
 * kapalı depoda durduğu için adresleri açılışta toplu imzalanıyor.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { shrinkImage } from "@/lib/imageResize";
import { TRIP_BUCKET, TRIP_DAYS, clampToTrip, isTripDay, tripDayFor } from "@/lib/trip";
import { readCaptureDate } from "@/lib/exifDate";

/** İmzalı adresin ömrü. Sayfa bir gün boyu açık kalsa da fotoğraflar kararmasın. */
const SIGNED_URL_TTL = 60 * 60 * 12;

export interface TripActivity {
  id: string;
  day: string;
  text: string;
  order_index: number;
}

export interface TripPhoto {
  id: string;
  day: string;
  storage_path: string;
  caption: string;
  order_index: number;
  /** İmzalı adres; imzalama başarısızsa null. */
  url: string | null;
}

export interface TripDay {
  day: string;
  title: string;
  activities: TripActivity[];
  photos: TripPhoto[];
}

export interface UploadProgress {
  /** Toplu yüklemede null — fotoğraflar birden çok güne dağılıyor. */
  day: string | null;
  done: number;
  total: number;
}

/** Toplu yüklemenin sonucu — hangi güne kaç fotoğraf gittiği. */
export interface BulkResult {
  perDay: { day: string; count: number }[];
  /** Tarihi okunamadığı için hiç yüklenmeyen dosyalar. */
  undated: string[];
  /** Tarihi gezi aralığının dışına düştüğü için en yakın güne çekilenler. */
  clamped: number;
  uploaded: number;
}

const byOrder = <T extends { order_index: number }>(a: T, b: T) => a.order_index - b.order_index;

export function useTripDiary() {
  const { toast } = useToast();
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [activities, setActivities] = useState<TripActivity[]>([]);
  const [photos, setPhotos] = useState<TripPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [upload, setUpload] = useState<UploadProgress | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const fail = useCallback(
    (description: string) => toast({ title: "Olmadı", description, variant: "destructive" }),
    [toast],
  );

  /** Depo yollarını imzalı adreslere çevirir. */
  const signPaths = useCallback(async (paths: string[]): Promise<Map<string, string>> => {
    const map = new Map<string, string>();
    if (paths.length === 0) return map;
    const { data, error } = await supabase.storage
      .from(TRIP_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL);
    if (error) return map;
    for (const row of data ?? []) {
      if (row.path && row.signedUrl) map.set(row.path, row.signedUrl);
    }
    return map;
  }, []);

  const load = useCallback(async () => {
    const [daysRes, activitiesRes, photosRes] = await Promise.all([
      supabase.from("trip_days").select("day, title"),
      supabase.from("trip_activities").select("id, day, text, order_index").order("order_index"),
      supabase
        .from("trip_photos")
        .select("id, day, storage_path, caption, order_index")
        .order("order_index"),
    ]);

    const error = daysRes.error || activitiesRes.error || photosRes.error;
    if (error) {
      if (mounted.current) setLoading(false);
      fail("Günlük yüklenemedi. Bağlantıyı kontrol edip sayfayı yenileyin.");
      return;
    }

    const rows = photosRes.data ?? [];
    const signed = await signPaths(rows.map((r) => r.storage_path));
    if (!mounted.current) return;

    setTitles(Object.fromEntries((daysRes.data ?? []).map((d) => [d.day, d.title])));
    setActivities(activitiesRes.data ?? []);
    setPhotos(rows.map((row) => ({ ...row, url: signed.get(row.storage_path) ?? null })));
    setLoading(false);
  }, [fail, signPaths]);

  useEffect(() => {
    load();
  }, [load]);

  /* ── Günler ───────────────────────────────────────────────────── */

  const saveTitle = useCallback(
    async (day: string, title: string) => {
      const trimmed = title.trim();
      setTitles((prev) => ({ ...prev, [day]: trimmed }));
      const { error } = await supabase.from("trip_days").upsert({ day, title: trimmed });
      if (error) fail("Gün başlığı kaydedilemedi.");
    },
    [fail],
  );

  /* ── Yapılanlar ───────────────────────────────────────────────── */

  const addActivity = useCallback(
    async (day: string): Promise<string | null> => {
      const siblings = activities.filter((a) => a.day === day);
      const order = siblings.length === 0 ? 0 : Math.max(...siblings.map((a) => a.order_index)) + 1;
      const { data, error } = await supabase
        .from("trip_activities")
        .insert({ day, text: "", order_index: order })
        .select("id, day, text, order_index")
        .single();
      if (error || !data) {
        fail("Satır eklenemedi.");
        return null;
      }
      setActivities((prev) => [...prev, data]);
      return data.id;
    },
    [activities, fail],
  );

  const saveActivity = useCallback(
    async (id: string, text: string) => {
      setActivities((prev) => prev.map((a) => (a.id === id ? { ...a, text } : a)));
      const { error } = await supabase.from("trip_activities").update({ text }).eq("id", id);
      if (error) fail("Yazdığınız satır kaydedilemedi.");
    },
    [fail],
  );

  const removeActivity = useCallback(
    async (id: string) => {
      const snapshot = activities;
      setActivities((prev) => prev.filter((a) => a.id !== id));
      const { error } = await supabase.from("trip_activities").delete().eq("id", id);
      if (error) {
        setActivities(snapshot);
        fail("Satır silinemedi.");
      }
    },
    [activities, fail],
  );

  /* ── Fotoğraflar ──────────────────────────────────────────────── */

  /** Tek dosya: küçült → depoya koy → satırı yaz → imzala. Başarısızsa null. */
  const uploadOne = useCallback(
    async (day: string, original: File, order: number): Promise<TripPhoto | null> => {
      const file = await shrinkImage(original);
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${day}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(TRIP_BUCKET)
        .upload(path, file, { cacheControl: "3600", contentType: file.type || undefined });
      if (uploadError) {
        fail(`"${original.name}" yüklenemedi: ${uploadError.message}`);
        return null;
      }

      const { data, error } = await supabase
        .from("trip_photos")
        .insert({ day, storage_path: path, order_index: order })
        .select("id, day, storage_path, caption, order_index")
        .single();
      if (error || !data) {
        // Satır yazılamadıysa dosya öksüz kalmasın.
        await supabase.storage.from(TRIP_BUCKET).remove([path]);
        fail(`"${original.name}" kaydedilemedi.`);
        return null;
      }

      const signed = await signPaths([path]);
      return { ...data, url: signed.get(path) ?? null };
    },
    [fail, signPaths],
  );

  /** Bir güne ait sıradaki `order_index`. */
  const nextOrder = useCallback(
    (day: string) => {
      const siblings = photos.filter((p) => p.day === day);
      return siblings.length === 0 ? 0 : Math.max(...siblings.map((p) => p.order_index)) + 1;
    },
    [photos],
  );

  const addPhotos = useCallback(
    async (day: string, files: File[]) => {
      const images = files.filter((f) => f.type.startsWith("image/"));
      if (images.length === 0) return;

      let order = nextOrder(day);
      setUpload({ day, done: 0, total: images.length });
      let added = 0;

      for (const original of images) {
        const photo = await uploadOne(day, original, order);
        if (!mounted.current) return;
        if (!photo) continue;
        setPhotos((prev) => [...prev, photo]);
        order += 1;
        added += 1;
        setUpload({ day, done: added, total: images.length });
      }

      if (!mounted.current) return;
      setUpload(null);
      if (added > 0) {
        toast({
          title: added === images.length ? "Yüklendi" : "Kısmen yüklendi",
          description: `${added} fotoğraf eklendi.`,
        });
      }
    },
    [nextOrder, uploadOne, toast],
  );

  /**
   * Toplu yükleme: karışık seçilen fotoğrafları çekim tarihine göre günlere
   * dağıtır.
   *
   * Tarih sırası: EXIF çekim anı → (yoksa) dosya tarihi, ama yalnızca gezi
   * aralığına düşüyorsa; indirilen bir fotoğrafın dosya tarihi indirme anıdır,
   * ona güvenilmez. Hiçbiri yoksa dosya atlanır — yanlış güne koymaktansa
   * kullanıcının kendi elleriyle koyması iyi.
   */
  const addPhotosByDate = useCallback(
    async (files: File[]): Promise<BulkResult | null> => {
      const images = files.filter((f) => f.type.startsWith("image/"));
      if (images.length === 0) return null;

      const planned: { file: File; day: string; at: number }[] = [];
      const undated: string[] = [];
      let clamped = 0;

      for (const file of images) {
        const captured = await readCaptureDate(file);
        let day = captured ? tripDayFor(captured) : null;

        if (!day && file.lastModified) {
          const guess = tripDayFor(new Date(file.lastModified));
          if (isTripDay(guess)) day = guess;
        }
        if (!day) {
          undated.push(file.name);
          continue;
        }

        const inRange = clampToTrip(day);
        if (inRange !== day) clamped += 1;
        planned.push({ file, day: inRange, at: captured?.getTime() ?? file.lastModified });
      }

      if (planned.length === 0) {
        return { perDay: [], undated, clamped, uploaded: 0 };
      }

      // Aynı gün içinde çekim sırasına göre dizilsinler.
      planned.sort((a, b) => (a.day === b.day ? a.at - b.at : a.day < b.day ? -1 : 1));

      const orders = new Map<string, number>();
      const counts = new Map<string, number>();
      setUpload({ day: null, done: 0, total: planned.length });
      let done = 0;

      for (const item of planned) {
        const order = orders.get(item.day) ?? nextOrder(item.day);
        const photo = await uploadOne(item.day, item.file, order);
        if (!mounted.current) return null;
        orders.set(item.day, order + 1);
        if (photo) {
          setPhotos((prev) => [...prev, photo]);
          counts.set(item.day, (counts.get(item.day) ?? 0) + 1);
          done += 1;
          setUpload({ day: null, done, total: planned.length });
        }
      }

      if (!mounted.current) return null;
      setUpload(null);
      return {
        perDay: [...counts.entries()]
          .map(([day, count]) => ({ day, count }))
          .sort((a, b) => (a.day < b.day ? -1 : 1)),
        undated,
        clamped,
        uploaded: done,
      };
    },
    [nextOrder, uploadOne],
  );

  const savePhotoCaption = useCallback(
    async (id: string, caption: string) => {
      setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, caption } : p)));
      const { error } = await supabase.from("trip_photos").update({ caption }).eq("id", id);
      if (error) fail("Fotoğraf açıklaması kaydedilemedi.");
    },
    [fail],
  );

  const removePhoto = useCallback(
    async (photo: TripPhoto) => {
      const snapshot = photos;
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      const { error } = await supabase.from("trip_photos").delete().eq("id", photo.id);
      if (error) {
        setPhotos(snapshot);
        fail("Fotoğraf silinemedi.");
        return;
      }
      await supabase.storage.from(TRIP_BUCKET).remove([photo.storage_path]);
    },
    [photos, fail],
  );

  /* ── Sıralama ─────────────────────────────────────────────────── */

  /** İki komşunun `order_index` değerini takas eder — yukarı/aşağı okları. */
  const move = useCallback(
    async (
      table: "trip_activities" | "trip_photos",
      list: { id: string; order_index: number }[],
      index: number,
      delta: number,
    ) => {
      const target = index + delta;
      if (target < 0 || target >= list.length) return;
      const a = list[index];
      const b = list[target];

      const apply = <T extends { id: string; order_index: number }>(rows: T[]): T[] =>
        rows.map((row) =>
          row.id === a.id
            ? { ...row, order_index: b.order_index }
            : row.id === b.id
              ? { ...row, order_index: a.order_index }
              : row,
        );

      if (table === "trip_activities") setActivities(apply);
      else setPhotos(apply);

      const results = await Promise.all([
        supabase.from(table).update({ order_index: b.order_index }).eq("id", a.id),
        supabase.from(table).update({ order_index: a.order_index }).eq("id", b.id),
      ]);
      if (results.some((r) => r.error)) {
        fail("Sıra değiştirilemedi.");
        load();
      }
    },
    [fail, load],
  );

  const moveActivity = useCallback(
    (day: string, index: number, delta: number) =>
      move("trip_activities", activities.filter((a) => a.day === day).sort(byOrder), index, delta),
    [activities, move],
  );

  const movePhoto = useCallback(
    (day: string, index: number, delta: number) =>
      move("trip_photos", photos.filter((p) => p.day === day).sort(byOrder), index, delta),
    [photos, move],
  );

  /* ── Türetilmiş ───────────────────────────────────────────────── */

  const days = useMemo<TripDay[]>(
    () =>
      TRIP_DAYS.map((day) => ({
        day,
        title: titles[day] ?? "",
        activities: activities.filter((a) => a.day === day).sort(byOrder),
        photos: photos.filter((p) => p.day === day).sort(byOrder),
      })),
    [titles, activities, photos],
  );

  return {
    days,
    loading,
    upload,
    photoCount: photos.length,
    activityCount: activities.filter((a) => a.text.trim().length > 0).length,
    saveTitle,
    addActivity,
    saveActivity,
    removeActivity,
    moveActivity,
    addPhotos,
    addPhotosByDate,
    savePhotoCaption,
    removePhoto,
    movePhoto,
  };
}
