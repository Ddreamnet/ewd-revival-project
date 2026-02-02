import { useLanguage } from '@/contexts/LanguageContext';
import { GraduationCap, Check } from 'lucide-react';

export function AdultPackages() {
  const { language, t } = useLanguage();

  const adultItems = [
    t.adultPackages.adultPackage.items.speaking,
    t.adultPackages.adultPackage.items.skills,
    t.adultPackages.adultPackage.items.everyday,
    t.adultPackages.adultPackage.items.work,
    t.adultPackages.adultPackage.items.duration,
    t.adultPackages.adultPackage.items.options,
  ];

  return (
    <section
      id="adult-packages"
      className="scroll-section py-16 md:py-24"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-landing-purple-dark mb-4">
            {t.adultPackages.title[language]}
          </h2>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
            {t.adultPackages.description[language]}
          </p>
        </div>

        {/* Package Card + Blob */}
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-center justify-center">
          {/* Adult Package Card */}
          <div className="flex-1 max-w-xl w-full">
            <div className="bg-landing-purple/20 backdrop-blur-sm rounded-3xl p-6 md:p-8 shadow-lg">
              <h3 className="text-xl md:text-2xl font-bold text-landing-purple-dark mb-2">
                {t.adultPackages.adultPackage.title[language]}
              </h3>
              
              {/* Levels Badge */}
              <div className="inline-block bg-landing-purple/30 rounded-full px-4 py-1.5 mb-3">
                <span className="text-sm font-medium text-landing-purple-dark">
                  {t.adultPackages.adultPackage.levels[language]}
                </span>
              </div>
              
              <p className="text-sm text-muted-foreground mb-4">
                {t.adultPackages.adultPackage.levelDescription[language]}
              </p>

              <p className="text-sm font-medium text-foreground/70 mb-4">
                {t.adultPackages.adultPackage.subtitle[language]}
              </p>

              <ul className="space-y-3">
                {adultItems.map((item, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-landing-purple-dark flex-shrink-0 mt-0.5" />
                    <span className="text-sm md:text-base text-foreground">
                      {item[language]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Blob with Student Icon */}
          <div className="hidden lg:flex flex-col items-center justify-center w-48 xl:w-64">
            <div className="w-32 h-32 xl:w-48 xl:h-48 rounded-full bg-landing-purple/10 flex items-center justify-center">
              <GraduationCap className="w-16 h-16 xl:w-24 xl:h-24 text-landing-purple/50" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
