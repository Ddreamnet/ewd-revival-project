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
import { Loader2, Trash2, Archive, AlertTriangle, ChevronLeft, ChevronRight, AlignLeft } from "lucide-react";
import { formatTime } from "@/lib/lessonTypes";
import { DAYS_OF_WEEK, TIME_OPTIONS } from "@/lib/types";
import type { StudentLessonBase } from "@/lib/types";
import { useEditStudentDialog } from "@/hooks/useEditStudentDialog";

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
    lessonDates, originalLessonDates,
    loading, shifting, showConfirm, setShowConfirm,
    showResetConfirm, setShowResetConfirm,
    updateRemainingDays, setUpdateRemainingDays,
    conflicts, completedCount, totalLessons,
    sortedLessonsForDisplay, canShiftBackward, hasRealignableInstances,
    handleLessonsPerWeekChange, updateLesson, updateLessonDate,
    handleDateSubmit, handleMarkLastLesson, handleUndoLastLesson,
    handleResetAllLessons, confirmDateUpdate, handleSubmit,
    handleDeleteStudent, handleArchiveStudent,
    handleRealignChain, handleShiftForward, handleShiftBackward,
  } = useEditStudentDialog(props);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
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
                  <Select
                    value={lesson.startTime}
                    onValueChange={(v) => updateLesson(index, "startTime", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seçin" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {TIME_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Bitiş</Label>
                  <Select
                    value={lesson.endTime}
                    onValueChange={(v) => updateLesson(index, "endTime", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seçin" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {TIME_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
          {conflicts.length > 0 && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 space-y-1.5">
              <div className="flex items-center gap-2 text-destructive font-medium text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Çakışma Tespit Edildi
              </div>
              {conflicts.map((c, i) => (
                <div key={i} className="text-xs text-destructive/80">
                  {c.studentName} — {c.date} {c.timeRange} ({c.type === "trial" ? "Deneme" : "Ders"})
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
                {/* Chain control arrows */}
                {hasRealignableInstances && (
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={handleShiftBackward}
                      disabled={loading || shifting || !canShiftBackward}
                      title="Zinciri 1 slot geri kaydır"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={handleShiftForward}
                      disabled={loading || shifting}
                      title="Zinciri 1 slot ileri kaydır"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={handleRealignChain}
                      disabled={loading || shifting}
                      title="Zinciri yeniden hizala"
                    >
                      <AlignLeft className="h-3.5 w-3.5" />
                      Hizala
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {completedCount < lessonsPerWeek * 4 && (
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
                <div
                  key={`${lesson.lessonNumber}-${lesson.instanceId || lesson.displayIndex}`}
                  className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 border rounded-lg ${lesson.isOverridden ? "border-amber-500" : ""}`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className={`h-4 w-4 rounded-full shrink-0 ${lesson.isCompleted ? "bg-primary" : "bg-muted"}`} />
                    <span className={`font-medium text-sm ${lesson.isCompleted ? "text-foreground" : "text-muted-foreground"}`}>
                      Ders {lesson.displayIndex}
                    </span>
                    {lesson.startTime && lesson.endTime && (
                      <span className="text-xs text-muted-foreground ml-1 shrink-0">
                        {formatTime(lesson.startTime)} - {formatTime(lesson.endTime)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Label className={`text-sm ${lesson.isOverridden ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
                      {lesson.isOverridden ? "Yeni:" : "Tarih:"}
                    </Label>
                    <Input
                      type="date"
                      value={lessonDates[lesson.lessonNumber.toString()] || lesson.effectiveDate || ""}
                      onChange={(e) => updateLessonDate(lesson.lessonNumber, e.target.value)}
                      className={`w-full sm:w-40 ${lesson.isOverridden ? "border-amber-500" : ""}`}
                    />
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="default"
                onClick={handleDateSubmit}
                disabled={loading || Object.keys(lessonDates).every((key) => lessonDates[key] === originalLessonDates[key])}
                className="w-full"
              >
                Tarihleri Onayla
              </Button>
            </div>
          </div>

          <Separator className="my-4" />

          {/* Tehlikeli Alan */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-medium text-destructive">Tehlikeli Alan</Label>
                <p className="text-sm text-muted-foreground">Öğrenciyi arşivleyin veya kalıcı olarak silin.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const confirmed = window.confirm(
                    `${props.currentName} adlı öğrenciyi arşivlemek istediğinize emin misiniz? Öğrenci ders programından ve listeden kaldırılacak, ancak tüm verileri korunacaktır. İstediğiniz zaman geri alabilirsiniz.`
                  );
                  if (confirmed) handleArchiveStudent();
                }}
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
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Kalıcı Sil
              </Button>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="flex gap-3">
            <Button type="submit" disabled={loading || conflicts.length > 0} className="flex-1">
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Kaydet
            </Button>
            <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)} disabled={loading}>
              İptal
            </Button>
          </div>
        </form>

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
