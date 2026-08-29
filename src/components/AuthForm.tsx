import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { loadLastEmail } from "@/lib/capacitorStorage";

// Accounts are created by an admin (create-student / create-teacher edge
// functions), so this screen is sign-in only. The self-service sign-up form
// that used to live here was unreachable — nothing ever set isSignUp — and it
// posted a client-chosen `role`, which is the input the privilege-escalation
// path depended on.
export function AuthForm() {
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [signInData, setSignInData] = useState({
    email: "",
    password: ""
  });

  // Prefill the e-mail only (Preferences on native, localStorage on web).
  useEffect(() => {
    loadLastEmail().then((email) => {
      if (email) setSignInData((prev) => ({ ...prev, email }));
    });
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await signIn(signInData.email, signInData.password);
      if (error) {
        toast({
          title: "Hata",
          description: error.message,
          variant: "destructive"
        });
      } else {
        navigate('/dashboard');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-board-wrap">
      {/* Logo - same position as landing page */}
      <Link to="/" className="login-logo fixed left-2 sm:left-4 lg:left-8 top-1 sm:top-2 md:top-3 z-[60]">
        <img
          src="/uploads/logo.webp"
          alt="English with Dilara"
          className="h-20 sm:h-28 md:h-40 w-auto transform -rotate-[10deg] hover:scale-105 transition-transform duration-300 cursor-pointer" />

      </Link>

      <div className="login-board-outer">
        {/* Title above the board — centered */}
        <div className="login-board__title pr-[40px]" aria-label="English with Dilara title">
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
                      <h2 className="text-xl font-semibold">Giriş Yap</h2>
                    </div>

                    <form onSubmit={handleSignIn} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="signin-email">E-posta</Label>
                          <Input
                          id="signin-email"
                          type="email"
                          name="email"
                          autoComplete="username"
                          placeholder="E-posta adresinizi girin"
                          value={signInData.email}
                          onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                          required />

                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signin-password">Şifre</Label>
                          <Input
                          id="signin-password"
                          type="password"
                          name="password"
                          autoComplete="current-password"
                          placeholder="Şifrenizi girin"
                          value={signInData.password}
                          onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                          required />

                        </div>
                        <Button type="submit" className="w-full" disabled={isLoading}>
                          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Giriş Yap
                        </Button>
                      </form>
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
    </div>);

}