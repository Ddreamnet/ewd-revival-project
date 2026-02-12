import { useLanguage } from '@/contexts/LanguageContext';
import { Star, Sparkles, Monitor } from 'lucide-react';
export function WhySection() {
  const {
    language,
    t
  } = useLanguage();
  const features = [t.why.features.personalProgram, t.why.features.oneOnOne, t.why.features.liveZoom, t.why.features.speakingFocused, t.why.features.regularTracking, t.why.features.freeTrial];
  return <section id="why" className="scroll-section py-16 md:py-24 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Two column layout on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-4 items-center justify-items-center">
          
          {/* Left Column - Title (45%) */}
          <div className="lg:col-span-5 text-center lg:text-left relative">
            {/* Decorative sparkle near title */}
            <Star className="why-sparkle-blink absolute -top-4 -left-2 lg:left-0 w-6 h-6 text-landing-yellow opacity-60" fill="currentColor" />
            
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold leading-tight">
              <span className="text-foreground">{t.why.title[language]}</span>
              <br />
              <span className="text-landing-purple-dark text-4xl md:text-5xl lg:text-6xl">ENGLISH</span>
              <br />
              <span className="text-foreground/80 text-xl md:text-2xl font-semibold">with</span>
              <br />
              <span className="font-aprilia text-landing-purple-dark text-4xl md:text-5xl lg:text-6xl">DILARA</span>
              <span className="text-landing-yellow text-4xl md:text-5xl lg:text-6xl font-extrabold">?</span>
            </h2>

            {/* Decorative arrow/accent */}
            
          </div>

          {/* Right Column - Benefits Card + Preview (55%) */}
          <div className="lg:col-span-7 flex flex-col items-center lg:items-start gap-6">
            
            {/* Benefits Card - Sticker Style */}
            <div className="why-card-float relative w-full max-w-md">
              {/* Yellow clip decoration */}
              <div className="absolute -top-3 left-8 w-8 h-6 bg-landing-yellow rounded-b-lg shadow-md z-10" />
              <div className="absolute -top-1 left-9 w-6 h-2 bg-landing-yellow-light rounded-full" />
              
              {/* Sparkle on card */}
              <Sparkles className="why-sparkle-blink absolute -top-2 -right-2 w-5 h-5 text-landing-pink opacity-50" />

              {/* Card */}
              <div className="bg-landing-purple/30 border-[3px] border-landing-purple/50 rounded-[20px] p-5 md:p-6 shadow-xl backdrop-blur-sm">
                <ul className="space-y-3">
                  {features.map((feature, index) => <li key={index} className="flex items-center gap-3">
                      {/* Yellow bullet */}
                      <span className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-landing-yellow shadow-sm" />
                      <span className="text-base md:text-lg font-semibold text-foreground/90">
                        {feature[language]}
                      </span>
                    </li>)}
                </ul>
              </div>
            </div>

            {/* Preview Panel */}
            <div className="why-card-float relative w-48 md:w-56 lg:mr-8" style={{
            animationDelay: '0.5s'
          }}>
              {/* Sparkles around preview */}
              
              

              {/* Panel */}
              
            </div>
          </div>
        </div>
      </div>
    </section>;
}