import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Settings } from "lucide-react";
import type { Teacher } from "@/lib/types";

interface AdminTeacherListProps {
  teachers: Teacher[];
  selectedTeacher: Teacher | null;
  onSelectTeacher: (teacher: Teacher) => void;
  onCreateTeacher: () => void;
  onEditTeacher: (teacher: Teacher) => void;
}

export function AdminTeacherList({
  teachers,
  selectedTeacher,
  onSelectTeacher,
  onCreateTeacher,
  onEditTeacher,
}: AdminTeacherListProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Öğretmenler
            </CardTitle>
            <CardDescription>{teachers.length} öğretmen kayıtlı</CardDescription>
          </div>
          <Button onClick={onCreateTeacher} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Oluştur
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {teachers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Henüz öğretmen yok.</p>
        ) : (
          teachers.map((teacher) => (
            <Card
              key={teacher.user_id}
              className={`cursor-pointer transition-colors hover:bg-accent ${
                selectedTeacher?.user_id === teacher.user_id ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => onSelectTeacher(teacher)}
            >
              <CardContent className="p-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-medium">{teacher.full_name}</h4>
                    <p className="text-sm text-muted-foreground">{teacher.email}</p>
                    <Badge variant="outline" className="mt-1">
                      {teacher.students.filter((s) => !s.is_archived).length} öğrenci
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditTeacher(teacher);
                    }}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </CardContent>
    </Card>
  );
}
