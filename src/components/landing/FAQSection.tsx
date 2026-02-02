import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Plus, Minus } from 'lucide-react';

export function FAQSection() {
  const { language, t } = useLanguage();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqItems = [
    {
      question: t.faq.questions.duration.question,
      answer: t.faq.questions.duration.answer,
    },
    {
      question: t.faq.questions.freeTrial.question,
      answer: t.faq.questions.freeTrial.answer,
    },
    {
      question: t.faq.questions.platform.question,
      answer: t.faq.questions.platform.answer,
    },
    {
      question: t.faq.questions.lessonType.question,
      answer: t.faq.questions.lessonType.answer,
      subItems: [
        t.faq.questions.lessonType.subItems.oneOnOne,
        t.faq.questions.lessonType.subItems.group,
      ],
    },
    {
      question: t.faq.questions.login.question,
      answer: t.faq.questions.login.answer,
    },
  ];

  const toggleItem = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section
      id="faq"
      className="scroll-section py-16 md:py-24"
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-landing-purple-dark">
            {t.faq.title[language]}
          </h2>
        </div>

        {/* Accordion Items */}
        <div className="space-y-4">
          {faqItems.map((item, index) => (
            <div key={index} className="overflow-hidden">
              {/* Question Button */}
              <button
                onClick={() => toggleItem(index)}
                className={`w-full flex items-center justify-between p-4 md:p-5 text-left transition-all duration-300 ${
                  openIndex === index
                    ? 'bg-landing-purple/30 rounded-t-2xl'
                    : 'bg-landing-purple/20 rounded-2xl hover:bg-landing-purple/25'
                }`}
              >
                <span className="text-base md:text-lg font-medium text-foreground pr-4">
                  {item.question[language]}
                </span>
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-landing-purple/40 flex items-center justify-center">
                  {openIndex === index ? (
                    <Minus className="w-5 h-5 text-landing-purple-dark" />
                  ) : (
                    <Plus className="w-5 h-5 text-landing-purple-dark" />
                  )}
                </div>
              </button>

              {/* Answer Panel */}
              <div
                className={`transition-all duration-300 overflow-hidden ${
                  openIndex === index ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="bg-landing-pink/30 rounded-b-2xl p-4 md:p-5">
                  <p className="text-sm md:text-base text-foreground/80">
                    {item.answer[language]}
                  </p>
                  {item.subItems && (
                    <ul className="mt-3 space-y-2 pl-4">
                      {item.subItems.map((subItem, subIndex) => (
                        <li key={subIndex} className="text-sm md:text-base text-foreground/70 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-landing-purple-dark" />
                          {subItem[language]}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
