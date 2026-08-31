import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
import { Capacitor } from "@capacitor/core";
import { AuthProvider, useAuthContext } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthForm } from "@/components/AuthForm";
import { Button } from "@/components/ui/button";

const TeacherDashboard = lazy(() => import("./components/TeacherDashboard").then(m => ({ default: m.TeacherDashboard })));
const StudentDashboard = lazy(() => import("./components/StudentDashboard").then(m => ({ default: m.StudentDashboard })));
const AdminDashboard = lazy(() => import("./components/AdminDashboard").then(m => ({ default: m.AdminDashboard })));

// Eager-load the landing page for instant first paint
import LandingPage from "./pages/LandingPage";

// Lazy-load secondary pages — they are code-split and prefetched
const WorkWithUsPage = lazy(() => import("./pages/WorkWithUsPage"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));
const BlogPage = lazy(() => import("./pages/BlogPage"));
const BlogPostPage = lazy(() => import("./pages/BlogPostPage"));
const WordsPage = lazy(() => import("./pages/WordsPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Prefetch secondary routes after initial load
if (typeof window !== "undefined") {
  window.addEventListener("load", () => {
    setTimeout(() => {
      import("./pages/WorkWithUsPage");
      import("./pages/PrivacyPolicyPage");
      import("./pages/BlogPage");
      import("./pages/BlogPostPage");
      import("./pages/WordsPage");
    }, 1000);
  }, { once: true });
}

const queryClient = new QueryClient();

function DashboardRoutes() {
  const { user, profile, loading, initializing, signOut, signingOut } = useAuthContext();

  // Session is still being restored from native storage — never redirect yet
  // Show spinner only during initial boot or first profile load.
  // Token refresh with existing profile → no spinner, dashboard stays mounted.
  if (initializing || (loading && !profile)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  if (profile?.roles?.includes("admin")) {
    return <AdminDashboard />;
  }

  if (profile?.role === "teacher") {
    return <TeacherDashboard />;
  }

  if (profile?.role === "student") {
    return <StudentDashboard />;
  }

  // Signed in, but no usable profile — e.g. the profile row was deleted while
  // the auth user survived, or the handle_new_user trigger swallowed an error.
  // This used to fall through to a spinner with no way out, stranding the user
  // on every platform. Give them an explanation and an exit.
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-lg font-semibold">Hesabınız yapılandırılamadı</h1>
      <p className="text-sm text-muted-foreground max-w-sm">
        Bu hesaba bağlı bir profil bulunamadı. Lütfen yöneticinizle iletişime geçin.
      </p>
      <Button onClick={signOut} variant="outline" disabled={signingOut}>
        {signingOut ? "Çıkış yapılıyor..." : "Çıkış Yap"}
      </Button>
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
// Hides the native splash screen once the app is ready (initializing === false)
function SplashHider() {
  const { initializing } = useAuthContext();
  useEffect(() => {
    if (!initializing && Capacitor.isNativePlatform()) {
      import("@capacitor/splash-screen").then(({ SplashScreen }) => {
        SplashScreen.hide({ fadeOutDuration: 200 });
      });
    }
  }, [initializing]);
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
    <LanguageProvider>
    <AuthProvider>
      <SplashHider />
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <Suspense fallback={null}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/bizimle-calisin" element={<WorkWithUsPage />} />
              <Route path="/gizlilik-politikasi" element={<PrivacyPolicyPage />} />
              <Route path="/blog" element={<BlogPage />} />
              <Route path="/blog/:slug" element={<BlogPostPage />} />
              <Route path="/gunun-kelimeleri" element={<WordsPage />} />
              <Route path="/login" element={<AuthForm />} />
              <Route path="/dashboard" element={<DashboardRoutes />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
    </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
