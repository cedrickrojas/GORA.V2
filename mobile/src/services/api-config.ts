const LOCAL_API_BASE_URL = 'http://localhost:3000';

export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();

  if (!configured) {
    return LOCAL_API_BASE_URL;
  }

  return configured.replace(/\/+$/, '');
}
