import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { HeroSection } from '@/components/landing/HeroSection';
import { WhySection } from '@/components/landing/WhySection';
import { KidsPackages } from '@/components/landing/KidsPackages';
import { AdultPackages } from '@/components/landing/AdultPackages';
import { FAQSection } from '@/components/landing/FAQSection';
import { BlogSection } from '@/components/landing/BlogSection';
import { ValuesSection } from '@/components/landing/ValuesSection';
import { ContactSection } from '@/components/landing/ContactSection';
import { Footer } from '@/components/landing/Footer';
import { StickyBubble } from '@/components/landing/StickyBubble';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { useAuthContext } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

function LandingContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const scrollHandled = useRef(false);
  const { user, initializing } = useAuthContext();

  // Auto-redirect authenticated users to dashboard
  useEffect(() => {
    if (!initializing && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [initializing, user, navigate]);

  useEffect(() => {
    const scrollTo = (location.state as { scrollTo?: string })?.scrollTo;
    if (scrollTo && !scrollHandled.current) {
      scrollHandled.current = true;
      const el = document.getElementById(scrollTo);
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 100);
      }
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

  // Show loading while checking auth state
  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="landing-body min-h-screen overflow-x-hidden">
      <LandingHeader />
      <main>
        <HeroSection />
        <WhySection />
        <KidsPackages />
        <AdultPackages />
        <FAQSection />
        <BlogSection />
        <ValuesSection />
        <ContactSection />
      </main>
      <Footer />
      <StickyBubble />
    </div>
  );
}

export default function LandingPage() {
  return (
    <LanguageProvider>
      <LandingContent />
    </LanguageProvider>
  );
}
