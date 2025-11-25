import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import html2canvas from "html2canvas";

export interface LessonData {
  timeSlot: string;
  dayLessons: (string | null)[];
}

export const exportToPDF = async (
  lessons: LessonData[],
  days: string[],
  formatTime: (time: string) => string
): Promise<void> => {
  const doc = new jsPDF({ orientation: "landscape" });
  
  doc.setFontSize(16);
  doc.text("Haftalık Ders Programı", 14, 15);
  
  const tableData = lessons.map((lesson) => {
    const row = [formatTime(lesson.timeSlot)];
    lesson.dayLessons.forEach((lessonText) => {
      row.push(lessonText || "-");
    });
    return row;
  });

  autoTable(doc, {
    head: [["Saat", ...days]],
    body: tableData,
    startY: 25,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [59, 130, 246] },
  });

  const today = new Date().toISOString().split("T")[0];
  doc.save(`ders-programi-${today}.pdf`);
};

export const exportToPNG = async (elementId: string): Promise<void> => {
  const scheduleElement = document.getElementById(elementId);
  if (!scheduleElement) {
    throw new Error("Schedule element not found");
  }

  const canvas = await html2canvas(scheduleElement, {
    backgroundColor: "#ffffff",
    scale: 2,
  });

  const link = document.createElement("a");
  const today = new Date().toISOString().split("T")[0];
  link.download = `ders-programi-${today}.png`;
  link.href = canvas.toDataURL();
  link.click();
};

export const exportToExcel = async (
  lessons: LessonData[],
  days: string[],
  formatTime: (time: string) => string
): Promise<void> => {
  const data = [["Saat", ...days]];
  
  lessons.forEach((lesson) => {
    const row = [formatTime(lesson.timeSlot)];
    lesson.dayLessons.forEach((lessonText) => {
      row.push(lessonText || "-");
    });
    data.push(row);
  });

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Ders Programı");

  const today = new Date().toISOString().split("T")[0];
  XLSX.writeFile(wb, `ders-programi-${today}.xlsx`);
};
