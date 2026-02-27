/**
 * Pure functions for sorting and displaying lessons with override awareness.
 * Extracted from LessonTracker and StudentLessonTracker (identical logic).
 */

import { LessonDates, LessonOverrideInfo, SortedLesson, DisplayLessonData } from "./lessonTypes";

/**
 * Builds a chronologically sorted list of lessons, applying overrides.
 * Cancelled lessons sort by original date; active lessons sort by effective date.
 * 
 * CRITICAL: This ordering ensures correct chronological display when lessons are
 * rescheduled to dates beyond their original sequence (see memory: lesson-override-chronological-sorting-bug).
 */
export function getSortedLessons(
  lessonDates: LessonDates,
  lessonOverrides: LessonOverrideInfo[],
  totalLessons: number,
  instanceStartTimes?: Record<string, string> // lessonNumber -> start_time for time-aware sort
): SortedLesson[] {
  const lessonsWithDates: SortedLesson[] = [];

  for (let i = 1; i <= totalLessons; i++) {
    const originalDate = lessonDates[i.toString()];
    if (!originalDate) continue;

    const override = lessonOverrides.find((o) => o.original_date === originalDate);
    const isCancelled = override?.is_cancelled || false;
    const effectiveDate =
      override && override.new_date && !isCancelled ? override.new_date : originalDate;

    lessonsWithDates.push({
      lessonNumber: i,
      originalDate,
      effectiveDate,
      isCancelled,
      isOverridden: effectiveDate !== originalDate,
    });
  }

  // Sort by effective date + start_time (chronological order)
  lessonsWithDates.sort((a, b) => {
    const dateA = a.isCancelled ? a.originalDate : a.effectiveDate;
    const dateB = b.isCancelled ? b.originalDate : b.effectiveDate;
    const dateCompare = dateA.localeCompare(dateB);
    if (dateCompare !== 0) return dateCompare;
    // Time-aware tiebreak for same-date lessons
    if (instanceStartTimes) {
      const timeA = instanceStartTimes[a.lessonNumber.toString()] || "";
      const timeB = instanceStartTimes[b.lessonNumber.toString()] || "";
      return timeA.localeCompare(timeB);
    }
    return 0;
  });

  return lessonsWithDates;
}

/**
 * Maps a display position (1-based) to lesson data from the sorted array.
 * Returns sequential numbers when no dates have been assigned yet.
 */
export function getDisplayLessonData(
  sortedLessons: SortedLesson[],
  lessonDates: LessonDates,
  displayPosition: number
): DisplayLessonData {
  if (Object.keys(lessonDates).length === 0) {
    return {
      lessonNumber: displayPosition,
      displayDate: null,
      isCancelled: false,
      isOverridden: false,
    };
  }

  const lessonData = sortedLessons[displayPosition - 1];
  if (!lessonData) {
    return {
      lessonNumber: displayPosition,
      displayDate: null,
      isCancelled: false,
      isOverridden: false,
    };
  }

  return {
    lessonNumber: lessonData.lessonNumber,
    displayDate: lessonData.effectiveDate,
    isCancelled: lessonData.isCancelled,
    isOverridden: lessonData.isOverridden,
  };
}
