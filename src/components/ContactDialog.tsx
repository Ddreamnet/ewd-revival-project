import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Phone } from "lucide-react";

interface ContactDialogProps {
  /** Verilirse kart dışarıdan açılır (mobil taşma menüsündeki "İletişim"). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Tetik düğmesine eklenir — ör. telefonda gizlemek için `max-md:hidden`. */
  triggerClassName?: string;
}

export function ContactDialog({ open, onOpenChange, triggerClassName }: ContactDialogProps = {}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {/* Panelin kendi düğme dili: zil ve tema düğmesiyle aynı yuvarlak ikon
            düğmesi. Eskiden shadcn'in köşeli `outline` düğmesiydi; iki
            yuvarlak düğmenin arasında başka bir tasarımdan kalmış gibi
            duruyordu. */}
        <button
          type="button"
          className={`pnl-iconbtn pnl-iconbtn--sm ${triggerClassName ?? ""}`}
          aria-label="İletişim"
          title="İletişim"
        >
          <Phone className="h-5 w-5" />
        </button>
      </DialogTrigger>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>İletişim Bilgileri</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">E-posta</p>
                  <a href="mailto:dilarasirlan30@gmail.com" className="text-sm text-primary hover:underline">
                    dilarasirlan30@gmail.com
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Telefon</p>
                  <a href="tel:+905077962036" className="text-sm text-primary hover:underline">
                    +90 (507) 796 20 36
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
