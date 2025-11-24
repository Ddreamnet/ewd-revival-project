import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
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
  teacherId: string;
}

export function NotificationBell({ teacherId }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchNotifications();
    setupRealtimeSubscription();
  }, [teacherId]);

  const fetchNotifications = async () => {
    try {
      // Önce bildirimleri al
      const { data: notificationsData, error: notificationsError } = await supabase
        .from('notifications')
        .select('*')
        .eq('teacher_id', teacherId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (notificationsError) throw notificationsError;

      // Öğrenci ID'lerini topla
      const studentIds = [...new Set(notificationsData?.map(n => n.student_id) || [])];

      // Öğrenci isimlerini al
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', studentIds);

      if (profilesError) throw profilesError;

      // Profilleri map'e dönüştür
      const profilesMap = new Map(
        profilesData?.map(p => [p.user_id, p.full_name]) || []
      );

      // Bildirimleri profil isimleriyle birleştir
      const enrichedNotifications = notificationsData?.map(n => ({
        ...n,
        profiles: {
          full_name: profilesMap.get(n.student_id) || 'Öğrenci'
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
      .channel('notifications-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `teacher_id=eq.${teacherId}`
        },
        (payload) => {
          console.log('New notification received:', payload);
          fetchNotifications(); // Yeni bildirim geldiğinde listeyi güncelle
          
          toast({
            title: "Yeni Ödev",
            description: "Bir öğrenciniz yeni ödev yükledi",
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
      <PopoverContent className="w-80" align="end">
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Bildirimler</CardTitle>
            <CardDescription>
              {unreadCount > 0 
                ? `${unreadCount} okunmamış bildirim` 
                : "Yeni bildirim yok"}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[300px] px-4">
              {notifications.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Henüz bildirim yok
                </div>
              ) : (
                <div className="space-y-2">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 rounded-lg border transition-colors ${
                        notification.is_read 
                          ? 'bg-background' 
                          : 'bg-accent/50 border-primary/20'
                      }`}
                    >
                      <p className="text-sm font-medium">
                        {notification.profiles?.full_name || 'Öğrenci'} yeni bir dosya yükledi
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(notification.created_at), "dd MMM yyyy, HH:mm", { locale: tr })}
                      </p>
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