import type { DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "lucide-react";
import { formatTime } from "@/lib/lessonTypes";
import {
  getActualLessonsForDayAndTime,
  isSecondaryInBackToBack,
  getBackToBackGroupForLesson,
  dayIndexToDbDayOfWeek,
  ActualLesson,
} from "@/hooks/useScheduleGrid";

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
  weekStart: Date;
  studentColors: Map<string, string>;
  onActualLessonClick: (lesson: ActualLesson) => void;
  /** Taşınmak üzere seçilmiş ders — seçiliyken her hücre hedef olur. */
  tasinan?: ActualLesson | null;
  /** Sürüklemeye başlandı (masaüstü) ya da "Taşı" ile seçildi (dokunmatik). */
  onTasimaBasla?: (lesson: ActualLesson) => void;
  /** Hedef hücre seçildi: bırakma ya da dokunma. */
  onHedefSec?: (dayIndex: number, timeSlot: string) => void;
}

export function ScheduleGridCell({
  showTemplate,
  dayIndex,
  timeSlot,
  lessons,
  actualLessons,
  weekStart,
  studentColors,
  onActualLessonClick,
  tasinan = null,
  onTasimaBasla,
  onHedefSec,
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
  //
  // Her hücre bir hedef: boş olan da, dolu olan da. Dolu bir saate bırakmak
  // artık engellenmiyor — sunucu yazıyor ve çakışmayı uyarı olarak bildiriyor.
  const tasimaModu = !!tasinan;
  const hedefOzellikleri = {
    onDragOver: (e: DragEvent) => {
      if (onHedefSec) e.preventDefault();
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      onHedefSec?.(dayIndex, timeSlot);
    },
    onClick: tasimaModu ? () => onHedefSec?.(dayIndex, timeSlot) : undefined,
  };
  const hedefSinifi = tasimaModu
    ? "outline-dashed outline-1 outline-primary/40 cursor-copy hover:bg-primary/5"
    : "";

  const slotLessons = getActualLessonsForDayAndTime(actualLessons, dayIndex, timeSlot, weekStart);

  const visibleLessons = slotLessons.filter(
    (l) => !isSecondaryInBackToBack(actualLessons, dayIndex, l.id, weekStart)
  );

  if (visibleLessons.length === 0) {
    return <td className={`border border-border p-2 ${hedefSinifi}`} {...hedefOzellikleri}></td>;
  }

  type RenderItem =
    | { type: "b2b"; lesson: ActualLesson; group: ActualLesson[] }
    | { type: "single"; lesson: ActualLesson };

  const renderItems: RenderItem[] = [];

  for (const lesson of visibleLessons) {
    const b2bGroup = getBackToBackGroupForLesson(actualLessons, dayIndex, lesson.id, weekStart);
    if (b2bGroup) {
      renderItems.push({ type: "b2b", lesson, group: b2bGroup });
    } else {
      renderItems.push({ type: "single", lesson });
    }
  }

  const isMulti = renderItems.length > 1;

  /**
   * Kart rengi. Deneme dersinin öğrencisi yok, dolayısıyla öğrenci rengi de
   * yok; eskiden ayrı bir dalda çizildiği için kırmızısı oraya gömülüydü.
   */
  const renkSinifi = (l: ActualLesson) =>
    l.tur === "deneme"
      ? "bg-red-100 text-red-800 border-red-300 hover:bg-red-200"
      : (l.student_id && studentColors.get(l.student_id)) || "bg-gray-100 text-gray-800";

  return (
    <td className={`border border-border p-1 ${hedefSinifi}`} {...hedefOzellikleri}>
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
                    } ${al.is_manual_override ? "ring-2 ring-amber-400 ring-offset-1" : ""} ${renkSinifi(al)}`}
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
                className={`${isMulti ? "flex-1 min-w-0 px-1 py-1" : "w-full py-2"} justify-center relative cursor-pointer ${
                  al.status === "completed" ? "opacity-40" : ""
                } ${al.is_manual_override ? "ring-2 ring-amber-400 ring-offset-1" : ""} ${tasinan?.id === al.id ? "opacity-30" : ""} ${renkSinifi(al)}`}
                draggable={!!onTasimaBasla}
                onDragStart={() => onTasimaBasla?.(al)}
                onClick={() => {
                  // Taşıma sürerken hücreye dokunmak hedefi seçer; ders
                  // panelini açmak bu modda beklenmeyen bir sonuç olurdu.
                  if (tasimaModu) {
                    onHedefSec?.(dayIndex, timeSlot);
                    return;
                  }
                  onActualLessonClick(al);
                }}
              >
                <div className="text-center truncate">
                  <div className={`font-medium flex items-center justify-center gap-1 ${isMulti ? "text-[10px]" : ""}`}>
                    {al.is_manual_override && <Calendar className="h-3 w-3 text-amber-600 shrink-0" />}
                    <span className="truncate">{al.student_name}</span>
                  </div>
                  <div className={`${isMulti ? "text-[9px]" : "text-xs"} mt-0.5 font-mono`}>
                    {formatTime(al.start_time)} - {formatTime(al.end_time)}
                  </div>
                  {al.tur === "deneme" && al.aday_adi && (
                    <div className={`${isMulti ? "text-[9px]" : "text-[10px]"} opacity-70`}>deneme</div>
                  )}
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
