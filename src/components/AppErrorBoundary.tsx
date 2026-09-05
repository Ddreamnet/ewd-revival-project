import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Uygulamanın son savunma hattı.
 *
 * Üç panel de `lazy()` ile yükleniyor. Deploy sonrası eski chunk'ın hash'i
 * sunucuda kalmadığı için 404 dönüyor; `lazy()` reject ediyor ve `Suspense`
 * bunu yakalamıyor — boundary olmadan React tüm ağacı unmount ediyor ve
 * kullanıcı bomboş beyaz ekran görüyor. Mobil veride kopan bir chunk isteği de
 * aynı sonucu veriyor.
 *
 * Bu yüzden iki ayrı mesaj var: chunk hatasında "yeni sürüm çıktı, yenile"
 * (gerçekten çözüm bu), diğerlerinde genel kurtarma.
 */

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Eski/yarım yüklenen kod parçası hataları — çözümü sayfayı yenilemek. */
function chunkHatasiMi(error: Error): boolean {
  const metin = `${error.name} ${error.message}`;
  return /loading chunk|chunkloaderror|dynamically imported module|importing a module script|failed to fetch dynamically/i.test(
    metin,
  );
}

/** Aynı oturumda sonsuz yenileme döngüsüne girmemek için. */
const YENILEME_ANAHTARI = "ewd:chunk-reload";

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error("[AppErrorBoundary]", error, info.componentStack);

    // Chunk hatasında bir kez kendiliğinden yenile: kullanıcı ne olduğunu
    // anlamak zorunda kalmasın. İkinci kez olursa ekranı gösterip duruyoruz,
    // yoksa sonsuz döngüye girer.
    if (chunkHatasiMi(error)) {
      let dahaOnce = false;
      try {
        dahaOnce = sessionStorage.getItem(YENILEME_ANAHTARI) === "1";
        if (!dahaOnce) sessionStorage.setItem(YENILEME_ANAHTARI, "1");
      } catch {
        // Gizli sekmede storage kapalı olabilir; o zaman elle yenileme kalır.
      }
      if (!dahaOnce) window.location.reload();
    }
  }

  private yenile = () => {
    try {
      sessionStorage.removeItem(YENILEME_ANAHTARI);
    } catch {
      /* önemsiz */
    }
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const chunk = chunkHatasiMi(error);

    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center"
        style={{ background: "var(--ewd-cream, #FFF8EF)" }}
        role="alert"
      >
        <img src="/uploads/logo.webp" alt="" aria-hidden="true" className="h-16 w-auto" />
        <h1 className="text-[22px] font-black" style={{ color: "var(--ewd-ink, #2E1065)" }}>
          {chunk ? "Yeni bir sürüm yayınlandı" : "Bir şeyler ters gitti"}
        </h1>
        <p
          className="max-w-[380px] text-[14px] font-medium leading-[1.55]"
          style={{ color: "var(--ewd-body, #5B4A6E)" }}
        >
          {chunk
            ? "Sayfayı yenileyince güncel sürüm yüklenecek."
            : "Bağlantını kontrol edip tekrar dene. Sorun sürerse çıkış yapıp yeniden giriş yap."}
        </p>
        <button type="button" className="ewd-btn ewd-btn--purple" onClick={this.yenile}>
          Yenile
        </button>
        {import.meta.env.DEV && (
          <pre className="max-w-full overflow-x-auto text-left text-[11px] opacity-60">
            {error.stack ?? error.message}
          </pre>
        )}
      </div>
    );
  }
}
