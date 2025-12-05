import { useState, useEffect } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: "teacher" | "student" | "admin";
  roles: ("teacher" | "student" | "admin")[];
  created_at: string;
  updated_at: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    console.log("useAuth effect running");

    // Set up auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth state changed:", event, session?.user?.id);
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Fetch user profile
        setTimeout(async () => {
          try {
            console.log("Fetching profile for user:", session.user.id);
            const { data: profileData, error: profileError } = await supabase
              .from("profiles")
              .select("*")
              .eq("user_id", session.user.id)
              .single();

            if (profileError) {
              console.log("Profile fetch error:", profileError);
              if (profileError.code === "PGRST116") {
                console.log("No profile found - user may need to complete signup");
                setProfile(null);
              } else {
                throw profileError;
              }
            } else {
              // Fetch user roles
              const { data: rolesData } = await supabase
                .from("user_roles")
                .select("role")
                .eq("user_id", session.user.id);

              const roles = rolesData?.map((r) => r.role as "teacher" | "student" | "admin") || [];
              
              // Determine primary role (admin > teacher > student)
              const primaryRole = roles.includes("admin")
                ? "admin"
                : roles.includes("teacher")
                ? "teacher"
                : "student";

              console.log("Profile loaded successfully:", profileData, "Roles:", roles);
              setProfile({
                ...profileData,
                roles,
                role: primaryRole,
              });
            }
          } catch (error) {
            console.error("Error fetching profile:", error);
            setProfile(null);
          } finally {
            console.log("Setting loading to false after profile fetch");
            setLoading(false);
          }
        }, 100);
      } else {
        console.log("No user session, setting loading to false");
        setProfile(null);
        setLoading(false);
      }
    });

    // Get initial session
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        console.log("Initial session check:", session?.user?.id);
        // Only set initial session state if no auth state change event has fired yet
        if (!user && !session) {
          console.log("No initial session found");
          setLoading(false);
        }
      })
      .catch((error) => {
        console.error("Error getting initial session:", error);
        setLoading(false);
      });

    return () => subscription.unsubscribe();
  }, [toast]);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  const signUp = async (email: string, password: string, fullName: string, role: "teacher" | "student") => {
    try {
      const redirectUrl = `${window.location.origin}/`;

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
            role: role,
          },
        },
      });

      if (error) throw error;

      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  const signOut = async () => {
    if (signingOut) return; // Prevent multiple clicks
    
    setSigningOut(true);
    try {
      // First clear local state immediately - don't wait for onAuthStateChange
      setUser(null);
      setSession(null);
      setProfile(null);
      
      // Then sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.warn("SignOut warning:", error.message);
        // Even if there's an error, state is already cleared so user will see login page
      }
      
      toast({
        title: "Başarılı",
        description: "Çıkış yapıldı",
      });
    } catch (error: any) {
      console.error("Error signing out:", error);
      // State is already cleared above, just show the toast
      toast({
        title: "Çıkış yapıldı",
        description: "Oturum sonlandırıldı",
      });
    } finally {
      setSigningOut(false);
    }
  };

  return {
    user,
    session,
    profile,
    loading,
    signingOut,
    signIn,
    signUp,
    signOut,
  };
}
