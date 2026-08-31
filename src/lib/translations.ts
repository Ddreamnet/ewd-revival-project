/**
 * Site sözlüğü — Türkçe / İngilizce / Fransızca.
 *
 * Her yaprak `{ tr, en, fr }` üçlüsüdür. `useLanguage()` seçili dile göre
 * okur; eksik bir dil bırakmayın — tip `Localized` bunu zorunlu kılar.
 */

export type Language = "tr" | "en" | "fr";

export const LANGUAGES: { code: Language; label: string; flag: string; name: string }[] = [
  { code: "tr", label: "TR", flag: "🇹🇷", name: "Türkçe" },
  { code: "en", label: "EN", flag: "🇬🇧", name: "English" },
  { code: "fr", label: "FR", flag: "🇫🇷", name: "Français" },
];

export type Localized = { tr: string; en: string; fr: string };

export const translations = {
  // ---------------------------------------------------------------- Header
  header: {
    lessons: { tr: "Dersler", en: "Lessons", fr: "Cours" },
    contact: { tr: "İletişim", en: "Contact", fr: "Contact" },
    blog: { tr: "Blog", en: "Blog", fr: "Blog" },
    words: { tr: "Günün Kelimeleri", en: "Words of the Day", fr: "Mots du jour" },
    wordsShort: { tr: "Kelimeler", en: "Words", fr: "Mots" },
    login: { tr: "Giriş yap", en: "Log in", fr: "Connexion" },
    loginShort: { tr: "Giriş", en: "Log in", fr: "Connexion" },
    language: { tr: "Dil", en: "Language", fr: "Langue" },
    menu: { tr: "Menü", en: "Menu", fr: "Menu" },
    home: { tr: "Ana sayfa", en: "Home", fr: "Accueil" },
  },

  // ------------------------------------------------------------------ Hero
  hero: {
    badgeKids: { tr: "ÇOCUKLAR İÇİN", en: "FOR CHILDREN", fr: "POUR LES ENFANTS" },
    badgeAdults: { tr: "YETİŞKİNLER", en: "FOR ADULTS", fr: "POUR LES ADULTES" },
    lead: {
      tr: "Oyunla ve konuşarak ilerleyen online İngilizce dersleri. Her öğrenciye kendi programı, her ders sonunda veliye geri bildirim.",
      en: "Online English lessons built on play and conversation. A programme for every student, and feedback for parents after every lesson.",
      fr: "Des cours d'anglais en ligne fondés sur le jeu et la conversation. Un programme par élève et un retour aux parents après chaque cours.",
    },
    leadAdults: {
      tr: "İş ve günlük hayat için pratik odaklı online İngilizce. Seviyeniz, başlamadan önce yapılan seviye tespitiyle belirlenir.",
      en: "Practical online English for work and daily life. Your level is set with a placement test before you start.",
      fr: "Un anglais en ligne pratique pour le travail et la vie quotidienne. Votre niveau est défini par un test de placement avant de commencer.",
    },
    ctaTrial: { tr: "Ücretsiz deneme dersi", en: "Free trial lesson", fr: "Cours d'essai gratuit" },
    ctaWhatsapp: { tr: "WhatsApp", en: "WhatsApp", fr: "WhatsApp" },
    kidsCardTitle: { tr: "Çocuk\ndersleri", en: "Children's\nlessons", fr: "Cours\nenfants" },
    kidsCardSub: { tr: "30 dk · oyunla öğrenme", en: "30 min · learning through play", fr: "30 min · apprendre en jouant" },
    kidsCardCta: { tr: "Paketleri gör", en: "See packages", fr: "Voir les forfaits" },
    adultCardTitle: { tr: "Yetişkin\ndersleri", en: "Adult\nlessons", fr: "Cours\nadultes" },
    adultCardSub: { tr: "60 dk · A1–C1 seviyeleri", en: "60 min · levels A1–C1", fr: "60 min · niveaux A1–C1" },
    teacherAlt: { tr: "Dilara Öğretmen", en: "Dilara, your teacher", fr: "Dilara, votre professeure" },
  },

  // ---------------------------------------------------------------- Marquee
  marquee: {
    top: {
      tr: "SEVİYE TESPİT SINAVI · 30 DK ÇOCUK DERSİ",
      en: "PLACEMENT TEST · 30-MIN LESSONS FOR CHILDREN",
      fr: "TEST DE NIVEAU · COURS ENFANTS DE 30 MIN",
    },
    bottom: {
      tr: "ÜCRETSİZ DENEME DERSİ · KONUŞMA ODAKLI EĞİTİM · BİREBİR & GRUP",
      en: "FREE TRIAL LESSON · SPEAKING-FOCUSED TEACHING · ONE-TO-ONE & GROUP",
      fr: "COURS D'ESSAI GRATUIT · AXÉ SUR L'ORAL · INDIVIDUEL & EN GROUPE",
    },
  },

  // ------------------------------------------------------------ Sticky CTA
  stickyBubble: {
    line1: { tr: "ÜCRETSİZ", en: "FREE", fr: "GRATUIT" },
    line2: { tr: "Deneme", en: "Trial", fr: "Cours" },
    line3: { tr: "Dersi!", en: "Lesson!", fr: "d'essai !" },
    cta: { tr: "Hemen deneyin", en: "Try it now", fr: "Essayez-le" },
  },

  // --------------------------------------------------------------- Why EWD
  why: {
    title: { tr: "Neden", en: "Why", fr: "Pourquoi" },
    lead: {
      tr: "Her öğrenci için yaşına, seviyesine ve hedefine göre kurulan bir program — ve her ders sonunda veliye giden net bir geri bildirim.",
      en: "A programme built around each student's age, level and goals — plus clear feedback to parents after every lesson.",
      fr: "Un programme construit selon l'âge, le niveau et les objectifs de chaque élève — et un retour clair aux parents après chaque cours.",
    },
    cta: { tr: "Ücretsiz deneme dersi al", en: "Book a free trial lesson", fr: "Réserver un cours d'essai" },
    features: {
      personalProgram: { tr: "Kişiye özel program", en: "Personalised programme", fr: "Programme sur mesure" },
      oneOnOne: { tr: "Birebir & küçük gruplar", en: "One-to-one & small groups", fr: "Individuel & petits groupes" },
      liveZoom: { tr: "Canlı Zoom dersleri", en: "Live lessons on Zoom", fr: "Cours en direct sur Zoom" },
      speakingFocused: { tr: "Konuşma odaklı eğitim", en: "Speaking-focused teaching", fr: "Enseignement axé sur l'oral" },
      regularTracking: { tr: "Düzenli takip & geri bildirim", en: "Regular tracking & feedback", fr: "Suivi régulier & retours" },
      freeTrial: { tr: "Ücretsiz deneme dersi", en: "Free trial lesson", fr: "Cours d'essai gratuit" },
    },
  },

  // -------------------------------------------------------- Kids packages
  kidsPackages: {
    title: { tr: "Çocuk Ders\nPaketleri", en: "Lesson Packages\nfor Children", fr: "Forfaits de cours\npour enfants" },
    description: {
      tr: "Tüm ders paketleri öğrencinin yaşı, seviyesi ve ihtiyacına göre planlanır. Kayıt öncesi ücretsiz deneme dersinde birlikte karar veriyoruz.",
      en: "Every package is planned around the student's age, level and needs. We decide together in a free trial lesson before you enrol.",
      fr: "Chaque forfait est conçu selon l'âge, le niveau et les besoins de l'élève. Nous décidons ensemble lors du cours d'essai gratuit.",
    },
    classicPackage: {
      number: { tr: "1.", en: "1.", fr: "1." },
      titleTop: { tr: "TEMEL", en: "CORE", fr: "ANGLAIS" },
      titleBottom: { tr: "İNGİLİZCE", en: "ENGLISH", fr: "DE BASE" },
      slogan: {
        tr: "İngilizceyi sevdiren program",
        en: "The programme that makes English fun",
        fr: "Le programme qui fait aimer l'anglais",
      },
      footer: {
        tr: "Temelden güçlü bir başlangıç",
        en: "A strong start from the ground up",
        fr: "Un départ solide dès la base",
      },
      items: {
        lessonsPerWeek: {
          title: { tr: "Haftada 2 ders", en: "2 lessons a week", fr: "2 cours par semaine" },
          sub: { tr: "Düzenli ve verimli program", en: "A steady, effective rhythm", fr: "Un rythme régulier et efficace" },
        },
        speaking: {
          title: { tr: "Konuşma çalışmaları", en: "Speaking practice", fr: "Pratique de l'oral" },
          sub: {
            tr: "Akıcı konuşma becerileri kazandırır",
            en: "Builds fluency and confidence",
            fr: "Développe l'aisance à l'oral",
          },
        },
        coreEnglish: {
          title: { tr: "Temel İngilizce bilgisi", en: "Core English foundations", fr: "Bases de l'anglais" },
          sub: {
            tr: "Kelime, cümle ve dil bilgisi temelleri",
            en: "Vocabulary, sentences and grammar basics",
            fr: "Vocabulaire, phrases et bases de grammaire",
          },
        },
        listening: {
          title: { tr: "Dinleme ve anlama becerileri", en: "Listening and comprehension", fr: "Écoute et compréhension" },
          sub: {
            tr: "İngilizceyi anlayarak öğrenme",
            en: "Learning English by understanding it",
            fr: "Apprendre l'anglais en le comprenant",
          },
        },
        games: {
          title: {
            tr: "Oyunlar eşliğinde yeni kelimeler",
            en: "New words through games",
            fr: "Du vocabulaire par le jeu",
          },
          sub: {
            tr: "Eğlenceli aktivitelerle kalıcı öğrenme",
            en: "Fun activities that make learning stick",
            fr: "Des activités ludiques qui ancrent l'apprentissage",
          },
        },
        duration: {
          title: { tr: "30 dakikalık dersler", en: "30-minute lessons", fr: "Cours de 30 minutes" },
          sub: {
            tr: "Dijital ekran süresine uygun, verimli",
            en: "Screen-time friendly and effective",
            fr: "Adaptés au temps d'écran, et efficaces",
          },
        },
        options: {
          title: {
            tr: "Birebir ve grup ders seçeneği",
            en: "One-to-one and group options",
            fr: "Cours individuels ou en groupe",
          },
          sub: {
            tr: "İhtiyaca göre esnek ders tercihi",
            en: "Flexible, based on what's needed",
            fr: "Un choix flexible selon les besoins",
          },
        },
      },
    },
    schoolPackage: {
      number: { tr: "2.", en: "2.", fr: "2." },
      titleTop: { tr: "OKUL", en: "SCHOOL", fr: "ANGLAIS" },
      titleBottom: { tr: "İNGİLİZCESİ", en: "ENGLISH", fr: "SCOLAIRE" },
      slogan: {
        tr: "Okulda başarı, İngilizce ile mümkün",
        en: "Success at school starts with English",
        fr: "La réussite scolaire passe par l'anglais",
      },
      footer: {
        tr: "Okul notlarında görünür fark",
        en: "A visible difference in school grades",
        fr: "Une différence visible sur les notes",
      },
      items: {
        lessonsPerWeek: {
          title: { tr: "Haftada 2 ders", en: "2 lessons a week", fr: "2 cours par semaine" },
          sub: { tr: "Düzenli ve verimli program", en: "A steady, effective rhythm", fr: "Un rythme régulier et efficace" },
        },
        parallel: {
          title: {
            tr: "Okul konularıyla paralel ilerleme",
            en: "In step with the school syllabus",
            fr: "En parallèle du programme scolaire",
          },
          sub: {
            tr: "Derslerle tam uyumlu içerik",
            en: "Content matched to classwork",
            fr: "Un contenu aligné sur les cours",
          },
        },
        exams: {
          title: { tr: "Sınavlara destek", en: "Exam support", fr: "Soutien aux examens" },
          sub: {
            tr: "Sınavlara hazırlık ve pratik imkânı",
            en: "Preparation and practice for exams",
            fr: "Préparation et entraînement aux examens",
          },
        },
        homework: {
          title: { tr: "Ödevlerin birlikte yapılması", en: "Homework done together", fr: "Les devoirs faits ensemble" },
          sub: {
            tr: "Eksikler ders içinde kapatılır",
            en: "Gaps are closed during the lesson",
            fr: "Les lacunes se comblent en cours",
          },
        },
        support: {
          title: { tr: "Temel İngilizce ile destek", en: "Backed by core English", fr: "Appui sur les bases" },
          sub: {
            tr: "Gerektiğinde temele geri dönülür",
            en: "We go back to basics when needed",
            fr: "On revient aux bases si nécessaire",
          },
        },
        duration: {
          title: { tr: "30 dakikalık dersler", en: "30-minute lessons", fr: "Cours de 30 minutes" },
          sub: { tr: "Haftada iki kez, düzenli", en: "Twice a week, consistently", fr: "Deux fois par semaine, régulièrement" },
        },
        options: {
          title: {
            tr: "Birebir ve grup ders seçeneği",
            en: "One-to-one and group options",
            fr: "Cours individuels ou en groupe",
          },
          sub: {
            tr: "İhtiyaca göre esnek ders tercihi",
            en: "Flexible, based on what's needed",
            fr: "Un choix flexible selon les besoins",
          },
        },
      },
    },
    moreInfo: { tr: "Daha fazla bilgi için", en: "For more information", fr: "Pour en savoir plus" },
  },

  // ------------------------------------------------------- Adult packages
  adultPackages: {
    title: { tr: "Yetişkin Ders\nPaketi", en: "Lesson Package\nfor Adults", fr: "Forfait de cours\npour adultes" },
    description: {
      tr: "İş hayatı ve günlük hayat için pratik odaklı ilerleme. Seviye, eğitim öncesi yapılan seviye tespit sınavıyla belirlenir.",
      en: "Practical progress for work and daily life. Your level is set with a placement test before lessons begin.",
      fr: "Une progression pratique pour le travail et le quotidien. Le niveau est défini par un test de placement avant le début.",
    },
    adultPackage: {
      number: { tr: "3.", en: "3.", fr: "3." },
      titleTop: { tr: "YETİŞKİN", en: "ENGLISH", fr: "ANGLAIS" },
      titleBottom: { tr: "İNGİLİZCESİ", en: "FOR ADULTS", fr: "POUR ADULTES" },
      levels: { tr: "Seviyeler: A1 · A2 · B1 · B2 · C1", en: "Levels: A1 · A2 · B1 · B2 · C1", fr: "Niveaux : A1 · A2 · B1 · B2 · C1" },
      contents: { tr: "PAKET İÇERİĞİ", en: "WHAT'S INCLUDED", fr: "CE QUI EST INCLUS" },
      footer: {
        tr: "Esnek program · Pratik odaklı · Hedefe yönelik eğitim",
        en: "Flexible schedule · Practice-first · Goal-driven teaching",
        fr: "Horaires flexibles · Axé sur la pratique · Orienté objectifs",
      },
      cta: { tr: "Seviye tespiti al", en: "Take the placement test", fr: "Passer le test de niveau" },
      items: {
        speaking: {
          tr: "Konuşma (Speaking) odaklı ilerleme",
          en: "Speaking-focused progress",
          fr: "Progression axée sur l'expression orale",
        },
        work: { tr: "İş hayatına özel programlar", en: "Programmes built for work", fr: "Programmes dédiés au monde du travail" },
        skills: {
          tr: "Dinleme, okuma ve yazma çalışmaları",
          en: "Listening, reading and writing practice",
          fr: "Travail d'écoute, de lecture et d'écriture",
        },
        duration: {
          tr: "1 saatlik dersler, iş saatlerinize uygun planlama",
          en: "One-hour lessons, scheduled around your work",
          fr: "Cours d'une heure, planifiés selon vos horaires",
        },
        everyday: {
          tr: "Günlük hayatta ve iş hayatında kullanılan İngilizce",
          en: "The English used in daily life and at work",
          fr: "L'anglais du quotidien et du travail",
        },
        options: {
          tr: "Birebir ve grup ders seçeneği",
          en: "One-to-one and group options",
          fr: "Cours individuels ou en groupe",
        },
      },
    },
  },

  // ------------------------------------------------------------------- FAQ
  faq: {
    title: { tr: "Sık Sorulan Sorular", en: "Frequently Asked Questions", fr: "Questions fréquentes" },
    short: { tr: "SSS", en: "FAQ", fr: "FAQ" },
    lead: {
      tr: "Aklınızda kalan bir şey varsa bize yazmanız yeterli.",
      en: "If anything is still unclear, just drop us a message.",
      fr: "S'il vous reste une question, écrivez-nous simplement.",
    },
    questions: {
      duration: {
        question: { tr: "Ders süreleri ne kadar?", en: "How long are the lessons?", fr: "Quelle est la durée des cours ?" },
        answer: {
          tr: "Çocuk dersleri 30 dakika, yetişkin dersleri 60 dakikadır. Çocuk derslerinin süresi, dijital ekran süresi önerilerine uygun olarak planlanmıştır.",
          en: "Children's lessons run 30 minutes and adult lessons 60. The shorter format for children follows recommended screen-time guidance.",
          fr: "Les cours pour enfants durent 30 minutes et ceux pour adultes 60. Le format court suit les recommandations sur le temps d'écran.",
        },
      },
      freeTrial: {
        question: { tr: "Ücretsiz deneme dersi var mı?", en: "Is there a free trial lesson?", fr: "Y a-t-il un cours d'essai gratuit ?" },
        answer: {
          tr: "Evet. Kayıt öncesinde ücretsiz bir deneme dersi yapıyoruz; bu derste seviyeyi ve hedefleri birlikte konuşup uygun paketi belirliyoruz.",
          en: "Yes. We run a free trial lesson before you enrol, where we talk through level and goals together and pick the right package.",
          fr: "Oui. Nous proposons un cours d'essai gratuit avant l'inscription : nous y discutons du niveau et des objectifs pour choisir le bon forfait.",
        },
      },
      platform: {
        question: {
          tr: "Dersler hangi platformda yapılıyor?",
          en: "Which platform are the lessons on?",
          fr: "Sur quelle plateforme ont lieu les cours ?",
        },
        answer: {
          tr: "Dersler canlı olarak Zoom üzerinden yapılır. Ders bağlantısı her ders öncesinde paylaşılır; ekstra bir program kurmanız gerekmez.",
          en: "Lessons are held live on Zoom. The link is shared before each lesson — there is nothing extra to install.",
          fr: "Les cours ont lieu en direct sur Zoom. Le lien est envoyé avant chaque cours ; rien d'autre à installer.",
        },
      },
      lessonType: {
        question: {
          tr: "Birebir ders mi, grup dersi mi yapılıyor?",
          en: "Are lessons one-to-one or in groups?",
          fr: "Les cours sont-ils individuels ou en groupe ?",
        },
        answer: {
          tr: "İkisi de mümkün. Tüm paketlerde birebir ve küçük grup seçeneği var; grup dersleri benzer yaş ve seviyedeki öğrencilerle oluşturulur.",
          en: "Both. Every package offers one-to-one and small-group options; groups are formed from students of similar age and level.",
          fr: "Les deux. Chaque forfait propose l'individuel et le petit groupe ; les groupes réunissent des élèves d'âge et de niveau proches.",
        },
      },
      login: {
        question: { tr: "Neden giriş yapamıyorum?", en: "Why can't I log in?", fr: "Pourquoi n'arrivé-je pas à me connecter ?" },
        answer: {
          tr: "Öğrenci paneli hesabı ilk kayıttan sonra tanımlanır. Giriş bilgileriniz gelmediyse veya şifrenizi hatırlamıyorsanız WhatsApp'tan yazın, hemen sıfırlayalım.",
          en: "Your student-panel account is created after you enrol. If your details never arrived or you've forgotten the password, message us on WhatsApp and we'll reset it right away.",
          fr: "Le compte de l'espace élève est créé après l'inscription. Si vous n'avez pas reçu vos identifiants ou avez oublié le mot de passe, écrivez-nous sur WhatsApp : nous le réinitialisons aussitôt.",
        },
      },
    },
  },

  // ------------------------------------------------------------------ Blog
  blog: {
    badge: { tr: "BLOG", en: "BLOG", fr: "BLOG" },
    title: { tr: "Okuma köşesi", en: "Reading corner", fr: "Coin lecture" },
    lead: {
      tr: "Veliler ve öğrenciler için kısa, işe yarar yazılar",
      en: "Short, useful pieces for parents and students",
      fr: "Des articles courts et utiles pour parents et élèves",
    },
    all: { tr: "Tüm yazılar", en: "All posts", fr: "Tous les articles" },
    readMore: { tr: "Devamını oku", en: "Read more", fr: "Lire la suite" },
    empty: {
      tr: "Henüz yazı yok — yakında burada olacak.",
      en: "No posts yet — they're on their way.",
      fr: "Pas encore d'articles — ils arrivent bientôt.",
    },
  },

  // ------------------------------------------------------------ Our values
  values: {
    badge: { tr: "DEĞERLERİMİZ", en: "OUR VALUES", fr: "NOS VALEURS" },
    title: {
      tr: "Öğretmenlik bir emanettir",
      en: "Teaching is a trust we carry",
      fr: "Enseigner est une responsabilité",
    },
    quote: {
      tr: "Öğretmenler! Yeni nesil sizin eseriniz olacaktır.",
      en: "Teachers! The new generation will be your work.",
      fr: "Enseignants ! La nouvelle génération sera votre œuvre.",
    },
    quoteAuthor: { tr: "Mustafa Kemal Atatürk", en: "Mustafa Kemal Atatürk", fr: "Mustafa Kemal Atatürk" },
    caption1: { tr: "Atatürk ve çocuklar", en: "Atatürk and children", fr: "Atatürk et les enfants" },
    caption2: { tr: "Başöğretmen", en: "The Head Teacher", fr: "Le Maître d'école" },
    lead: {
      tr: "Her ders bir öğrencinin özgüvenine dokunuyor. Bu yüzden programı öğrenciye göre kuruyor, gelişimi veliyle birlikte takip ediyoruz.",
      en: "Every lesson touches a student's confidence. That's why we build the programme around the student and track progress together with parents.",
      fr: "Chaque cours touche à la confiance d'un élève. C'est pourquoi nous bâtissons le programme autour de lui et suivons ses progrès avec les parents.",
    },
  },

  // --------------------------------------------------------------- Contact
  contact: {
    title: { tr: "Bizimle iletişime geçin", en: "Get in touch with us", fr: "Contactez-nous" },
    description: {
      tr: "Ücretsiz deneme dersi, ders paketleri ve seviye tespiti hakkında her şeyi sorabilirsiniz.",
      en: "Ask us anything about the free trial lesson, the packages, or the placement test.",
      fr: "Posez-nous toutes vos questions sur le cours d'essai, les forfaits ou le test de niveau.",
    },
    whatsapp: { tr: "WhatsApp'tan yazın", en: "Message us on WhatsApp", fr: "Écrivez-nous sur WhatsApp" },
    instagram: { tr: "Instagram'dan yazın", en: "Message us on Instagram", fr: "Écrivez-nous sur Instagram" },
    whyCard: {
      title: { tr: "NEDEN ENGLISH WITH DILARA?", en: "WHY ENGLISH WITH DILARA?", fr: "POURQUOI ENGLISH WITH DILARA ?" },
      items: {
        personalProgram: { tr: "Kişiye özel program", en: "Personalised programme", fr: "Programme sur mesure" },
        oneOnOne: { tr: "Birebir ve küçük gruplar", en: "One-to-one and small groups", fr: "Individuel et petits groupes" },
        tracking: { tr: "Düzenli takip ve geri bildirim", en: "Regular tracking and feedback", fr: "Suivi régulier et retours" },
        freeTrial: { tr: "Ücretsiz deneme dersi", en: "Free trial lesson", fr: "Cours d'essai gratuit" },
      },
    },
    form: {
      title: { tr: "İletişim Formu", en: "Contact Form", fr: "Formulaire de contact" },
      fullName: { tr: "Ad Soyad", en: "Full name", fr: "Nom et prénom" },
      studentAge: { tr: "Öğrenci yaşı / Kendim", en: "Student age / Myself", fr: "Âge de l'élève / Moi-même" },
      phone: { tr: "Telefon numaranız", en: "Your phone number", fr: "Votre numéro de téléphone" },
      message: { tr: "Mesajınız", en: "Your message", fr: "Votre message" },
      submit: { tr: "Gönder", en: "Send", fr: "Envoyer" },
      sending: { tr: "Gönderiliyor...", en: "Sending...", fr: "Envoi en cours..." },
      submitted: { tr: "Gönderildi ✓", en: "Sent ✓", fr: "Envoyé ✓" },
      success: {
        tr: "Başvurunuz başarıyla gönderildi!",
        en: "Your message has been sent!",
        fr: "Votre message a bien été envoyé !",
      },
      error: {
        tr: "Bir hata oluştu, lütfen tekrar deneyin.",
        en: "Something went wrong — please try again.",
        fr: "Une erreur s'est produite, veuillez réessayer.",
      },
      note: {
        tr: "Formu doldurduktan sonra en kısa sürede sizinle iletişime geçiyoruz.",
        en: "Once you send the form, we'll get back to you as soon as we can.",
        fr: "Après l'envoi du formulaire, nous vous répondons dans les plus brefs délais.",
      },
      ageOptions: {
        myself: { tr: "Kendim (Yetişkin)", en: "Myself (adult)", fr: "Moi-même (adulte)" },
        age4_6: { tr: "4-6 yaş", en: "Ages 4–6", fr: "4–6 ans" },
        age7_9: { tr: "7-9 yaş", en: "Ages 7–9", fr: "7–9 ans" },
        age10_12: { tr: "10-12 yaş", en: "Ages 10–12", fr: "10–12 ans" },
        age13_15: { tr: "13-15 yaş", en: "Ages 13–15", fr: "13–15 ans" },
        age16_18: { tr: "16-18 yaş", en: "Ages 16–18", fr: "16–18 ans" },
      },
    },
  },

  // ---------------------------------------------------------------- Footer
  footer: {
    tagline: { tr: "Online İngilizce dersleri", en: "Online English lessons", fr: "Cours d'anglais en ligne" },
    workWithUs: { tr: "Bizimle Çalışın!", en: "Work with Us!", fr: "Travaillez avec nous !" },
    privacyPolicy: { tr: "Gizlilik Politikası", en: "Privacy Policy", fr: "Politique de confidentialité" },
    downloadGooglePlay: { tr: "Google Play", en: "Google Play", fr: "Google Play" },
    downloadAppStore: { tr: "App Store", en: "App Store", fr: "App Store" },
    comingSoon: { tr: "Yakında", en: "Coming soon", fr: "Bientôt" },
    copyright: { tr: "Tüm hakları saklıdır.", en: "All rights reserved.", fr: "Tous droits réservés." },
  },

  // -------------------------------------------------------- Words of the day
  words: {
    badge: { tr: "GÜNÜN KELİMELERİ", en: "WORDS OF THE DAY", fr: "MOTS DU JOUR" },
    title: { tr: "Bugünün üç kelimesi", en: "Today's three words", fr: "Les trois mots du jour" },
    lead: {
      tr: "Her gün akşam 20.00'de üç yeni kelime. Kartın üstüne dokunun; arkasında okunuşu, örnek cümlesi ve eş anlamlıları var.",
      en: "Three new words every day at 8 pm. Tap a card — the back holds its pronunciation, an example sentence and synonyms.",
      fr: "Trois nouveaux mots chaque jour à 20 h. Touchez une carte : au dos, la prononciation, une phrase d'exemple et des synonymes.",
    },
    pageLead: {
      tr: "Günün kelimeleri her akşam 20.00'de yenilenir. İstersen seviye ya da konu seçip kendi kartlarını da çekebilirsin.",
      en: "The daily words refresh every evening at 8 pm. You can also draw your own cards by level or topic.",
      fr: "Les mots du jour se renouvellent chaque soir à 20 h. Vous pouvez aussi tirer vos propres cartes par niveau ou par thème.",
    },
    countdownTitle: { tr: "Yenilenmesine", en: "Refreshes in", fr: "Renouvellement dans" },
    countdownNote: {
      tr: "Her gün 20.00'de yeni kelimeler",
      en: "New words every day at 8 pm",
      fr: "De nouveaux mots chaque jour à 20 h",
    },
    hours: { tr: "SAAT", en: "HRS", fr: "H" },
    minutes: { tr: "DAKİKA", en: "MIN", fr: "MIN" },
    seconds: { tr: "SANİYE", en: "SEC", fr: "SEC" },
    flipHint: { tr: "Çevirmek için dokun", en: "Tap to flip", fr: "Touchez pour retourner" },
    backHint: { tr: "Geri dön", en: "Flip back", fr: "Retourner" },
    listen: { tr: "Dinle", en: "Listen", fr: "Écouter" },
    meaning: { tr: "Anlamı", en: "Meaning", fr: "Signification" },
    example: { tr: "Örnek cümle", en: "Example", fr: "Exemple" },
    synonyms: { tr: "Eş anlamlıları", en: "Synonyms", fr: "Synonymes" },
    antonym: { tr: "Zıt anlamı", en: "Opposite", fr: "Contraire" },
    level: { tr: "Seviye", en: "Level", fr: "Niveau" },
    category: { tr: "Konu", en: "Topic", fr: "Thème" },
    allLevels: { tr: "Tüm seviyeler", en: "All levels", fr: "Tous niveaux" },
    allCategories: { tr: "Tüm konular", en: "All topics", fr: "Tous les thèmes" },
    shuffle: { tr: "Rastgele üç kelime", en: "Draw three at random", fr: "Tirer trois mots au hasard" },
    backToToday: { tr: "Günün kelimelerine dön", en: "Back to today's words", fr: "Revenir aux mots du jour" },
    randomBadge: { tr: "RASTGELE SEÇİM", en: "RANDOM DRAW", fr: "TIRAGE ALÉATOIRE" },
    todayBadge: { tr: "BUGÜN", en: "TODAY", fr: "AUJOURD'HUI" },
    langLabel: { tr: "Kelime dili", en: "Word language", fr: "Langue des mots" },
    langEn: { tr: "İngilizce", en: "English", fr: "Anglais" },
    langFr: { tr: "Fransızca", en: "French", fr: "Français" },
    seeAll: { tr: "Tüm kelimeler", en: "Explore all words", fr: "Voir tous les mots" },
    noMatch: {
      tr: "Bu seçimle eşleşen kelime yok. Filtreyi biraz gevşetin.",
      en: "No words match that selection — try loosening the filter.",
      fr: "Aucun mot ne correspond à cette sélection — assouplissez le filtre.",
    },
    pos: {
      noun: { tr: "isim", en: "noun", fr: "nom" },
      verb: { tr: "fiil", en: "verb", fr: "verbe" },
      adjective: { tr: "sıfat", en: "adjective", fr: "adjectif" },
      adverb: { tr: "zarf", en: "adverb", fr: "adverbe" },
      phrase: { tr: "kalıp", en: "phrase", fr: "expression" },
    },
    categories: {
      daily: { tr: "Günlük hayat", en: "Daily life", fr: "Vie quotidienne" },
      school: { tr: "Okul", en: "School", fr: "École" },
      work: { tr: "İş hayatı", en: "Work", fr: "Travail" },
      feelings: { tr: "Duygular", en: "Feelings", fr: "Émotions" },
      travel: { tr: "Seyahat", en: "Travel", fr: "Voyage" },
      food: { tr: "Yemek", en: "Food", fr: "Nourriture" },
      nature: { tr: "Doğa", en: "Nature", fr: "Nature" },
      people: { tr: "İnsanlar", en: "People", fr: "Les gens" },
      home: { tr: "Ev", en: "Home", fr: "Maison" },
      body: { tr: "Vücut & sağlık", en: "Body & health", fr: "Corps & santé" },
      time: { tr: "Zaman", en: "Time", fr: "Temps" },
      tech: { tr: "Teknoloji", en: "Technology", fr: "Technologie" },
    },
  },

  // ---------------------------------------------------------- Work with us
  workWithUs: {
    title: { tr: "Bizimle Çalışın!", en: "Work with Us!", fr: "Travaillez avec nous !" },
    fullName: { tr: "Ad Soyad", en: "Full name", fr: "Nom et prénom" },
    age: { tr: "Yaş", en: "Age", fr: "Âge" },
    university: { tr: "Üniversite", en: "University", fr: "Université" },
    department: { tr: "Bölüm", en: "Department", fr: "Filière" },
    email: { tr: "E-posta", en: "Email", fr: "E-mail" },
    phone: { tr: "Telefon Numaranız", en: "Your phone number", fr: "Votre numéro de téléphone" },
    submit: { tr: "Gönder", en: "Submit", fr: "Envoyer" },
    sending: { tr: "Gönderiliyor...", en: "Sending...", fr: "Envoi en cours..." },
    submitted: { tr: "Gönderildi ✓", en: "Sent ✓", fr: "Envoyé ✓" },
    note: {
      tr: "Başvurunuzu aldıktan sonra en kısa sürede sizinle iletişime geçeceğiz.",
      en: "Once we receive your application we'll be in touch as soon as we can.",
      fr: "Dès réception de votre candidature, nous vous contacterons rapidement.",
    },
    success: {
      tr: "Başvurunuz başarıyla gönderildi!",
      en: "Your application has been submitted!",
      fr: "Votre candidature a bien été envoyée !",
    },
    error: {
      tr: "Bir hata oluştu, lütfen tekrar deneyin.",
      en: "Something went wrong — please try again.",
      fr: "Une erreur s'est produite, veuillez réessayer.",
    },
    formNotReady: {
      tr: "Form şu an aktif değil.",
      en: "The form isn't active right now.",
      fr: "Le formulaire n'est pas actif pour le moment.",
    },
  },

  // -------------------------------------------------------- Privacy policy
  privacyPolicy: {
    title: { tr: "Gizlilik Politikası", en: "Privacy Policy", fr: "Politique de confidentialité" },
    sections: [
      {
        title: { tr: "Topladığımız Bilgiler", en: "Information We Collect", fr: "Informations collectées" },
        content: {
          tr: "İletişim ve başvuru formları aracılığıyla ad soyad, e-posta, telefon ve yaş bilgisi toplamaktayız. Bu bilgiler yalnızca sizin tarafınızdan formlara girildiğinde alınır.",
          en: "We collect your full name, email address, phone number, and age through our contact and application forms. This information is only collected when you voluntarily submit it via our forms.",
          fr: "Nous collectons vos nom et prénom, adresse e-mail, numéro de téléphone et âge via nos formulaires de contact et de candidature. Ces données ne sont recueillies que lorsque vous les saisissez vous-même.",
        },
      },
      {
        title: { tr: "Bilgileri Ne Amaçla Kullanıyoruz", en: "How We Use Your Information", fr: "Utilisation de vos données" },
        content: {
          tr: "Toplanan bilgiler yalnızca sizinle iletişime geçmek, ders ve başvuru süreçlerini yönetmek ve hizmet kalitemizi artırmak amacıyla kullanılır.",
          en: "The information we collect is used solely to contact you, manage lesson and application processes, and improve the quality of our services.",
          fr: "Les données collectées servent uniquement à vous contacter, à gérer les cours et les candidatures, et à améliorer la qualité de nos services.",
        },
      },
      {
        title: { tr: "Üçüncü Taraflar", en: "Third Parties", fr: "Tiers" },
        content: {
          tr: "Form verileriniz Formspree aracılığıyla iletilmektedir. WhatsApp ve Instagram bağlantılarımız sizi ilgili platformlara yönlendirir; bu platformların kendi gizlilik politikaları geçerlidir. Gelecekte ek hizmetler kullanılması durumunda bu politika güncellenecektir.",
          en: "Your form data is transmitted via Formspree. Our WhatsApp and Instagram links redirect you to the respective platforms, which are governed by their own privacy policies. Should additional services be used in the future, this policy will be updated accordingly.",
          fr: "Les données des formulaires sont transmises via Formspree. Nos liens WhatsApp et Instagram vous redirigent vers ces plateformes, régies par leurs propres politiques de confidentialité. Si d'autres services sont utilisés à l'avenir, cette politique sera mise à jour.",
        },
      },
      {
        title: { tr: "Veri Saklama Süresi", en: "Data Retention", fr: "Durée de conservation" },
        content: {
          tr: "Kişisel verileriniz hizmet süresince ve makul bir süre boyunca saklanır. Artık gerekli olmadığında güvenli bir şekilde silinir.",
          en: "Your personal data is retained for the duration of our services and for a reasonable period thereafter. It is securely deleted once it is no longer required.",
          fr: "Vos données personnelles sont conservées pendant la durée du service et une période raisonnable ensuite. Elles sont supprimées de façon sécurisée dès qu'elles ne sont plus nécessaires.",
        },
      },
      {
        title: { tr: "Güvenlik", en: "Security", fr: "Sécurité" },
        content: {
          tr: "Verilerinizi korumak için makul teknik ve organizasyonel önlemler uygularız.",
          en: "We implement reasonable technical and organisational measures to protect your data.",
          fr: "Nous mettons en œuvre des mesures techniques et organisationnelles raisonnables pour protéger vos données.",
        },
      },
      {
        title: { tr: "Kullanıcı Hakları", en: "Your Rights", fr: "Vos droits" },
        content: {
          tr: "Kişisel verilerinize erişim, düzeltme veya silme talebinde bulunabilirsiniz. Talepleriniz için aşağıdaki iletişim adresinden bize ulaşabilirsiniz.",
          en: "You may request access to, correction of, or deletion of your personal data. Please contact us using the details below to submit your request.",
          fr: "Vous pouvez demander l'accès à vos données personnelles, leur rectification ou leur suppression. Contactez-nous à l'adresse ci-dessous pour toute demande.",
        },
      },
      {
        title: { tr: "İletişim", en: "Contact", fr: "Contact" },
        content: {
          tr: "Gizlilik politikamız hakkındaki sorularınız için dilarasirlan30@gmail.com adresinden bize ulaşabilirsiniz.",
          en: "For any questions regarding our privacy policy, please contact us at dilarasirlan30@gmail.com.",
          fr: "Pour toute question sur notre politique de confidentialité, écrivez-nous à dilarasirlan30@gmail.com.",
        },
      },
    ],
  },
} as const;

export type TranslationKey = keyof typeof translations;
