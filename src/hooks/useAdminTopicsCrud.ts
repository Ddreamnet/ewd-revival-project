import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Topic } from "@/lib/types";

interface UseAdminTopicsCrudOptions {
  adminUserId: string | undefined;
  selectedTeacherStudents: Array<{ id: string; student_id: string }> | undefined;
  studentTopics: Map<string, Topic[]>;
  fetchStudentTopics: (studentUserId: string, studentId: string) => Promise<void>;
}

export function useAdminTopicsCrud({
  adminUserId,
  selectedTeacherStudents,
  studentTopics,
  fetchStudentTopics,
}: UseAdminTopicsCrudOptions) {
  const { toast } = useToast();

  const handleAddTopic = async (title: string, description: string, selectedStudentForTopic: string | null) => {
    if (!selectedStudentForTopic) return;

    try {
      const student = selectedTeacherStudents?.find((s) => s.id === selectedStudentForTopic);
      if (!student) return;

      const topics = studentTopics.get(selectedStudentForTopic) || [];
      const nextOrderIndex = topics.length > 0 ? Math.max(...topics.map((t) => t.order_index)) + 1 : 0;

      const { error } = await supabase.from("topics").insert({
        teacher_id: adminUserId,
        student_id: student.student_id,
        title,
        description: description || null,
        order_index: nextOrderIndex,
      });

      if (error) throw error;

      toast({ title: "Başarılı", description: "Konu başarıyla oluşturuldu" });
      await fetchStudentTopics(student.student_id, selectedStudentForTopic);
    } catch (error: any) {
      toast({ title: "Hata", description: error.message, variant: "destructive" });
    }
  };

  const handleAddResource = async (
    title: string,
    description: string,
    resourceType: string,
    resourceUrl: string,
    selectedTopicForResource: string | null
  ) => {
    if (!selectedTopicForResource) return;

    try {
      const topics = Array.from(studentTopics.values()).flat();
      const topic = topics.find((t) => t.id === selectedTopicForResource);
      if (!topic) return;

      const nextOrderIndex =
        topic.resources.length > 0 ? Math.max(...topic.resources.map((r) => r.order_index)) + 1 : 0;

      const { error } = await supabase.from("resources").insert({
        topic_id: selectedTopicForResource,
        title,
        description: description || null,
        resource_type: resourceType,
        resource_url: resourceUrl,
        order_index: nextOrderIndex,
      });

      if (error) throw error;

      toast({ title: "Başarılı", description: "Kaynak başarıyla eklendi" });

      const studentId = Array.from(studentTopics.entries()).find(([_, topics]) =>
        topics.some((t) => t.id === selectedTopicForResource)
      )?.[0];

      if (studentId) {
        const student = selectedTeacherStudents?.find((s) => s.id === studentId);
        if (student) {
          await fetchStudentTopics(student.student_id, studentId);
        }
      }
    } catch (error: any) {
      toast({ title: "Hata", description: error.message, variant: "destructive" });
    }
  };

  const handleEditTopic = async (id: string, title: string, description: string) => {
    try {
      const { error } = await supabase
        .from("topics")
        .update({ title, description: description || null })
        .eq("id", id);

      if (error) throw error;

      toast({ title: "Başarılı", description: "Konu güncellendi" });

      const studentId = Array.from(studentTopics.entries()).find(([_, topics]) =>
        topics.some((t) => t.id === id)
      )?.[0];

      if (studentId) {
        const student = selectedTeacherStudents?.find((s) => s.id === studentId);
        if (student) {
          await fetchStudentTopics(student.student_id, studentId);
        }
      }
    } catch (error: any) {
      toast({ title: "Hata", description: error.message, variant: "destructive" });
    }
  };

  const handleEditResource = async (
    id: string,
    title: string,
    description: string,
    resourceType: string,
    resourceUrl: string
  ) => {
    try {
      const { error } = await supabase
        .from("resources")
        .update({
          title,
          description: description || null,
          resource_type: resourceType,
          resource_url: resourceUrl,
        })
        .eq("id", id);

      if (error) throw error;

      toast({ title: "Başarılı", description: "Kaynak güncellendi" });

      const studentId = Array.from(studentTopics.entries()).find(([_, topics]) =>
        topics.some((t) => t.resources.some((r) => r.id === id))
      )?.[0];

      if (studentId) {
        const student = selectedTeacherStudents?.find((s) => s.id === studentId);
        if (student) {
          await fetchStudentTopics(student.student_id, studentId);
        }
      }
    } catch (error: any) {
      toast({ title: "Hata", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteTopic = async (topicId: string, studentId: string, studentUserId: string) => {
    try {
      const { error } = await supabase.from("topics").delete().eq("id", topicId);
      if (error) throw error;
      toast({ title: "Başarılı", description: "Konu silindi" });
      await fetchStudentTopics(studentUserId, studentId);
    } catch (error: any) {
      toast({ title: "Hata", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteResource = async (resourceId: string, studentId: string, studentUserId: string) => {
    try {
      const { error } = await supabase.from("resources").delete().eq("id", resourceId);
      if (error) throw error;
      toast({ title: "Başarılı", description: "Kaynak silindi" });
      await fetchStudentTopics(studentUserId, studentId);
    } catch (error: any) {
      toast({ title: "Hata", description: error.message, variant: "destructive" });
    }
  };

  return {
    handleAddTopic,
    handleAddResource,
    handleEditTopic,
    handleEditResource,
    handleDeleteTopic,
    handleDeleteResource,
  };
}
