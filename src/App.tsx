import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect, useRef, lazy, Suspense } from "react";
import { captureSnapshot } from "@/lib/pageSnapshot";
import { Capacitor } from "@capacitor/core";
import { AuthProvider, useAuthContext } from "@/contexts/AuthContext";
import { AuthForm } from "@/components/AuthForm";

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
const NotFound = lazy(() => import("./pages/NotFound"));

// Prefetch secondary routes after initial load
if (typeof window !== "undefined") {
  window.addEventListener("load", () => {
    setTimeout(() => {
      import("./pages/WorkWithUsPage");
      import("./pages/PrivacyPolicyPage");
      import("./pages/BlogPage");
      import("./pages/BlogPostPage");
    }, 1000);
  }, { once: true });
}

const queryClient = new QueryClient();

function DashboardRoutes() {
  const { user, profile, loading, initializing } = useAuthContext();

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

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  const prevPathname = useRef(pathname);
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      // Capture outgoing page's visual state BEFORE scroll reset
      captureSnapshot();
      prevPathname.current = pathname;
    }
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
              <Route path="/login" element={<AuthForm />} />
              <Route path="/dashboard" element={<DashboardRoutes />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
