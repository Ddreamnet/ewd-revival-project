import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
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
  const navigate = useNavigate();

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
      } else {
        navigate('/dashboard');
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
    <div className="login-board-wrap">
      {/* Logo - same position as landing page */}
      <Link to="/" className="fixed left-2 sm:left-4 lg:left-8 top-1 sm:top-2 md:top-3 z-[60]">
        <img 
          src="/uploads/logo.webp" 
          alt="English with Dilara" 
          className="h-20 sm:h-28 md:h-40 w-auto transform -rotate-[10deg] hover:scale-105 transition-transform duration-300 cursor-pointer" 
        />
      </Link>

      <div className="login-board-outer">
        {/* Title above the board — centered */}
        <div className="login-board__title" aria-label="English with Dilara title">
          <div className="login-board__title-text">
            <div className="t-english">English</div>
            <div className="t-with">with</div>
            <div className="t-dilara font-aprilia">DILARA</div>
          </div>
        </div>

        {/* Board */}
        <div className="login-board" aria-label="Chalkboard">
          <div className="login-board__surface">
            {/* Login card centered */}
            <div className="login-board__center">
            <Card className="w-full max-w-sm bg-background/65 backdrop-blur-sm">
              <CardContent className="pt-6">
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

            {/* Shelf */}
            <div className="login-board__shelf" aria-hidden="true">
              <span className="chalk chalk--white"></span>
              <span className="chalk chalk--pink"></span>
              <span className="chalk chalk--yellow"></span>
              <span className="eraser"></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
