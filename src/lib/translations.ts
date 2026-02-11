export type Language = 'tr' | 'en';

export const translations = {
  // Header / Menu
  header: {
    lessons: { tr: 'Dersler', en: 'Lessons' },
    contact: { tr: 'İletişim', en: 'Contact' },
    login: { tr: 'Giriş yap', en: 'Log in' },
  },

  // Hero Section
  hero: {
    subtitle1: {
      tr: 'Çocuklar ve yetişkinler için online İngilizce dersleri',
      en: 'Online English lessons for children and adults',
    },
    subtitle2: {
      tr: 'Kişiye özel programlar, birebir ve grup dersleri, düzenli takip ve geri bildirim.',
      en: 'Personalised programmes, one-to-one and group lessons, with regular progress tracking and feedback.',
    },
  },

  // Sticky Bubble
  stickyBubble: {
    line1: { tr: 'ÜCRETSİZ', en: 'FREE' },
    line2: { tr: 'Deneme', en: 'Trial' },
    line3: { tr: 'Dersi!', en: 'Lesson!' },
    cta: { tr: 'Hemen deneyin', en: 'Try now' },
  },

  // Why Section
  why: {
    title: { tr: 'Neden', en: 'Why' },
    features: {
      personalProgram: { tr: 'Kişiye özel program', en: 'Personalised programme' },
      oneOnOne: { tr: 'Birebir & küçük gruplar', en: 'One-to-one & small groups' },
      liveZoom: { tr: 'Canlı Zoom dersleri', en: 'Live Zoom lessons' },
      speakingFocused: { tr: 'Konuşma odaklı eğitim', en: 'Speaking-focused learning' },
      regularTracking: { tr: 'Düzenli takip & geri bildirim', en: 'Regular progress tracking & feedback' },
      freeTrial: { tr: 'Ücretsiz deneme dersi', en: 'Free trial lesson' },
    },
  },

  // Kids Packages
  kidsPackages: {
    title: { tr: 'Çocuk Ders Paketleri', en: 'Children\'s Lesson Packages' },
    description: {
      tr: 'English with Dilara\'da tüm ders paketleri, öğrencinin yaşı, seviyesi ve ihtiyacına göre planlanır.',
      en: 'At English with Dilara, all lesson packages are planned based on the student\'s age, level, and needs.',
    },
    classicPackage: {
      title: { tr: '1. Klasik Paket', en: '1. Classic Package' },
      subtitle: { tr: 'Paket İçeriği:', en: 'Package includes:' },
      items: {
        lessonsPerWeek: { tr: 'Haftada 2 ders', en: '2 lessons per week' },
        speaking: { tr: 'Konuşma çalışmaları', en: 'Speaking practice' },
        coreEnglish: { tr: 'Temel İngilizce bilgisi', en: 'Core English foundations' },
        listening: { tr: 'Dinleme ve anlama becerileri', en: 'Listening and comprehension skills' },
        games: { tr: 'Oyunlar eşliğinde eğlenerek öğrenme', en: 'Fun learning through games' },
        duration: { tr: 'Dijital ekran süresine uygun 30 dakikalık dersler', en: '30-minute lessons designed for healthy screen time' },
        options: { tr: 'Birebir ve Grup ders seçeneği', en: 'One-to-one and group lesson options' },
      },
    },
    schoolPackage: {
      title: { tr: '2. Okul Destek Paket', en: '2. School Support Package' },
      subtitle: { tr: 'Paket İçeriği:', en: 'Package includes:' },
      items: {
        parallel: { tr: 'Okulda işlenen İngilizce konularıyla paralel ilerleme', en: 'Progress in line with school English topics' },
        homework: { tr: 'İngilizce ödevlerin birlikte yapılması', en: 'Doing English homework together' },
        exams: { tr: 'Sınavlara destek', en: 'Exam support' },
        support: { tr: 'Gerektiğinde temel İngilizce çalışmalarıyla okulu destekleme', en: 'Extra core English practice when needed to support schoolwork' },
        duration: { tr: '30 dakikalık dersler, haftada 2 ders', en: '30-minute lessons, 2 per week' },
        options: { tr: 'Birebir ve Grup ders seçeneği', en: 'One-to-one and group lesson options' },
      },
    },
    moreInfo: { tr: 'Daha fazla bilgi için', en: 'For more information' },
  },

  // Adult Packages
  adultPackages: {
    title: { tr: 'Yetişkin Ders Paketleri', en: 'Adult Lesson Packages' },
    description: {
      tr: 'English with Dilara\'da tüm ders paketleri, öğrencinin yaşı, seviyesi ve ihtiyacına göre planlanır.',
      en: 'At English with Dilara, all lesson packages are planned based on the student\'s age, level, and needs.',
    },
    adultPackage: {
      title: { tr: '3. Yetişkin Paketi', en: '3. Adult Package' },
      levels: { tr: 'Seviyeler: A1-A2-B1-B2-C1', en: 'Levels: A1–A2–B1–B2–C1' },
      levelDescription: {
        tr: 'Seviye, eğitim öncesinde yapılan seviye tespit sınavı ile belirlenir.',
        en: 'Your level is determined with a placement test before the lessons begin.',
      },
      subtitle: { tr: 'Paket İçeriği:', en: 'Package includes:' },
      items: {
        speaking: { tr: 'Konuşma (Speaking) odaklı ilerleme', en: 'Speaking-focused progress' },
        skills: { tr: 'Dinleme, okuma ve yazma çalışmaları', en: 'Listening, reading, and writing practice' },
        everyday: { tr: 'Günlük hayatta ve iş hayatında kullanılan İngilizce', en: 'English for everyday life and the workplace' },
        work: { tr: 'İş hayatına özel programlar', en: 'Work-focused programmes' },
        duration: { tr: '1 saatlik dersler, gün ve saatleri iş saatlerinize uygun şekilde planlanır', en: '60-minute lessons, scheduled to fit around your working hours' },
        options: { tr: 'Birebir ve Grup ders seçeneği', en: 'One-to-one and group lesson options' },
      },
    },
  },

  // FAQ
  faq: {
    title: { tr: 'SSS', en: 'FAQ' },
    questions: {
      duration: {
        question: { tr: 'Ders süreleri ne kadar?', en: 'How long are the lessons?' },
        answer: { tr: 'Çocuk dersleri 30 dakika, yetişkin dersleri 60 dakikadır.', en: 'Children\'s lessons are 30 minutes, adult lessons are 60 minutes.' },
      },
      freeTrial: {
        question: { tr: 'Ücretsiz deneme dersi var mı?', en: 'Is there a free trial lesson?' },
        answer: { tr: 'Evet, tüm yeni öğrenciler için ücretsiz deneme dersi sunuyoruz.', en: 'Yes, we offer a free trial lesson for all new students.' },
      },
      platform: {
        question: { tr: 'Dersler hangi platformda yapılıyor?', en: 'Which platform are the lessons held on?' },
        answer: { tr: 'Tüm dersler Zoom üzerinden canlı olarak yapılmaktadır.', en: 'All lessons are held live on Zoom.' },
      },
      lessonType: {
        question: { tr: 'Birebir ders mi, grup dersi mi yapılıyor?', en: 'Are lessons one-to-one or in groups?' },
        answer: { tr: 'Her iki seçenek de mevcuttur.', en: 'Both options are available.' },
        subItems: {
          oneOnOne: { tr: 'Birebir dersler', en: 'One-to-one lessons' },
          group: { tr: 'Grup dersleri (maksimum 5 kişilik, aynı seviyedeki öğrencilerle)', en: 'Group lessons (up to 5 students, at the same level)' },
        },
      },
      login: {
        question: { tr: 'Neden giriş yapamıyorum?', en: 'Why can\'t I log in?' },
        answer: { 
          tr: 'Derslerimize kaydolduğunuzda size giriş yapabilmeniz için bir mail ve şifre veriliyor. Bu bilgilerle sisteme giriş yaparsanız hesabınızı açtığınızda öğrenci panelinize erişebileceksiniz. Ödev gönderimi, işlenen dersler bu panelden takip edilir.',
          en: 'When you register for our courses, you are given an email and password to log in. If you log in with this information, you will be able to access your student panel once you create your account. Assignment submissions and course progress are tracked through this panel.'
        },
      },
    },
  },

  // Contact
  contact: {
    title: { tr: 'Bizimle İletişime Geçin!', en: 'Get in touch with us!' },
    description: {
      tr: 'Ücretsiz deneme dersi, ders paketleri ve seviye tespiti hakkında bizimle iletişime geçebilirsiniz.',
      en: 'Contact us about the free trial lesson, lesson packages, and level assessment.',
    },
    whatsapp: { tr: 'Whatsapp\'tan hemen yazın!', en: 'Message on WhatsApp now!' },
    instagram: { tr: 'Instagram\'dan hemen yazın!', en: 'Message on Instagram now!' },
    whyCard: {
      title: { tr: 'Neden English with Dilara?', en: 'Why English with Dilara?' },
      items: {
        personalProgram: { tr: 'Kişiye özel program', en: 'Personalised programme' },
        oneOnOne: { tr: 'Birebir ve küçük gruplar', en: 'One-to-one and small groups' },
        tracking: { tr: 'Düzenli takip ve geri bildirim', en: 'Regular progress tracking and feedback' },
        freeTrial: { tr: 'Ücretsiz deneme dersi', en: 'Free trial lesson' },
      },
    },
    form: {
      title: { tr: 'İletişim Formu', en: 'Contact Form' },
      fullName: { tr: 'Ad Soyad', en: 'Full name' },
      studentAge: { tr: 'Öğrenci yaşı / Kendim', en: 'Student age / Myself' },
      phone: { tr: 'Telefon Numaranız', en: 'Your phone number' },
      message: { tr: 'Mesajınız', en: 'Your message' },
      submit: { tr: 'Gönder', en: 'Send' },
      note: {
        tr: 'Formu doldurduktan sonra en kısa sürede sizinle iletişime geçiyoruz.',
        en: 'After you submit the form, we\'ll get back to you as soon as possible.',
      },
      ageOptions: {
        myself: { tr: 'Kendim (Yetişkin)', en: 'Myself (Adult)' },
        age4_6: { tr: '4-6 yaş', en: 'Age 4-6' },
        age7_9: { tr: '7-9 yaş', en: 'Age 7-9' },
        age10_12: { tr: '10-12 yaş', en: 'Age 10-12' },
        age13_15: { tr: '13-15 yaş', en: 'Age 13-15' },
        age16_18: { tr: '16-18 yaş', en: 'Age 16-18' },
      },
    },
  },

  // Footer
  footer: {
    workWithUs: { tr: 'Bizimle Çalışın', en: 'Work with Us' },
    privacyPolicy: { tr: 'Gizlilik Politikası', en: 'Privacy Policy' },
    downloadGooglePlay: { tr: "Google Play'den İndir", en: 'Get it on Google Play' },
    downloadAppStore: { tr: "App Store'dan İndir", en: 'Download on the App Store' },
    comingSoon: { tr: 'Yakında', en: 'Coming Soon' },
    copyright: { tr: 'Tüm hakları saklıdır.', en: 'All rights reserved.' },
  },

  // Work With Us
  workWithUs: {
    title: { tr: 'Bizimle Çalışın', en: 'Work with Us' },
    fullName: { tr: 'Ad Soyad', en: 'Full Name' },
    age: { tr: 'Yaş', en: 'Age' },
    university: { tr: 'Üniversite', en: 'University' },
    department: { tr: 'Bölüm', en: 'Department' },
    email: { tr: 'E-posta', en: 'Email' },
    phone: { tr: 'Telefon Numaranız', en: 'Your Phone Number' },
    submit: { tr: 'Gönder', en: 'Submit' },
    submitted: { tr: 'Gönderildi ✓', en: 'Submitted ✓' },
    note: {
      tr: 'Başvurunuzu aldıktan sonra en kısa sürede sizinle iletişime geçeceğiz.',
      en: 'After receiving your application, we will contact you as soon as possible.',
    },
    success: {
      tr: 'Başvurunuz başarıyla gönderildi!',
      en: 'Your application has been submitted successfully!',
    },
    error: {
      tr: 'Bir hata oluştu, lütfen tekrar deneyin.',
      en: 'An error occurred, please try again.',
    },
    formNotReady: {
      tr: 'Form şu an aktif değil.',
      en: 'The form is not active at the moment.',
    },
  },

  // Privacy Policy
  privacyPolicy: {
    title: { tr: 'Gizlilik Politikası', en: 'Privacy Policy' },
    sections: [
      {
        title: { tr: 'Topladığımız Bilgiler', en: 'Information We Collect' },
        content: {
          tr: 'İletişim ve başvuru formları aracılığıyla ad soyad, e-posta, telefon ve yaş bilgisi toplamaktayız. Bu bilgiler yalnızca sizin tarafınızdan formlara girildiğinde alınır.',
          en: 'We collect your full name, email address, phone number, and age through our contact and application forms. This information is only collected when you voluntarily submit it via our forms.',
        },
      },
      {
        title: { tr: 'Bilgileri Ne Amaçla Kullanıyoruz', en: 'How We Use Your Information' },
        content: {
          tr: 'Toplanan bilgiler yalnızca sizinle iletişime geçmek, ders ve başvuru süreçlerini yönetmek ve hizmet kalitemizi artırmak amacıyla kullanılır.',
          en: 'The information we collect is used solely to contact you, manage lesson and application processes, and improve the quality of our services.',
        },
      },
      {
        title: { tr: 'Üçüncü Taraflar', en: 'Third Parties' },
        content: {
          tr: 'Form verileriniz Formspree aracılığıyla iletilmektedir. WhatsApp ve Instagram bağlantılarımız sizi ilgili platformlara yönlendirir; bu platformların kendi gizlilik politikaları geçerlidir. Gelecekte ek hizmetler kullanılması durumunda bu politika güncellenecektir.',
          en: 'Your form data is transmitted via Formspree. Our WhatsApp and Instagram links redirect you to the respective platforms, which are governed by their own privacy policies. Should additional services be used in the future, this policy will be updated accordingly.',
        },
      },
      {
        title: { tr: 'Veri Saklama Süresi', en: 'Data Retention' },
        content: {
          tr: 'Kişisel verileriniz hizmet süresince ve makul bir süre boyunca saklanır. Artık gerekli olmadığında güvenli bir şekilde silinir.',
          en: 'Your personal data is retained for the duration of our services and for a reasonable period thereafter. It is securely deleted once it is no longer required.',
        },
      },
      {
        title: { tr: 'Güvenlik', en: 'Security' },
        content: {
          tr: 'Verilerinizi korumak için makul teknik ve organizasyonel önlemler uygularız.',
          en: 'We implement reasonable technical and organisational measures to protect your data.',
        },
      },
      {
        title: { tr: 'Kullanıcı Hakları', en: 'Your Rights' },
        content: {
          tr: 'Kişisel verilerinize erişim, düzeltme veya silme talebinde bulunabilirsiniz. Talepleriniz için aşağıdaki iletişim adresinden bize ulaşabilirsiniz.',
          en: 'You may request access to, correction of, or deletion of your personal data. Please contact us using the details below to submit your request.',
        },
      },
      {
        title: { tr: 'İletişim', en: 'Contact' },
        content: {
          tr: 'Gizlilik politikamız hakkındaki sorularınız için dilarasirlan30@gmail.com adresinden bize ulaşabilirsiniz.',
          en: 'For any questions regarding our privacy policy, please contact us at dilarasirlan30@gmail.com.',
        },
      },
    ],
  },
} as const;

export type TranslationKey = keyof typeof translations;
