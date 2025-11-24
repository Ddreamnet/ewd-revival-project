import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AuthForm } from "@/components/AuthForm";
import { TeacherDashboard } from "@/components/TeacherDashboard";
import { StudentDashboard } from "@/components/StudentDashboard";
import { AdminDashboard } from "@/components/AdminDashboard";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route 
        path="/" 
        element={
          !user ? (
            <AuthForm />
          ) : profile?.roles?.includes('admin') ? (
            <AdminDashboard />
          ) : profile?.role === 'teacher' ? (
            <TeacherDashboard />
          ) : profile?.role === 'student' ? (
            <StudentDashboard />
          ) : (
            <div className="min-h-screen flex items-center justify-center">
              <p>Profil yükleniyor...</p>
            </div>
          )
        } 
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
