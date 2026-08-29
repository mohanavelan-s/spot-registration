import { EventAliasMap } from '../types';
import { DEFAULT_EVENT_REGISTRY } from '../config/defaultAliases';
import { getAuthHeaders } from './auth';

const STORAGE_KEY = 'airox_custom_event_registry';

/**
 * Fetch active symposium events registry from backend server with localStorage fallback.
 */
export async function fetchEventRegistry(): Promise<EventAliasMap> {
  try {
    const res = await fetch('/api/events/registry', {
      headers: getAuthHeaders()
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.registry && Object.keys(data.registry).length > 0) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data.registry));
        }
        return data.registry;
      }
    }
  } catch (err) {
    console.warn('[EventRegistryService] Failed to load registry from server, checking cache:', err);
  }

  // Fallback to local storage
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Object.keys(parsed).length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
  }

  return DEFAULT_EVENT_REGISTRY;
}

/**
 * Save and broadcast updated symposium event configuration across all users via server.
 */
export async function saveEventRegistry(
  newRegistry: EventAliasMap
): Promise<{ success: boolean; registry: EventAliasMap; message: string }> {
  try {
    const res = await fetch('/api/events/registry', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ registry: newRegistry })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to save events configuration on server');
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data.registry || newRegistry));
    }

    return {
      success: true,
      registry: data.registry || newRegistry,
      message: data.message || 'Symposium events successfully updated!'
    };
  } catch (err: any) {
    // If offline or server unreachable, cache locally
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newRegistry));
    }
    return {
      success: true,
      registry: newRegistry,
      message: `Saved locally: ${err.message || 'Server unreachable'}`
    };
  }
}

/**
 * Reset symposium event configuration back to defaults.
 */
export async function resetEventRegistryToServer(): Promise<{
  success: boolean;
  registry: EventAliasMap;
  message: string;
}> {
  try {
    const res = await fetch('/api/events/registry/reset', {
      method: 'POST',
      headers: getAuthHeaders()
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to reset events configuration on server');
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data.registry || DEFAULT_EVENT_REGISTRY));
    }

    return {
      success: true,
      registry: data.registry || DEFAULT_EVENT_REGISTRY,
      message: data.message || 'Events reset to default configuration.'
    };
  } catch (err: any) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_EVENT_REGISTRY));
    }
    return {
      success: true,
      registry: DEFAULT_EVENT_REGISTRY,
      message: `Reset locally: ${err.message || 'Server unreachable'}`
    };
  }
}
