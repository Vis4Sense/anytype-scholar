export type AnytypeConnectionSettings = {
  baseUrl: string;
  apiToken: string;
  appName: string;
};

export type AnytypeChallengeResult = {
  ok: boolean;
  message: string;
  challengeId?: string;
  status?: number;
  statusText?: string;
};

export type AnytypeApiKeyResult = {
  ok: boolean;
  message: string;
  apiKey?: string;
  status?: number;
  statusText?: string;
};

export const ANYTYPE_API_VERSION = '2025-11-08';

export const DEFAULT_CONNECTION_SETTINGS: AnytypeConnectionSettings = {
  baseUrl: 'http://127.0.0.1:31009',
  apiToken: '',
  appName: 'Anytype Scholar',
};

export const STORAGE_KEY = 'anytype-connection-settings';

export async function loadConnectionSettings(): Promise<AnytypeConnectionSettings> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  const savedSettings = stored[STORAGE_KEY];

  return {
    ...DEFAULT_CONNECTION_SETTINGS,
    ...(isConnectionSettings(savedSettings) ? savedSettings : {}),
  };
}

export async function saveConnectionSettings(
  settings: AnytypeConnectionSettings,
): Promise<void> {
  await browser.storage.local.set({
    [STORAGE_KEY]: normalizeConnectionSettings(settings),
  });
}

export function normalizeConnectionSettings(
  settings: AnytypeConnectionSettings,
): AnytypeConnectionSettings {
  return {
    baseUrl: settings.baseUrl.trim().replace(/\/+$/, ''),
    apiToken: settings.apiToken.trim(),
    appName: settings.appName.trim() || DEFAULT_CONNECTION_SETTINGS.appName,
  };
}

function isConnectionSettings(value: unknown): value is AnytypeConnectionSettings {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.baseUrl === 'string' &&
    typeof candidate.apiToken === 'string' &&
    typeof candidate.appName === 'string'
  );
}
