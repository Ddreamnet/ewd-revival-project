import { HeroBook } from "./HeroBook";

export function HeroSection() {
  return (
    <section id="hero" className="scroll-section min-h-screen flex items-center pt-24 md:pt-28 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-8 lg:gap-12">
          {/* Animated Book - Left */}
          <HeroBook />

          {/* Character Image - Right */}
          <div className="flex-shrink-0 animate-float">
            <img
              src="/uploads/dilarateacher.png"
              alt="Dilara Teacher"
              className="w-40 h-auto md:w-48 lg:w-72 xl:w-96 object-contain drop-shadow-xl"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
