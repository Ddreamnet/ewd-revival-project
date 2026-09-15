/**
 * Bu işlev artık iş yapmıyor — bilerek.
 *
 * Eskiden her gece, tarihi geçmiş deneme derslerini siliyordu. Deneme dersi
 * ayrı bir tabloda yaşayan, geçmişi tutulmayan bir slottu; silinmesi bir şey
 * kaybettirmiyordu. Faz 5'te denemeler ders takvimine girdi (lesson_instances,
 * tur = 'deneme'): işlendi işaretleniyor, bakiye defterine satır yazıyor,
 * taşınıyor ve geri alınıyor. Artık geçmişi silmek, öğretmenin ödendiği
 * dersin takvim kaydını yok etmek demek.
 *
 * Zamanlaması da kaldırıldı (cron.job'da karşılığı yok). Kaynak burada
 * duruyor ki, bir yerden çağrılırsa sessizce silmek yerine niçin durduğunu
 * söylesin. Supabase panelinden tamamen kaldırılabilir.
 */
Deno.serve(() =>
  new Response(
    JSON.stringify({
      success: false,
      error: "gone",
      message:
        "Deneme dersleri artık ders takviminin kalıcı kayıtları (lesson_instances, tur = deneme). " +
        "Otomatik silme kaldırıldı; silme işi admin panelindeki ders kartından yapılır.",
    }),
    { status: 410, headers: { "Content-Type": "application/json" } },
  )
);
