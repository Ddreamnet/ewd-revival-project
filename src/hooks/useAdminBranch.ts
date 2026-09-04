import { useCallback, useState } from "react";
import { type Branch, readStoredBranch, storeBranch } from "@/lib/branch";

/**
 * Admin panelinin açık olduğu dil şubesi.
 *
 * Seçim tarayıcıda saklanır: admin Fransızca panelde çalışırken sayfayı
 * yenilediğinde İngilizce panele düşmez.
 */
export function useAdminBranch(): [Branch, (branch: Branch) => void] {
  const [branch, setBranchState] = useState<Branch>(readStoredBranch);

  const setBranch = useCallback((next: Branch) => {
    setBranchState(next);
    storeBranch(next);
  }, []);

  return [branch, setBranch];
}
