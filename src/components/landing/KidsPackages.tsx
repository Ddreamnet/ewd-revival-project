import { useLanguage } from '@/contexts/LanguageContext';
import { GraduationCap, Check } from 'lucide-react';

export function KidsPackages() {
  const { language, t } = useLanguage();

  const scrollToContact = () => {
    const element = document.getElementById('contact');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const classicItems = [
    t.kidsPackages.classicPackage.items.lessonsPerWeek,
    t.kidsPackages.classicPackage.items.speaking,
    t.kidsPackages.classicPackage.items.coreEnglish,
    t.kidsPackages.classicPackage.items.listening,
    t.kidsPackages.classicPackage.items.games,
    t.kidsPackages.classicPackage.items.duration,
    t.kidsPackages.classicPackage.items.options,
  ];

  const schoolItems = [
    t.kidsPackages.schoolPackage.items.parallel,
    t.kidsPackages.schoolPackage.items.homework,
    t.kidsPackages.schoolPackage.items.exams,
    t.kidsPackages.schoolPackage.items.support,
    t.kidsPackages.schoolPackage.items.duration,
    t.kidsPackages.schoolPackage.items.options,
  ];

  return (
    <section
      id="kids-packages"
      className="scroll-section py-16 md:py-24"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-landing-purple-dark mb-4">
            {t.kidsPackages.title[language]}
          </h2>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
            {t.kidsPackages.description[language]}
          </p>
        </div>

        {/* Package Cards + Blob */}
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* Two Package Columns */}
          <div className="flex-1 grid md:grid-cols-2 gap-6">
            {/* Classic Package */}
            <div className="bg-landing-purple/20 backdrop-blur-sm rounded-3xl p-6 shadow-lg">
              <h3 className="text-xl md:text-2xl font-bold text-landing-purple-dark mb-2">
                {t.kidsPackages.classicPackage.title[language]}
              </h3>
              <p className="text-sm font-medium text-foreground/70 mb-4">
                {t.kidsPackages.classicPackage.subtitle[language]}
              </p>
              <ul className="space-y-3">
                {classicItems.map((item, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-landing-purple-dark flex-shrink-0 mt-0.5" />
                    <span className="text-sm md:text-base text-foreground">
                      {item[language]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* School Support Package */}
            <div className="bg-landing-purple/20 backdrop-blur-sm rounded-3xl p-6 shadow-lg">
              <h3 className="text-xl md:text-2xl font-bold text-landing-purple-dark mb-2">
                {t.kidsPackages.schoolPackage.title[language]}
              </h3>
              <p className="text-sm font-medium text-foreground/70 mb-4">
                {t.kidsPackages.schoolPackage.subtitle[language]}
              </p>
              <ul className="space-y-3">
                {schoolItems.map((item, index) => (
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
            <button
              onClick={scrollToContact}
              className="mt-6 px-4 py-2 bg-landing-yellow text-foreground rounded-full text-sm font-medium hover:bg-landing-yellow/80 transition-colors shadow-md"
            >
              {t.kidsPackages.moreInfo[language]} →
            </button>
          </div>
        </div>

        {/* Mobile CTA */}
        <div className="lg:hidden flex justify-center mt-8">
          <button
            onClick={scrollToContact}
            className="px-6 py-3 bg-landing-yellow text-foreground rounded-full text-base font-medium hover:bg-landing-yellow/80 transition-colors shadow-md"
          >
            {t.kidsPackages.moreInfo[language]} →
          </button>
        </div>
      </div>
    </section>
  );
}
