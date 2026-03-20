const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const DEFAULT_TIMEOUT_MS = 30_000;

export class ApiError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function buildAbortSignal(
  externalSignal?: AbortSignal
): { signal: AbortSignal; cleanup: () => void } {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(
    () => timeoutController.abort(new Error("Request timed out after 30 seconds")),
    DEFAULT_TIMEOUT_MS
  );

  if (!externalSignal) {
    return {
      signal: timeoutController.signal,
      cleanup: () => clearTimeout(timeoutId),
    };
  }

  // Combine external signal with timeout signal
  const combinedController = new AbortController();

  function onExternalAbort() {
    combinedController.abort(externalSignal!.reason ?? new Error("Request aborted"));
    clearTimeout(timeoutId);
  }

  function onTimeoutAbort() {
    combinedController.abort(
      timeoutController.signal.reason ?? new Error("Request timed out after 30 seconds")
    );
  }

  if (externalSignal.aborted) {
    combinedController.abort(externalSignal.reason ?? new Error("Request aborted"));
    clearTimeout(timeoutId);
  } else {
    externalSignal.addEventListener("abort", onExternalAbort, { once: true });
    timeoutController.signal.addEventListener("abort", onTimeoutAbort, { once: true });
  }

  return {
    signal: combinedController.signal,
    cleanup: () => {
      clearTimeout(timeoutId);
      externalSignal.removeEventListener("abort", onExternalAbort);
      timeoutController.signal.removeEventListener("abort", onTimeoutAbort);
    },
  };
}

function parseJsonSafe<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(0, `Invalid JSON response: ${text.slice(0, 200)}`);
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { signal?: AbortSignal } = {}
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const { signal: externalSignal, ...restOptions } = options;
  const { signal, cleanup } = buildAbortSignal(externalSignal);

  try {
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...restOptions.headers,
      },
      ...restOptions,
      signal,
    });

    const text = await res.text();

    if (!res.ok) {
      let errorMessage: string;
      try {
        const parsed = JSON.parse(text) as { detail?: string; message?: string };
        errorMessage = parsed.detail || parsed.message || text;
      } catch {
        errorMessage = text || `HTTP ${res.status} ${res.statusText}`;
      }
      throw new ApiError(res.status, errorMessage);
    }

    if (!text) {
      return undefined as unknown as T;
    }

    return parseJsonSafe<T>(text);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError(0, "Request was cancelled");
    }
    if (err instanceof Error && err.message.includes("timed out")) {
      throw new ApiError(0, "Request timed out after 30 seconds");
    }
    throw new ApiError(
      0,
      err instanceof Error ? err.message : "Network request failed"
    );
  } finally {
    cleanup();
  }
}

export function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  return request<T>(path, { method: "GET", signal });
}

export function post<T>(
  path: string,
  body: unknown,
  signal?: AbortSignal
): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
    signal,
  });
}

export function del<T>(path: string, signal?: AbortSignal): Promise<T> {
  return request<T>(path, { method: "DELETE", signal });
}

export async function upload<T>(
  path: string,
  formData: FormData,
  signal?: AbortSignal
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const { signal: combinedSignal, cleanup } = buildAbortSignal(signal);

  try {
    const res = await fetch(url, {
      method: "POST",
      body: formData,
      signal: combinedSignal,
    });

    const text = await res.text();

    if (!res.ok) {
      let errorMessage: string;
      try {
        const parsed = JSON.parse(text) as { detail?: string; message?: string };
        errorMessage = parsed.detail || parsed.message || text;
      } catch {
        errorMessage = text || `Upload failed: HTTP ${res.status}`;
      }
      throw new ApiError(res.status, errorMessage);
    }

    if (!text) {
      return undefined as unknown as T;
    }

    return parseJsonSafe<T>(text);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError(0, "Upload was cancelled");
    }
    throw new ApiError(
      0,
      err instanceof Error ? err.message : "Upload failed"
    );
  } finally {
    cleanup();
  }
}
