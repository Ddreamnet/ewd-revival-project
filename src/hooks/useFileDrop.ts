/**
 * useFileDrop — bir yüzeye (genellikle bütün diyalog kartına) dosya bırakma.
 *
 * `handlers` hedef öğeye yayılır; `dragging` sürükleme kartın üstündeyken
 * doğrudur. İki ayrıntı elle yazılınca hep yanlış çıkıyor:
 *  - `dragleave` alt öğeler arasında gezinirken de ateşlenir; tek bir boolean
 *    vurguyu titretir. Giriş/çıkışlar sayılır.
 *  - Hedefin birkaç piksel dışına bırakılan dosyayı tarayıcı SEKMEDE AÇAR ve
 *    uygulama gider. Yüzey açıkken pencere düzeyinde bu engellenir.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent as ReactDragEvent } from "react";

const hasFiles = (e: { dataTransfer: DataTransfer | null }) =>
  !!e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files");

export function useFileDrop(onFiles: (files: File[]) => void, enabled = true) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);
  const onFilesRef = useRef(onFiles);
  onFilesRef.current = onFiles;

  const reset = useCallback(() => {
    depth.current = 0;
    setDragging(false);
  }, []);

  useEffect(() => {
    if (!enabled) {
      reset();
      return;
    }
    const block = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const end = (e: DragEvent) => {
      block(e);
      reset();
    };
    window.addEventListener("dragover", block);
    window.addEventListener("drop", end);
    window.addEventListener("dragend", reset);
    return () => {
      window.removeEventListener("dragover", block);
      window.removeEventListener("drop", end);
      window.removeEventListener("dragend", reset);
    };
  }, [enabled, reset]);

  const handlers = useMemo(
    () => ({
      onDragEnter: (e: ReactDragEvent) => {
        if (!enabled || !hasFiles(e)) return;
        e.preventDefault();
        depth.current += 1;
        setDragging(true);
      },
      onDragOver: (e: ReactDragEvent) => {
        if (!enabled || !hasFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      },
      onDragLeave: (e: ReactDragEvent) => {
        if (!enabled || !hasFiles(e)) return;
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setDragging(false);
      },
      onDrop: (e: ReactDragEvent) => {
        if (!enabled || !hasFiles(e)) return;
        e.preventDefault();
        reset();
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) onFilesRef.current(files);
      },
    }),
    [enabled, reset],
  );

  return { dragging, handlers };
}
