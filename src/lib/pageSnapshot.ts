/**
 * Page Snapshot — captures the outgoing page's DOM as static HTML
 * for use as a visual background during back-swipe gestures.
 *
 * Single-slot storage: only the most recent snapshot is kept.
 */

interface Snapshot {
  html: string;
  scrollY: number;
}

let snapshot: Snapshot | null = null;

/** Selectors for elements that should be stripped from the snapshot */
const STRIP_SELECTORS = [
  '[data-sonner-toaster]',
  '[data-radix-portal]',
  '[data-radix-popper-content-wrapper]',
  '.toaster',
  '[role="dialog"]',
  '[role="alertdialog"]',
  'iframe',
  'video',
  'audio',
];

/**
 * Capture the current page's visual state.
 * Call BEFORE scrollTo(0,0) on route change so scroll position is preserved.
 */
export function captureSnapshot(): void {
  const root = document.getElementById('root');
  if (!root) return;

  const scrollY = window.scrollY;

  // Clone the root to avoid mutating live DOM
  const clone = root.cloneNode(true) as HTMLElement;

  // Strip portals, media, dialogs
  for (const selector of STRIP_SELECTORS) {
    clone.querySelectorAll(selector).forEach((el) => el.remove());
  }

  // Remove all id attributes to prevent DOM conflicts
  clone.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
  clone.removeAttribute('id');

  snapshot = {
    html: clone.innerHTML,
    scrollY,
  };
}

/** Get the stored snapshot, or null if none exists. */
export function getSnapshot(): Snapshot | null {
  return snapshot;
}

/** Clear the stored snapshot (call after swipe completes/cancels). */
export function clearSnapshot(): void {
  snapshot = null;
}
