"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import {
  DEMO_CREDENTIALS,
  defaultWorkspaceForBackendRole,
  workspacesForBackendRole,
  type BackendRole,
} from "@/lib/roles";
import type { WorkspaceRole } from "@/context/WorkspaceContext";

export interface AuthUser {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  token: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
  role: BackendRole;
  phoneNumber?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; user?: AuthUser }>;
  register: (
    payload: RegisterPayload
  ) => Promise<{ success: boolean; error?: string; user?: AuthUser }>;
  loginAsRole: (
    role: Exclude<WorkspaceRole, "guest">
  ) => Promise<{ success: boolean; error?: string; user?: AuthUser; workspace?: WorkspaceRole }>;
  logout: () => void;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  availableWorkspaces: WorkspaceRole[];
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isAuthenticated: false,
  isHydrated: false,
  login: async () => ({ success: false }),
  register: async () => ({ success: false }),
  loginAsRole: async () => ({ success: false }),
  logout: () => {},
  authFetch: async () => new Response(),
  availableWorkspaces: ["guest"],
});

export const useAuth = () => useContext(AuthContext);

const STORAGE_KEY = "propertyiq_auth";
const API_BASE = "/api";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as AuthUser;
        if (parsed.token && parsed.role) {
          setUser(parsed);
        }
      }
    } catch {
      // ignore
    } finally {
      setIsHydrated(true);
    }
  }, []);

  const persistUser = (u: AuthUser | null) => {
    setUser(u);
    if (u) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { success: false, error: (err as { message?: string }).message || "Login failed" };
      }

      const data = await res.json();
      const authUser: AuthUser = {
        userId: String(data.userId),
        email: data.email,
        fullName: data.fullName,
        role: data.role as BackendRole,
        token: data.token,
      };
      persistUser(authUser);
      return { success: true, user: authUser };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Network error — is the API running on :5000?";
      return { success: false, error: msg };
    }
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: payload.fullName.trim(),
          email: payload.email.trim(),
          password: payload.password,
          phoneNumber: payload.phoneNumber?.trim() || "",
          role: payload.role,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return {
          success: false,
          error: (err as { message?: string }).message || "Signup failed",
        };
      }

      const data = await res.json();
      const authUser: AuthUser = {
        userId: String(data.userId),
        email: data.email,
        fullName: data.fullName,
        role: data.role as BackendRole,
        token: data.token,
      };
      persistUser(authUser);
      return { success: true, user: authUser };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Network error — is the API running on :5000?";
      return { success: false, error: msg };
    }
  }, []);

  const loginAsRole = useCallback(
    async (role: Exclude<WorkspaceRole, "guest">) => {
      const creds = DEMO_CREDENTIALS[role];
      if (!creds) {
        return { success: false, error: `No demo credentials for role: ${role}` };
      }
      const result = await login(creds.email, creds.password);
      if (!result.success || !result.user) return result;

      // Prefer the persona the user clicked (e.g. agency vs agent with same credentials)
      const allowed = workspacesForBackendRole(result.user.role);
      const preferred =
        allowed.includes(role) ? role : defaultWorkspaceForBackendRole(result.user.role);

      return { ...result, workspace: preferred };
    },
    [login]
  );

  const logout = useCallback(() => {
    persistUser(null);
  }, []);

  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      const headers = new Headers(options.headers || {});
      if (user?.token) {
        headers.set("Authorization", `Bearer ${user.token}`);
      }
      // JSON bodies only — never set Content-Type for FormData (browser needs multipart boundary)
      const isFormData =
        typeof FormData !== "undefined" && options.body instanceof FormData;
      if (
        !isFormData &&
        !headers.has("Content-Type") &&
        options.body &&
        typeof options.body === "string"
      ) {
        headers.set("Content-Type", "application/json");
      }
      return fetch(url, { ...options, headers });
    },
    [user?.token]
  );

  const availableWorkspaces = useMemo(
    () => workspacesForBackendRole(user?.role),
    [user?.role]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token: user?.token ?? null,
        isAuthenticated: !!user?.token,
        isHydrated,
        login,
        register,
        loginAsRole,
        logout,
        authFetch,
        availableWorkspaces,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
