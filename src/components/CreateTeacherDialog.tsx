import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface CreateTeacherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTeacherCreated: () => void;
}

export function CreateTeacherDialog({ open, onOpenChange, onTeacherCreated }: CreateTeacherDialogProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !name || !tempPassword) {
      toast({
        title: "Hata",
        description: "Lütfen tüm alanları doldurun",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("create-teacher", {
        body: {
          email,
          name,
          password: tempPassword,
        },
      });

      if (error) throw error;

      const result = data as any;
      if (result?.error) {
        toast({
          title: "Hata",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Başarılı",
        description: `Öğretmen hesabı başarıyla oluşturuldu! Geçici şifre: ${tempPassword}`,
      });

      setEmail("");
      setName("");
      setTempPassword("");
      onTeacherCreated();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message || "Öğretmen hesabı oluşturulamadı",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generatePassword = () => {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let result = "";
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setTempPassword(result);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Öğretmen Hesabı Oluştur
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Öğretmen E-postası</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ogretmen@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Ad Soyad</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Öğretmen Adı"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Geçici Şifre</Label>
            <div className="flex gap-2">
              <Input
                id="password"
                type="text"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                placeholder="Şifre oluştur veya gir"
                required
              />
              <Button type="button" variant="outline" onClick={generatePassword} className="shrink-0">
                Oluştur
              </Button>
            </div>
          </div>

          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Not:</strong> Öğretmen bu geçici şifre ile oluşturulacak. Lütfen bu bilgileri öğretmen ile güvenli
              şekilde paylaşın.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              İptal
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="transition-all duration-150 hover:scale-105 active:scale-95"
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Hesap Oluştur
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
