"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "./supabase";

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string;
  bio: string;
  job_title: string;
  company: string;
  phone: string;
  timezone: string;
  language: string;
  theme: string;
  notification_email: boolean;
  notification_session_end: boolean;
}

interface UserContextType {
  user: { id: string; email: string } | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({ user: null, profile: null, loading: true, refreshProfile: async () => {} });

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        setUser({ id: authUser.id, email: authUser.email || "" });
        // Fetch profile from API
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/me`, {
          headers: { "x-user-id": authUser.id },
        });
        if (res.ok) {
          setProfile(await res.json());
        }
      }
    } catch (e) {
      console.error("Failed to fetch profile:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfile(); }, []);

  return (
    <UserContext.Provider value={{ user, profile, loading, refreshProfile: fetchProfile }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
