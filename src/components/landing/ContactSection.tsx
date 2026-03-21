import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Phone, Globe, Mail, Check, User } from "lucide-react";
const whatsappLogo = "/uploads/whatsappLogo.png";
const instagramLogo = "/uploads/instagramLogo.png";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const FORMSPREE_ENDPOINT = "https://formspree.io/f/mzdjgzzo";

export function ContactSection() {
  const { language, t } = useLanguage();
  const [formData, setFormData] = useState({
    fullName: "",
    studentAge: "",
    phone: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const whatsappMessage =
    language === "tr"
      ? "Merhaba, ücretsiz deneme dersi hakkında bilgi almak istiyorum."
      : "Hello, I would like to get information about the free trial lesson.";
  const whatsappLink = `https://wa.me/905306792831?text=${encodeURIComponent(whatsappMessage)}`;
  const instagramLink = "https://instagram.com/englishwithdilarateacher";
  const whyItems = [
    t.contact.whyCard.items.personalProgram,
    t.contact.whyCard.items.oneOnOne,
    t.contact.whyCard.items.tracking,
    t.contact.whyCard.items.freeTrial,
  ];
  const ageOptions = [
    {
      value: "myself",
      label: t.contact.form.ageOptions.myself,
    },
    {
      value: "4-6",
      label: t.contact.form.ageOptions.age4_6,
    },
    {
      value: "7-9",
      label: t.contact.form.ageOptions.age7_9,
    },
    {
      value: "10-12",
      label: t.contact.form.ageOptions.age10_12,
    },
    {
      value: "13-15",
      label: t.contact.form.ageOptions.age13_15,
    },
    {
      value: "16-18",
      label: t.contact.form.ageOptions.age16_18,
    },
  ];

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
    <section id="contact" className="scroll-section py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-landing-purple-dark mb-4">
            {t.contact.title[language]}
          </h2>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
            {t.contact.description[language]}
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 px-6 py-4 bg-landing-yellow text-foreground rounded-2xl font-medium text-lg hover:bg-landing-yellow/80 transition-colors shadow-lg"
          >
            <img src={whatsappLogo} alt="WhatsApp" className="w-6 h-6" />
            {t.contact.whatsapp[language]}
          </a>
          <a
            href={instagramLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 px-6 py-4 bg-landing-pink text-foreground rounded-2xl font-medium text-lg hover:bg-landing-pink/80 transition-colors shadow-lg"
          >
            <img src={instagramLogo} alt="Instagram" className="w-6 h-6" />
            {t.contact.instagram[language]}
          </a>
        </div>

        {/* Three Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
          {/* Left - Contact Cards */}
          <div className="flex flex-col self-start space-y-4 w-full min-w-0 lg:max-w-sm">
            {/* Contact Card */}
            <div className="w-full max-w-full rounded-2xl bg-landing-yellow/40 backdrop-blur-sm p-4 sm:p-5 shadow-lg">
              <div className="space-y-3">
                <div className="flex items-start gap-3 min-w-0">
                  <Phone className="w-5 h-5 text-foreground/70 shrink-0 mt-0.5" />
                  <span className="text-sm sm:text-base font-medium min-w-0 break-words">0530 679 2831</span>
                </div>

                <div className="flex items-start gap-3 min-w-0">
                  <Globe className="w-5 h-5 text-foreground/70 shrink-0 mt-0.5" />
                  <span className="text-sm sm:text-base font-medium min-w-0 break-words">englishwithdilara.com</span>
                </div>

                <div className="flex items-start gap-3 min-w-0">
                  <Mail className="w-5 h-5 text-foreground/70 shrink-0 mt-0.5" />
                  <span className="text-sm sm:text-base font-medium min-w-0 break-all">
                    admin@englishwithdilara.com
                  </span>
                </div>
              </div>
            </div>

            {/* Why Card */}
            <div className="hidden lg:block w-full rounded-2xl bg-landing-purple/20 backdrop-blur-sm p-4 sm:p-5 shadow-lg">
              <h3 className="text-lg font-bold text-landing-purple-dark mb-4">{t.contact.whyCard.title[language]}</h3>
              <ul className="space-y-2">
                {whyItems.map((item, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-landing-purple-dark flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-foreground">{item[language]}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Center - Form */}
          <div className="w-full min-w-0 mx-auto lg:mx-0">
            <div className="w-full max-w-[340px] sm:max-w-[380px] mx-auto">
              <div className="overflow-hidden bg-secondary/80 rounded-[20px] p-3 shadow-lg">
                <div className="overflow-hidden bg-card/70 backdrop-blur-sm rounded-[16px] p-4">
                  <h3 className="text-lg font-bold text-foreground mb-4">{t.contact.form.title[language]}</h3>

                  <form onSubmit={handleSubmit} className="space-y-3">
                    <input type="text" name="_gotcha" style={{ display: "none" }} tabIndex={-1} autoComplete="off" />

                    <div className="relative min-w-0">
                      <input
                        type="text"
                        name="fullName"
                        placeholder={t.contact.form.fullName[language]}
                        value={formData.fullName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            fullName: e.target.value,
                          })
                        }
                        required
                        autoComplete="name"
                        maxLength={100}
                        className="w-full min-w-0 h-9 px-3 pr-10 bg-input border border-border rounded-xl
                           placeholder:text-muted-foreground text-base md:text-sm text-foreground
                           focus:ring-2 focus:ring-pink-400 focus:outline-none"
                      />
                      <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    </div>

                    <Select
                      value={formData.studentAge}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          studentAge: value,
                        })
                      }
                      required
                    >
                      <SelectTrigger
                        className="w-full min-w-0 h-9 bg-input border border-border rounded-xl text-base md:text-sm
                           placeholder:text-muted-foreground
                           focus:ring-2 focus:ring-pink-400 focus:outline-none
                           [&>span]:text-muted-foreground [&>span]:data-[state=selected]:text-foreground"
                      >
                        <SelectValue placeholder={t.contact.form.studentAge[language]} />
                      </SelectTrigger>
                      <SelectContent className="z-[60] rounded-xl">
                        {ageOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value} className="text-sm">
                            {option.label[language]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="flex min-w-0 overflow-hidden rounded-xl">
                      <div
                        className="flex-shrink-0 flex items-center px-3 bg-muted
                           text-sm font-medium text-muted-foreground border-r border-border/60 h-9"
                      >
                        +90
                      </div>
                      <input
                        type="tel"
                        name="phone"
                        placeholder={t.contact.form.phone[language]}
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            phone: e.target.value,
                          })
                        }
                        required
                        autoComplete="tel"
                        maxLength={15}
                        className="min-w-0 flex-1 h-9 px-3 bg-input border border-border
                           placeholder:text-muted-foreground text-base md:text-sm text-foreground
                           focus:ring-2 focus:ring-pink-400 focus:outline-none"
                      />
                    </div>

                    <textarea
                      name="message"
                      placeholder={t.contact.form.message[language]}
                      value={formData.message}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          message: e.target.value,
                        })
                      }
                      maxLength={1000}
                      className="w-full min-w-0 min-h-[80px] px-3 py-2 bg-input border border-border rounded-xl
                         placeholder:text-muted-foreground text-sm sm:text-base text-foreground resize-none
                         focus:ring-2 focus:ring-pink-400 focus:outline-none"
                    />

                    <button
                      type="submit"
                      disabled={isSubmitting || submitted}
                      className="w-full h-10 rounded-xl font-bold text-amber-900 dark:text-amber-100
                         bg-gradient-to-b from-yellow-300 to-landing-yellow
                         hover:brightness-105 active:translate-y-[1px] transition-all
                         shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isSubmitting
                        ? t.contact.form.sending[language]
                        : submitted
                          ? t.contact.form.submitted[language]
                          : t.contact.form.submit[language]}
                    </button>

                    <p className="text-xs text-center text-muted-foreground mt-2">{t.contact.form.note[language]}</p>
                  </form>
                </div>
              </div>
            </div>
          </div>

          {/* Right - Character */}
          <div className="hidden lg:flex items-end justify-end overflow-hidden min-w-0">
            <img
              src="/uploads/dilarateacher.png"
              alt="Dilara Teacher"
              className="w-48 h-auto md:w-64 lg:w-80 xl:w-96 object-contain drop-shadow-xl"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
