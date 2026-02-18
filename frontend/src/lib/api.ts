const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface FetchOptions extends RequestInit {
  token?: string;
}

export async function apiFetch<T = unknown>(path: string, options: FetchOptions = {}): Promise<T> {
  const { token, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((customHeaders as Record<string, string>) || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { headers, ...rest });

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
