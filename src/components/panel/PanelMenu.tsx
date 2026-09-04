import { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
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
        <IconButton label={label}>
          <MoreHorizontal className="h-5 w-5" />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[190px]">
        {items.map((item) => (
          <DropdownMenuItem
            key={item.label}
            disabled={item.disabled}
            onSelect={item.onSelect}
            className="gap-2.5 py-2.5 text-[14px] font-semibold"
          >
            {item.icon}
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
