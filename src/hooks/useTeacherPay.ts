/**
 * Ücret ayarını okur. Ayar nadiren değişiyor; ilk okuyan modül seviyesinde
 * önbelleğe alıyor, sonraki bileşenler ağ isteği atmıyor. Yerel önbellek
 * sayesinde ilk boyamada da doğru tutar görünüyor.
 *
 * Ücret dil şubesi başına ayrı tutuluyor, bu yüzden önbellek de şubeye göre
 * bölünmüş durumda — İngilizce ücreti Fransızca öğretmene sızmıyor.
 */
import { useEffect, useState } from "react";
import { readCache, writeCache } from "@/lib/panelCache";
import { DEFAULT_TEACHER_PAY, fetchTeacherPay, type TeacherPay } from "@/lib/teacherPay";
import type { Branch } from "@/lib/branch";

const CACHE_VERSION = 1;

const cacheKey = (branch: Branch) => `teacher-pay-${branch}`;

const inFlight = new Map<Branch, Promise<TeacherPay>>();
const cached = new Map<Branch, TeacherPay>();

async function load(branch: Branch): Promise<TeacherPay> {
  const hit = cached.get(branch);
  if (hit) return hit;

  let pending = inFlight.get(branch);
  if (!pending) {
    pending = fetchTeacherPay(branch)
      .then((pay) => {
        cached.set(branch, pay);
        writeCache(cacheKey(branch), pay, CACHE_VERSION);
        return pay;
      })
      .finally(() => {
        inFlight.delete(branch);
      });
    inFlight.set(branch, pending);
  }
  return pending;
}

/** Ayar değiştiğinde (admin kaydettiğinde) önbelleği düşür. */
export function invalidateTeacherPay(branch?: Branch) {
  if (branch) cached.delete(branch);
  else cached.clear();
}

export function useTeacherPay(branch: Branch): TeacherPay {
  const [pay, setPay] = useState<TeacherPay>(
    () => cached.get(branch) ?? readCache<TeacherPay>(cacheKey(branch), CACHE_VERSION) ?? DEFAULT_TEACHER_PAY,
  );

  useEffect(() => {
    let alive = true;
    // Şube değişince önce o şubenin bilinen değerine dön; aksi halde ekranda
    // bir an diğer şubenin tutarı kalırdı.
    setPay(
      cached.get(branch) ?? readCache<TeacherPay>(cacheKey(branch), CACHE_VERSION) ?? DEFAULT_TEACHER_PAY,
    );
    load(branch).then((fresh) => {
      if (alive) setPay(fresh);
    });
    return () => {
      alive = false;
    };
  }, [branch]);

  return pay;
}
