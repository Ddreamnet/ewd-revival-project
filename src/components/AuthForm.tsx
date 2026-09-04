import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Label } from "@/components/ui/label";
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
        <div className="login-board__title" aria-label="English with Dilara">
          {/* Hero'daki kilit düzenin aynısı — site genelinde tek bir marka bloğu */}
          <div className="ewd-lockup items-center">
            <span className="ewd-lockup__english">ENGLISH</span>
            <span className="ewd-lockup__with">with</span>
            <span className="ewd-lockup__dilara">Dilara</span>
          </div>
        </div>

        {/* Board */}
        <div className="login-board" aria-label="Chalkboard">
          <div className="login-board__surface">
            {/* Login card centered */}
            <div className="login-board__center">
            <div
              className="w-full max-w-sm rounded-[30px] border-[3px] px-6 py-7 backdrop-blur-sm"
              style={{
                background: "color-mix(in srgb, var(--ewd-cream-hi) 92%, transparent)",
                borderColor: "var(--ewd-lilac-line)",
                boxShadow: "0 26px 44px -24px rgba(0,0,0,0.5)",
              }}
            >
              <div className="mb-5 text-center">
                <h2 className="text-[22px] font-black tracking-[-0.01em] text-[color:var(--ewd-on-surface)]">
                  Giriş Yap
                </h2>
                <p className="mt-1 text-[13px] font-semibold text-[color:var(--ewd-on-surface-soft)]">
                  Öğrenci ve öğretmen paneli
                </p>
              </div>

              <form onSubmit={handleSignIn} className="space-y-3.5">
                <div className="space-y-1.5">
                  <Label htmlFor="signin-email" className="text-[12px] font-extrabold uppercase tracking-[0.1em]">
                    E-posta
                  </Label>
                  <input
                    id="signin-email"
                    className="ewd-field"
                    type="email"
                    name="email"
                    autoComplete="username"
                    placeholder="E-posta adresinizi girin"
                    value={signInData.email}
                    onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signin-password" className="text-[12px] font-extrabold uppercase tracking-[0.1em]">
                    Şifre
                  </Label>
                  <input
                    id="signin-password"
                    className="ewd-field"
                    type="password"
                    name="password"
                    autoComplete="current-password"
                    placeholder="Şifrenizi girin"
                    value={signInData.password}
                    onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="ewd-btn ewd-btn--purple w-full disabled:opacity-70"
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Giriş Yap
                </button>
              </form>
            </div>
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