import { ReactNode, memo, useCallback } from "react";
import { useNavigate } from "react-router-dom";

export interface PanelTab {
  key: string;
  /** Masaüstü nav pill etiketi. */
  label: string;
  /** Alt sekme çubuğu etiketi (kısası). */
  shortLabel?: string;
  /** Gidilecek yol. */
  to: string;
  /** `/ewd/assets/ic/` altındaki rozet. */
  icon?: string;
  /** Rozet yerine simge (bakiye ₺, ödev kutusu…). */
  glyph?: ReactNode;
  /** Simgenin zemin/metin rengi (inline style). */
  glyphStyle?: React.CSSProperties;
  /** Sağda gösterilen küçük sayı (bakiye). */
  amount?: string;
  /** Bekleyen iş sayacı — pembe rozet (ödev kutusu). */
  badge?: number;
  /** Sarı bakiye pill'i görünümü. */
  tone?: "pink" | "yellow";
}

interface NavPillsProps {
  tabs: PanelTab[];
  activeKey: string;
  /** Sekme üzerine gelince / dokununca ilgili parçayı önden indirir. */
  onPrefetch?: (key: string) => void;
}

/**
 * Masaüstü nav pill şeridi — landing'in nav dilinin panel karşılığı.
 * Gerçek `<button>`; klavye ile gezilebilir, odak halkası görünür.
 */
export const NavPills = memo(function NavPills({ tabs, activeKey, onPrefetch }: NavPillsProps) {
  const navigate = useNavigate();

  return (
    <nav className="pnl-nav" aria-label="Panel bölümleri">
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <button
            key={tab.key}
            type="button"
            className={tab.tone === "yellow" ? "pnl-pill pnl-pill--money" : "pnl-pill"}
            data-active={active}
            aria-current={active ? "page" : undefined}
            onClick={() => navigate(tab.to)}
            onMouseEnter={() => onPrefetch?.(tab.key)}
            onFocus={() => onPrefetch?.(tab.key)}
          >
            {tab.icon && (
              <span className="pnl-pill__icon" aria-hidden="true">
                <img src={tab.icon} alt="" width={32} height={32} />
              </span>
            )}
            {!tab.icon && tab.glyph && (
              <span className="pnl-pill__icon" style={tab.glyphStyle} aria-hidden="true">
                {tab.glyph}
              </span>
            )}
            {tab.label}
            {tab.amount && <span className="pnl-pill__amount">{tab.amount}</span>}
            {!!tab.badge && <span className="pnl-pill__badge">{tab.badge > 99 ? "99+" : tab.badge}</span>}
          </button>
        );
      })}
    </nav>
  );
});

interface BottomTabBarProps {
  tabs: PanelTab[];
  activeKey: string;
  onPrefetch?: (key: string) => void;
}

/**
 * Mobil alt sekme çubuğu — `position: fixed`, alt güvenli alan payı ile.
 * Her sekme ≥ 52px; ikon + etiket tek sütunda.
 */
export const BottomTabBar = memo(function BottomTabBar({
  tabs,
  activeKey,
  onPrefetch,
}: BottomTabBarProps) {
  const navigate = useNavigate();
  const go = useCallback((to: string) => navigate(to), [navigate]);

  return (
    <nav className="pnl-tabbar md:hidden" aria-label="Panel bölümleri">
      <div
        className="pnl-tabbar__grid"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((tab) => {
          const active = tab.key === activeKey;
          return (
            <button
              key={tab.key}
              type="button"
              className="pnl-tab"
              data-active={active}
              aria-current={active ? "page" : undefined}
              aria-label={
                tab.badge ? `${tab.shortLabel ?? tab.label} — ${tab.badge} yeni` : undefined
              }
              onClick={() => go(tab.to)}
              onTouchStart={() => onPrefetch?.(tab.key)}
            >
              <span className="pnl-tab__icon" style={tab.glyphStyle} aria-hidden="true">
                {tab.icon ? <img src={tab.icon} alt="" width={30} height={30} /> : tab.glyph}
              </span>
              {tab.shortLabel ?? tab.label}
              {!!tab.badge && (
                <span className="pnl-tab__badge" aria-hidden="true">
                  {tab.badge > 9 ? "9+" : tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
});
