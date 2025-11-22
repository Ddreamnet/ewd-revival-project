import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export function AuthForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();

  const [signInData, setSignInData] = useState({
    email: "",
    password: "",
  });

  const [signUpData, setSignUpData] = useState({
    email: "",
    password: "",
    fullName: "",
    role: "student" as "teacher" | "student",
  });

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await signIn(signInData.email, signInData.password);
      if (error) {
        toast({
          title: "Hata",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await signUp(signUpData.email, signUpData.password, signUpData.fullName, signUpData.role);
      if (error) {
        toast({
          title: "Hata",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Başarılı",
          description: "Hesap başarıyla oluşturuldu! Şimdi giriş yapabilirsiniz.",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Arka plan + overlay: sadece bu sayfaya özel */}
      <div className="login-bg min-h-screen flex items-center justify-center p-4 relative bg-cover bg-center">
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/40" />

        {/* Masaüstü görünüm: Logo sol-üstte (3x büyük) */}
        <img src="/uploads/logo.webp" alt="Logo" className="hidden md:block absolute top-6 left-6 h-48 w-auto z-20" />

        {/* İçerik */}
        <div className="relative z-10 w-full max-w-sm space-y-6">
          {/* Mobil görünüm: Logo Card'ın hemen üstünde ortalı (3x büyük) */}
          <div className="block md:hidden text-center mb-2">
            <img src="/uploads/logo.webp" alt="Logo" className="h-48 w-auto mx-auto" />
          </div>

          {/* Başlık (istersen burada kalabilir; mobilde logo üstte görünüyor, masaüstünde sol-üstte ayrı logo var) */}
          {/*<div className="text-center mb-4">
            <h1 className="text-3xl font-bold text-foreground">
              English with Dilara
            </h1>
          </div>*/}

          <Card className="w-full bg-background/65 backdrop-blur-sm">
            <CardHeader className="text-center">
              {
                //<CardTitle className="text-2xl font-bold">İngilizce Öğrenme Platformu</CardTitle>
              }
              {
                //<CardDescription>Öğretmenleri ve öğrencileri kişiselleştirilmiş İngilizce öğrenimi için bağlar</CardDescription>
              }
            </CardHeader>
            <CardContent>
              <div className="w-full">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-semibold">{isSignUp ? "Kayıt Ol" : "Giriş Yap"}</h2>
                </div>

                {!isSignUp ? (
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email">E-posta</Label>
                      <Input
                        id="signin-email"
                        type="email"
                        placeholder="E-posta adresinizi girin"
                        value={signInData.email}
                        onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signin-password">Şifre</Label>
                      <Input
                        id="signin-password"
                        type="password"
                        placeholder="Şifrenizi girin"
                        value={signInData.password}
                        onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Giriş Yap
                    </Button>

                    {/*<div className="mt-4 text-center">
                      <p className="text-sm text-muted-foreground">
                        Hesabınız yok mu?{' '}
                        <button
                          type="button"
                          onClick={() => setIsSignUp(true)}
                          className="text-primary hover:underline font-medium"
                        >
                          Kayıt Ol
                        </button>
                      </p>
                    </div>*/}
                  </form>
                ) : (
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Ad Soyad</Label>
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="Ad ve soyadınızı girin"
                        value={signUpData.fullName}
                        onChange={(e) => setSignUpData({ ...signUpData, fullName: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">E-posta</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="E-posta adresinizi girin"
                        value={signUpData.email}
                        onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Şifre</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="Şifrenizi girin"
                        value={signUpData.password}
                        onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Ben bir...</Label>
                      <Select
                        value={signUpData.role}
                        onValueChange={(value: "teacher" | "student") => setSignUpData({ ...signUpData, role: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Rolünüzü seçin" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="student">Öğrenci</SelectItem>
                          <SelectItem value="teacher">Öğretmen</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Kayıt Ol
                    </Button>

                    <div className="mt-4 text-center">
                      <p className="text-sm text-muted-foreground">
                        Zaten hesabınız var mı?{" "}
                        <button
                          type="button"
                          onClick={() => setIsSignUp(false)}
                          className="text-primary hover:underline font-medium"
                        >
                          Giriş Yap
                        </button>
                      </p>
                    </div>
                  </form>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sayfaya özel arka plan resimleri (masaüstü: 16:9, mobil: 9:16) */}
      <style>
        {`
          .login-bg {
            background-image: url('/uploads/login-bg-169.webp');
          }
          @media (max-width: 768px) {
            .login-bg {
              background-image: url('/uploads/login-bg-916.webp') !important;
            }
          }
        `}
      </style>
    </>
  );
}
