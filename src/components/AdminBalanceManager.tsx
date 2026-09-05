import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { supabase } from "@/integrations/supabase/client";
import { Clock, CheckCircle2, Calendar, Plus, Minus, RotateCcw, Receipt, FileText, Wallet, Settings2 } from "lucide-react";
import { toast, hataGoster } from "@/lib/notify";
import { manualBalanceAdjust } from "@/lib/lessonService";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { useTeacherPay, invalidateTeacherPay } from "@/hooks/useTeacherPay";
import { feeForMinutes, feeForPayment, formatMoney, ratePerMinute, saveTeacherPay, type TeacherPay } from "@/lib/teacherPay";
import { useAuth } from "@/hooks/useAuth";
import { branchLabel, type Branch } from "@/lib/branch";

interface AdminBalanceManagerProps {
  teacherId: string;
  /** Öğretmenin dil şubesi — ücret ayarı şube başına tutuluyor. */
  branch: Branch;
  /** Aktif öğrenci sayısı — ay sonu raporu adedi bununla ön dolduruluyor. */
  activeStudentCount?: number;
}

interface BalanceData {
  total_minutes: number;
  completed_regular_lessons: number;
  completed_trial_lessons: number;
  regular_lessons_minutes: number;
  trial_lessons_minutes: number;
}

interface PaymentHistory {
  id: string;
  amount_minutes: number;
  rate_per_minute: number | null;
  completed_regular_lessons: number;
  completed_trial_lessons: number;
  payment_date: string;
  notes: string | null;
}

export function AdminBalanceManager({ teacherId, branch, activeStudentCount = 0 }: AdminBalanceManagerProps) {
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [minutesToAdd, setMinutesToAdd] = useState("");
  const [minutesToSubtract, setMinutesToSubtract] = useState("");
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  /**
   * Para hareketi yapan tek bir işlem aynı anda yürüsün.
   *
   * Denetimde çıkan asıl açık buydu: "Ekle" ve "Çıkar" düğmeleri tıklandıktan
   * sonra ekranda kalıyordu ve `disabled` yoktu; arka arkaya iki tık bakiyeye
   * iki kez yazıyordu. Tek bir kilit hepsini kapsıyor — bir işlem sürerken
   * diğer para düğmeleri de pasif, çünkü hepsi aynı bakiyeyi okuyup yazıyor.
   */
  const [busy, setBusy] = useState<null | "add" | "sub" | "reset" | "delete">(null);

  const { profile } = useAuth();
  const pay = useTeacherPay(branch);
  const [reportCount, setReportCount] = useState("");
  const [rateForm, setRateForm] = useState<TeacherPay | null>(null);
  const [savingRate, setSavingRate] = useState(false);

  /** Bakiyedeki dakikanın para karşılığı. */
  const money = (minutes: number) => formatMoney(feeForMinutes(minutes, pay), pay);

  /**
   * Ay sonu raporları. Her öğretmen her öğrencisi için bir rapor çıkarıyor;
   * rapor başına `reportMinutes` dakika bakiyeye ekleniyor, böylece rapor da
   * ders dakikasıyla aynı orandan ücretleniyor.
   */
  const handleAddReports = async () => {
    if (busy) return;
    const count = parseInt(reportCount || String(activeStudentCount), 10);
    if (isNaN(count) || count <= 0) {
      toast.error("Geçerli bir rapor sayısı girin");
      return;
    }
    const minutes = count * pay.reportMinutes;
    if (minutes <= 0) {
      toast.error("Rapor başına dakika 0 olarak tanımlı");
      return;
    }
    setBusy("add");
    try {
      const result = await manualBalanceAdjust(teacherId, minutes, `Ay sonu raporu x${count}`);
      if (!result.success) {
        toast.error(result.error || "Rapor eklenirken hata oluştu");
        return;
      }
      toast.success(`${count} rapor eklendi (+${minutes} dk · ${money(minutes)})`);
      setReportCount("");
      await fetchBalance();
    } catch (error) {
      hataGoster(error, "Rapor eklenirken hata oluştu");
    } finally {
      setBusy(null);
    }
  };

  const handleSaveRate = async () => {
    if (!rateForm) return;
    setSavingRate(true);
    try {
      const { error } = await saveTeacherPay(rateForm, profile?.user_id, branch);
      if (error) {
        toast.error(error);
        return;
      }
      invalidateTeacherPay(branch);
      toast.success(`Ücret ayarı güncellendi. ${branchLabel(branch)} şubesindeki tüm öğretmenler için geçerli.`);
      setRateForm(null);
    } finally {
      setSavingRate(false);
    }
  };

  useEffect(() => {
    fetchBalance();
    fetchPaymentHistory();
  }, [teacherId]);

  const fetchBalance = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("teacher_balance")
        .select(
          "total_minutes, completed_regular_lessons, completed_trial_lessons, regular_lessons_minutes, trial_lessons_minutes",
        )
        .eq("teacher_id", teacherId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setBalance(data);
      } else {
        setBalance({
          total_minutes: 0,
          completed_regular_lessons: 0,
          completed_trial_lessons: 0,
          regular_lessons_minutes: 0,
          trial_lessons_minutes: 0,
        });
      }
    } catch (error) {
      hataGoster(error, "Bakiye bilgisi yüklenirken hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("payment_history")
        .select(
          "id, amount_minutes, rate_per_minute, completed_regular_lessons, completed_trial_lessons, payment_date, notes",
        )
        .eq("teacher_id", teacherId)
        .order("payment_date", { ascending: false });

      if (error) throw error;

      setPaymentHistory(data || []);
    } catch (error) {
      hataGoster(error, "Ödeme geçmişi yüklenemedi");
    }
  };

  const handleAddMinutes = async () => {
    if (busy) return;
    const minutes = parseInt(minutesToAdd);
    if (isNaN(minutes) || minutes <= 0) {
      toast.error("Geçerli bir dakika değeri girin");
      return;
    }

    setBusy("add");
    try {
      const result = await manualBalanceAdjust(teacherId, minutes, "Manuel dakika ekleme");
      if (!result.success) {
        toast.error(result.error || "Dakika eklenirken hata oluştu");
        return;
      }

      toast.success(`${minutes} dakika eklendi`);
      setMinutesToAdd("");
      await fetchBalance();
    } catch (error) {
      hataGoster(error, "Dakika eklenirken hata oluştu");
    } finally {
      setBusy(null);
    }
  };

  const handleSubtractMinutes = async () => {
    if (busy) return;
    const minutes = parseInt(minutesToSubtract);
    if (isNaN(minutes) || minutes <= 0) {
      toast.error("Geçerli bir dakika değeri girin");
      return;
    }

    // Bu yalnızca erken uyarı. Asıl yeterlilik kontrolü
    // `rpc_manual_balance_adjust` içinde; buradaki `balance` bir önceki
    // fetch'ten kalma olabilir ve hızlı iki tıkta güncel değeri göstermez.
    if (!balance || balance.total_minutes < minutes) {
      toast.error("Bakiyede yeterli dakika yok");
      return;
    }

    setBusy("sub");
    try {
      const result = await manualBalanceAdjust(teacherId, -minutes, "Manuel dakika çıkarma");
      if (!result.success) {
        toast.error(result.error || "Dakika çıkarılırken hata oluştu");
        return;
      }

      toast.success(`${minutes} dakika çıkarıldı`);
      setMinutesToSubtract("");
      await fetchBalance();
    } catch (error) {
      hataGoster(error, "Dakika çıkarılırken hata oluştu");
    } finally {
      setBusy(null);
    }
  };

  /**
   * Bakiyeyi kapat ve ödemeyi geçmişe yaz.
   *
   * Eskiden bu iki adım istemcide ayrı sorgulardı: önce payment_history
   * INSERT, sonra teacher_balance UPDATE. Aradaki bir hata "ödendi" kaydı
   * bırakıp bakiyeyi olduğu gibi bırakıyordu. Artık tek RPC; içinde
   * `SELECT ... FOR UPDATE` var, yani çift tıkta ikinci çağrı birincinin
   * bitmesini bekliyor ve bakiye sıfırlandığı için ikinci kayıt düşmüyor.
   */
  const handleResetBalance = async () => {
    if (busy) return;
    setBusy("reset");
    try {
      const { data, error } = await supabase.rpc("rpc_close_teacher_payout", {
        p_teacher_id: teacherId,
        // Oran satırla birlikte donuyor: ücret sonradan değişse de bu
        // ödemenin tutarı olduğu gibi kalır.
        p_rate: ratePerMinute(pay),
      });
      if (error) throw error;

      const sonuc = (data ?? {}) as { success?: boolean; error?: string; paid_minutes?: number };
      if (!sonuc.success) {
        toast.error(sonuc.error || "Bakiye sıfırlanırken hata oluştu");
        return;
      }

      toast.success(
        sonuc.paid_minutes
          ? `Bakiye sıfırlandı, ${sonuc.paid_minutes} dk ödeme kaydedildi`
          : "Bakiye zaten sıfırdı",
      );
      setShowResetDialog(false);
      await Promise.all([fetchBalance(), fetchPaymentHistory()]);
    } catch (error) {
      hataGoster(error, "Bakiye sıfırlanırken hata oluştu");
    } finally {
      setBusy(null);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (busy) return;
    setBusy("delete");
    try {
      const { error } = await supabase
        .from("payment_history")
        .delete()
        .eq("id", paymentId);

      if (error) throw error;

      toast.success("Ödeme kaydı silindi");
      await fetchPaymentHistory();
    } catch (error) {
      hataGoster(error, "Ödeme kaydı silinirken hata oluştu");
    } finally {
      setBusy(null);
    }
  };

  const formatMinutes = (minutes: number) => {
    return `${minutes} dakika`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Balance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-1">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Wallet className="h-5 w-5 text-primary" />
                <p className="text-sm font-medium text-muted-foreground">Ödenecek Tutar</p>
              </div>
              <p className="text-xl sm:text-3xl font-bold text-primary">{money(balance?.total_minutes || 0)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatMinutes(balance?.total_minutes || 0)} · {pay.lessonMinutes} dk = {formatMoney(pay.lessonFee, pay, true)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <CheckCircle2 className="h-5 w-5 text-blue-500" />
                <p className="text-sm font-medium text-muted-foreground">Normal Dersler</p>
              </div>
              <p className="text-lg sm:text-3xl font-bold">{balance?.completed_regular_lessons || 0} ders</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatMinutes(balance?.regular_lessons_minutes || 0)} · {money(balance?.regular_lessons_minutes || 0)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Calendar className="h-5 w-5 text-purple-500" />
                <p className="text-sm font-medium text-muted-foreground">Deneme Dersleri</p>
              </div>
              <p className="text-lg sm:text-3xl font-bold">{balance?.completed_trial_lessons || 0} ders</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatMinutes(balance?.trial_lessons_minutes || 0)} · {money(balance?.trial_lessons_minutes || 0)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Balance Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Bakiye Yönetimi</CardTitle>
          <CardDescription>Öğretmen bakiyesine dakika ekleyin veya çıkarın</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Ay sonu raporları */}
          <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <Label htmlFor="report-count" className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Ay Sonu Raporu
            </Label>
            <p className="text-xs text-muted-foreground">
              Her öğrenci raporu bakiyeye {pay.reportMinutes} dk ekler
              {activeStudentCount > 0 && ` · bu öğretmenin ${activeStudentCount} aktif öğrencisi var`}.
            </p>
            <div className="flex gap-2">
              <Input
                id="report-count"
                type="number"
                min="1"
                placeholder={activeStudentCount > 0 ? String(activeStudentCount) : "Rapor sayısı"}
                value={reportCount}
                onChange={(e) => setReportCount(e.target.value)}
              />
              <Button onClick={handleAddReports} disabled={busy !== null} className="whitespace-nowrap">
                <Plus className="h-4 w-4 mr-2" />
                Rapor Ekle
              </Button>
            </div>
            {(() => {
              const count = parseInt(reportCount || String(activeStudentCount), 10);
              if (isNaN(count) || count <= 0) return null;
              const minutes = count * pay.reportMinutes;
              return (
                <p className="text-xs font-medium text-primary">
                  {count} rapor = +{minutes} dk = {money(minutes)}
                </p>
              );
            })()}
          </div>

          {/* Add Minutes */}
          <div className="space-y-2">
            <Label htmlFor="add-minutes">Dakika Ekle</Label>
            <div className="flex gap-2">
              <Input
                id="add-minutes"
                type="number"
                placeholder="Eklenecek dakika"
                value={minutesToAdd}
                onChange={(e) => setMinutesToAdd(e.target.value)}
                min="1"
              />
              <Button onClick={handleAddMinutes} disabled={busy !== null} className="whitespace-nowrap">
                <Plus className="h-4 w-4 mr-2" />
                Ekle
              </Button>
            </div>
            {parseInt(minutesToAdd, 10) > 0 && (
              <p className="text-xs text-muted-foreground">
                Karşılığı: {money(parseInt(minutesToAdd, 10))}
              </p>
            )}
          </div>

          {/* Subtract Minutes */}
          <div className="space-y-2">
            <Label htmlFor="subtract-minutes">Dakika Çıkar</Label>
            <div className="flex gap-2">
              <Input
                id="subtract-minutes"
                type="number"
                placeholder="Çıkarılacak dakika"
                value={minutesToSubtract}
                onChange={(e) => setMinutesToSubtract(e.target.value)}
                min="1"
              />
              <Button onClick={handleSubtractMinutes} disabled={busy !== null} variant="secondary" className="whitespace-nowrap">
                <Minus className="h-4 w-4 mr-2" />
                Çıkar
              </Button>
            </div>
            {parseInt(minutesToSubtract, 10) > 0 && (
              <p className="text-xs text-muted-foreground">
                Karşılığı: {money(parseInt(minutesToSubtract, 10))}
              </p>
            )}
          </div>

          {/* Reset Balance */}
          <div className="pt-4 border-t">
            <Button onClick={() => setShowResetDialog(true)} variant="destructive" className="w-full">
              <RotateCcw className="h-4 w-4 mr-2" />
              Bakiyeyi Sıfırla
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Öğretmen ödeme yaptıktan sonra bakiyeyi sıfırlayın
            </p>
          </div>

          {/* Ücret ayarı — şube başına */}
          <div className="pt-4 border-t space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  Ücret Ayarı · {branchLabel(branch)}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {pay.lessonMinutes} dk = {formatMoney(pay.lessonFee, pay, true)} ·
                  {" "}dakika başı {formatMoney(ratePerMinute(pay), pay)} · rapor {pay.reportMinutes} dk
                  {" "}— {branchLabel(branch)} şubesindeki tüm öğretmenler için geçerli
                </p>
              </div>
              {rateForm === null && (
                <Button variant="outline" size="sm" onClick={() => setRateForm(pay)} className="shrink-0">
                  Düzenle
                </Button>
              )}
            </div>

            {rateForm !== null && (
              <div className="space-y-3 rounded-lg border p-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="rate-minutes" className="text-xs">Ders süresi (dk)</Label>
                    <Input
                      id="rate-minutes"
                      type="number"
                      min="1"
                      value={rateForm.lessonMinutes}
                      onChange={(e) => setRateForm({ ...rateForm, lessonMinutes: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rate-fee" className="text-xs">Ders ücreti (₺)</Label>
                    <Input
                      id="rate-fee"
                      type="number"
                      min="0"
                      value={rateForm.lessonFee}
                      onChange={(e) => setRateForm({ ...rateForm, lessonFee: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rate-report" className="text-xs">Rapor başına (dk)</Label>
                    <Input
                      id="rate-report"
                      type="number"
                      min="0"
                      value={rateForm.reportMinutes}
                      onChange={(e) => setRateForm({ ...rateForm, reportMinutes: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Dakika başı {formatMoney(ratePerMinute(rateForm), rateForm)} · kayıtlı ödemeler
                  kendi anındaki orandan hesaplanmaya devam eder.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveRate} disabled={savingRate || !rateForm.lessonMinutes}>
                    Kaydet
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setRateForm(null)} disabled={savingRate}>
                    İptal
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Ödeme Geçmişi
          </CardTitle>
          <CardDescription>Geçmiş ödeme kayıtları</CardDescription>
        </CardHeader>
        <CardContent>
          {paymentHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Henüz ödeme kaydı yok</p>
          ) : (
            <div className="space-y-3">
              {paymentHistory.map((payment) => (
                <Card key={payment.id} className="border-l-4 border-l-primary">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-primary" />
                          <p className="font-semibold text-lg">
                            {formatMoney(feeForPayment(payment.amount_minutes, payment.rate_per_minute, pay), pay)}
                          </p>
                          <span className="text-xs text-muted-foreground">({formatMinutes(payment.amount_minutes)})</span>
                        </div>
                        <div className="flex gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-blue-500" />
                            {payment.completed_regular_lessons} ders
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-purple-500" />
                            {payment.completed_trial_lessons} ders
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {format(new Date(payment.payment_date), "dd MMMM yyyy", { locale: tr })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(payment.payment_date), "HH:mm", { locale: tr })}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePayment(payment.id)}
                          className="text-destructive hover:text-destructive h-8"
                        >
                          Sil
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bakiyeyi Sıfırla</AlertDialogTitle>
            <AlertDialogDescription>
              Bu işlem öğretmenin tüm bakiyesini ({formatMinutes(balance?.total_minutes || 0)} ·{" "}
              {money(balance?.total_minutes || 0)}) sıfırlayacak ve mevcut bakiye ödeme geçmişine
              kaydedilecek. Devam etmek istediğinize emin misiniz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetBalance} disabled={busy !== null} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sıfırla ve Kaydet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
