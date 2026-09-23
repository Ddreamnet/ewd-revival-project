import { ReactNode } from "react";
import { MoreHorizontal, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "./PanelBits";

export interface PanelMenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  /** Satırın sağına yaslanan içerik — bir anahtarın açık/kapalı göstergesi. */
  trailing?: ReactNode;
  /** Seçildikten sonra menü açık kalsın (arka arkaya değiştirilen ayarlar). */
  keepOpen?: boolean;
}

/**
 * Gizlilik politikası satırı. App Store 5.1.1(i) metnin uygulamanın İÇİNDEN
 * kolayca bulunmasını istiyor; uygulamada landing alt bilgisi hiç görünmediği
 * için giriş yapmış kullanıcının ona ulaşacağı tek yer bu menü.
 */
export function useGizlilikMenuOgesi(): PanelMenuItem {
  const navigate = useNavigate();
  return {
    label: "Gizlilik politikası",
    icon: <ShieldCheck className="h-4 w-4" />,
    onSelect: () => navigate("/gizlilik-politikasi"),
  };
}

/**
 * Başlıktaki taşma menüsü — yalnızca dar ekranda.
 *
 * Mobilde dört ayrı 48px ikon butonu başlık satırını yiyordu: "Öğretmen
 * Paneli" için 157px gerekirken 62px kalıyor ve başlık "Öğre…" olarak
 * kırpılıyordu. İkincil eylemler buraya toplanınca başlığa yer açılıyor.
 */
export function PanelMenu({ items, label = "Diğer işlemler" }: { items: PanelMenuItem[]; label?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* `compact`: yanındaki zille aynı boy. Onsuz mobilde 48px kalıyor,
            36px'lik zilin yanında hem iri hem de başlık çizgisine taşıyordu. */}
        <IconButton label={label} compact>
          <MoreHorizontal className="h-5 w-5" />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[190px]">
        {items.map((item) => (
          <DropdownMenuItem
            key={item.label}
            disabled={item.disabled}
            onSelect={(event) => {
              if (item.keepOpen) event.preventDefault();
              item.onSelect();
            }}
            className="gap-2.5 py-2.5 text-[14px] font-semibold"
          >
            {item.icon}
            <span className="flex-1">{item.label}</span>
            {item.trailing}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
