const configuredApiUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, "");

export const apiBaseUrl = configuredApiUrl ?? null;

export function backendUrl(path: string) {
  return apiBaseUrl ? `${apiBaseUrl}${path}` : path;
}

export function websocketUrl(path = "/ws") {
  const base = apiBaseUrl ?? window.location.origin;
  return `${base.replace(/^http:/, "ws:").replace(/^https:/, "wss:")}${path}`;
}
