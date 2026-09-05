import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePublishedPosts } from "@/hooks/useBlogPosts";
import { LOCALES } from "@/lib/translations";

/** Kart tonları — pul kenarı ve iç zemin aynı renkten. */
const TONES = [
  { bg: "#EFDFF9", date: "#6B4A8A", edge: "#A253BE", ink: "#6D28D9", art: "n-sohbet.svg" },
  { bg: "#FBD5E4", date: "#9B3E62", edge: "#EC4899", ink: "#BE185D", art: "n-pano.svg" },
  { bg: "#FDECC0", date: "#7A5A0E", edge: "#D9A21B", ink: "#8A6410", art: "n-video.svg" },
];

/** Blog — noktalı krem zemin üzerinde pul kenarlı üç kart. */
export function BlogSection() {
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const { data: posts } = usePublishedPosts(3);

  if (!posts?.length) return null;

  return (
    <section
      id="blog"
      className="ewd-dots ewd-bulge-host scroll-section ewd-section relative px-5 sm:px-8"
      style={{
        backgroundColor: "var(--ewd-cream)",
        ["--dot" as string]: "#F0DCE4",
        backgroundSize: "34px 34px",
      }}
    >
      {/* Tarak geçişi — noktalı krem zemin üstteki ve alttaki bölüme sarkar. */}
      <span className="ewd-bulge" style={{ ["--bulge" as string]: "var(--ewd-cream)" }} aria-hidden="true">
        <span className="ewd-bulge__tex ewd-dots" style={{ backgroundSize: "34px 34px" }} />
      </span>
      <div className="mx-auto max-w-[1180px]">
        <div className="flex flex-col items-start justify-between gap-6 pb-12 md:flex-row md:items-end md:gap-10">
          <div className="flex flex-col gap-2">
            <span className="ewd-label self-start rounded-full bg-[#EC4899] px-5 py-2.5 text-white">
              {t.blog.badge[language]}
            </span>
            <h2 className="ewd-h2 mt-1.5">{t.blog.title[language]}</h2>
            <p className="text-[15px] font-medium text-[#6B5B7B] sm:text-[16px]">{t.blog.lead[language]}</p>
          </div>
          <button type="button" onClick={() => navigate("/blog")} className="ewd-btn ewd-btn--purple">
            {t.blog.all[language]} →
          </button>
        </div>

        <div className="grid gap-11 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, i) => {
            const tone = TONES[i % TONES.length];
            return (
              <Link
                key={post.id}
                to={`/blog/${encodeURIComponent(post.slug)}`}
                className="ewd-stamp group block transition-transform duration-200 hover:-translate-y-1"
                style={{ ["--stamp" as string]: tone.bg }}
              >
                <span className="ewd-stamp__side ewd-stamp__side--l" aria-hidden="true" />
                <span className="ewd-stamp__side ewd-stamp__side--r" aria-hidden="true" />
                <div
                  className="relative flex h-full flex-col items-center gap-3.5 rounded-[26px] px-7 pb-8 pt-7 text-center"
                  style={{ background: tone.bg }}
                >
                  {/* Kapaklar 3:2 yükleniyor; kutu da 3:2 olsun ki görsel kırpılmadan tam boy dursun. */}
                  {post.cover_image_url ? (
                    <div className="aspect-[3/2] w-full overflow-hidden rounded-[18px]">
                      <img
                        src={post.cover_image_url}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-[3/2] w-full items-center justify-center">
                      <img
                        src={`/ewd/assets/ic/${tone.art}`}
                        alt=""
                        aria-hidden="true"
                        className="max-h-full w-auto"
                        style={{ filter: "drop-shadow(0 10px 16px rgba(46,16,101,0.24))" }}
                      />
                    </div>
                  )}

                  {/* Tarih, başlık ve özet tek blok: aralarındaki boşluk görsel ve buton
                      aralığından dar, böylece başlık havada durmuyor ve kart kısalıyor. */}
                  <div className="flex w-full flex-col items-center gap-1.5">
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

                    <h3 className="text-[18px] font-extrabold leading-[1.35] text-[#2E1065] [text-wrap:pretty] sm:text-[19px]">
                      {post.title}
                    </h3>

                    {post.excerpt && (
                      <p className="line-clamp-2 text-[13px] font-medium leading-relaxed text-[#5B4A6E]">
                        {post.excerpt}
                      </p>
                    )}
                  </div>

                  <span className="mt-auto pt-1">
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
      </div>
    </section>
  );
}
