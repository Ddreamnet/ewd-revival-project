import { LandingHeader } from '@/components/landing/LandingHeader';
import { HeroSection } from '@/components/landing/HeroSection';
import { WhySection } from '@/components/landing/WhySection';
import { KidsPackages } from '@/components/landing/KidsPackages';
import { AdultPackages } from '@/components/landing/AdultPackages';
import { FAQSection } from '@/components/landing/FAQSection';
import { ContactSection } from '@/components/landing/ContactSection';
import { StickyBubble } from '@/components/landing/StickyBubble';
import { LanguageProvider } from '@/contexts/LanguageContext';

function LandingContent() {
  return (
    <div className="landing-body min-h-screen overflow-x-hidden">
      <LandingHeader />
      <main>
        <HeroSection />
        <WhySection />
        <KidsPackages />
        <AdultPackages />
        <FAQSection />
        <ContactSection />
      </main>
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
