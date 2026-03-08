import { useRef, useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import useEmblaCarousel from "embla-carousel-react";
import { usePublishedPosts } from "@/hooks/useBlogPosts";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";

export function BlogSection() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { data: posts } = usePublishedPosts(6);
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: "start", loop: false, skipSnaps: false });
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCanPrev(emblaApi.canScrollPrev());
    setCanNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
  }, [emblaApi, onSelect]);

  if (!posts?.length) return null;

  const title = language === "tr" ? "Blog" : "Blog";
  const subtitle = language === "tr"
    ? "İngilizce öğrenme yolculuğunuzda size ilham verecek yazılar"
    : "Articles to inspire you on your English learning journey";
  const allPosts = language === "tr" ? "Tüm yazılar" : "All posts";
  const readMore = language === "tr" ? "Devamını oku" : "Read more";

  return (
    <section id="blog" className="scroll-section py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-landing-purple-dark mb-3">{title}</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">{subtitle}</p>
          <Button
            variant="outline"
            className="mt-4 rounded-full border-landing-purple text-landing-purple-dark hover:bg-landing-purple/10"
            onClick={() => navigate("/blog")}
          >
            {allPosts} <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        {/* Carousel */}
        <div className="relative">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex gap-4 md:gap-6">
              {posts.map((post) => (
                <div key={post.id} className="flex-[0_0_85%] sm:flex-[0_0_45%] lg:flex-[0_0_30%] min-w-0">
                  <Link to={`/blog/${post.slug}`} className="block group">
                    <Card className="overflow-hidden h-full border-none shadow-md hover:shadow-lg transition-shadow bg-card">
                      {post.cover_image_url ? (
                        <div className="aspect-[16/10] overflow-hidden">
                          <img
                            src={post.cover_image_url}
                            alt={post.title}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                      ) : (
                        <div className="aspect-[16/10] bg-gradient-to-br from-landing-pink/40 to-landing-purple/30 flex items-center justify-center">
                          <span className="text-4xl">📝</span>
                        </div>
                      )}
                      <div className="p-4">
                        {post.published_at && (
                          <p className="text-xs text-muted-foreground mb-1">
                            {new Date(post.published_at).toLocaleDateString(language === "tr" ? "tr-TR" : "en-GB", { day: "numeric", month: "long", year: "numeric" })}
                          </p>
                        )}
                        <h3 className="font-semibold text-foreground line-clamp-2 mb-1 group-hover:text-primary transition-colors">{post.title}</h3>
                        {post.excerpt && <p className="text-sm text-muted-foreground line-clamp-2">{post.excerpt}</p>}
                        <span className="text-sm font-medium text-primary mt-2 inline-block">{readMore} →</span>
                      </div>
                    </Card>
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {/* Arrows */}
          {canPrev && (
            <button
              onClick={() => emblaApi?.scrollPrev()}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 bg-white/90 dark:bg-card shadow-md rounded-full p-2 hover:bg-white dark:hover:bg-mutedover:bg-white dark:hover:bg-muted transition hidden md:flex items-center justify-center"
            >
              <ChevronLeft className="h-5 w-5 text-foreground" />
            </button>
          )}
          {canNext && (
            <button
              onClick={() => emblaApi?.scrollNext()}
              className="absolute right-0 top-1/2 -translate-y-1/dark:bg-card shadow-md rounded-full p-2 hover:bg-white dark:hover:bg-mutedd rounded-full p-2 hover:bg-white transition hidden md:flex items-center justify-center"
            >
              <ChevronRight className="h-5 w-5 text-foreground" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
