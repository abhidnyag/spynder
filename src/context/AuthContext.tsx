"use client";

import { createContext, useContext, useMemo } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { LOGIN, LOGOUT, ME, REGISTER } from "@/graphql/operations";
import type { User } from "@/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data, loading, refetch } = useQuery<{ me: User | null }>(ME);
  const [loginM] = useMutation(LOGIN);
  const [registerM] = useMutation(REGISTER);
  const [logoutM] = useMutation(LOGOUT);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: data?.me ?? null,
      loading,
      login: async (email, password) => {
        await loginM({ variables: { email, password } });
        await refetch();
      },
      register: async (email, password, name) => {
        await registerM({ variables: { email, password, name } });
        await refetch();
      },
      logout: async () => {
        await logoutM();
        await refetch();
      },
    }),
    [data?.me, loading, loginM, registerM, logoutM, refetch],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
