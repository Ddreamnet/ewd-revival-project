import { useState } from "react";
import { Link } from "react-router-dom";
import { usePublishedPostsPaginated } from "@/hooks/useBlogPosts";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { Footer } from "@/components/landing/Footer";
import { BackSwipeWrapper } from "@/components/BackSwipeWrapper";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Language } from "@/lib/translations";

const PAGE_SIZE = 9;

/** Kart tonları — landing'deki blog bölümüyle aynı ritim. */
const TONES = [
  { bg: "#EFDFF9", date: "#6B4A8A", edge: "#A253BE", ink: "#6D28D9", art: "n-sohbet.png" },
  { bg: "#FBD5E4", date: "#9B3E62", edge: "#EC4899", ink: "#BE185D", art: "n-pano.png" },
  { bg: "#FDECC0", date: "#7A5A0E", edge: "#D9A21B", ink: "#8A6410", art: "n-video.png" },
];

const LOCALES: Record<Language, string> = { tr: "tr-TR", en: "en-GB", fr: "fr-FR" };

export default function BlogPage() {
  const { language, t } = useLanguage();
  const [page, setPage] = useState(0);
  const { data, isLoading } = usePublishedPostsPaginated(page, PAGE_SIZE);

  const posts = data?.posts || [];
  const total = data?.total || 0;
  const hasMore = (page + 1) * PAGE_SIZE < total;

  return (
    <BackSwipeWrapper>
      <div className="landing-body ewd-light min-h-screen">
        <LandingHeader />

        <main
          className="ewd-dots px-5 pb-20 pt-12 sm:px-8"
          style={{
            backgroundColor: "var(--ewd-cream)",
            ["--dot" as string]: "#F0DCE4",
            backgroundSize: "34px 34px",
          }}
        >
          <div className="mx-auto max-w-[1180px]">
            <div className="flex flex-col items-center gap-2 pb-12 text-center">
              <span className="ewd-label rounded-full bg-[#EC4899] px-5 py-2.5 text-white">
                {t.blog.badge[language]}
              </span>
              <h1 className="ewd-h2 mt-2">{t.blog.title[language]}</h1>
              <p className="ewd-lead max-w-[520px]">{t.blog.lead[language]}</p>
            </div>

            {isLoading && page === 0 ? (
              <div className="flex justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[color:var(--ewd-purple)]" />
              </div>
            ) : !posts.length ? (
              <p className="py-16 text-center text-[15px] font-semibold text-[#6B5B7B]">
                {t.blog.empty[language]}
              </p>
            ) : (
              <>
                <div className="grid gap-11 sm:grid-cols-2 lg:grid-cols-3">
                  {posts.map((post, i) => {
                    const tone = TONES[i % TONES.length];
                    return (
                      <Link
                        key={post.id}
                        to={`/blog/${post.slug}`}
                        className="ewd-stamp group block transition-transform duration-200 hover:-translate-y-1"
                        style={{ ["--stamp" as string]: tone.bg }}
                      >
                        <span className="ewd-stamp__side ewd-stamp__side--l" aria-hidden="true" />
                        <span className="ewd-stamp__side ewd-stamp__side--r" aria-hidden="true" />
                        <div
                          className="relative flex h-full flex-col items-center gap-3.5 rounded-[26px] px-7 pb-8 pt-7 text-center"
                          style={{ background: tone.bg }}
                        >
                          {post.cover_image_url ? (
                            <div className="h-[104px] w-full overflow-hidden rounded-[18px]">
                              <img
                                src={post.cover_image_url}
                                alt=""
                                loading="lazy"
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                            </div>
                          ) : (
                            <img
                              src={`/ewd/assets/ic/${tone.art}`}
                              alt=""
                              aria-hidden="true"
                              className="h-[104px] w-auto"
                              style={{ filter: "drop-shadow(0 10px 16px rgba(46,16,101,0.24))" }}
                            />
                          )}

                          {post.published_at && (
                            <span
                              className="text-[11px] font-extrabold uppercase tracking-[0.12em]"
                              style={{ color: tone.date }}
                            >
                              {new Date(post.published_at).toLocaleDateString(LOCALES[language], {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })}
                            </span>
                          )}

                          <h2 className="text-[18px] font-extrabold leading-[1.35] text-[#2E1065] [text-wrap:pretty] sm:text-[19px]">
                            {post.title}
                          </h2>

                          {post.excerpt && (
                            <p className="line-clamp-3 text-[13px] font-medium leading-relaxed text-[#5B4A6E]">
                              {post.excerpt}
                            </p>
                          )}

                          <span className="mt-auto pt-3">
                            <span
                              className="inline-block rounded-full border-2 px-5 py-2.5 text-[13px] font-extrabold"
                              style={{ borderColor: tone.edge, color: tone.ink }}
                            >
                              {t.blog.readMore[language]}
                            </span>
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>

                {hasMore && (
                  <div className="mt-14 flex justify-center">
                    <button
                      type="button"
                      className="ewd-btn ewd-btn--purple"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={isLoading}
                    >
                      {t.blog.all[language]} →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </main>

        <Footer />
      </div>
    </BackSwipeWrapper>
  );
}
