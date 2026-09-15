import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { hataGoster } from "@/lib/notify";
import { denemeEkle, describeRescheduleWarnings } from "@/lib/lessonService";
import { toDbTime } from "@/lib/lessonTypes";
import { AlertTriangle } from "lucide-react";

interface AddTrialLessonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacherId: string;
  onSuccess: () => void;
}

/**
 * Deneme dersi ekleme.
 *
 * İki şey değişti. Birincisi: kayıt artık doğrudan tabloya yazılmıyor,
 * `rpc_deneme_ekle` üzerinden gidiyor — deneme dersi de ders takviminin bir
 * satırı (tur = deneme), yani taşınabiliyor, işlenebiliyor, geri alınabiliyor.
 *
 * İkincisi: çakışma kontrolü buradan kalktı. Eskiden istemcide ayrı bir
 * sorgu vardı (`conflictDetection.ts`), sunucudaki kontrolün ikinci bir
 * kopyasıydı ve yalnızca uyarı gösterip kaydı yine de yazıyordu. Artık tek
 * kontrol sunucuda; sonuç `warnings` olarak geri geliyor.
 *
 * Gün seçici yerine tarih: eskiden "önümüzdeki salı" hesaplanıyordu, bu da
 * iki hafta sonrasına deneme koymayı imkânsız kılıyordu.
 */
export function AddTrialLessonDialog({ open, onOpenChange, teacherId, onSuccess }: AddTrialLessonDialogProps) {
  const [tarih, setTarih] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [adayAdi, setAdayAdi] = useState("");
  const [loading, setLoading] = useState(false);
  const [uyarilar, setUyarilar] = useState<string | null>(null);
  const { toast } = useToast();

  const sifirla = () => {
    setTarih("");
    setStartTime("");
    setEndTime("");
    setAdayAdi("");
    setUyarilar(null);
  };

  const handleSubmit = async () => {
    if (!tarih || !startTime || !endTime) {
      toast({
        title: "Eksik bilgi",
        description: "Tarih, başlangıç ve bitiş saatini doldurun",
        variant: "destructive",
      });
      return;
    }
    if (toDbTime(endTime) <= toDbTime(startTime)) {
      toast({
        title: "Hata",
        description: "Bitiş saati başlangıçtan sonra olmalı",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setUyarilar(null);
    try {
      const sonuc = await denemeEkle(teacherId, tarih, toDbTime(startTime), toDbTime(endTime), adayAdi);
      if (!sonuc.success) {
        toast({
          title: "Hata",
          description: sonuc.error || "Deneme dersi eklenemedi",
          variant: "destructive",
        });
        return;
      }

      const cakisma = describeRescheduleWarnings(sonuc);
      toast(
        cakisma
          ? { title: "Eklendi — o saatte başka ders de var", description: cakisma }
          : { title: "Başarılı", description: "Deneme dersi eklendi" }
      );

      sifirla();
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      hataGoster(error, "İşlem tamamlanamadı");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" animateHeight>
        <DialogHeader>
          <DialogTitle>Deneme Dersi Ekle</DialogTitle>
          <DialogDescription>
            Aday henüz kayıtlı bir öğrenci değil; takvimde yer tutar, işlendi işaretlenince
            bakiyeye girer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="deneme-tarih">Tarih</Label>
            <Input
              id="deneme-tarih"
              type="date"
              value={tarih}
              onChange={(e) => setTarih(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="deneme-bas">Başlangıç</Label>
              <Input
                id="deneme-bas"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deneme-bitis">Bitiş</Label>
              <Input
                id="deneme-bitis"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deneme-aday">Aday adı <span className="text-muted-foreground">(isteğe bağlı)</span></Label>
            <Input
              id="deneme-aday"
              value={adayAdi}
              onChange={(e) => setAdayAdi(e.target.value)}
              placeholder="Programda bu adla görünür"
            />
          </div>

          {uyarilar && (
            <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3">
              <div className="flex items-start gap-2 text-amber-700 dark:text-amber-400 text-xs">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{uyarilar}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSubmit} disabled={loading} className="flex-1">
            {loading ? "Ekleniyor..." : "Ekle"}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Vazgeç
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
