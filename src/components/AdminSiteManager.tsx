// ============================================================================
// ADMİN — SİTE YÖNETİMİ
// ============================================================================
// Landing sayfasının içeriğini tek bir yerden toplar: veli yorumları, ders içi
// fotoğraf/videolar ve sayfadaki bütün metinler. Alt tarafta, sitenin tasarım
// ve mimari belgelerine giden kalıcı bir bağlantı var.

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { AdminSiteTestimonials } from "./AdminSiteTestimonials";
import { AdminSiteMoments } from "./AdminSiteMoments";
import { AdminSiteTexts } from "./AdminSiteTexts";
import { BookOpen, ExternalLink, Images, MessageSquareQuote, Type } from "lucide-react";

type Tab = "testimonials" | "moments" | "texts";

const TABS: { key: Tab; label: string; icon: typeof Type }[] = [
  { key: "testimonials", label: "Veli yorumları", icon: MessageSquareQuote },
  { key: "moments", label: "Dersten kareler", icon: Images },
  { key: "texts", label: "Site metinleri", icon: Type },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminSiteManager({ open, onOpenChange }: Props) {
  const [tab, setTab] = useState<Tab>("testimonials");
  const { refreshSiteContent } = useLanguage();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100%-1rem)] max-w-5xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Site Yönetimi</DialogTitle>
        </DialogHeader>

        <div className="flex gap-1.5 overflow-x-auto border-b-2 border-[color:var(--ewd-line)] pb-3">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              className="ewd-tab flex items-center gap-2 whitespace-nowrap"
              data-active={tab === key}
              onClick={() => setTab(key)}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto py-1 pr-1">
          {tab === "testimonials" && <AdminSiteTestimonials onChanged={refreshSiteContent} />}
          {tab === "moments" && <AdminSiteMoments onChanged={refreshSiteContent} />}
          {tab === "texts" && <AdminSiteTexts onChanged={refreshSiteContent} />}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <p className="text-xs text-muted-foreground">
            Değişiklikler kaydedildiği anda sitede yayına girer.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href="/" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" /> Siteyi aç
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="/site-rehberi" target="_blank" rel="noopener noreferrer">
                <BookOpen className="mr-2 h-4 w-4" /> Site rehberi
              </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
