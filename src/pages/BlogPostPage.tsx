import { useParams, Link } from "react-router-dom";
import { useBlogPostBySlug } from "@/hooks/useBlogPosts";
import { ArrowLeft } from "lucide-react";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { Footer } from "@/components/landing/Footer";

function BlogPostContent() {
  const { slug } = useParams<{ slug: string }>();
  const { data: post, isLoading } = useBlogPostBySlug(slug || "");

  if (isLoading) {
    return (
      <div className="landing-body min-h-screen overflow-x-hidden">
        <LandingHeader />
        <main className="pt-28 md:pt-32 pb-16 px-4 flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="landing-body min-h-screen overflow-x-hidden">
        <LandingHeader />
        <main className="pt-28 md:pt-32 pb-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-xl text-muted-foreground mb-4">Yazı bulunamadı.</p>
            <Link to="/blog" className="text-primary hover:underline flex items-center gap-1 justify-center">
              <ArrowLeft className="h-4 w-4" /> Blog'a dön
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="landing-body min-h-screen overflow-x-hidden">
      <LandingHeader />
      <main className="pt-28 md:pt-32 pb-16 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Cover image */}
          {post.cover_image_url && (
            <div className="aspect-[16/9] overflow-hidden rounded-xl mb-8">
              <img src={post.cover_image_url} alt={post.title} className="w-full h-full object-cover" />
            </div>
          )}

          {/* Meta */}
          {post.published_at && (
            <p className="text-sm text-muted-foreground mb-2">
              {new Date(post.published_at).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          )}

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-landing-purple-dark mb-6 leading-tight">{post.title}</h1>

          {/* Content */}
          {post.content && (
            <article
              className="prose prose-sm sm:prose-base max-w-none 
                prose-headings:text-foreground prose-p:text-foreground/90 
                prose-a:text-primary prose-strong:text-foreground
                prose-img:rounded-lg prose-img:mx-auto"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />
          )}

          {/* Back link */}
          <div className="mt-12 pt-6 border-t">
            <Link to="/blog" className="text-primary hover:underline flex items-center gap-1">
              <ArrowLeft className="h-4 w-4" /> Blog'a dön
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function BlogPostPage() {
  return (
    <LanguageProvider>
      <BlogPostContent />
    </LanguageProvider>
  );
}
