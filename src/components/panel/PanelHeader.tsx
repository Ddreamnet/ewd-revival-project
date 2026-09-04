import { ReactNode } from "react";
import { Link } from "react-router-dom";

interface PanelHeaderProps {
  /** Panelin adı — "Öğretmen Paneli", "Admin Paneli"… */
  title: string;
  /**
   * Başlığın yanındaki küçük durum etiketi.
   * Rol için kullanılmaz — "Öğretmen Paneli" zaten rolü söylüyor; yalnızca
   * değişen bir bilgi için (ör. adminde aktif dil şubesi).
   */
  badge?: string;
  /** İkinci satır, "Hoş geldin, {ad}". */
  subtitle?: string;
  /** Sağ üst köşe: bildirim, tema, çıkış. */
  actions?: ReactNode;
  /** Başlığın altındaki nav pill şeridi (masaüstü). */
  nav?: ReactNode;
  /** Logoya basınca gidilecek yer — varsayılan panelin kökü. */
  homeTo?: string;
}

/**
 * Panel başlığı.
 * Logo · başlık · karşılama, sağda eylemler, en altta nav
 * pill'leri. `position: sticky` + üst güvenli alan payı.
 * (Tasarımdaki 7px üç renkli marka şeridi kaldırıldı.)
 */
export function PanelHeader({ title, badge, subtitle, actions, nav, homeTo = "/dashboard" }: PanelHeaderProps) {
  return (
    <header className="pnl-head">
      <div className="pnl-wrap flex items-center justify-between gap-4 pt-3 md:pt-3.5">
        <div className="flex min-w-0 items-center gap-3 md:gap-4">
          <Link to={homeTo} aria-label="Panel ana ekranı" className="shrink-0">
            <img
              src="/uploads/logo.webp"
              alt=""
              width={46}
              height={46}
              className="block h-10 w-auto md:h-[46px]"
            />
          </Link>

          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex items-center gap-2.5">
              <h1 className="pnl-title truncate">{title}</h1>
              {badge && <span className="pnl-role hidden sm:inline-block">{badge}</span>}
            </div>
            {/* Mobilde gizli: dört ikon butonuyla birlikte başlığı 62px'e
                sıkıştırıp "Öğre…" yapıyordu. */}
            {subtitle && <p className="pnl-welcome hidden truncate sm:block">{subtitle}</p>}
          </div>
        </div>

        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>

      {nav && <div className="pnl-wrap pb-4 pt-3.5">{nav}</div>}
    </header>
  );
}
