import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Settings, Clock, UserPlus, Archive, RotateCcw, FileUser } from "lucide-react";
import { getDayName, formatTime } from "@/lib/lessonTypes";
import { AdminStudentTopicsSection } from "./AdminStudentTopicsSection";
import type { Student, Topic, Resource } from "@/lib/types";

interface AdminStudentListProps {
  students: Student[];
  expandedStudents: Set<string>;
  studentTopics: Map<string, Topic[]>;
  studentCompletedTopics: Map<string, Topic[]>;
  onToggleStudent: (studentId: string, student: Student) => void;
  onCreateStudent: () => void;
  onEditStudent: (student: Student) => void;
  onRestoreStudent: (studentId: string) => void;
  onOpenStudentAbout: (student: Student) => void;
  onAddTopic: (studentId: string) => void;
  onAddResource: (topicId: string) => void;
  onEditTopic: (topic: Topic) => void;
  onEditResource: (resource: Resource) => void;
  onDeleteTopic: (topicId: string, studentId: string, studentUserId: string) => void;
  onDeleteResource: (resourceId: string, studentId: string, studentUserId: string) => void;
}

export function AdminStudentList({
  students,
  expandedStudents,
  studentTopics,
  studentCompletedTopics,
  onToggleStudent,
  onCreateStudent,
  onEditStudent,
  onRestoreStudent,
  onOpenStudentAbout,
  onAddTopic,
  onAddResource,
  onEditTopic,
  onEditResource,
  onDeleteTopic,
  onDeleteResource,
}: AdminStudentListProps) {
  const activeStudents = students.filter((s) => !s.is_archived);
  const archivedStudents = students.filter((s) => s.is_archived);
  // Arşiv KAPALI başlar: arşivlenmiş öğrenci günlük işin parçası değil,
  // listenin altına açık serildiğinde aktif öğrencileri aşağı itiyordu.
  const [archiveOpen, setArchiveOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex justify-end mb-3">
        <Button onClick={onCreateStudent} size="sm">
          <UserPlus className="h-4 w-4 mr-2" />
          Öğrenci Oluştur
        </Button>
      </div>

      {/* Active Students */}
      {activeStudents.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Bu öğretmenin henüz aktif öğrencisi yok.
        </p>
      ) : (
        activeStudents.map((student) => (
          <Card key={student.id} className="border">
            <Collapsible>
              <CardContent className="p-2.5">
                {/* Ad, e-posta ve dersler alt alta üç blok hâlindeydi; kart
                    boyu öğrenci başına 100px'i geçiyordu. Şimdi ad bir satır,
                    ders saatleri onun altında TEK satırda virgülle.
                    E-posta bir ara kaldırılmıştı; admin, giriş adresini soran
                    veliye bakıp söyleyebilsin diye geri geldi. Kendi satırını
                    AÇMIYOR: adın yanında durur, yalnızca sığmadığında (telefon)
                    alta kayar — geniş kartta kart boyu değişmez. */}
                <div className="flex items-center gap-2">
                  <CollapsibleTrigger
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    onClick={() => onToggleStudent(student.id, student)}
                  >
                    {expandedStudents.has(student.id) ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                        <h4 className="max-w-full truncate text-[15px] font-semibold leading-tight">
                          {student.profiles.full_name}
                        </h4>
                        {student.profiles.email && (
                          <span className="max-w-full select-text truncate text-xs text-muted-foreground">
                            {student.profiles.email}
                          </span>
                        )}
                      </div>
                      {student.lessons.length > 0 && (
                        <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3 shrink-0" aria-hidden />
                          <span className="truncate">
                            {student.lessons
                              .slice(0, 2)
                              .map(
                                (lesson) =>
                                  `${getDayName(lesson.dayOfWeek)} ${formatTime(lesson.startTime)}`,
                              )
                              .join(", ")}
                            {student.lessons.length > 2 && ` +${student.lessons.length - 2}`}
                          </span>
                        </span>
                      )}
                    </div>
                  </CollapsibleTrigger>

                  <div className="flex shrink-0 items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenStudentAbout(student);
                      }}
                      title="Öğrenci hakkında"
                    >
                      <FileUser className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onEditStudent(student)}
                      title="Öğrenci ayarları"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <CollapsibleContent className="mt-3">
                  <AdminStudentTopicsSection
                    studentId={student.id}
                    studentUserId={student.student_id}
                    studentTopics={studentTopics.get(student.id) || []}
                    completedTopics={studentCompletedTopics.get(student.id) || []}
                    onAddTopic={onAddTopic}
                    onAddResource={onAddResource}
                    onEditTopic={onEditTopic}
                    onEditResource={onEditResource}
                    onDeleteTopic={onDeleteTopic}
                    onDeleteResource={onDeleteResource}
                  />
                </CollapsibleContent>
              </CardContent>
            </Collapsible>
          </Card>
        ))
      )}

      {/* Archived Students */}
      {archivedStudents.length > 0 && (
        <Collapsible open={archiveOpen} onOpenChange={setArchiveOpen} className="mt-4 border-t pt-3">
          <CollapsibleTrigger className="flex w-full items-center gap-2 text-left text-sm text-muted-foreground">
            {archiveOpen ? (
              <ChevronDown className="h-4 w-4 shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0" />
            )}
            <Archive className="h-4 w-4 shrink-0" aria-hidden />
            <span className="font-medium">Arşiv</span>
            <span className="tabular-nums">{archivedStudents.length}</span>
          </CollapsibleTrigger>

          <CollapsibleContent className="mt-2 space-y-1.5">
            {archivedStudents.map((student) => (
              <div
                key={student.id}
                className="flex items-center gap-2 rounded-lg border bg-muted/30 px-2.5 py-1.5"
              >
                <span className="min-w-0 flex-1 truncate text-sm">{student.profiles.full_name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => onRestoreStudent(student.id)}
                  title="Arşivden geri al"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
