const API_URL = import.meta.env.VITE_API_URL ?? "/api";

export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("diin_token");
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (response.status === 401) { localStorage.removeItem("diin_token"); if (location.pathname !== "/login") location.href = "/login"; }
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new ApiError(body.message ?? "Yêu cầu thất bại", response.status); }
  return response.json();
}

export async function download(path: string, fileName: string) {
  const token = localStorage.getItem("diin_token");
  const response = await fetch(`${API_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!response.ok) throw new ApiError("Không tải được file", response.status);
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a"); a.href = url; a.download = fileName; a.click(); URL.revokeObjectURL(url);
}
