import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { parseLocalDate } from "@/lib/lessonTypes";
import type { BakiyeDersi, BakiyeDokumu } from "@/hooks/useBakiyeDokumu";

/** Haftalık programdaki adlandırmayla aynı: deneme, adın yanında söylenir. */
function dersAdi(ders: BakiyeDersi): string {
  if (ders.tur === "deneme") return ders.ad ? `${ders.ad} (deneme)` : "Deneme dersi";
  return ders.ad ?? "Silinmiş öğrenci";
}

/**
 * Bakiyedeki dersler — öğretmenin "Bakiyem" diyaloğu ile adminin ödemeler
 * sekmesinde aynı liste. En yeni en üstte; soldaki sayı, dersin bu dönemde
 * bakiyeye yazılan kaçıncı ders olduğu. Ödeme kapatılınca liste boşalır.
 */
export function BakiyeDersleri({ dokum }: { dokum: BakiyeDokumu | null }) {
  return (
    <section className="flex flex-col gap-2.5" aria-label="Bakiyedeki dersler">
      <h3 className="pnl-divider__label pt-2">Bakiyedeki dersler</h3>

      {!dokum ? (
        <div className="h-[38px] animate-pulse rounded-[14px]" style={{ background: "var(--ewd-lilac-tint)" }} />
      ) : dokum.dersler.length === 0 && dokum.devir === 0 ? (
        <p className="pnl-ledger__note">Bu dönemde işlenen ders yok.</p>
      ) : (
        <>
          {dokum.dersler.length > 0 && (
            <ul className="pnl-ledger">
              {dokum.dersler.map((ders) => (
                <li key={ders.id} className="pnl-ledger__row" data-eksi={ders.sira === null}>
                  <span className="pnl-ledger__no">{ders.sira ?? "−"}</span>
                  <span className="pnl-ledger__name">
                    {dersAdi(ders)}
                    {ders.sira === null && (
                      <span style={{ color: "var(--ewd-pink-ink)" }}> · geri alındı</span>
                    )}
                  </span>
                  <span className="pnl-ledger__when">
                    {format(parseLocalDate(ders.tarih), "EEE d MMM", { locale: tr })}
                    {ders.bas && ` · ${ders.bas}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {/* Defter düzenine geçişte sayı olarak devralınan dersler; satırları yok. */}
          {dokum.devir > 0 && (
            <p className="pnl-ledger__note">İlk {dokum.devir} ders önceki kayıtlardan devir.</p>
          )}
        </>
      )}
    </section>
  );
}
