import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { BRANCHES, branchLabel, type Branch } from "@/lib/branch";
import { toast } from "@/lib/notify";

interface CreateTeacherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  /** Panelin açık olduğu şube — seçim buradan başlar. */
  defaultBranch: Branch;
}

export function CreateTeacherDialog({
  open,
  onOpenChange,
  onSuccess,
  defaultBranch,
}: CreateTeacherDialogProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [branch, setBranch] = useState<Branch>(defaultBranch);
  const [loading, setLoading] = useState(false);

  // Diyalog her açılışta panelin bulunduğu şubeyle başlar; admin Fransızca
  // panelde "+" dediğinde İngilizce öğretmen oluşturması hata olurdu.
  useEffect(() => {
    if (open) setBranch(defaultBranch);
  }, [open, defaultBranch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      toast.error("Lütfen tüm alanları doldurun");
      return;
    }

    if (password.length < 6) {
      toast.error("Şifre en az 6 karakter olmalıdır");
      return;
    }

    setLoading(true);

    try {
      // Get current session for authorization
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Oturum bulunamadı");
        return;
      }

      // Call edge function to create teacher
      const response = await supabase.functions.invoke('create-teacher', {
        body: {
          email,
          name: fullName,
          password,
          language: branch,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Öğretmen oluşturulamadı');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast.success(`${branchLabel(branch)} öğretmeni oluşturuldu`);
      setFullName("");
      setEmail("");
      setPassword("");
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Error creating teacher:", error);
      toast.error(error.message || "Öğretmen oluşturulurken hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Yeni Öğretmen Oluştur</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Öğretmen Adı</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ad Soyad"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-posta</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@email.com"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Şifre</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="En az 6 karakter"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label>Şube</Label>
              <div className="grid grid-cols-2 gap-2">
                {BRANCHES.map((option) => (
                  <button
                    key={option.code}
                    type="button"
                    onClick={() => setBranch(option.code)}
                    disabled={loading}
                    aria-pressed={branch === option.code}
                    className={
                      "rounded-lg border-2 px-3 py-3 text-sm font-bold transition-colors disabled:opacity-60 " +
                      (branch === option.code
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-accent")
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Öğretmen yalnızca bu şubede görünür; öğrencileri de aynı şubeye eklenir.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              İptal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Oluşturuluyor..." : "Oluştur"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
