import { BRANCHES, type Branch } from "@/lib/branch";

interface BranchSwitcherProps {
  value: Branch;
  onChange: (branch: Branch) => void;
  /** Şube başına öğretmen sayısı — rozet olarak gösterilir. */
  counts?: Record<Branch, number>;
}

/**
 * İngilizce ↔ Fransızca panel anahtarı.
 *
 * İki sistem birbirinden bağımsız: seçilen şubenin öğretmenleri, öğrencileri
 * ve global konuları görünür. Seçim `useAdminBranch` üzerinden saklanır.
 */
export function BranchSwitcher({ value, onChange, counts }: BranchSwitcherProps) {
  return (
    <div className="pnl-branch" role="group" aria-label="Panel şubesi">
      {BRANCHES.map((branch) => {
        const active = branch.code === value;
        const count = counts?.[branch.code];
        return (
          <button
            key={branch.code}
            type="button"
            className="pnl-branch__opt"
            data-active={active}
            aria-pressed={active}
            onClick={() => onChange(branch.code)}
          >
            {branch.label}
            {count !== undefined && <span className="pnl-branch__count">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
