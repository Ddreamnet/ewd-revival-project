

# Post-Recovery Cleanup & Hardening (Updated)

## What Gets Removed

| Item | Action |
|---|---|
| `public/recovery.html` | Archive to `docs/archive/recovery.html`, then delete from public |
| `supabase/functions/data-recovery/index.ts` | Archive to `docs/archive/data-recovery-index.ts`, then delete |
| `supabase/config.toml` line 27-28 (`[functions.data-recovery]`) | Remove config entry |
| Edge function deployment | Undeploy `data-recovery` from Supabase |

## What Gets Preserved

All production code stays untouched:
- `package_cycle` filtering, cycle-aware instance generation
- All dashboard components (Teacher, Student, Admin panels)
- All data tables: `lesson_instances`, `student_lesson_tracking`, `student_lessons`, `teacher_balance` — zero mutations
- All other edge functions remain deployed

## Steps

1. **Archive recovery artifacts** — copy `public/recovery.html` to `docs/archive/recovery.html` and `supabase/functions/data-recovery/index.ts` to `docs/archive/data-recovery-index.ts` (local backup before deletion)
2. **Delete originals** — remove `public/recovery.html` and `supabase/functions/data-recovery/index.ts`
3. **Remove config** — delete `[functions.data-recovery]` block from `supabase/config.toml`
4. **Undeploy edge function** — use `supabase--delete_edge_functions` to remove `data-recovery` from Supabase
5. **Post-cleanup verification**:
   - Fetch `https://{preview-url}/recovery.html` and confirm it returns 404 / not found
   - Call `supabase--curl_edge_functions` on `data-recovery` and confirm it no longer responds
   - Verify no recovery references remain in `src/`

