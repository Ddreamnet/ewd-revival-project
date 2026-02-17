
-- Create blog_posts table
CREATE TABLE public.blog_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  excerpt text,
  content text,
  cover_image_url text,
  status text NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Public can read published posts (anon + authenticated)
CREATE POLICY "public_view_published_posts"
ON public.blog_posts
FOR SELECT
TO anon, authenticated
USING (status = 'published');

-- Admin full CRUD
CREATE POLICY "admin_full_access_blog_posts"
ON public.blog_posts
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- updated_at trigger
CREATE TRIGGER update_blog_posts_updated_at
BEFORE UPDATE ON public.blog_posts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create blog-media storage bucket (public)
INSERT INTO storage.buckets (id, name, public) VALUES ('blog-media', 'blog-media', true);

-- Storage policies: anyone can view
CREATE POLICY "Blog media publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'blog-media');

-- Only admins can upload
CREATE POLICY "Admins can upload blog media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'blog-media' AND public.has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update
CREATE POLICY "Admins can update blog media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'blog-media' AND public.has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete
CREATE POLICY "Admins can delete blog media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'blog-media' AND public.has_role(auth.uid(), 'admin'::app_role));
