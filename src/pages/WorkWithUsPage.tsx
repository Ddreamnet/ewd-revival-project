import { useState, useRef } from 'react';
import { User, Mail, Phone, GraduationCap, Building, Calendar } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { Footer } from '@/components/landing/Footer';
import { toast } from 'sonner';

const FORMSPREE_ENDPOINT = "https://formspree.io/f/YOUR_FORM_ID";

function WorkWithUsContent() {
  const { language, t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (FORMSPREE_ENDPOINT.includes('YOUR_FORM_ID')) {
      console.warn('[WorkWithUs] Formspree endpoint henüz yapılandırılmamış!');
      toast.error(t.workWithUs.formNotReady[language]);
      return;
    }

    setIsSubmitting(true);
    try {
      const fd = new FormData(e.currentTarget);
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        body: fd,
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        e.currentTarget.reset();
        setSubmitted(true);
        toast.success(t.workWithUs.success[language]);
        setTimeout(() => setSubmitted(false), 3000);
      } else {
        toast.error(t.workWithUs.error[language]);
      }
    } catch {
      toast.error(t.workWithUs.error[language]);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="landing-body min-h-screen overflow-x-hidden">
      <LandingHeader />
      <main className="pt-28 md:pt-32 pb-16 px-4">
        <div className="max-w-md mx-auto">
          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-bold text-landing-purple-dark text-center mb-8">
            {t.workWithUs.title[language]}
          </h1>

          {/* Pink frame + white inner panel (matching ContactSection) */}
          <div className="bg-secondary/80 rounded-[20px] p-3 shadow-lg w-full max-w-[400px] mx-auto">
            <div className="bg-card/70 backdrop-blur-sm rounded-[16px] p-4">
              <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
                {/* Ad Soyad */}
                <div className="relative">
                  <input
                    type="text"
                    name="fullName"
                    placeholder={t.workWithUs.fullName[language]}
                    required
                    className="w-full h-9 px-3 pr-10 bg-input border border-border rounded-xl placeholder:text-muted-foreground text-sm text-foreground focus:ring-2 focus:ring-pink-400 focus:outline-none"
                  />
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                </div>

                {/* Yaş */}
                <div className="relative">
                  <input
                    type="text"
                    name="age"
                    placeholder={t.workWithUs.age[language]}
                    required
                    inputMode="numeric"
                    className="w-full h-9 px-3 pr-10 bg-purple-200/70 border-0 rounded-xl placeholder:text-purple-500 text-sm text-foreground focus:ring-2 focus:ring-pink-400 focus:outline-none"
                  />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500" />
                </div>

                {/* Üniversite */}
                <div className="relative">
                  <input
                    type="text"
                    name="university"
                    placeholder={t.workWithUs.university[language]}
                    required
                    className="w-full h-9 px-3 pr-10 bg-purple-200/70 border-0 rounded-xl placeholder:text-purple-500 text-sm text-foreground focus:ring-2 focus:ring-pink-400 focus:outline-none"
                  />
                  <Building className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500" />
                </div>

                {/* Bölüm */}
                <div className="relative">
                  <input
                    type="text"
                    name="department"
                    placeholder={t.workWithUs.department[language]}
                    required
                    className="w-full h-9 px-3 pr-10 bg-purple-200/70 border-0 rounded-xl placeholder:text-purple-500 text-sm text-foreground focus:ring-2 focus:ring-pink-400 focus:outline-none"
                  />
                  <GraduationCap className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500" />
                </div>

                {/* E-posta */}
                <div className="relative">
                  <input
                    type="email"
                    name="email"
                    placeholder={t.workWithUs.email[language]}
                    required
                    className="w-full h-9 px-3 pr-10 bg-purple-200/70 border-0 rounded-xl placeholder:text-purple-500 text-sm text-foreground focus:ring-2 focus:ring-pink-400 focus:outline-none"
                  />
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500" />
                </div>

                {/* Telefon +90 prefix */}
                <div className="flex">
                  <div className="flex items-center px-3 bg-purple-300/70 rounded-l-xl text-sm font-medium text-purple-800 border-r border-purple-300/60 h-9">
                    +90
                  </div>
                  <div className="relative flex-1">
                    <input
                      type="tel"
                      name="phone"
                      placeholder={t.workWithUs.phone[language]}
                      required
                      inputMode="numeric"
                      className="w-full h-9 px-3 pr-10 bg-purple-200/70 border-0 rounded-r-xl placeholder:text-purple-500 text-sm text-foreground focus:ring-2 focus:ring-pink-400 focus:outline-none"
                    />
                    <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500" />
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-10 rounded-xl font-bold text-amber-900 bg-gradient-to-b from-yellow-300 to-landing-yellow hover:brightness-105 active:translate-y-[1px] transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting
                    ? '...'
                    : submitted
                      ? t.workWithUs.submitted[language]
                      : t.workWithUs.submit[language]}
                </button>

                {/* Note */}
                <p className="text-xs text-center text-purple-700/70 mt-2">
                  {t.workWithUs.note[language]}
                </p>
              </form>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function WorkWithUsPage() {
  return (
    <LanguageProvider>
      <WorkWithUsContent />
    </LanguageProvider>
  );
}
