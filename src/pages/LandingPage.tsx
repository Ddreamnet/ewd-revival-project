import { Suspense, lazy, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { HeroSection } from '@/components/landing/HeroSection';
import { RibbonBand } from '@/components/landing/RibbonBand';
import { WhySection } from '@/components/landing/WhySection';
import { KidsPackages } from '@/components/landing/KidsPackages';
import { AdultPackages } from '@/components/landing/AdultPackages';
import { MomentsSection } from '@/components/landing/MomentsSection';
import { TestimonialsSection } from '@/components/landing/TestimonialsSection';
import { FAQSection } from '@/components/landing/FAQSection';
import { BlogSection } from '@/components/landing/BlogSection';
import { ValuesSection } from '@/components/landing/ValuesSection';
import { ContactSection } from '@/components/landing/ContactSection';
import { Footer } from '@/components/landing/Footer';
import { useAuthContext } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';

/**
 * Günün kelimeleri bölümü altı dilin kelime bankasını taşıyor (~860 kB kaynak,
 * ~470 kB paket). Hero'nun altında kaldığı için tembel yükleniyor: ilk boyama
 * bunu beklemiyor, bölüm görünür alana yaklaşırken iniyor.
 */
const DailyWordsSection = lazy(() =>
  import('@/components/landing/DailyWordsSection').then((m) => ({ default: m.DailyWordsSection })),
);
import { Loader2 } from 'lucide-react';

export default function LandingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { language, t } = useLanguage();

  // Başlık da açıklama da seçili dilden gelsin ki arama sonucu ve paylaşım
  // kartı ziyaretçinin dilinde görünsün. Başlığa marka adını `useDocumentMeta`
  // ekliyor: "Online İngilizce Dersleri · English with Dilara".
  useDocumentMeta({
    title: t.seo.homeTitle[language],
    description: t.hero.lead[language],
  });
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

  // Oturum açıkken landing hiç boyanmasın: yukarıdaki yönlendirme efekt
  // içinde çalıştığı için sayfa bir kare tam olarak çiziliyordu — uygulamada
  // panele geçerken pazarlama sayfasının parlaması bu yüzdendi.
  if (initializing || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    // `ewd-light`: landing her zaman açık modda kalır (koyu mod yalnızca panelde).
    <div className="landing-body ewd-light min-h-screen">
      <LandingHeader />
      <main>
        <HeroSection />
        <RibbonBand />
        <Suspense fallback={<div style={{ minHeight: 420 }} aria-hidden="true" />}>
          <DailyWordsSection />
        </Suspense>
        <WhySection />
        <KidsPackages />
        <AdultPackages />
        <MomentsSection />
        <TestimonialsSection />
        <FAQSection />
        <BlogSection />
        <ValuesSection />
        <ContactSection />
      </main>
      <Footer />
    </div>
  );
}
