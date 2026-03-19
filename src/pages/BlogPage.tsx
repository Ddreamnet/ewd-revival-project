import { useState } from "react";
import { Link } from "react-router-dom";
import { usePublishedPostsPaginated } from "@/hooks/useBlogPosts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { Footer } from "@/components/landing/Footer";
import { BackSwipeWrapper } from "@/components/BackSwipeWrapper";

const PAGE_SIZE = 9;

function BlogContent() {
  const [page, setPage] = useState(0);
  const { data, isLoading } = usePublishedPostsPaginated(page, PAGE_SIZE);

  const posts = data?.posts || [];
  const total = data?.total || 0;
  const hasMore = (page + 1) * PAGE_SIZE < total;

  return (
    <BackSwipeWrapper>
    <div className="landing-body min-h-screen overflow-x-hidden">
      <LandingHeader />
      <main className="pt-28 md:pt-32 pb-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-landing-purple-dark text-center mb-8">
            Blog
          </h1>

          {isLoading && page === 0 ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : !posts.length ? (
            <p className="text-center text-muted-foreground py-16">Henüz yayınlanmış yazı yok.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {posts.map((post) => (
                  <Link key={post.id} to={`/blog/${post.slug}`} className="group">
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
                            {new Date(post.published_at).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
                          </p>
                        )}
                        <h2 className="font-semibold text-foreground line-clamp-2 mb-1 group-hover:text-primary transition-colors">{post.title}</h2>
                        {post.excerpt && <p className="text-sm text-muted-foreground line-clamp-3">{post.excerpt}</p>}
                        <span className="text-sm font-medium text-primary mt-2 inline-block">Devamını oku →</span>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>

              {hasMore && (
                <div className="flex justify-center mt-10">
                  <Button variant="outline" className="rounded-full" onClick={() => setPage((p) => p + 1)} disabled={isLoading}>
                    Daha fazla yükle
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function BlogPage() {
  return (
    <LanguageProvider>
      <BlogContent />
    </LanguageProvider>
  );
}
