import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus } from "lucide-react";
import { edgeCagir, EPOSTA_BICIMI } from "@/lib/edgeFonksiyon";
import type { StudentLessonBase } from "@/lib/types";
import { DAYS_OF_WEEK } from "@/lib/types";

const daysOfWeek = DAYS_OF_WEEK;

interface CreateStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStudentCreated: () => void;
  teacherId: string;
}

export function CreateStudentDialog({ open, onOpenChange, onStudentCreated, teacherId }: CreateStudentDialogProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [lessonsPerWeek, setLessonsPerWeek] = useState(1);
  const [lessons, setLessons] = useState<StudentLessonBase[]>([{ dayOfWeek: 1, startTime: "", endTime: "" }]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (lessonsPerWeek > lessons.length) {
      const newLessons = [...lessons];
      for (let i = lessons.length; i < lessonsPerWeek; i++) {
        newLessons.push({ dayOfWeek: 1, startTime: "", endTime: "" });
      }
      setLessons(newLessons);
    } else if (lessonsPerWeek < lessons.length) {
      setLessons(lessons.slice(0, lessonsPerWeek));
    }
  }, [lessonsPerWeek]);

  const updateLesson = (index: number, field: keyof StudentLessonBase, value: string | number) => {
    const updatedLessons = [...lessons];
    updatedLessons[index] = { ...updatedLessons[index], [field]: value };
    setLessons(updatedLessons);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Sunucuya gitmeden yakalanabilecek her şey burada yakalanıyor. Eskiden
    // şifre uzunluğu hiç denetlenmiyordu; 5 haneli bir şifre Supabase'e kadar
    // gidip anlaşılmaz bir hatayla dönüyordu.
    const eksik = (mesaj: string): void => {
      toast({ title: "Eksik ya da hatalı bilgi", description: mesaj, variant: "destructive" });
    };

    if (!name.trim()) return eksik("Öğrenci adını girin.");
    if (!EPOSTA_BICIMI.test(email.trim())) return eksik("E-posta adresi geçersiz.");
    if (tempPassword.length < 6) return eksik("Şifre en az 6 karakter olmalı. \"Oluştur\" düğmesiyle güvenli bir şifre üretebilirsiniz.");
    if (!lessons.every((l) => l.dayOfWeek !== undefined && l.startTime && l.endTime)) {
      return eksik("Tüm ders saatlerini doldurun.");
    }
    if (lessons.some((l) => l.endTime <= l.startTime)) {
      return eksik("Bir ders saatinde bitiş, başlangıçtan sonra olmalı.");
    }
    const anahtarlar = lessons.map((l) => `${l.dayOfWeek}|${l.startTime}`);
    if (new Set(anahtarlar).size !== anahtarlar.length) {
      return eksik("Aynı gün ve saate iki ders girilmiş. Birini değiştirin.");
    }

    setLoading(true);

    try {
      const { veri, hata } = await edgeCagir<{ reused?: boolean }>("create-student", {
        email: email.trim(),
        name: name.trim(),
        password: tempPassword,
        teacherId,
        lessons: lessons.map((lesson) => ({
          day_of_week: lesson.dayOfWeek,
          start_time: lesson.startTime,
          end_time: lesson.endTime,
        })),
      });

      if (hata) {
        toast({ title: "Öğrenci oluşturulamadı", description: hata, variant: "destructive" });
        return;
      }

      toast({
        title: "Başarılı",
        description: veri?.reused
          ? `Bu e-postanın eski hesabı yeniden etkinleştirildi. Yeni şifre: ${tempPassword}`
          : `Öğrenci hesabı oluşturuldu. Geçici şifre: ${tempPassword}`,
      });

      setEmail("");
      setName("");
      setTempPassword("");
      setLessonsPerWeek(1);
      setLessons([{ dayOfWeek: 1, startTime: "", endTime: "" }]);
      onStudentCreated();
      onOpenChange(false);
    } catch {
      toast({
        title: "Öğrenci oluşturulamadı",
        description: "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generatePassword = () => {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let result = "";
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setTempPassword(result);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Öğrenci Hesabı Oluştur
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Öğrenci E-postası</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ogrenci@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Ad Soyad</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Öğrenci Adı"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Geçici Şifre</Label>
            <div className="flex gap-2">
              <Input
                id="password"
                type="text"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                placeholder="Şifre oluştur veya gir"
                required
              />
              <Button type="button" variant="outline" onClick={generatePassword} className="shrink-0">
                Oluştur
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lessonsPerWeek">Haftalık Ders Sayısı</Label>
            <Select
              value={lessonsPerWeek.toString()}
              onValueChange={(value) => setLessonsPerWeek(Number(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                  <SelectItem key={num} value={num.toString()}>
                    {num} ders
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label className="text-base font-medium">Ders Programı</Label>
            {lessons.map((lesson, index) => (
              <div key={index} className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 border rounded-lg">
                <div className="space-y-2">
                  <Label>Gün</Label>
                  <Select
                    value={lesson.dayOfWeek.toString()}
                    onValueChange={(value) => updateLesson(index, "dayOfWeek", Number(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {daysOfWeek.map((day) => (
                        <SelectItem key={day.value} value={day.value.toString()}>
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Başlangıç</Label>
                  <Input
                    type="time"
                    value={lesson.startTime}
                    onChange={(e) => updateLesson(index, "startTime", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Bitiş</Label>
                  <Input
                    type="time"
                    value={lesson.endTime}
                    onChange={(e) => updateLesson(index, "endTime", e.target.value)}
                    required
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Not:</strong> Öğrenci bu geçici şifre ile oluşturulacak. Lütfen bu bilgileri öğrenci ile güvenli
              şekilde paylaşın.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              İptal
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="transition-all duration-150 hover:scale-105 active:scale-95"
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Hesap Oluştur
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
