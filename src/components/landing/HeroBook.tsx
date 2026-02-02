import { useLanguage } from '@/contexts/LanguageContext';

export function HeroBook() {
  const { language, t } = useLanguage();

  return (
    <div className="hero-book-wrap">
      <div className="hero-book hero-book--alive">
        {/* Spine */}
        <div className="hero-book__spine" />
        
        {/* Pages edge */}
        <div className="hero-book__pages" />
        
        {/* Cover */}
        <div className="hero-book__cover">
          {/* Stitches */}
          <div className="hero-book__stitches" />
          
          {/* Corners */}
          <div className="hero-book__corner hero-book__corner--a" />
          <div className="hero-book__corner hero-book__corner--b" />
          
          {/* Dots */}
          <div className="hero-book__dot hero-book__dot--1" />
          <div className="hero-book__dot hero-book__dot--2" />
          
          {/* Content */}
          <div className="hero-book__content">
            <span className="hero-book__english">ENGLISH</span>
            <span className="hero-book__with">with</span>
            <span className="hero-book__dilara">DILARA</span>
            
            <p className="hero-book__lead">
              {t.hero.subtitle1[language]}
            </p>
            
            <p className="hero-book__sub">
              {t.hero.subtitle2[language]}
            </p>
            
            <span className="hero-book__mini">♡</span>
          </div>
        </div>
        
        {/* Sparkles */}
        <span className="hero-book__spark hero-book__spark--1">✦</span>
        <span className="hero-book__spark hero-book__spark--2">✦</span>
      </div>
    </div>
  );
}
