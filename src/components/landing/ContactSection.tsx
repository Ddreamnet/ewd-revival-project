import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Phone, Globe, Mail, Check, User } from "lucide-react";
import whatsappLogo from "@/assets/whatsappLogo.png";
import instagramLogo from "@/assets/instagramLogo.png";
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
          <div className="w-full max-w-[340px] mx-auto lg:mx-0">
            {/* Dış Pembe Çerçeve */}
            <div className="bg-pink-200/70 rounded-[20px] p-3 shadow-lg">
              {/* İç Panel - Lila/Beyaz */}
              <div className="bg-white/60 backdrop-blur-sm rounded-[16px] p-4">
                {/* Başlık */}
                <h3 className="text-lg font-bold text-purple-900 mb-4">
                  {t.contact.form.title[language]}
                </h3>
                
                <form onSubmit={handleSubmit} className="space-y-3">
                  {/* Ad Soyad - Sağda User ikonu */}
                  <div className="relative">
                    <input 
                      type="text"
                      placeholder={t.contact.form.fullName[language]}
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="w-full h-9 px-3 pr-10 bg-purple-100/60 border-0 rounded-xl 
                                 placeholder:text-purple-400 text-sm text-foreground
                                 focus:ring-2 focus:ring-pink-300 focus:outline-none"
                    />
                    <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
                  </div>
                  
                  {/* Select - Öğrenci yaşı */}
                  <Select
                    value={formData.studentAge}
                    onValueChange={(value) => setFormData({ ...formData, studentAge: value })}
                  >
                    <SelectTrigger className="h-9 bg-purple-100/60 border-0 rounded-xl text-sm 
                                               placeholder:text-purple-400 
                                               focus:ring-2 focus:ring-pink-300 focus:outline-none
                                               [&>span]:text-purple-400 [&>span]:data-[state=selected]:text-foreground">
                      <SelectValue placeholder={t.contact.form.studentAge[language]} />
                    </SelectTrigger>
                    <SelectContent className="bg-white z-[60] rounded-xl border-purple-200/50">
                      {ageOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="text-sm">
                          {option.label[language]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {/* Telefon - +90 prefix birleşik */}
                  <div className="flex">
                    <div className="flex items-center px-3 bg-purple-100/80 rounded-l-xl 
                                    text-sm font-medium text-purple-700 border-r border-purple-200/50 h-9">
                      +90
                    </div>
                    <input 
                      type="tel"
                      placeholder={t.contact.form.phone[language]}
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="flex-1 h-9 px-3 bg-purple-100/60 border-0 rounded-r-xl 
                                 placeholder:text-purple-400 text-sm text-foreground
                                 focus:ring-2 focus:ring-pink-300 focus:outline-none"
                    />
                  </div>
                  
                  {/* Mesaj Textarea */}
                  <textarea 
                    placeholder={t.contact.form.message[language]}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full min-h-[80px] px-3 py-2 bg-purple-100/60 border-0 rounded-xl 
                               placeholder:text-purple-400 text-sm text-foreground resize-none
                               focus:ring-2 focus:ring-pink-300 focus:outline-none"
                  />
                  
                  {/* Sarı Gönder Butonu */}
                  <button 
                    type="submit"
                    className="w-full h-10 rounded-xl font-bold text-amber-900
                               bg-gradient-to-b from-yellow-300 to-landing-yellow
                               hover:brightness-105 active:translate-y-[1px] transition-all
                               shadow-sm"
                  >
                    {t.contact.form.submit[language]}
                  </button>
                  
                  {/* Alt açıklama */}
                  <p className="text-xs text-center text-purple-700/70 mt-2">
                    {t.contact.form.note[language]}
                  </p>
                </form>
              </div>
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
