import { useState, useEffect } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: "teacher" | "student";
  created_at: string;
  updated_at: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
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
            const { data, error } = await supabase.from("profiles").select("*").eq("user_id", session.user.id).single();

            if (error) {
              console.log("Profile fetch error:", error);
              // If no profile exists, that's okay for new users
              if (error.code === "PGRST116") {
                console.log("No profile found - user may need to complete signup");
                setProfile(null);
              } else {
                throw error;
              }
            } else {
              console.log("Profile loaded successfully:", data);
              setProfile(data);
            }
          } catch (error) {
            console.error("Error fetching profile:", error);
            setProfile(null);
          } finally {
            console.log("Setting loading to false after profile fetch");
            setLoading(false);
          }
        }, 100); // Increased timeout to ensure proper sequencing
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
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return {
    user,
    session,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
  };
}
