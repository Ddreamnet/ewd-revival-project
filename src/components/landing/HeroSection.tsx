import { useLanguage } from '@/contexts/LanguageContext';

export function HeroSection() {
  const { language, t } = useLanguage();

  return (
    <section
      id="hero"
      className="scroll-section min-h-screen flex items-center pt-24 md:pt-28 pb-12"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-12">
          {/* Character Image - Left */}
          <div className="flex-shrink-0 animate-float">
            <img
              src="/uploads/dilarateacher.png"
              alt="Dilara Teacher"
              className="w-48 h-auto md:w-64 lg:w-80 xl:w-96 object-contain drop-shadow-xl"
            />
          </div>

          {/* Book/Card Panel - Right */}
          <div className="animate-breathe">
            <div
              className="relative bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-6 md:p-10 lg:p-12 transform -rotate-2 max-w-md md:max-w-lg"
              style={{ boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.15)' }}
            >
              {/* Book spine effect */}
              <div className="absolute left-0 top-4 bottom-4 w-2 bg-gradient-to-b from-landing-purple/40 via-landing-pink/40 to-landing-purple/40 rounded-l-lg" />
              
              <div className="pl-4">
                {/* Title */}
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-landing-purple-dark leading-tight">
                  ENGLISH
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground mt-1">with</p>
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-aprilia text-landing-purple-dark mt-1">
                  DILARA
                </h2>

                {/* Subtitles */}
                <div className="mt-6 space-y-3">
                  <p className="text-base md:text-lg text-foreground/80 leading-relaxed">
                    {t.hero.subtitle1[language]}
                  </p>
                  <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                    {t.hero.subtitle2[language]}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
