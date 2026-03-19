const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`API error ${res.status}: ${error}`);
  }

  return res.json();
}

export function get<T>(path: string): Promise<T> {
  return request<T>(path, { method: "GET" });
}

export function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function del<T>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" });
}

export async function upload<T>(path: string, formData: FormData): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Upload error ${res.status}: ${error}`);
  }

  return res.json();
}
