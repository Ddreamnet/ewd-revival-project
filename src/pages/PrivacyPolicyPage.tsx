import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { Footer } from '@/components/landing/Footer';
import { BackSwipeWrapper } from '@/components/BackSwipeWrapper';

function PrivacyPolicyContent() {
  const { language, t } = useLanguage();

  return (
    <div className="landing-body min-h-screen overflow-x-hidden">
      <LandingHeader />
      <main className="pt-28 md:pt-32 pb-16 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-bold text-landing-purple-dark text-center mb-8">
            {t.privacyPolicy.title[language]}
          </h1>

          {/* Sections */}
          <div className="space-y-4">
            {t.privacyPolicy.sections.map((section, index) => (
              <div
                key={index}
                className="bg-landing-purple/20 rounded-2xl p-4 md:p-5"
              >
                <h2 className="text-lg font-bold text-landing-purple-dark mb-2">
                  {section.title[language]}
                </h2>
                <p className="text-sm text-foreground/80 leading-relaxed">
                  {section.content[language]}
                </p>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <LanguageProvider>
      <PrivacyPolicyContent />
    </LanguageProvider>
  );
}
