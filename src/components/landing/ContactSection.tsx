import { useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { whatsappTrialLink } from "@/lib/whatsapp";
import { languageName } from "@/lib/translations";

const FORMSPREE_ENDPOINT = "https://formspree.io/f/mzdjgzzo";
const INSTAGRAM_URL = "https://instagram.com/englishwithdilarateacher";

const WHY_ITEMS = ["personalProgram", "oneOnOne", "tracking", "freeTrial"] as const;

/** İletişim — sol bilgi kartları, ortada form, sağda maskot. */
export function ContactSection() {
  const { language, t } = useLanguage();
  const [formData, setFormData] = useState({ fullName: "", studentAge: "", phone: "", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const whatsappLink = whatsappTrialLink(language);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("fullName", formData.fullName.trim());
      fd.append("studentAge", formData.studentAge);
      fd.append("phone", formData.phone.trim());
      fd.append("message", formData.message.trim());
      fd.append("_gotcha", ""); // honeypot
      // Ziyaretçinin sitedeki dili de gitsin — başvuruya hangi dilde
      // dönüleceği aksi hâlde belli olmuyor.
      fd.append("siteLanguage", languageName(language));

      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: "POST",
        body: fd,
        headers: { Accept: "application/json" },
      });

      if (res.ok) {
        setFormData({ fullName: "", studentAge: "", phone: "", message: "" });
        setSubmitted(true);
        toast.success(t.contact.form.success[language]);
        setTimeout(() => setSubmitted(false), 3000);
      } else {
        toast.error(t.contact.form.error[language]);
      }
    } catch {
      toast.error(t.contact.form.error[language]);
    }
    setIsSubmitting(false);
  };

  return (
    <section
      id="contact"
      className="scroll-section relative overflow-hidden px-5 pt-20 sm:px-8 md:pt-24"
      style={{ background: "var(--ewd-cream)" }}
    >
      <div className="mx-auto flex max-w-[1180px] flex-col items-center gap-3">
        <h2 className="ewd-h2 text-center">{t.contact.title[language]}</h2>
        <p className="ewd-lead max-w-[600px] text-center">{t.contact.description[language]}</p>

        <div className="flex flex-col gap-4 pt-4 sm:flex-row">
          <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="ewd-btn ewd-btn--wa">
            <img src="/uploads/whatsappLogo.png" alt="" className="h-[30px] w-[30px]" />
            {t.contact.whatsapp[language]}
          </a>
          <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="ewd-btn ewd-btn--pink !pl-4">
            <img src="/uploads/instagramLogo.png" alt="" className="h-[30px] w-[30px] rounded-lg" />
            {t.contact.instagram[language]}
          </a>
        </div>

        <div className="grid w-full items-end gap-8 pt-12 lg:grid-cols-[366px_1fr_292px]">
          {/* --------------------------------------------------- bilgi kartları */}
          <div className="flex flex-col gap-4 pb-6">
            <div
              className="relative flex flex-col gap-3.5 overflow-hidden rounded-[32px] border-[3px] px-6 py-6"
              style={{ background: "var(--ewd-yellow-pale)", borderColor: "var(--ewd-yellow)" }}
            >
              <span
                className="pointer-events-none absolute inset-0 opacity-[0.45]"
                style={{ backgroundImage: "url(/ewd/pat/tile-dot-yellow.png)", backgroundSize: "104px" }}
                aria-hidden="true"
              />
              <InfoRow icon="icon-call.png" text="0530 679 2831" />
              <InfoRow icon="icon-globe.png" text="englishwithdilara.com" />
              <InfoRow icon="icon-mail.png" text="admin@englishwithdilara.com" />
            </div>

            <div
              className="flex flex-col gap-3 rounded-[32px] border-[3px] px-6 py-5"
              style={{ background: "var(--ewd-lilac-soft)", borderColor: "var(--ewd-lilac-line-soft)" }}
            >
              <span className="text-[14px] font-extrabold tracking-[0.04em] text-[#5B21B6] sm:text-[15px]">
                {t.contact.whyCard.title[language]}
              </span>
              <ul className="flex flex-col gap-2.5">
                {WHY_ITEMS.map((key) => (
                  <li key={key} className="flex items-center gap-2.5 text-[14px] font-semibold text-[#4C3A5E]">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-[#A253BE]" aria-hidden="true" />
                    {t.contact.whyCard.items[key][language]}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* --------------------------------------------------------- form */}
          <div
            className="flex flex-col gap-3.5 rounded-[34px] border-[3px] px-6 pb-7 pt-7 sm:px-[30px]"
            style={{
              background: "#FFFDF8",
              borderColor: "var(--ewd-pink-line)",
              boxShadow: "0 26px 44px -26px rgba(46,16,101,0.4)",
            }}
          >
            <span className="text-[21px] font-black tracking-[-0.01em] text-[#2E1065]">
              {t.contact.form.title[language]}
            </span>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input type="text" name="_gotcha" className="hidden" tabIndex={-1} autoComplete="off" />

              <input
                type="text"
                name="fullName"
                className="ewd-field"
                placeholder={t.contact.form.fullName[language]}
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                required
                autoComplete="name"
                maxLength={100}
              />

              {/* Yaşı veli kendi yazsın — hazır aralık listesi yerine serbest alan. */}
              <input
                type="text"
                name="studentAge"
                className="ewd-field"
                placeholder={t.contact.form.studentAge[language]}
                value={formData.studentAge}
                onChange={(e) => setFormData({ ...formData, studentAge: e.target.value })}
                required
                maxLength={40}
              />

              <div className="flex gap-2.5">
                <span className="ewd-field !w-auto shrink-0 font-bold text-[#6B5B7B]">+90</span>
                <input
                  type="tel"
                  name="phone"
                  className="ewd-field"
                  placeholder={t.contact.form.phone[language]}
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                  autoComplete="tel"
                  maxLength={15}
                />
              </div>

              <textarea
                name="message"
                className="ewd-field min-h-[92px] resize-none"
                placeholder={t.contact.form.message[language]}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                maxLength={1000}
              />

              <button
                type="submit"
                disabled={isSubmitting || submitted}
                className="ewd-btn ewd-btn--purple w-full disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting
                  ? t.contact.form.sending[language]
                  : submitted
                    ? t.contact.form.submitted[language]
                    : t.contact.form.submit[language]}
              </button>

              <p className="text-center text-[12px] leading-relaxed text-[#9A87AC]">
                {t.contact.form.note[language]}
              </p>
            </form>
          </div>

          {/* ------------------------------------------------------- maskot */}
          <div className="hidden items-end justify-center lg:flex">
            <img
              src="/uploads/dilarateacher.png"
              alt=""
              aria-hidden="true"
              className="h-[420px] w-auto"
              style={{ filter: "drop-shadow(0 18px 24px rgba(46,16,101,0.18))" }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function InfoRow({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="relative flex items-center gap-3.5">
      <img src={`/ewd/assets/${icon}`} alt="" aria-hidden="true" className="w-[42px] shrink-0" />
      <span className="min-w-0 break-words text-[14px] font-bold text-[#4C3A5E] sm:text-[15px]">{text}</span>
    </div>
  );
}
