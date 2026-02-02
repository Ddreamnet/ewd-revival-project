import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Phone, Globe, Mail, Check } from "lucide-react";
import whatsappLogo from "@/assets/whatsappLogo.png";
import instagramLogo from "@/assets/instagramLogo.png";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ContactSection() {
  const { language, t } = useLanguage();
  const [formData, setFormData] = useState({
    fullName: "",
    studentAge: "",
    phone: "",
    message: "",
  });

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
    { value: "myself", label: t.contact.form.ageOptions.myself },
    { value: "4-6", label: t.contact.form.ageOptions.age4_6 },
    { value: "7-9", label: t.contact.form.ageOptions.age7_9 },
    { value: "10-12", label: t.contact.form.ageOptions.age10_12 },
    { value: "13-15", label: t.contact.form.ageOptions.age13_15 },
    { value: "16-18", label: t.contact.form.ageOptions.age16_18 },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Form submission logic here
    console.log("Form submitted:", formData);
  };

  return (
    <section id="contact" className="scroll-section py-16 md:py-24 pb-safe">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8 md:mb-12">
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
        <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Left - Contact Cards */}
          <div className="space-y-4">
            {/* Yellow Contact Info Card */}
            <div className="bg-landing-yellow/40 backdrop-blur-sm rounded-2xl p-5 shadow-lg">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-foreground/70" />
                  <span className="text-base font-medium">0530 679 2831</span>
                </div>
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-foreground/70" />
                  <span className="text-base font-medium">englishwithdilara.com</span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-foreground/70" />
                  <span className="text-base font-medium">englishwithdilara@gmail.com</span>
                </div>
              </div>
            </div>

            {/* Why Card */}
            <div className="bg-landing-purple/20 backdrop-blur-sm rounded-2xl p-5 shadow-lg">
              <h3 className="text-lg font-bold text-landing-purple-dark mb-4">{t.contact.whyCard.title[language]}</h3>
              <ul className="space-y-2">
                {whyItems.map((item, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-landing-purple-dark flex-shrink-0" />
                    <span className="text-sm text-foreground">{item[language]}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Center - Form */}
          <div className="lg:col-span-1">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
              <h3 className="text-xl font-bold text-foreground mb-6">{t.contact.form.title[language]}</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  placeholder={t.contact.form.fullName[language]}
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="bg-white/50"
                />
                <Select
                  value={formData.studentAge}
                  onValueChange={(value) => setFormData({ ...formData, studentAge: value })}
                >
                  <SelectTrigger className="bg-white/50">
                    <SelectValue placeholder={t.contact.form.studentAge[language]} />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-[60]">
                    {ageOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label[language]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <div className="flex items-center justify-center px-3 bg-muted rounded-md text-sm font-medium">
                    +90
                  </div>
                  <Input
                    placeholder={t.contact.form.phone[language]}
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="flex-1 bg-white/50"
                  />
                </div>
                <Textarea
                  placeholder={t.contact.form.message[language]}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  rows={4}
                  className="bg-white/50"
                />
                <Button type="submit" className="w-full bg-landing-purple hover:bg-landing-purple-dark text-white">
                  {t.contact.form.submit[language]}
                </Button>
                <p className="text-xs text-center text-muted-foreground">{t.contact.form.note[language]}</p>
              </form>
            </div>
          </div>

          {/* Right - Character */}
          <div className="hidden lg:flex items-end justify-center">
            <img
              src="/uploads/dilarateacher.png"
              alt="Dilara Teacher"
              className="w-48 xl:w-64 h-auto object-contain drop-shadow-xl"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
