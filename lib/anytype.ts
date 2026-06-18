export type AnytypeConnectionSettings = {
  baseUrl: string;
  apiToken: string;
  appName: string;
  targetSpaceId: string;
  targetTypeId: string;
  targetTypeMode: 'new-paper' | 'existing';
};

export type AnytypeSpace = {
  id: string;
  name: string;
};

export type AnytypeType = {
  id: string;
  key: string;
  name: string;
};

export type AnytypeProperty = {
  id: string;
  key: string;
  name: string;
  format: string;
};

export type AnytypeTypeDetail = AnytypeType & {
  propertyKeys: string[];
};

export type AnytypeConnectionCheckResult = {
  ok: boolean;
  message: string;
  spaces?: AnytypeSpace[];
  status?: number;
  statusText?: string;
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
  targetSpaceId: '',
  targetTypeId: '',
  targetTypeMode: 'new-paper',
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
    targetSpaceId: settings.targetSpaceId.trim(),
    targetTypeId: settings.targetTypeId.trim(),
    targetTypeMode:
      settings.targetTypeMode === 'existing' ? 'existing' : 'new-paper',
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
    typeof candidate.appName === 'string' &&
    typeof candidate.targetSpaceId === 'string' &&
    typeof candidate.targetTypeId === 'string' &&
    (candidate.targetTypeMode === 'new-paper' ||
      candidate.targetTypeMode === 'existing')
  );
}

export const REQUIRED_PAPER_PROPERTIES = [
  { key: 'title', name: 'Title', format: 'text' },
  { key: 'authors', name: 'Authors', format: 'text' },
  { key: 'year', name: 'Year', format: 'number' },
  { key: 'venue', name: 'Venue', format: 'text' },
  { key: 'doi', name: 'DOI', format: 'text' },
  { key: 'url', name: 'URL', format: 'url' },
  { key: 'abstract', name: 'Abstract', format: 'text' },
  { key: 'citationKey', name: 'Citation Key', format: 'text' },
  { key: 'rawBibtex', name: 'Raw BibTeX', format: 'text' },
] as const;
