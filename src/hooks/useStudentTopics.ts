/**
 * useStudentTopics — shared hook that encapsulates the
 * "fetch student topics + global topics + completion status + merge" pattern.
 *
 * Previously triplicated in:
 *  - AdminDashboard.fetchStudentTopics
 *  - StudentDashboard.fetchTopics
 *  - StudentTopics.fetchTopics
 */
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Topic, Resource } from "@/lib/types";

interface UseStudentTopicsReturn {
  /** All topics (student-specific + merged global) sorted by order_index */
  allTopics: Topic[];
  /** Only student-specific topics (for CRUD in admin/teacher views) */
  studentOnlyTopics: Topic[];
  loading: boolean;
  refetch: () => Promise<void>;
}

/**
 * Fetches and merges student-specific + global topics with completion status.
 *
 * @param studentUserId  The student's auth user_id (profiles.user_id)
 */
export function useStudentTopics(studentUserId: string | undefined): UseStudentTopicsReturn {
  const [allTopics, setAllTopics] = useState<Topic[]>([]);
  const [studentOnlyTopics, setStudentOnlyTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const refetch = useCallback(async () => {
    if (!studentUserId) return;

    try {
      // Fetch all data in parallel
      const [studentTopicsRes, globalTopicsRes, completionRes] = await Promise.all([
        supabase
          .from("topics")
          .select("*, resources (*)")
          .eq("student_id", studentUserId)
          .order("order_index"),
        supabase
          .from("global_topics")
          .select("*, global_topic_resources(*)")
          .order("order_index"),
        supabase
          .from("student_resource_completion")
          .select("*")
          .eq("student_id", studentUserId),
      ]);

      if (studentTopicsRes.error) throw studentTopicsRes.error;
      if (globalTopicsRes.error) throw globalTopicsRes.error;
      if (completionRes.error) throw completionRes.error;

      const studentTopicsData = studentTopicsRes.data || [];
      const globalTopicsData = globalTopicsRes.data || [];
      const completionData = completionRes.data || [];

      // Build completion map
      const completionMap = new Map<string, { is_completed: boolean; completed_at: string | null }>();
      completionData.forEach((c: any) => {
        completionMap.set(c.resource_id, {
          is_completed: c.is_completed,
          completed_at: c.completed_at,
        });
      });

      // Process student-specific topics
      const processedStudentTopics: Topic[] = studentTopicsData.map((topic) => ({
        id: topic.id,
        title: topic.title,
        description: topic.description,
        is_completed: topic.is_completed,
        completed_at: topic.completed_at,
        order_index: topic.order_index,
        isGlobal: false,
        resources: ((topic.resources as any[]) || [])
          .map((r) => {
            const completion = completionMap.get(r.id);
            return {
              id: r.id,
              title: r.title,
              description: r.description,
              resource_type: r.resource_type,
              resource_url: r.resource_url,
              order_index: r.order_index,
              is_completed: completion?.is_completed || false,
              completed_at: completion?.completed_at || null,
            } satisfies Resource;
          })
          .sort((a, b) => a.order_index - b.order_index),
      }));

      setStudentOnlyTopics(processedStudentTopics);

      // Process global topics — filter out those with same title as student topics
      const studentTopicTitles = new Set(processedStudentTopics.map((t) => t.title));

      const processedGlobalTopics: Topic[] = globalTopicsData
        .filter((topic) => !studentTopicTitles.has(topic.title))
        .map((topic) => {
          const globalResources: Resource[] = ((topic.global_topic_resources as any[]) || [])
            .map((r) => {
              const completion = completionMap.get(r.id);
              return {
                id: r.id,
                title: r.title,
                description: r.description,
                resource_type: r.resource_type,
                resource_url: r.resource_url,
                order_index: r.order_index,
                is_completed: completion?.is_completed || false,
                completed_at: completion?.completed_at || null,
              };
            })
            .sort((a, b) => a.order_index - b.order_index);

          const allResourcesCompleted =
            globalResources.length > 0 && globalResources.every((r) => r.is_completed);

          return {
            id: topic.id,
            title: topic.title,
            description: topic.description,
            is_completed: allResourcesCompleted,
            completed_at: allResourcesCompleted ? new Date().toISOString() : null,
            order_index: topic.order_index + 1000,
            resources: globalResources,
            isGlobal: true,
          };
        });

      // Combine and sort: student-specific first, then global
      const combined = [...processedStudentTopics, ...processedGlobalTopics].sort((a, b) => {
        if (a.isGlobal && !b.isGlobal) return 1;
        if (!a.isGlobal && b.isGlobal) return -1;
        return a.order_index - b.order_index;
      });

      setAllTopics(combined);
    } catch (error: any) {
      toast({
        title: "Hata",
        description: "Konular yüklenemedi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [studentUserId, toast]);

  return { allTopics, studentOnlyTopics, loading, refetch };
}
