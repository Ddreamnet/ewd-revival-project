import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar, AlertCircle } from "lucide-react";
import { formatTime } from "@/lib/lessonTypes";
import {
  getActualLessonsForDayAndTime,
  getTrialLessonForDayAndTime,
  isSecondaryInBackToBack,
  getBackToBackGroupForLesson,
  dayIndexToDbDayOfWeek,
  getLessonDateForCurrentWeek,
  ActualLesson,
} from "@/hooks/useScheduleGrid";

interface TrialLesson {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_completed: boolean;
  lesson_date: string;
}

interface StudentLesson {
  id: string;
  student_id: string;
  student_name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  note?: string;
}

interface ScheduleGridCellProps {
  showTemplate: boolean;
  dayIndex: number;
  timeSlot: string;
  lessons: StudentLesson[];
  actualLessons: ActualLesson[];
  trialLessons: TrialLesson[];
  weekStart: Date;
  studentColors: Map<string, string>;
  onActualLessonClick: (lesson: ActualLesson) => void;
  onTrialLessonClick: (trial: TrialLesson) => void;
}

export function ScheduleGridCell({
  showTemplate,
  dayIndex,
  timeSlot,
  lessons,
  actualLessons,
  trialLessons,
  weekStart,
  studentColors,
  onActualLessonClick,
  onTrialLessonClick,
}: ScheduleGridCellProps) {
  if (showTemplate) {
    const lesson = lessons.find(
      (l) => l.day_of_week === dayIndexToDbDayOfWeek(dayIndex) && l.start_time === timeSlot
    );
    return (
      <td className="border border-border p-2">
        {lesson && (
          <div
            className={`w-full py-2 px-3 rounded border-2 ${
              studentColors.get(lesson.student_id) || "bg-gray-100 text-gray-800 border-gray-300"
            }`}
          >
            <div className="text-center">
              <div className="font-medium text-xs">
                {lesson.note ? `${lesson.student_name} - ${lesson.note}` : lesson.student_name}
              </div>
              <div className="text-[10px] mt-1 font-mono">
                {formatTime(lesson.start_time)} - {formatTime(lesson.end_time)}
              </div>
            </div>
          </div>
        )}
      </td>
    );
  }

  // GÜNCEL MODE
  const slotLessons = getActualLessonsForDayAndTime(actualLessons, dayIndex, timeSlot, weekStart);
  const trialLesson = getTrialLessonForDayAndTime(trialLessons, dayIndex, timeSlot, weekStart);

  const visibleLessons = slotLessons.filter(
    (l) => !isSecondaryInBackToBack(actualLessons, dayIndex, l.id, weekStart)
  );

  if (visibleLessons.length === 0 && !trialLesson) {
    return <td className="border border-border p-2"></td>;
  }

  type RenderItem =
    | { type: "b2b"; lesson: ActualLesson; group: ActualLesson[] }
    | { type: "single"; lesson: ActualLesson }
    | { type: "trial"; trial: TrialLesson };

  const renderItems: RenderItem[] = [];

  for (const lesson of visibleLessons) {
    const b2bGroup = getBackToBackGroupForLesson(actualLessons, dayIndex, lesson.id, weekStart);
    if (b2bGroup) {
      renderItems.push({ type: "b2b", lesson, group: b2bGroup });
    } else {
      renderItems.push({ type: "single", lesson });
    }
  }
  if (trialLesson && visibleLessons.length === 0) {
    renderItems.push({ type: "trial", trial: trialLesson });
  }

  const isMulti = renderItems.length > 1;

  return (
    <td className="border border-border p-1">
      <div className="flex gap-0.5 h-full">
        {renderItems.map((item) => {
          if (item.type === "b2b") {
            const al = item.lesson;
            return (
              <Popover key={al.id}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`${isMulti ? "flex-1 min-w-0 px-1 py-1" : "w-full py-2"} justify-center cursor-pointer relative ${
                      al.status === "completed" ? "opacity-40" : ""
                    } ${al.is_manual_override ? "ring-2 ring-amber-400 ring-offset-1" : ""} ${
                      studentColors.get(al.student_id) || "bg-gray-100 text-gray-800"
                    }`}
                  >
                    <div className="text-center truncate">
                      <div className={`font-medium flex items-center justify-center gap-1 ${isMulti ? "text-[10px]" : ""}`}>
                        {al.is_manual_override && <Calendar className="h-3 w-3 text-amber-600 shrink-0" />}
                        <span className="truncate">{al.student_name}</span>
                        <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0">
                          {item.group.length} ders
                        </Badge>
                      </div>
                      {!isMulti &&
                        item.group.map((l) => (
                          <div key={l.id} className="text-xs mt-0.5 font-mono">
                            {formatTime(l.start_time)} - {formatTime(l.end_time)}
                          </div>
                        ))}
                    </div>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2">
                  <div className="flex flex-col gap-1">
                    {item.group.map((l) => (
                      <Button
                        key={l.id}
                        variant="ghost"
                        size="sm"
                        className="justify-start text-xs"
                        onClick={() => onActualLessonClick(l)}
                      >
                        {formatTime(l.start_time)} - {formatTime(l.end_time)}
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            );
          }

          if (item.type === "single") {
            const al = item.lesson;
            return (
              <Button
                key={al.id}
                variant="outline"
                className={`${isMulti ? "flex-1 min-w-0 px-1 py-1" : "w-full py-2"} justify-center relative ${
                  al.isGhost ? "cursor-default" : "cursor-pointer"
                } ${!al.isGhost && al.status === "completed" ? "opacity-40" : ""} ${
                  !al.isGhost && al.is_manual_override ? "ring-2 ring-amber-400 ring-offset-1" : ""
                } ${studentColors.get(al.student_id) || "bg-gray-100 text-gray-800"}`}
                onClick={() => !al.isGhost && onActualLessonClick(al)}
              >
                {al.isGhost && <AlertCircle className="absolute top-1 right-1 h-3 w-3 text-amber-500" />}
                <div className="text-center truncate">
                  <div className={`font-medium flex items-center justify-center gap-1 ${isMulti ? "text-[10px]" : ""}`}>
                    {!al.isGhost && al.is_manual_override && <Calendar className="h-3 w-3 text-amber-600 shrink-0" />}
                    <span className="truncate">{al.student_name}</span>
                  </div>
                  <div className={`${isMulti ? "text-[9px]" : "text-xs"} mt-0.5 font-mono`}>
                    {formatTime(al.start_time)} - {formatTime(al.end_time)}
                  </div>
                </div>
              </Button>
            );
          }

          if (item.type === "trial") {
            const tl = item.trial;
            return (
              <Button
                key={tl.id}
                variant="outline"
                className={`${isMulti ? "flex-1 min-w-0 px-1 py-1" : "w-full py-2"} border-2 transition-all ${
                  tl.is_completed
                    ? "bg-red-50/30 text-red-300 border-red-100 hover:bg-red-50/50 opacity-40"
                    : "bg-red-100 text-red-800 border-red-300 hover:bg-red-200"
                }`}
                onClick={() => onTrialLessonClick(tl)}
              >
                <div className="text-center w-full truncate">
                  <div className={`font-medium ${isMulti ? "text-[10px]" : ""}`}>Deneme</div>
                  <div className={`${isMulti ? "text-[9px]" : "text-xs"} mt-0.5 font-mono`}>
                    {formatTime(tl.start_time)} - {formatTime(tl.end_time)}
                  </div>
                </div>
              </Button>
            );
          }

          return null;
        })}
      </div>
    </td>
  );
}
