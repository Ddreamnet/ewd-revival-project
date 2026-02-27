
# Codebase Architecture Audit Report

## Executive Summary

The project is a multi-role education platform (Admin, Teacher, Student dashboards + public landing page) built with React, Supabase, and Capacitor. A recent refactoring extracted lesson-related logic into shared modules, which was a significant improvement. However, several structural issues remain that impact maintainability.

---

## Issue 1: Massive Dashboard Components (CRITICAL)

**Problem:** `AdminDashboard.tsx` is 1,128 lines with 25+ state variables, inline CRUD handlers for topics/resources, and deeply nested JSX (8+ levels). `TeacherDashboard.tsx` (349 lines) and `StudentDashboard.tsx` (519 lines) are more manageable but still contain inline data-fetching logic and duplicated utilities.

**Impact:** Difficult to read, test, or modify any single feature without risking the whole dashboard.

**Recommendation:**
- Extract `AdminDashboard` into sub-components:
  - `AdminTeacherList` -- teacher sidebar with selection
  - `AdminStudentList` -- student cards with expand/collapse, archived section
  - `AdminStudentTopicsSection` -- the "Islenen Konular" + "Ogrenciye Ozel Konular" inline sections (lines 776-968)
- Move topic/resource CRUD handlers (`handleAddTopic`, `handleEditTopic`, `handleDeleteTopic`, `handleAddResource`, `handleEditResource`, `handleDeleteResource`) into a custom hook `useAdminTopicsCrud(teacherId)`.
- Move `fetchStudentTopics` into a shared hook since it does the same global+student topic merging that `StudentDashboard.fetchTopics` and `StudentTopics.fetchTopics` also do.

**Priority:** High -- this is the single largest maintenance risk.

---

## Issue 2: Duplicated Interface Definitions (HIGH)

**Problem:** `StudentLesson` interface is defined independently in 8 files with slight variations (some have `id?`, some have `isCompleted?`, some have `note?`). `Student` interface is defined in 4 files. `Topic` and `Resource` interfaces are defined in 3 files.

**Files affected:**
- `StudentLesson`: AdminDashboard, TeacherDashboard, EditStudentDialog, AddStudentDialog, CreateStudentDialog, EditStudentLessonsDialog, WeeklyScheduleDialog, AdminWeeklySchedule, ScheduleExportCanvas
- `Student`: AdminDashboard, TeacherDashboard, StudentTopics
- `Topic`/`Resource`: AdminDashboard, StudentDashboard, StudentTopics

**Recommendation:**
- Add `StudentLesson`, `Student`, `Teacher`, `Topic`, `Resource` interfaces to `src/lib/lessonTypes.ts` (or create a new `src/lib/types.ts` for non-lesson types).
- Use a union or optional fields approach: `StudentLesson` with all optional fields, and each consumer picks what it needs.

**Priority:** High -- prevents drift between components.

---

## Issue 3: Duplicated Utility Functions (MEDIUM)

**Problem:** Several small utility functions are copy-pasted across components:

| Function | Duplicated in |
|---|---|
| `getDayName(dayOfWeek)` | AdminDashboard, TeacherDashboard |
| `formatTime(time)` | AdminDashboard, TeacherDashboard (local versions differ from `lessonTypes.formatTime`) |
| `getResourceIcon(type)` | AdminDashboard, StudentDashboard, StudentTopics, GlobalTopicsManager (4 identical copies) |
| `getLessonStatus(day, time)` | TeacherDashboard (only 1 copy, but could be shared) |

**Recommendation:**
- Move `getDayName` to `src/lib/lessonTypes.ts` alongside existing `formatTime`.
- Create `src/lib/resourceUtils.tsx` exporting `getResourceIcon` as a shared React component.
- Ensure AdminDashboard and TeacherDashboard use the centralized `formatTime` from `lessonTypes.ts` instead of local copies.

**Priority:** Medium.

---

## Issue 4: Topic Fetching Logic Triplicated (MEDIUM)

**Problem:** The pattern of "fetch student topics + global topics + completion status + merge" appears in three places:
1. `AdminDashboard.fetchStudentTopics` (lines 196-301)
2. `StudentDashboard.fetchTopics` (lines 102-226)
3. `StudentTopics.fetchTopics` (lines 104-240)

All three do essentially the same thing: query `topics`, `global_topics`, `student_resource_completion`, build a completion map, merge, and sort.

**Recommendation:**
- Create `src/hooks/useStudentTopics.ts` that encapsulates this fetch-merge-sort pattern.
- Parameters: `studentUserId`, `options: { includeGlobal: boolean, onlyCompleted: boolean }`
- Returns: `{ topics, loading, refetch }`

**Priority:** Medium -- reduces ~350 lines of duplicated data-fetching logic.

---

## Issue 5: Flat Component Directory (MEDIUM)

**Problem:** `src/components/` has 40+ files at the top level with no subdirectory organization beyond `landing/` and `ui/`. Admin-specific dialogs, teacher components, student components, and shared components are all mixed together.

**Recommendation:** Organize into role-based subdirectories:

```text
src/components/
  admin/
    AdminDashboard.tsx
    AdminWeeklySchedule.tsx
    AdminBalanceManager.tsx
    AdminBlogManager.tsx
    AdminNotificationBell.tsx
    CreateStudentDialog.tsx
    CreateTeacherDialog.tsx
    EditStudentDialog.tsx
    EditTeacherDialog.tsx
    LessonOverrideDialog.tsx
    ...
  teacher/
    TeacherDashboard.tsx
    TeacherBalanceDialog.tsx
    WeeklyScheduleDialog.tsx
    StudentTopics.tsx
    ...
  student/
    StudentDashboard.tsx
    StudentLessonTracker.tsx
    UploadHomeworkDialog.tsx
    ...
  shared/
    Header.tsx
    Logo.tsx
    AuthForm.tsx
    ContactDialog.tsx
    NotificationBell.tsx
    HomeworkListDialog.tsx
    ...
  landing/  (already organized)
  ui/  (already organized)
```

**Priority:** Medium -- improves discoverability, no functional change.

---

## Issue 6: Dead/Unused Code (LOW)

**Problem:**
- `src/pages/Index.tsx` contains a placeholder page ("BOS EWD") that is routed but serves no purpose since `/` goes to `LandingPage`.
- `src/hooks/useAuth.ts` is a 3-line re-export wrapper that could be replaced by direct imports of `useAuthContext`.

**Recommendation:**
- Remove `Index.tsx` or redirect its route.
- Consider removing `useAuth.ts` wrapper if the indirection is not providing value (though it does provide a stable import path, so this is optional).

**Priority:** Low.

---

## Issue 7: Inline Supabase Queries in Components (MEDIUM)

**Problem:** Most dashboard components make direct `supabase.from(...)` calls inline. There is no data-access layer. This means:
- Query logic is not reusable.
- Error handling patterns are repeated (`try/catch + toast`).
- Testing requires mocking the Supabase client everywhere.

**Recommendation:** For the most-duplicated queries, extract into service functions or hooks:
- `useTeachers()` -- fetches teachers with students and lessons (used by AdminDashboard)
- `useStudentTopics(studentId)` -- as described in Issue 4
- `useStudentData(teacherId)` -- fetches students with lessons (used by TeacherDashboard)

This is a larger architectural shift. Start with the most-duplicated patterns (topic fetching) and expand gradually.

**Priority:** Medium -- do incrementally alongside other refactors.

---

## Recommended Implementation Order

| Step | Change | Files | Risk |
|---|---|---|---|
| 1 | Centralize shared interfaces (`StudentLesson`, `Student`, `Topic`, `Resource`) | `src/lib/types.ts` (new), all consumers | Low -- additive |
| 2 | Move `getDayName`, `getResourceIcon` to shared modules | `src/lib/lessonTypes.ts`, `src/lib/resourceUtils.tsx` (new) | Low |
| 3 | Create `useStudentTopics` hook | `src/hooks/useStudentTopics.ts` (new) | Low -- additive |
| 4 | Refactor `StudentTopics` and `StudentDashboard` to use `useStudentTopics` | 2 files | Medium |
| 5 | Extract `AdminDashboard` sub-components | 3-4 new files, 1 modified | Medium |
| 6 | Extract admin topic CRUD into `useAdminTopicsCrud` hook | 1 new file, AdminDashboard modified | Medium |
| 7 | Reorganize component directory structure | Move files, update imports | Low (but many files touched) |
| 8 | Remove dead code (`Index.tsx`) | 1-2 files | Low |

Each step is independently deployable and testable. Steps 1-3 are purely additive (new files only). Steps 4-6 modify existing components. Step 7 is a bulk rename that should be done in one commit.

---

## What Is Already Well Done

- **Recent lesson refactoring**: `lessonTypes.ts`, `teacherBalance.ts`, `lessonSorting.ts`, `lessonDateCalculation.ts`, `useScheduleGrid.ts` are clean, well-documented shared modules.
- **Auth architecture**: `AuthContext` with `useAuth` wrapper is clean and handles Capacitor-specific session persistence well.
- **Landing page organization**: `src/components/landing/` is well-structured with individual section components.
- **Language system**: `LanguageContext` + `translations.ts` is a good i18n approach.
- **Lazy loading**: Secondary pages are code-split with prefetching -- good performance practice.
