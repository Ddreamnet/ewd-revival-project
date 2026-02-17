import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AuthForm } from "@/components/AuthForm";
import { TeacherDashboard } from "@/components/TeacherDashboard";
import { StudentDashboard } from "@/components/StudentDashboard";
import { AdminDashboard } from "@/components/AdminDashboard";
import LandingPage from "./pages/LandingPage";
import WorkWithUsPage from "./pages/WorkWithUsPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import BlogPage from "./pages/BlogPage";
import BlogPostPage from "./pages/BlogPostPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function DashboardRoutes() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  if (profile?.roles?.includes('admin')) {
    return <AdminDashboard />;
  }
  
  if (profile?.role === 'teacher') {
    return <TeacherDashboard />;
  }
  
  if (profile?.role === 'student') {
    return <StudentDashboard />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p>Profil yükleniyor...</p>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Landing Page - Public */}
          <Route path="/" element={<LandingPage />} />
          
          {/* Work With Us - Public */}
          <Route path="/bizimle-calisin" element={<WorkWithUsPage />} />
          
          {/* Privacy Policy - Public */}
          <Route path="/gizlilik-politikasi" element={<PrivacyPolicyPage />} />
          
          {/* Blog - Public */}
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />
          
          {/* Login Page - Public */}
          <Route path="/login" element={<AuthForm />} />
          
          {/* Dashboard - Protected, role-based */}
          <Route path="/dashboard" element={<DashboardRoutes />} />
          
          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
