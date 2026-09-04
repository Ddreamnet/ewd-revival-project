/**
 * WhatsApp'a gidilirken kutuya hazır düşen mesaj.
 *
 * Hero ve İletişim bölümlerinin ikisi de aynı metni kullanıyor; ziyaretçi
 * hangi dilde geziniyorsa mesaj da o dilde açılsın diye tek yerde duruyor.
 */
import type { Language } from "@/lib/translations";

export const WHATSAPP_NUMBER = "905306792831";

const TRIAL_MESSAGE: Record<Language, string> = {
  tr: "Merhaba, ücretsiz deneme dersi hakkında bilgi almak istiyorum.",
  en: "Hello, I would like information about the free trial lesson.",
  fr: "Bonjour, je souhaite des informations sur le cours d'essai gratuit.",
  ru: "Здравствуйте, я хотел бы узнать о бесплатном пробном уроке.",
  es: "Hola, me gustaría recibir información sobre la clase de prueba gratuita.",
  de: "Hallo, ich hätte gern Informationen zur kostenlosen Probestunde.",
  ar: "مرحباً، أودّ الحصول على معلومات عن الدرس التجريبي المجاني.",
};

/** Deneme dersi mesajı hazır gelen `wa.me` bağlantısı. */
export function whatsappTrialLink(language: Language): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(TRIAL_MESSAGE[language])}`;
}
