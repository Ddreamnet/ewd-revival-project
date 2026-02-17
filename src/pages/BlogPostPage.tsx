import { useParams, Link } from "react-router-dom";
import { useBlogPostBySlug } from "@/hooks/useBlogPosts";
import { ArrowLeft } from "lucide-react";

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: post, isLoading } = useBlogPostBySlug(slug || "");

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-xl text-muted-foreground">Yazı bulunamadı.</p>
        <Link to="/blog" className="text-primary hover:underline flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Blog'a dön
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="py-6 px-4">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Link to="/">
            <img src="/uploads/logo.webp" alt="English with Dilara" className="h-14 sm:h-16 w-auto" />
          </Link>
          <div className="flex-1" />
          <Link to="/blog" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Blog
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pb-16">
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

        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-6 leading-tight">{post.title}</h1>

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
      </main>
    </div>
  );
}
