import { useState, useEffect } from "react";
import { Bell, FileText, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

interface Notification {
  id: string;
  teacher_id: string;
  student_id: string;
  homework_id: string;
  is_read: boolean;
  created_at: string;
  profiles?: {
    full_name: string;
  };
}

interface NotificationBellProps {
  userId: string; // Current user's ID (either teacher or student)
  teacherId: string; // Teacher ID for the relationship
  studentId?: string; // Student ID for the relationship (needed for student panel)
  isStudent?: boolean;
  onNotificationClick?: (studentId: string) => void; // Pass student_id when clicking notification
}

export function NotificationBell({ userId, teacherId, studentId, isStudent = false, onNotificationClick }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Guard: Don't fetch if userId is missing or empty (e.g., during logout)
    if (!userId) return;
    
    fetchNotifications();
    const cleanup = setupRealtimeSubscription();
    return cleanup;
  }, [userId]);

  const fetchNotifications = async () => {
    // Guard: Don't fetch if userId is missing
    if (!userId) return;
    
    try {
      // Bildirimleri recipient_id ile filtrele (kullanıcının kendisine gelen bildirimler)
      const { data: notificationsData, error: notificationsError } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (notificationsError) throw notificationsError;

      // Fetch names based on whether user is student or teacher
      // Öğrenci ise öğretmen adını, öğretmen ise öğrenci adını göster
      const userIds = isStudent 
        ? [...new Set(notificationsData?.map(n => n.teacher_id) || [])]
        : [...new Set(notificationsData?.map(n => n.student_id) || [])];

      // Get user names
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      // Convert profiles to map
      const profilesMap = new Map(
        profilesData?.map(p => [p.user_id, p.full_name]) || []
      );

      // Enrich notifications with names
      const enrichedNotifications = notificationsData?.map(n => ({
        ...n,
        profiles: {
          full_name: profilesMap.get(isStudent ? n.teacher_id : n.student_id) || (isStudent ? 'Öğretmen' : 'Öğrenci')
        }
      })) || [];

      setNotifications(enrichedNotifications);
      setUnreadCount(enrichedNotifications.filter(n => !n.is_read).length);
    } catch (error: any) {
      console.error('Error fetching notifications:', error);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`
        },
        (payload) => {
          console.log('New notification received:', payload);
          fetchNotifications(); // Yeni bildirim geldiğinde listeyi güncelle
          
          toast({
            title: "Yeni Ödev",
            description: isStudent ? "Öğretmeniniz yeni bir dosya yükledi" : "Bir öğrenciniz yeni ödev yükledi",
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications
        .filter(n => !n.is_read)
        .map(n => n.id);

      if (unreadIds.length === 0) return;

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', unreadIds);

      if (error) throw error;

      // UI'yi güncelle
      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true }))
      );
      setUnreadCount(0);
    } catch (error: any) {
      console.error('Error marking notifications as read:', error);
      toast({
        title: "Hata",
        description: "Bildirimler okundu olarak işaretlenemedi",
        variant: "destructive",
      });
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen && unreadCount > 0) {
      // Popup açıldığında bildirimleri okundu olarak işaretle
      markAllAsRead();
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    setOpen(false);
    // Pass the student_id from the notification to open the correct homework dialog
    onNotificationClick?.(notification.student_id);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-white text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-2rem)] sm:w-96 max-w-[400px] p-0" align="end">
        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b bg-gradient-to-r from-primary/5 to-primary/10 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold">Bildirimler</CardTitle>
                <CardDescription className="mt-1">
                  {unreadCount > 0 
                    ? `${unreadCount} okunmamış bildirim` 
                    : "Tüm bildirimler okundu"}
                </CardDescription>
              </div>
              {unreadCount > 0 && (
                <Badge className="bg-primary text-primary-foreground">
                  {unreadCount}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <div className="rounded-full bg-muted p-4 mb-4">
                    <Bell className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">Henüz bildirim yok</p>
                  <p className="text-xs text-muted-foreground mt-1">Yeni ödev yüklendiğinde burada görünecek</p>
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 transition-colors hover:bg-accent/50 cursor-pointer ${
                        !notification.is_read 
                          ? 'bg-primary/5 border-l-4 border-l-primary' 
                          : ''
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 rounded-full p-2 ${
                          !notification.is_read 
                            ? 'bg-primary/10' 
                            : 'bg-muted'
                        }`}>
                          <FileText className={`h-4 w-4 ${
                            !notification.is_read 
                              ? 'text-primary' 
                              : 'text-muted-foreground'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${
                            !notification.is_read 
                              ? 'font-semibold text-foreground' 
                              : 'font-medium text-muted-foreground'
                          }`}>
                            {notification.profiles?.full_name || (isStudent ? 'Öğretmen' : 'Öğrenci')}
                          </p>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {isStudent ? "Yeni bir dosya yükledi" : "Yeni bir ödev yükledi"}
                          </p>
                          <div className="flex items-center gap-1.5 mt-2">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(notification.created_at), "dd MMM yyyy, HH:mm", { locale: tr })}
                            </p>
                          </div>
                        </div>
                        {!notification.is_read && (
                          <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}