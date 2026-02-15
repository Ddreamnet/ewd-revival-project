import { useState, useEffect, useRef, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clearSupabaseStorage } from "@/lib/capacitorStorage";
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
  
  // Refs to track signing out state and prevent race conditions
  const isSigningOutRef = useRef(false);
  const profileFetchAbortRef = useRef<AbortController | null>(null);

  const fetchProfile = useCallback(async (userId: string) => {
    // Don't fetch profile if we're signing out
    if (isSigningOutRef.current) {
      console.log("Skipping profile fetch - signing out");
      return;
    }

    // Cancel any previous fetch
    if (profileFetchAbortRef.current) {
      profileFetchAbortRef.current.abort();
    }
    profileFetchAbortRef.current = new AbortController();

    try {
      console.log("Fetching profile for user:", userId);
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      // Check again if we're signing out after the async call
      if (isSigningOutRef.current) {
        console.log("Aborting profile set - signing out");
        return;
      }

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
          .eq("user_id", userId);

        // Check again after roles fetch
        if (isSigningOutRef.current) {
          console.log("Aborting profile set - signing out after roles fetch");
          return;
        }

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
      if (!isSigningOutRef.current) {
        console.error("Error fetching profile:", error);
        setProfile(null);
      }
    } finally {
      if (!isSigningOutRef.current) {
        console.log("Setting loading to false after profile fetch");
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    console.log("useAuth effect running");

    // Set up auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth state changed:", event, session?.user?.id);
      
      // If we're signing out, ignore any auth state changes
      if (isSigningOutRef.current && event !== 'SIGNED_OUT') {
        console.log("Ignoring auth state change during sign out");
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user && !isSigningOutRef.current) {
        // Defer profile fetch to avoid Supabase deadlock
        setTimeout(() => {
          if (!isSigningOutRef.current) {
            fetchProfile(session.user.id);
          }
        }, 100);
      } else {
        console.log("No user session or signing out, clearing profile");
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

    return () => {
      subscription.unsubscribe();
      // Abort any pending profile fetch on cleanup
      if (profileFetchAbortRef.current) {
        profileFetchAbortRef.current.abort();
      }
    };
  }, [fetchProfile]);

  const signIn = async (email: string, password: string) => {
    try {
      // Reset signing out state on sign in attempt
      isSigningOutRef.current = false;
      
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
    console.log("=== SIGNOUT START ===");
    
    // Set signing out flag immediately
    isSigningOutRef.current = true;
    setSigningOut(true);
    
    // Cancel any pending profile fetch
    if (profileFetchAbortRef.current) {
      profileFetchAbortRef.current.abort();
      profileFetchAbortRef.current = null;
    }
    
    // Clear local React state FIRST - this triggers UI redirect
    console.log("Step 1: Clearing React state");
    setUser(null);
    setSession(null);
    setProfile(null);
    
    // Clear storage (native Preferences or localStorage depending on platform)
    console.log("Step 2: Clearing auth storage");
    try {
      await clearSupabaseStorage();
    } catch (e) {
      console.warn("Storage clear error:", e);
    }
    
    // Show toast
    toast({
      title: "Başarılı",
      description: "Çıkış yapıldı",
    });
    
    // Try to sign out from Supabase (may fail if session already gone, that's OK)
    console.log("Step 3: Calling Supabase signOut");
    try {
      await supabase.auth.signOut();
      console.log("Supabase signOut successful");
    } catch (error: any) {
      console.warn("Supabase signOut error (OK if session expired):", error?.message);
    }
    
    console.log("=== SIGNOUT COMPLETE ===");
    setSigningOut(false);
    
    // Reset the ref after a delay
    setTimeout(() => {
      isSigningOutRef.current = false;
    }, 1000);
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
