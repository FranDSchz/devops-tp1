const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.trim() || "/api";
const API_BASE = configuredApiBase.replace(/\/$/, "");

export function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  return send<T>(`${API_BASE}${path}`, init);
}

export function proxyRequest<T>(path: string): Promise<T> {
  return send<T>(path);
}

async function send<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, init);
  } catch {
    throw new Error("No se pudo conectar con la API. Verificá que el backend esté disponible.");
  }

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function readApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string" && body.error.trim()) return body.error;
  } catch {
    // The API may return an empty or non-JSON error response.
  }

  return `La API respondió con el código ${response.status}.`;
}
