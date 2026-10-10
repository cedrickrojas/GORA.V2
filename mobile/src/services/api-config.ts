export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();

  if (!configured) {
    // Browser requests use the project's public /api routes, including previews.
    return '';
  }

  return configured.replace(/\/+$/, '');
}
