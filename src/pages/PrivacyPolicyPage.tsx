import { useLanguage } from '@/contexts/LanguageContext';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { Footer } from '@/components/landing/Footer';
import { BackSwipeWrapper } from '@/components/BackSwipeWrapper';
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

/** Bölüm kartları krem/leylak/pembe sırasıyla boyanır. */
const TONES = [
  { bg: 'var(--ewd-lilac-soft)', border: 'var(--ewd-lilac-line-soft)', ink: '#5B21B6' },
  { bg: 'var(--ewd-pink-tint)', border: 'var(--ewd-pink-line)', ink: '#BE185D' },
  { bg: 'var(--ewd-yellow-pale)', border: 'var(--ewd-yellow)', ink: '#8A6410' },
];

export default function PrivacyPolicyPage() {
  const { language, t } = useLanguage();

  useDocumentMeta({ title: t.privacyPolicy.title[language] });

  return (
    <BackSwipeWrapper>
      <div className="landing-body ewd-light min-h-screen">
        <LandingHeader />

        <main className="px-5 pb-20 pt-12 sm:px-8" style={{ background: 'var(--ewd-cream)' }}>
          <div className="mx-auto max-w-[820px]">
            <h1 className="ewd-h2 mb-10 text-center">{t.privacyPolicy.title[language]}</h1>

            <div className="flex flex-col gap-4">
              {t.privacyPolicy.sections.map((section, index) => {
                const tone = TONES[index % TONES.length];
                return (
                  <section
                    key={section.title.tr}
                    className="rounded-[28px] border-[3px] px-6 py-5 sm:px-7 sm:py-6"
                    style={{ background: tone.bg, borderColor: tone.border }}
                  >
                    <h2
                      className="mb-2 text-[17px] font-black tracking-[-0.01em] sm:text-[19px]"
                      style={{ color: tone.ink }}
                    >
                      {section.title[language]}
                    </h2>
                    <p className="text-[14px] font-medium leading-[1.65] text-[#4C3A5E] [text-wrap:pretty] sm:text-[15px]">
                      {section.content[language]}
                    </p>
                  </section>
                );
              })}
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </BackSwipeWrapper>
  );
}
