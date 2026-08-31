import { useRef, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { Footer } from '@/components/landing/Footer';
import { BackSwipeWrapper } from '@/components/BackSwipeWrapper';
import { toast } from 'sonner';

const FORMSPREE_ENDPOINT = 'https://formspree.io/f/mwvrbpvp';

export default function WorkWithUsPage() {
  const { language, t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setIsSubmitting(true);
    try {
      const fd = new FormData(e.currentTarget);
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        body: fd,
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        formRef.current?.reset();
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
    <BackSwipeWrapper>
      <div className="landing-body ewd-light min-h-screen">
        <LandingHeader />

        <main
          className="ewd-grid-paper px-5 pb-20 pt-12 sm:px-8"
          style={{ backgroundColor: '#FBF5FF', ['--grid' as string]: '#E9DBF7' }}
        >
          <div className="mx-auto grid max-w-[900px] items-center gap-10 lg:grid-cols-[1fr_380px]">
            <div className="flex flex-col items-start gap-3">
              <span className="ewd-label rounded-full bg-[#A253BE] px-5 py-2.5 text-white">
                {t.footer.workWithUs[language]}
              </span>
              <h1 className="ewd-h2 mt-1">{t.workWithUs.title[language]}</h1>
              <p className="ewd-lead max-w-[420px]">{t.workWithUs.note[language]}</p>
              <img
                src="/ewd/assets/art-graduation.png"
                alt=""
                aria-hidden="true"
                className="mt-4 hidden w-[220px] lg:block"
                style={{ filter: 'drop-shadow(0 12px 18px rgba(46,16,101,0.18))' }}
              />
            </div>

            <div
              className="rounded-[34px] border-[3px] px-6 py-7 sm:px-7"
              style={{
                background: '#FFFDF8',
                borderColor: 'var(--ewd-pink-line)',
                boxShadow: '0 26px 44px -26px rgba(46,16,101,0.4)',
              }}
            >
              <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
                {/* Honeypot anti-spam */}
                <input type="text" name="_gotcha" className="hidden" tabIndex={-1} autoComplete="off" />

                <input
                  type="text"
                  name="fullName"
                  className="ewd-field"
                  placeholder={t.workWithUs.fullName[language]}
                  required
                  autoComplete="name"
                />
                <input
                  type="text"
                  name="age"
                  className="ewd-field"
                  placeholder={t.workWithUs.age[language]}
                  required
                  inputMode="numeric"
                />
                <input
                  type="text"
                  name="university"
                  className="ewd-field"
                  placeholder={t.workWithUs.university[language]}
                  required
                  autoComplete="organization"
                />
                <input
                  type="text"
                  name="department"
                  className="ewd-field"
                  placeholder={t.workWithUs.department[language]}
                  required
                />
                <input
                  type="email"
                  name="email"
                  className="ewd-field"
                  placeholder={t.workWithUs.email[language]}
                  required
                  autoComplete="email"
                />

                <div className="flex gap-2.5">
                  <span className="ewd-field !w-auto shrink-0 font-bold text-[#6B5B7B]">+90</span>
                  <input
                    type="tel"
                    name="phone"
                    className="ewd-field"
                    placeholder={t.workWithUs.phone[language]}
                    required
                    inputMode="numeric"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="ewd-btn ewd-btn--purple w-full disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting
                    ? t.workWithUs.sending[language]
                    : submitted
                      ? t.workWithUs.submitted[language]
                      : t.workWithUs.submit[language]}
                </button>

                <p className="text-center text-[12px] leading-relaxed text-[#9A87AC]">
                  {t.workWithUs.note[language]}
                </p>
              </form>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </BackSwipeWrapper>
  );
}
