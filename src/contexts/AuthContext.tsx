import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clearSupabaseStorage } from "@/lib/capacitorStorage";
import { useToast } from "@/hooks/use-toast";
import { Capacitor } from "@capacitor/core";

const DEV = import.meta.env.DEV;

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

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  initializing: boolean;
  signingOut: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string, role: "teacher" | "student") => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  // `loading` = profile is being fetched (after session is known)
  const [loading, setLoading] = useState(true);
  // `initializing` = we don't know yet if there is a session at all
  const [initializing, setInitializing] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const { toast } = useToast();

  const isSigningOutRef = useRef(false);
  const profileFetchAbortRef = useRef<AbortController | null>(null);
  // Guard: mark true once the first auth event / getSession resolves
  const initDoneRef = useRef(false);

  const fetchProfile = useCallback(async (userId: string) => {
    if (isSigningOutRef.current) return;

    if (profileFetchAbortRef.current) {
      profileFetchAbortRef.current.abort();
    }
    profileFetchAbortRef.current = new AbortController();

    try {
      if (DEV) console.log("[Auth] fetching profile for:", userId);
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (isSigningOutRef.current) return;

      if (profileError) {
        if (DEV) console.log("[Auth] profile fetch error:", profileError.code);
        if (profileError.code === "PGRST116") {
          setProfile(null);
        } else {
          throw profileError;
        }
      } else {
        const { data: rolesData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);

        if (isSigningOutRef.current) return;

        const roles =
          rolesData?.map((r) => r.role as "teacher" | "student" | "admin") || [];
        const primaryRole = roles.includes("admin")
          ? "admin"
          : roles.includes("teacher")
          ? "teacher"
          : "student";

        if (DEV) console.log("[Auth] profile loaded, roles:", roles);
        setProfile({ ...profileData, roles, role: primaryRole });
      }
    } catch (error) {
      if (!isSigningOutRef.current) {
        console.error("[Auth] error fetching profile:", error);
        setProfile(null);
      }
    } finally {
      if (!isSigningOutRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (DEV) console.log("[Auth] AuthProvider mounting — setting up auth");

    // ── STEP 1: Subscribe to auth state changes FIRST ─────────────────────
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (DEV)
        console.log("[Auth] event:", event, "user:", newSession?.user?.id ?? "none");

      // Ignore irrelevant events during sign-out
      if (isSigningOutRef.current && event !== "SIGNED_OUT") {
        if (DEV) console.log("[Auth] ignoring event during sign-out");
        return;
      }

      setSession(newSession);
      setUser(newSession?.user ?? null);

      // Mark initializing complete on the first event
      if (!initDoneRef.current) {
        initDoneRef.current = true;
        setInitializing(false);
      }

      if (newSession?.user && !isSigningOutRef.current) {
        setLoading(true);
        // Defer profile fetch to avoid internal Supabase deadlock
        setTimeout(() => {
          if (!isSigningOutRef.current) {
            fetchProfile(newSession.user.id);
          }
        }, 0);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    // ── STEP 2: getSession() as fallback guarantor ─────────────────────────
    // In case INITIAL_SESSION fires before the listener was set up,
    // or native storage takes too long for the event to arrive.
    supabase.auth
      .getSession()
      .then(({ data: { session: existingSession } }) => {
        if (DEV)
          console.log(
            "[Auth] boot getSession ->",
            existingSession ? `user: ${existingSession.user.id}` : "no session"
          );

        // Only act if onAuthStateChange hasn't resolved things yet
        if (!initDoneRef.current) {
          initDoneRef.current = true;
          setInitializing(false);

          if (existingSession) {
            setSession(existingSession);
            setUser(existingSession.user);
            setLoading(true);
            fetchProfile(existingSession.user.id);
          } else {
            setLoading(false);
          }
        }
      })
      .catch((error) => {
        console.error("[Auth] getSession error:", error);
        if (!initDoneRef.current) {
          initDoneRef.current = true;
          setInitializing(false);
          setLoading(false);
        }
      });

    // ── STEP 3: Capacitor App foreground/background token refresh ──────────
    let appListenerHandle: Promise<{ remove: () => void }> | null = null;

    if (Capacitor.isNativePlatform()) {
      // Dynamic import to avoid breaking web builds
      import("@capacitor/app").then(({ App: CapApp }) => {
        appListenerHandle = CapApp.addListener("appStateChange", ({ isActive }) => {
          if (DEV) console.log("[Auth] appStateChange isActive:", isActive);
          if (isActive) {
            supabase.auth.startAutoRefresh();
          } else {
            supabase.auth.stopAutoRefresh();
          }
        });
      });
    }

    return () => {
      subscription.unsubscribe();
      if (profileFetchAbortRef.current) {
        profileFetchAbortRef.current.abort();
      }
      if (appListenerHandle) {
        appListenerHandle.then((h) => h.remove()).catch(() => {});
      }
    };
  }, [fetchProfile]);

  // ── Auth actions ────────────────────────────────────────────────────────

  const signIn = async (email: string, password: string) => {
    try {
      isSigningOutRef.current = false;
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: "teacher" | "student"
  ) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: { full_name: fullName, role },
        },
      });
      if (error) throw error;
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  const signOut = async () => {
    if (DEV) console.log("[Auth] === SIGNOUT START ===");

    isSigningOutRef.current = true;
    setSigningOut(true);

    if (profileFetchAbortRef.current) {
      profileFetchAbortRef.current.abort();
      profileFetchAbortRef.current = null;
    }

    // Clear React state first → instant UI redirect
    setUser(null);
    setSession(null);
    setProfile(null);

    // Clear native / localStorage
    try {
      await clearSupabaseStorage();
    } catch (e) {
      console.warn("[Auth] storage clear error:", e);
    }

    toast({ title: "Başarılı", description: "Çıkış yapıldı" });

    // Sign out from Supabase (may fail if session already gone — that's OK)
    try {
      await supabase.auth.signOut();
      if (DEV) console.log("[Auth] Supabase signOut ok");
    } catch (error: any) {
      console.warn("[Auth] signOut error (acceptable if session expired):", error?.message);
    }

    if (DEV) console.log("[Auth] === SIGNOUT COMPLETE ===");
    setSigningOut(false);

    setTimeout(() => {
      isSigningOutRef.current = false;
    }, 1000);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        initializing,
        signingOut,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext must be used inside <AuthProvider>");
  }
  return ctx;
}
