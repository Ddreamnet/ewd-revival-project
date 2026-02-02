import { useLanguage } from '@/contexts/LanguageContext';
import { Check } from 'lucide-react';

export function WhySection() {
  const { language, t } = useLanguage();

  const features = [
    t.why.features.personalProgram,
    t.why.features.oneOnOne,
    t.why.features.liveZoom,
    t.why.features.speakingFocused,
    t.why.features.regularTracking,
    t.why.features.freeTrial,
  ];

  return (
    <section
      id="why"
      className="scroll-section py-16 md:py-24"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-16">
          {/* Left - Title */}
          <div className="flex-1 text-center lg:text-left">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight">
              <span className="text-foreground">{t.why.title[language]}</span>
              <br />
              <span className="text-landing-purple-dark">ENGLISH</span>
              <br />
              <span className="text-foreground">with</span>
              <br />
              <span className="font-aprilia text-landing-purple-dark">DILARA</span>
              <span className="text-foreground">?</span>
            </h2>
          </div>

          {/* Right - Purple Card */}
          <div className="flex-1 w-full max-w-md lg:max-w-lg">
            <div className="bg-landing-purple/20 backdrop-blur-sm rounded-3xl p-6 md:p-8 shadow-lg">
              <ul className="space-y-4">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-landing-purple/40 flex items-center justify-center">
                      <Check className="w-4 h-4 text-landing-purple-dark" />
                    </div>
                    <span className="text-base md:text-lg text-foreground">
                      {feature[language]}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Small decorative area at bottom */}
              <div className="mt-6 pt-4 border-t border-landing-purple/30">
                <div className="flex justify-center">
                  <div className="w-16 h-16 rounded-full bg-landing-purple/30 flex items-center justify-center">
                    <span className="text-2xl">📚</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
