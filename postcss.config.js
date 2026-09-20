import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

/**
 * `:hover` kurallarını `@media (hover: hover)` içine alır.
 *
 * Dokunmatik ekranda gerçek bir "üzerine gelme" yok: tarayıcı, dokunulan öğeyi
 * başka bir yere dokunulana kadar `:hover` sayıyor. Düğme basıldıktan sonra
 * kalkık/renkli kalıyor — uygulamanın "web sayfası" gibi hissettirmesinin
 * bilinen nedenlerinden biri. Kurallar tek tek elle sarılmak yerine burada,
 * derleme sırasında sarılıyor: panel.css / ewd.css'teki elle yazılmış kurallar
 * da Tailwind'in ürettiği `hover:` / `group-hover:` sınıfları da kapsanıyor,
 * sonradan eklenecek kurallar da. Fareli cihazlarda hiçbir şey değişmez.
 *
 * Dokunmatikte basma geri bildirimi `:active` ile veriliyor (src/index.css).
 * Yalnızca hover'da GÖRÜNÜR olan bir öğe eklenirse dokunmatik için ayrıca
 * görünür yapılmalı (örnek: ui/toast.tsx kapatma düğmesi).
 */
const hoverGuard = () => ({
  postcssPlugin: "ewd-hover-guard",
  OnceExit(root, { AtRule }) {
    root.walkRules((rule) => {
      if (!rule.selector.includes(":hover")) return;

      for (let p = rule.parent; p && p.type !== "root"; p = p.parent) {
        if (p.type !== "atrule") continue;
        if (p.name === "keyframes") return;
        if (p.name === "media" && /hover:\s*hover/.test(p.params)) return;
      }

      const hoverli = rule.selectors.filter((s) => s.includes(":hover"));
      const digerleri = rule.selectors.filter((s) => !s.includes(":hover"));

      const media = new AtRule({ name: "media", params: "(hover: hover)" });
      media.append(rule.clone({ selectors: hoverli }));
      // Aynı yerde kalsın: basamak (cascade) sırası değişmesin.
      rule.after(media);

      if (digerleri.length > 0) rule.selectors = digerleri;
      else rule.remove();
    });
  },
});
hoverGuard.postcss = true;

export default {
  plugins: [tailwindcss(), autoprefixer(), hoverGuard()],
};
