import { Link } from "react-router-dom";
import { BookOpen, ExternalLink, Globe, PenSquare } from "lucide-react";

interface SiteScreenProps {
  onOpenSiteManager: () => void;
  onOpenBlogManager: () => void;
  onOpenGlobalTopics: () => void;
}

interface TileProps {
  title: string;
  text: string;
  icon: React.ReactNode;
  accent: string;
  wash: string;
  onClick?: () => void;
  to?: string;
}

function Tile({ title, text, icon, accent, wash, onClick, to }: TileProps) {
  const inner = (
    <>
      <span
        className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl"
        style={{ background: wash, color: accent }}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1 text-left">
        <span className="text-[17px] font-extrabold" style={{ color: "var(--ewd-on-surface)" }}>
          {title}
        </span>
        <span className="text-[13px] font-medium" style={{ color: "var(--ewd-on-surface-soft)" }}>
          {text}
        </span>
      </span>
    </>
  );

  const className = "pnl-card flex w-full items-center gap-4 p-5 text-left transition-colors";

  if (to) {
    return (
      <Link to={to} className={className}>
        {inner}
        <ExternalLink className="h-4 w-4 shrink-0" style={{ color: "var(--ewd-muted-3)" }} aria-hidden="true" />
      </Link>
    );
  }

  return (
    <button type="button" className={className} onClick={onClick}>
      {inner}
    </button>
  );
}

/**
 * Site & içerik sekmesi.
 * Eskiden bu üç araç header'daki küçük ikon butonlarının arkasındaydı;
 * mobilde ne olduğu anlaşılmıyordu. Artık ne yaptığını yazan kartlar.
 */
export function SiteScreen({ onOpenSiteManager, onOpenBlogManager, onOpenGlobalTopics }: SiteScreenProps) {
  return (
    <div className="flex flex-col gap-3 py-5">
      <p className="text-[13px] font-medium" style={{ color: "var(--ewd-on-surface-soft)" }}>
        Site ve blog içeriği iki dil şubesi için ortaktır; global konular ise açık olan şubeye aittir.
      </p>
      <Tile
        title="Site içeriği"
        text="Ana sayfanın metinleri, dersten kareler ve veli yorumları."
        icon={<Globe className="h-6 w-6" />}
        accent="var(--ewd-purple)"
        wash="var(--ewd-lilac-tint)"
        onClick={onOpenSiteManager}
      />
      <Tile
        title="Blog yazıları"
        text="Yeni yazı ekleyin, mevcut yazıları düzenleyin veya yayından kaldırın."
        icon={<PenSquare className="h-6 w-6" />}
        accent="var(--ewd-pink-base)"
        wash="var(--ewd-pink-tint)"
        onClick={onOpenBlogManager}
      />
      <Tile
        title="Global konular"
        text="Her öğrenciye atanabilen ortak konu ve kaynak havuzu."
        icon={<BookOpen className="h-6 w-6" />}
        accent="var(--ewd-yellow-ink-2)"
        wash="var(--ewd-yellow-pale)"
        onClick={onOpenGlobalTopics}
      />
      <Tile
        title="Site rehberi"
        text="Sayfanın bölüm bölüm nerede neyi düzenlediğinizi anlatan kılavuz."
        icon={<ExternalLink className="h-6 w-6" />}
        accent="var(--ewd-purple-deep)"
        wash="var(--ewd-lilac-tint)"
        to="/site-rehberi"
      />
    </div>
  );
}
