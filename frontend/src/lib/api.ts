import { getToken, getRefreshToken, setAuth, clearAuth } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface FetchOptions extends RequestInit {
  token?: string;
  _retried?: boolean;
}

async function tryRefreshToken(): Promise<string | null> {
  const rt = getRefreshToken();
  if (!rt) return null;
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: rt }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    // Preserve existing user info, just update tokens
    const rawUser = typeof window !== "undefined" ? localStorage.getItem("rt_user") : null;
    const user = rawUser ? JSON.parse(rawUser) : { id: "", email: "", displayName: "" };
    setAuth(data.accessToken, data.refreshToken, user);
    return data.accessToken;
  } catch {
    return null;
  }
}

export async function apiFetch<T = unknown>(path: string, options: FetchOptions = {}): Promise<T> {
  const { token, headers: customHeaders, _retried, ...rest } = options;

  const authToken = token || getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((customHeaders as Record<string, string>) || {}),
  };

  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_URL}${path}`, { headers, ...rest });

  // Auto-refresh on 401 (once)
  if (res.status === 401 && !_retried && authToken) {
    const newToken = await tryRefreshToken();
    if (newToken) {
      return apiFetch<T>(path, { ...options, token: newToken, _retried: true });
    }
    // Refresh failed — clear auth and redirect to login
    clearAuth();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `API error: ${res.status}`);
  }

  return res.json();
}

export function apiUpload(path: string, formData: FormData, token: string) {
  return fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  }).then(async (res) => {
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(body.error || `API error: ${res.status}`);
    }
    return res.json();
  });
}
