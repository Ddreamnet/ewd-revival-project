import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Tek 850 kB'lık paket yerine kararlı satıcı parçaları: sürüm çıktıkça
    // yalnızca değişen parça yeniden indirilir, ilk açılışta paralel iner.
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          // Altı dilin kelime bankası ~860 kB kaynak; kendi parçasında dursun
          // ki landing'in tembel bölümüyle birlikte inip önbellekte kalsın.
          if (/[\\/]src[\\/]lib[\\/]words[\\/]bank\./.test(id)) return "words-bank";
          if (!id.includes("node_modules")) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/.test(id)) {
            return "vendor-react";
          }
          if (id.includes("@supabase")) return "vendor-supabase";
          if (id.includes("@radix-ui")) return "vendor-radix";
          if (id.includes("@tiptap") || id.includes("prosemirror")) return "vendor-editor";
          if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
          if (id.includes("date-fns")) return "vendor-date";
          if (id.includes("lucide-react")) return "vendor-icons";
          return undefined;
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
});
