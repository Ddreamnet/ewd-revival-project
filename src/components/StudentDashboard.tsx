// ============================================================================
// ÖĞRENCİ PANELİ
// ============================================================================
// Bu bileşen öğrencilerin kendi öğrenme materyallerini görüntülemesini sağlar.
// Sadece tamamlanmış kaynakları gösterir.

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  ChevronDown,
  ChevronRight,
  LogOut,
  BookOpen,
  CheckCircle,
  Clock,
  ExternalLink,
  FileText,
  Video,
  Link as LinkIcon,
  Upload,
  ClipboardList,
} from "lucide-react";
import { Header } from "./Header";
import { StudentLessonTracker } from "./StudentLessonTracker";
import { UploadHomeworkDialog } from "./UploadHomeworkDialog";
import { HomeworkListDialog } from "./HomeworkListDialog";
import { ContactDialog } from "./ContactDialog";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggleButton } from "./ThemeToggleButton";
import { initPushNotifications } from "@/lib/pushNotifications";
import { getResourceIcon } from "@/lib/resourceUtils";
import { useStudentTopics } from "@/hooks/useStudentTopics";
import type { Topic, Resource } from "@/lib/types";

// ============================================================================
// ANA BİLEŞEN
// ============================================================================

export function StudentDashboard() {
  // ============================================================================
  // STATE YÖNETİMİ
  // ============================================================================

  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [teacherId, setTeacherId] = useState<string>("");
  const { profile, signOut, signingOut } = useAuth();
  const { toast } = useToast();
  const pushInitRef = useRef(false);

  // Use shared topic fetching hook
  const { allTopics: topics, loading, refetch: refetchTopics } = useStudentTopics(profile?.user_id);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Fetch teacher relationship and topics when profile loads
  useEffect(() => {
    if (profile?.user_id) {
      refetchTopics();
      fetchTeacherRelation();
      if (!pushInitRef.current) {
        pushInitRef.current = true;
        initPushNotifications(profile.user_id, 'student');
      }
    }
  }, [profile]);

  // Handle homework deep link from push notification
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'homework') {
      setListDialogOpen(true);
      window.history.replaceState({}, '', '/dashboard');
    }
  }, []);

  const fetchTeacherRelation = async () => {
    try {
      const { data: studentRelation, error: relationError } = await supabase
        .from("students")
        .select("teacher_id")
        .eq("student_id", profile?.user_id)
        .single();
      if (relationError) throw relationError;
      setTeacherId(studentRelation.teacher_id);
    } catch (error: any) {
      // teacher_id is optional for display purposes; topic loading handles its own errors
    }
  };

  // ============================================================================
  // UI FONKSİYONLARI
  // ============================================================================

  /**
   * Bir konuyu aç/kapa
   */
  const toggleTopic = (topicId: string) => {
    const newExpanded = new Set(expandedTopics);
    if (newExpanded.has(topicId)) {
      newExpanded.delete(topicId);
    } else {
      newExpanded.add(topicId);
    }
    setExpandedTopics(newExpanded);
  };

  // getResourceIcon is now imported from @/lib/resourceUtils

  /**
   * Öğrenciler sadece tamamlanmış kaynakları görebilir
   */
  const getVisibleResources = (topic: Topic) => {
    // If the whole topic is marked as completed, show all resources
    if (topic.is_completed) {
      return topic.resources;
    }
    // Otherwise, only show completed resources
    return topic.resources.filter((resource: any) => resource.is_completed);
  };

  // ============================================================================
  // VERİ HAZIRLAMA
  // ============================================================================

  // Tamamlanmış ve işlenmiş konuları filtrele ve order_index'e göre sırala
  const completedTopics = topics.filter((t) => t.is_completed);
  const pendingTopics = topics.filter((t) => !t.is_completed && t.resources.some((r: any) => r.is_completed));
  const allActiveTopics = [...completedTopics, ...pendingTopics].sort((a, b) => a.order_index - b.order_index);

  // ============================================================================
  // RENDER - LOADING STATE
  // ============================================================================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // ============================================================================
  // RENDER - ANA İÇERİK
  // ============================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5">
      {/* Header */}
      <Header
        rightActions={
          <>
            <NotificationBell 
              userId={profile?.user_id || ""}
              teacherId={teacherId}
              studentId={profile?.user_id}
              isStudent={true}
              onNotificationClick={(_studentId) => setListDialogOpen(true)}
            />
            <ContactDialog />
            <ThemeToggleButton />
            <Button onClick={signOut} variant="outline" size="sm" disabled={signingOut}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline ml-2">{signingOut ? "Çıkış..." : "Çıkış"}</span>
            </Button>
          </>
        }
      >
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-bold">Öğrenme Panelim</h1>
          <p className="text-sm sm:text-lg text-muted-foreground hidden sm:block">Hoş geldin, {profile?.full_name}</p>
        </div>
      </Header>

      <div className="container mx-auto p-4">
        {/* İlerleme Özeti - 2x2 Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Row 1 - Col 1: İşlenen Konular */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <BookOpen className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{allActiveTopics.length}</p>
                  <p className="text-sm text-muted-foreground">İşlenen Konular</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Row 1 - Col 2: Toplam Kaynak */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">
                    {topics.reduce((acc, topic) => acc + getVisibleResources(topic).length, 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Toplam Kaynak</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Row 2 - Col 1: İşlenen Dersler */}
          <StudentLessonTracker studentId={profile?.user_id || ""} />

          {/* Row 2 - Col 2: Ödev Kartı */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-full flex flex-col items-center justify-center gap-2 min-h-[80px]"
                  onClick={() => setUploadDialogOpen(true)}
                >
                  <Upload className="h-6 w-6 text-primary" />
                  <span className="text-sm font-medium">Yükle</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-full flex flex-col items-center justify-center gap-2 min-h-[80px]"
                  onClick={() => setListDialogOpen(true)}
                >
                  <ClipboardList className="h-6 w-6 text-primary" />
                  <span className="text-sm font-medium">Ödevler</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Öğrenme Konuları */}
        <div className="space-y-6">
          {allActiveTopics.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Öğrendiklerimiz
                </CardTitle>
                <CardDescription>Öğrenme materyallerin</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {allActiveTopics.map((topic) => {
                  const visibleResources = getVisibleResources(topic);
                  const completedResources = topic.resources.filter((r: any) => r.is_completed);
                  const isFullyCompleted = topic.is_completed;

                  return (
                    <Card key={topic.id} className="border-l-4 border-l-primary">
                      <CardContent className="p-4">
                        <Collapsible>
                      <CollapsibleTrigger
                        className="flex items-start gap-2 w-full text-left"
                        onClick={() => toggleTopic(topic.id)}
                      >
                        {expandedTopics.has(topic.id) ? (
                          <ChevronDown className="h-4 w-4 mt-0.5 shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 mt-0.5 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-medium">{topic.title}</h4>
                            <span className="text-xs text-muted-foreground shrink-0 mt-0.5">{visibleResources.length}</span>
                          </div>
                          {topic.description && (
                            <p className={`text-sm text-muted-foreground mt-0.5 ${
                              !expandedTopics.has(topic.id) ? 'line-clamp-2' : ''
                            }`}>
                              {topic.description}
                            </p>
                          )}
                        </div>
                      </CollapsibleTrigger>

                          {/* Kaynaklar */}
                          <CollapsibleContent className="mt-4">
                            <div className="pl-6 space-y-2">
                              <h5 className="font-medium text-sm">Kaynaklar</h5>
                              {visibleResources.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                  Bu konu için henüz gösterilecek kaynak bulunmuyor.
                                </p>
                              ) : (
                                <div className="space-y-2">
                                  {visibleResources.map((resource: any) => (
                                    <div
                                      key={resource.id}
                                      className="flex items-center gap-3 p-2 bg-accent/30 rounded-md"
                                    >
                                      {resource.is_completed ? (
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                      )}
                                      {getResourceIcon(resource.resource_type)}
                                      <div className="flex-1">
                                        <button
                                          className="font-medium text-sm text-left hover:underline cursor-pointer"
                                          onClick={() => window.open(resource.resource_url, "_blank")}
                                        >
                                          {resource.title}
                                        </button>
                                        {resource.description && (
                                          <p className="text-xs text-muted-foreground">{resource.description}</p>
                                        )}
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => window.open(resource.resource_url, "_blank")}
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </CardContent>
                    </Card>
                  );
                })}
              </CardContent>
            </Card>
          ) : (
            <Card className="text-center py-12">
              <CardContent>
                <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Henüz Öğrenme Aktivitesi Yok</h3>
                <p className="text-muted-foreground">
                  Öğretmeniniz size keşfetmeniz için konular ve kaynaklar atayacak.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Ödev Dialogs */}
        <UploadHomeworkDialog
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          studentId={profile?.user_id || ""}
          teacherId={teacherId}
          uploadedByUserId={profile?.user_id}
          onSuccess={() => {
            toast({
              title: "Başarılı",
              description: "Ödev başarıyla yüklendi",
            });
          }}
        />

        <HomeworkListDialog
          open={listDialogOpen}
          onOpenChange={setListDialogOpen}
          studentId={profile?.user_id || ""}
          teacherId={teacherId}
          currentUserId={profile?.user_id || ""}
          isTeacher={false}
        />
      </div>
    </div>
  );
}
