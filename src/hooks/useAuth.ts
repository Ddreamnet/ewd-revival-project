/**
 * useAuth — thin wrapper around AuthContext.
 * All session management lives in src/contexts/AuthContext.tsx.
 */
export { useAuthContext as useAuth } from "@/contexts/AuthContext";
export type { Profile } from "@/contexts/AuthContext";
