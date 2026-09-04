import { useParams, Link } from "react-router-dom";
import DOMPurify from "dompurify";
import { ArrowLeft } from "lucide-react";
import { useBlogPostBySlug } from "@/hooks/useBlogPosts";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { Footer } from "@/components/landing/Footer";
import { BackSwipeWrapper } from "@/components/BackSwipeWrapper";
import { useLanguage } from "@/contexts/LanguageContext";
import { LOCALES, type Language } from "@/lib/translations";

const BACK_LABEL: Record<Language, string> = {
  tr: "Blog'a dön",
  en: "Back to blog",
  fr: "Retour au blog",
  ru: "Назад к блогу",
  es: "Volver al blog",
  de: "Zurück zum Blog",
  ar: "العودة إلى المدونة",
};

const NOT_FOUND: Record<Language, string> = {
  tr: "Yazı bulunamadı.",
  en: "Post not found.",
  fr: "Article introuvable.",
  ru: "Запись не найдена.",
  es: "Entrada no encontrada.",
  de: "Beitrag nicht gefunden.",
  ar: "لم يتم العثور على المقال.",
};

/** Sayfa iskeleti — yükleme, hata ve içerik durumları aynı kabuğu paylaşır. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="landing-body ewd-light min-h-screen">
      <LandingHeader />
      <main className="px-5 pb-20 pt-12 sm:px-8" style={{ background: "var(--ewd-cream)" }}>
        {children}
      </main>
      <Footer />
    </div>
  );
}

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const { language } = useLanguage();
  const { data: post, isLoading } = useBlogPostBySlug(slug || "");

  if (isLoading) {
    return (
      <Shell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[color:var(--ewd-purple)]" />
        </div>
      </Shell>
    );
  }

  if (!post) {
    return (
      <Shell>
        <div className="mx-auto max-w-[820px] py-16 text-center">
          <p className="mb-5 text-[18px] font-bold text-[#6B5B7B]">{NOT_FOUND[language]}</p>
          <Link to="/blog" className="ewd-btn ewd-btn--purple ewd-btn--sm">
            <ArrowLeft className="h-4 w-4" /> {BACK_LABEL[language]}
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <BackSwipeWrapper>
      <Shell>
        <article className="mx-auto max-w-[820px]">
          <Link
            to="/blog"
            className="mb-6 inline-flex items-center gap-1.5 text-[14px] font-extrabold text-[#6D28D9] underline-offset-4 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> {BACK_LABEL[language]}
          </Link>

          {post.cover_image_url && (
            <div
              className="mb-8 aspect-[3/2] overflow-hidden rounded-[28px] border-[3px]"
              style={{ borderColor: "var(--ewd-lilac-line)" }}
            >
              <img src={post.cover_image_url} alt="" className="h-full w-full object-cover" />
            </div>
          )}

          {post.published_at && (
            <p className="mb-2 text-[12px] font-extrabold uppercase tracking-[0.12em] text-[#9A87AC]">
              {new Date(post.published_at).toLocaleDateString(LOCALES[language], {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          )}

          <h1 className="ewd-h2 mb-7 text-[28px] sm:text-[40px]">{post.title}</h1>

          {/*
            Content. Blog HTML comes from the TipTap editor and is stored
            verbatim. Only admins can publish, but an admin-account compromise
            would otherwise execute script in every visitor's browser and inside
            both mobile WebViews, so it is sanitized on the way out.
          */}
          {post.content && (
            <div
              className="prose prose-sm max-w-none prose-headings:text-[#2E1065] prose-p:text-[#4C3A5E] prose-a:text-[#A253BE] prose-strong:text-[#2E1065] prose-img:mx-auto prose-img:rounded-2xl sm:prose-base"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content) }}
            />
          )}

          <div className="mt-12 border-t-2 border-dashed pt-6" style={{ borderColor: "var(--ewd-lilac-line)" }}>
            <Link to="/blog" className="ewd-btn ewd-btn--outline ewd-btn--sm">
              <ArrowLeft className="h-4 w-4" /> {BACK_LABEL[language]}
            </Link>
          </div>
        </article>
      </Shell>
    </BackSwipeWrapper>
  );
}
