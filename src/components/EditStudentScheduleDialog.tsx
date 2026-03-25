import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface StudentSchedule {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface StudentData {
  name: string;
  email: string;
  schedule: StudentSchedule | null;
}

interface EditStudentScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  currentData: StudentData | null;
  onSaveChanges: (studentId: string, name: string, schedule: StudentSchedule) => Promise<void>;
  onRemoveStudent: (studentId: string) => Promise<void>;
}

const daysOfWeek = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];

const timeOptions: string[] = [];
for (let h = 8; h <= 22; h++) {
  for (let m = 0; m < 60; m += 15) {
    timeOptions.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
  }
}

export function EditStudentScheduleDialog({
  open,
  onOpenChange,
  studentId,
  currentData,
  onSaveChanges,
  onRemoveStudent,
}: EditStudentScheduleDialogProps) {
  const [name, setName] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState<number | undefined>();
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    if (currentData) {
      setName(currentData.name);
      if (currentData.schedule) {
        setDayOfWeek(currentData.schedule.dayOfWeek);
        setStartTime(currentData.schedule.startTime);
        setEndTime(currentData.schedule.endTime);
      } else {
        setDayOfWeek(undefined);
        setStartTime("");
        setEndTime("");
      }
    } else {
      setName("");
      setDayOfWeek(undefined);
      setStartTime("");
      setEndTime("");
    }
  }, [currentData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || dayOfWeek === undefined || !startTime || !endTime) return;

    setIsLoading(true);
    try {
      await onSaveChanges(studentId, name.trim(), {
        dayOfWeek,
        startTime,
        endTime,
      });
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async () => {
    setIsRemoving(true);
    try {
      await onRemoveStudent(studentId);
      onOpenChange(false);
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Student Settings</DialogTitle>
          <DialogDescription>Update the student's name and lesson schedule.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="student-name">Student Name</Label>
            <Input
              id="student-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter student name"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label>Day of Week</Label>
              <Select value={dayOfWeek?.toString()} onValueChange={(value) => setDayOfWeek(Number(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {daysOfWeek.map((day) => (
                    <SelectItem key={day.value} value={day.value.toString()}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Start Time</Label>
              <Select value={startTime} onValueChange={setStartTime}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {timeOptions.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>End Time</Label>
              <Select value={endTime} onValueChange={setEndTime}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {timeOptions.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2">
            <Button type="button" variant="destructive" onClick={handleRemove} disabled={isLoading || isRemoving} className="w-full sm:w-auto">
              {isRemoving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove Student
            </Button>

            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading || isRemoving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading || isRemoving || !name.trim() || dayOfWeek === undefined || !startTime || !endTime}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
