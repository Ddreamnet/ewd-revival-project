

# DB Fallback Template Lookup + Template Source Display

## Changes

### 1. Edge Function (`supabase/functions/data-recovery/index.ts`)

**Add `template_source` field** to `ClassifiedStudent` interface: `"restore_json" | "current_db_fallback" | "none"`

**After building `templateMap` from restore JSON (line 115)**, add DB fallback block:
- Collect all `student_id + teacher_id` pairs from tracking that are NOT archived AND have no entry in `templateMap`
- Query `student_lessons` table filtered by those exact `(student_id, teacher_id)` pairs
- Add results to `templateMap`
- Track which keys came from DB fallback in a `Set<string>` called `dbFallbackKeys`

**Key detail**: The query filters by both `student_id` AND `teacher_id` (not just `student_id`), using `.in("student_id", missingStudentIds)` then filtering results by matching pairs.

**In classification output**, include `template_source`:
- If key is in `dbFallbackKeys` → `"current_db_fallback"`
- If key has templates from restore JSON → `"restore_json"`
- If no templates → `"none"`

**In response `safeApply` and `manualReview` objects**, add `template_source` field.

### 2. Recovery UI (`public/recovery.html`)

**SAFE_APPLY table**: Add "Kaynak" (Source) column after LPW column showing:
- `📦 JSON` (green) for `restore_json`
- `🔄 DB` (blue) for `current_db_fallback`

**MANUAL_REVIEW rows**: Show template source tag next to reason code when available.

### Files Modified

| File | Change |
|---|---|
| `supabase/functions/data-recovery/index.ts` | Add DB fallback query + template_source tracking |
| `public/recovery.html` | Add Kaynak column to SAFE_APPLY table, show source in MANUAL_REVIEW |

