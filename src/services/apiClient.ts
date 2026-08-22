import { getAuthHeaders } from './auth';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  status: number;
}

/**
 * Robust, safe JSON fetch wrapper.
 * Inspects Content-Type, prevents "Unexpected token '<', "<!DOCTYPE " crashes,
 * and extracts human-readable error messages from any server error or HTML fallback.
 */
export async function apiRequest<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data: T; error?: string }> {
  const headers = {
    ...getAuthHeaders(),
    ...(options.headers || {})
  };

  try {
    const res = await fetch(url, {
      ...options,
      headers
    });

    const contentType = (res.headers.get('content-type') || '').toLowerCase();

    // 1. If content-type is JSON, parse safely
    if (contentType.includes('application/json')) {
      try {
        const json = await res.json();
        const errorMessage = !res.ok
          ? json.error || json.message || `Request failed with status ${res.status}`
          : undefined;

        return {
          ok: res.ok && json.success !== false,
          status: res.status,
          data: json,
          error: errorMessage
        };
      } catch (jsonErr: any) {
        return {
          ok: false,
          status: res.status,
          data: {} as T,
          error: `Failed to parse JSON response (${res.status}): ${jsonErr.message}`
        };
      }
    }

    // 2. If content-type is HTML or other, read text safely without crashing
    const rawText = await res.text();

    // Check if it happens to be valid JSON formatted without content-type header
    try {
      const parsed = JSON.parse(rawText);
      return {
        ok: res.ok && parsed.success !== false,
        status: res.status,
        data: parsed,
        error: !res.ok ? parsed.error || parsed.message || `Error ${res.status}` : undefined
      };
    } catch {
      // It's genuine HTML or text
    }

    let cleanErrorMessage = `Server returned status ${res.status}`;
    if (rawText.includes('<!DOCTYPE') || rawText.includes('<html') || rawText.includes('The page cannot be found')) {
      if (res.status === 404) {
        cleanErrorMessage = `API Endpoint '${url}' was not found (404). Ensure the backend API server is running.`;
      } else if (res.status === 502 || res.status === 503 || res.status === 504) {
        cleanErrorMessage = `Server Gateway Error (${res.status}). The backend service is temporarily unavailable.`;
      } else {
        cleanErrorMessage = `Server returned an HTML error page (${res.status}). Expected JSON response.`;
      }
    } else if (rawText.trim()) {
      cleanErrorMessage = rawText.slice(0, 200);
    }

    return {
      ok: false,
      status: res.status,
      data: {} as T,
      error: cleanErrorMessage
    };
  } catch (netErr: any) {
    return {
      ok: false,
      status: 0,
      data: {} as T,
      error: netErr.message || 'Network connection to symposium server failed.'
    };
  }
}
