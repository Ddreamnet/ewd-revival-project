import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Ana sayfadaki bir bölüme götürür: zaten o sayfadaysak yumuşakça kaydırır,
 * başka bir sayfadaysak ana sayfaya dönüp oraya kaydırır.
 *
 * Header, mobil menü ve footer aynı bölümlere bağlandığı için mantık burada
 * tek yerde duruyor.
 */
export function useSectionNav() {
  const navigate = useNavigate();

  return useCallback(
    (id: string) => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      } else {
        navigate("/", { state: { scrollTo: id } });
      }
    },
    [navigate],
  );
}
