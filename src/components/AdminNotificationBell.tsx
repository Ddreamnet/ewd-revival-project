import { useState, useEffect } from "react";
import { Bell, Clock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

interface AdminNotification {
  id: string;
  notification_type: string;
  teacher_id: string;
  student_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface AdminNotificationBellProps {
  adminId: string;
}

export function AdminNotificationBell({ adminId }: AdminNotificationBellProps) {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchNotifications();
    const cleanup = setupRealtimeSubscription();
    return cleanup;
  }, [adminId]);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setNotifications(data || []);
      setUnreadCount((data || []).filter(n => !n.is_read).length);
    } catch (error: any) {
      console.error('Error fetching admin notifications:', error);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel(`admin-notifications-${adminId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'admin_notifications'
        },
        (payload) => {
          console.log('New admin notification received:', payload);
          fetchNotifications();
          
          toast({
            title: "Yeni Bildirim",
            description: (payload.new as AdminNotification).message,
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
        .from('admin_notifications')
        .update({ is_read: true })
        .in('id', unreadIds);

      if (error) throw error;

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
      <PopoverContent className="w-96 p-0" align="end">
        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b bg-gradient-to-r from-amber-500/10 to-orange-500/10 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold">Admin Bildirimleri</CardTitle>
                <CardDescription className="mt-1">
                  {unreadCount > 0 
                    ? `${unreadCount} okunmamış bildirim` 
                    : "Tüm bildirimler okundu"}
                </CardDescription>
              </div>
              {unreadCount > 0 && (
                <Badge className="bg-amber-500 text-white">
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
                  <p className="text-xs text-muted-foreground mt-1 text-center">
                    Öğrencilerin son dersleri yaklaştığında burada görünecek
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 transition-colors ${
                        !notification.is_read 
                          ? 'bg-amber-500/5 border-l-4 border-l-amber-500' 
                          : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 rounded-full p-2 ${
                          !notification.is_read 
                            ? 'bg-amber-500/10' 
                            : 'bg-muted'
                        }`}>
                          <Users className={`h-4 w-4 ${
                            !notification.is_read 
                              ? 'text-amber-600' 
                              : 'text-muted-foreground'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${
                            !notification.is_read 
                              ? 'font-semibold text-foreground' 
                              : 'font-medium text-muted-foreground'
                          }`}>
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-1.5 mt-2">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(notification.created_at), "dd MMM yyyy, HH:mm", { locale: tr })}
                            </p>
                          </div>
                        </div>
                        {!notification.is_read && (
                          <div className="h-2 w-2 rounded-full bg-amber-500 mt-2" />
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