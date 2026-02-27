import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
              <CardContent className="p-3">
                <div className="flex justify-between items-start">
                  <CollapsibleTrigger
                    className="flex items-center gap-2 flex-1 text-left"
                    onClick={() => onToggleStudent(student.id, student)}
                  >
                    {expandedStudents.has(student.id) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <div className="flex-1">
                      <h4 className="font-medium">{student.profiles.full_name}</h4>
                      <p className="text-sm text-muted-foreground">{student.profiles.email}</p>

                      {student.lessons.length > 0 && (
                        <div className="mt-1 space-y-1">
                          {student.lessons.slice(0, 2).map((lesson, index) => (
                            <div key={index} className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                {getDayName(lesson.dayOfWeek)} {formatTime(lesson.startTime)}-
                                {formatTime(lesson.endTime)}
                              </span>
                            </div>
                          ))}
                          {student.lessons.length > 2 && (
                            <span className="text-xs text-muted-foreground">
                              +{student.lessons.length - 2} ders daha
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </CollapsibleTrigger>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenStudentAbout(student);
                      }}
                      title="Öğrenci hakkında"
                    >
                      <FileUser className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onEditStudent(student)}>
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <CollapsibleContent className="mt-4">
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
        <div className="mt-6 pt-4 border-t">
          <div className="flex items-center gap-2 mb-3">
            <Archive className="h-4 w-4 text-muted-foreground" />
            <h4 className="font-medium text-sm text-muted-foreground">Arşivlenmiş Öğrenciler</h4>
            <Badge variant="secondary" className="text-xs">
              {archivedStudents.length}
            </Badge>
          </div>
          <div className="space-y-2">
            {archivedStudents.map((student) => (
              <Card key={student.id} className="border bg-muted/30 opacity-70">
                <CardContent className="p-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Archive className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <h4 className="font-medium text-sm">{student.profiles.full_name}</h4>
                        <p className="text-xs text-muted-foreground">{student.profiles.email}</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => onRestoreStudent(student.id)}>
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Geri Al
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
