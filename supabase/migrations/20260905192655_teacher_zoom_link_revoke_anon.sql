-- Şemadaki varsayılan haklar yeni işlevi `anon` rolüne de açıyor. Oturumsuz
-- çağrı zaten boş dönerdi (auth.uid() yok) ama gereksiz yetki kalmasın.
REVOKE EXECUTE ON FUNCTION public.my_teacher_zoom_link() FROM anon;
