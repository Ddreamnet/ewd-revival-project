// Landing sayfasının admin panelinden düzenlenen içeriğini çeker.
//
// Landing açılışta anında boyansın diye ilk kare her zaman koddaki varsayılan
// sözlükle çizilir; veriler geldiğinde üzerine bindirilir. Bu yüzden hook
// yükleme durumu döndürmez — çağıran taraf beklemez.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SiteData } from "@/lib/siteContent";

export function useSiteData() {
  const [data, setData] = useState<SiteData | null>(null);

  const refetch = useCallback(async () => {
    try {
      const [contentRes, testimonialsRes, momentsRes] = await Promise.all([
        supabase.from("site_content").select("key, value"),
        supabase
          .from("site_testimonials")
          .select("id, quote_tr, quote_en, quote_fr, quote_ru, quote_es, quote_de, quote_ar, tags, order_index")
          .eq("is_published", true)
          .order("order_index"),
        supabase
          .from("site_moments")
          // eslint-disable-next-line max-len -- Supabase sütun listesini tek bir dizi sabiti olarak okur.
          .select(
            "id, media_type, media_url, poster_url, tag_tr, tag_en, tag_fr, tag_ru, tag_es, tag_de, tag_ar, caption_tr, caption_en, caption_fr, caption_ru, caption_es, caption_de, caption_ar, order_index",
          )
          .eq("is_published", true)
          .order("order_index"),
      ]);

      // Tek bir sorgu patlarsa bile diğerlerinin sonucu kullanılabilir; hata
      // veren küme boş kalır ve o bölüm varsayılan metinleriyle görünür.
      setData({
        content: contentRes.data ?? [],
        testimonials: testimonialsRes.data ?? [],
        moments: momentsRes.data ?? [],
      });
    } catch (error) {
      console.error("Failed to fetch site content:", error);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, refetch };
}
