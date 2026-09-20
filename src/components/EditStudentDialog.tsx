import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Trash2, Archive, AlertTriangle, AlignLeft, CalendarOff } from "lucide-react";
import { formatTime } from "@/lib/lessonTypes";
import { DAYS_OF_WEEK } from "@/lib/types";
import type { StudentLessonBase } from "@/lib/types";
import { useEditStudentDialog } from "@/hooks/useEditStudentDialog";
import { CompactDateField } from "@/components/panel/CompactDateField";

interface EditStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStudentUpdated: () => void;
  studentId: string;
  currentName: string;
  currentLessons: StudentLessonBase[];
}

const daysOfWeek = DAYS_OF_WEEK;

export function EditStudentDialog(props: EditStudentDialogProps) {
  const {
    name, setName,
    lessonsPerWeek, lessons,
    lessonDates,
    loading, shifting, showConfirm, setShowConfirm,
    showResetConfirm, setShowResetConfirm,
    updateRemainingDays, setUpdateRemainingDays,
    conflicts, warnings, pendingDateChanges, completedCount, totalLessons,
    sortedLessonsForDisplay, hasRealignableInstances,
    handleLessonsPerWeekChange, updateLesson, updateLessonDate,
    handleDateSubmit, handleMarkLastLesson, handleUndoLastLesson,
    handleResetAllLessons, confirmDateUpdate, handleSubmit,
    handleDeleteStudent, handleArchiveStudent,
    handleRealignChain, handleAraVer,
  } = useEditStudentDialog(props);

  // "Ara ver" tarih aralığı — yalnızca bu diyalog için yerel.
  const [araBaslangic, setAraBaslangic] = useState("");
  const [araBitis, setAraBitis] = useState("");
  const [araVerAcik, setAraVerAcik] = useState(false);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Öğrenci Ayarları</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Öğrenci Adı</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ad Soyad"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lessonsPerWeek">Haftalık Ders Sayısı</Label>
            <Select
              value={lessonsPerWeek.toString()}
              onValueChange={(value) => handleLessonsPerWeekChange(Number(value))}
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
              <div key={index} className="grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-3 p-3 border rounded-lg">
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
                <div className="space-y-2">
                  <Label>Not</Label>
                  <Input
                    type="text"
                    value={lesson.note || ""}
                    onChange={(e) => updateLesson(index, "note", e.target.value)}
                    placeholder="Opsiyonel"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Conflict warnings */}
          {warnings.length > 0 && (
            <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 space-y-1.5">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Yapıldı — bu saatlerde başka ders de var
              </div>
              {warnings.map((u, i) => (
                <div key={i} className="text-xs text-amber-700/80 dark:text-amber-400/80">
                  {u.date.slice(8, 10)}.{u.date.slice(5, 7)} · {u.time} · {u.student}
                </div>
              ))}
            </div>
          )}

          {conflicts.length > 0 && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 space-y-1.5">
              <div className="flex items-center gap-2 text-destructive font-medium text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                İşlem tamamlanamadı
              </div>
              {conflicts.map((c, i) => (
                <div key={i} className="text-xs text-destructive/80">
                  {c.message}
                </div>
              ))}
            </div>
          )}

          <Separator className="my-4" />

          {/* İşlenen Dersler */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Label className="text-base font-medium">İşlenen Dersler</Label>
                {hasRealignableInstances && (
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => setAraVerAcik(true)}
                      disabled={loading || shifting}
                      title="Seçilen tarih aralığını boşalt, dersleri ileri kaydır"
                    >
                      <CalendarOff className="h-3.5 w-3.5" />
                      Ara ver
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={handleRealignChain}
                      disabled={loading || shifting}
                      title="Dağılmış paketi haftalık programa göre yeniden diz"
                    >
                      <AlignLeft className="h-3.5 w-3.5" />
                      Programa göre diz
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {completedCount < totalLessons && (
                  <Button type="button" variant="default" size="sm" onClick={handleMarkLastLesson} disabled={loading || shifting}>
                    Son Dersi İşaretle
                  </Button>
                )}
                {completedCount > 0 && (
                  <>
                    <Button type="button" variant="outline" size="sm" onClick={handleUndoLastLesson} disabled={loading || shifting}>
                      Son Dersi Geri Al
                    </Button>
                    <Button type="button" variant="destructive" size="sm" onClick={() => setShowResetConfirm(true)} disabled={loading || shifting}>
                      Sıfırla
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div className="space-y-2">
              {sortedLessonsForDisplay.map((lesson) => (
                /* Tek satır. Eskiden telefonda iki satıra bölünüyordu ve
                   satırın yarısı etiketti: "Ders 3" (numara zaten sırayı
                   söylüyor), "Tarih:" (yanındaki şeyin tarih olduğu belli) ve
                   yıl dahil tam tarih (hepsi aynı yıl). */
                <div
                  key={lesson.instanceId || `placeholder-${lesson.displayIndex}`}
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${lesson.isOverridden ? "border-amber-500" : ""}`}
                >
                  <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${lesson.isCompleted ? "bg-primary" : "bg-muted"}`} />
                  <span
                    className={`w-5 shrink-0 text-[13px] font-semibold tabular-nums ${lesson.isCompleted ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {lesson.displayIndex}
                  </span>
                  {lesson.startTime && lesson.endTime && (
                    <span className="min-w-0 flex-1 truncate text-xs tabular-nums text-muted-foreground">
                      {formatTime(lesson.startTime)}–{formatTime(lesson.endTime)}
                    </span>
                  )}
                  {!(lesson.startTime && lesson.endTime) && <span className="flex-1" />}
                  <CompactDateField
                    value={lesson.instanceId ? lessonDates[lesson.instanceId] ?? lesson.effectiveDate : ""}
                    onChange={(next) => lesson.instanceId && updateLessonDate(lesson.instanceId, next)}
                    disabled={!lesson.instanceId}
                    highlighted={lesson.isOverridden}
                    title={lesson.instanceId ? undefined : "Bu ders henüz programa eklenmedi"}
                  />
                </div>
              ))}
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox
                  id="cascade-remaining"
                  checked={updateRemainingDays}
                  onCheckedChange={(v) => setUpdateRemainingDays(v === true)}
                />
                Değişiklikten sonraki dersler de kaysın
              </label>
              {pendingDateChanges > 0 && (
                <p className="text-xs text-muted-foreground">
                  {pendingDateChanges} ders değişecek
                  {updateRemainingDays ? ", sonrakiler de kayacak" : ""}.
                </p>
              )}
              <Button
                type="button"
                variant="default"
                onClick={handleDateSubmit}
                disabled={loading || pendingDateChanges === 0}
                className="w-full"
              >
                Tarihleri Onayla
              </Button>
            </div>
          </div>

          <Separator className="my-4" />

          {/* Tehlikeli Alan */}
          <div className="space-y-3 pt-2">
            <Label className="text-sm font-semibold text-destructive">Tehlikeli Alan</Label>
            {/* Telefonda alt alta iniyordu; iki kısa düğme bir satıra sığar. */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const confirmed = window.confirm(
                    `${props.currentName} adlı öğrenciyi arşivlemek istediğinize emin misiniz? Öğrenci ders programından ve listeden kaldırılacak, ancak tüm verileri korunacaktır. İstediğiniz zaman geri alabilirsiniz.`
                  );
                  if (confirmed) handleArchiveStudent();
                }}
                size="sm"
                className="flex items-center gap-2"
              >
                <Archive className="h-4 w-4" />
                Arşivle
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  const confirmed = window.confirm(
                    `${props.currentName} adlı öğrenciyi kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz ve tüm verileri silinecektir.`
                  );
                  if (confirmed) handleDeleteStudent();
                }}
                size="sm"
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Kalıcı Sil
              </Button>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={loading || conflicts.length > 0}
              className="flex-1"
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Kaydet
            </Button>
            <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)} disabled={loading}>
              İptal
            </Button>
          </div>
        </form>

        {/* Ara ver (tatil) — tarih aralığı */}
        <AlertDialog open={araVerAcik} onOpenChange={setAraVerAcik}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Ara ver</AlertDialogTitle>
              <AlertDialogDescription>
                Seçtiğiniz aralık boşalır. Aralıktaki ve sonrasındaki planlı dersler, sırası
                bozulmadan aralığın bitiminden itibaren ilk uygun saatlere kayar. Ders hakkı
                değişmez, paket yalnızca uzar.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="ara-baslangic" className="text-sm">Başlangıç</Label>
                <Input
                  id="ara-baslangic"
                  type="date"
                  value={araBaslangic}
                  onChange={(e) => setAraBaslangic(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ara-bitis" className="text-sm">Bitiş (dâhil)</Label>
                <Input
                  id="ara-bitis"
                  type="date"
                  value={araBitis}
                  onChange={(e) => setAraBitis(e.target.value)}
                />
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Vazgeç</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  await handleAraVer(araBaslangic, araBitis);
                  setAraVerAcik(false);
                  setAraBaslangic("");
                  setAraBitis("");
                }}
                disabled={!araBaslangic || !araBitis || shifting}
              >
                Ara ver
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Tarih onaylama dialogu */}
        <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Ders Tarihlerini Güncelle</AlertDialogTitle>
              <AlertDialogDescription>Ders tarihlerini güncellemek istediğinize emin misiniz?</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex items-center space-x-2 py-4">
              <Checkbox
                id="updateRemaining"
                checked={updateRemainingDays}
                onCheckedChange={(checked) => setUpdateRemainingDays(!!checked)}
              />
              <label htmlFor="updateRemaining" className="text-sm font-medium leading-none">
                Kalan günleri de güncelle
              </label>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>İptal</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDateUpdate}>Onayla</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Sıfırlama onaylama dialogu */}
        <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Tüm Dersleri Sıfırla</AlertDialogTitle>
              <AlertDialogDescription>
                Tüm işlenen dersleri ve tarihleri sıfırlamak istediğinize emin misiniz? Bu işlem öğretmen bakiyesini etkilemez.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>İptal</AlertDialogCancel>
              <AlertDialogAction onClick={handleResetAllLessons}>Sıfırla</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
