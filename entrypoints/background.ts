import {
  ANYTYPE_API_VERSION,
  type AnytypeApiKeyResult,
  type AnytypeChallengeResult,
  type AnytypeConnectionCheckResult,
  type AnytypeConnectionSettings,
  type AnytypeSpace,
  normalizeConnectionSettings,
} from '@/lib/anytype';

type AnytypeMessage =
  | {
      type: 'anytype:check-connection';
      payload: AnytypeConnectionSettings;
    }
  | {
      type: 'anytype:create-challenge';
      payload: AnytypeConnectionSettings;
    }
  | {
      type: 'anytype:create-api-key';
      payload: {
        settings: AnytypeConnectionSettings;
        challengeId: string;
        code: string;
      };
    }
  | {
      type: 'anytype:list-spaces';
      payload: AnytypeConnectionSettings;
    };

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: AnytypeMessage) => {
    if (message?.type === 'anytype:check-connection') {
      return checkConnection(message.payload);
    }

    if (message?.type === 'anytype:create-challenge') {
      return createChallenge(message.payload);
    }

    if (message?.type === 'anytype:create-api-key') {
      return createApiKey(
        message.payload.settings,
        message.payload.challengeId,
        message.payload.code,
      );
    }

    if (message?.type === 'anytype:list-spaces') {
      return listSpaces(message.payload);
    }

    return undefined;
  });
});

async function checkConnection(
  payload: AnytypeConnectionSettings,
): Promise<AnytypeConnectionCheckResult> {
  const settings = normalizeConnectionSettings(payload);

  if (!settings.apiToken) {
    return {
      ok: false,
      message: 'No API key saved yet.',
    };
  }

  try {
    const response = await fetchSpacesResponse(settings);
    const data = await safeJson(response);

    return {
      ok: response.ok,
      spaces: response.ok ? extractSpaces(data) : undefined,
      status: response.status,
      statusText: response.statusText,
      message: response.ok
        ? 'Connected to Anytype.'
        : 'Saved credentials are not working.',
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : 'Failed to reach the local Anytype API.',
    };
  }
}

async function listSpaces(payload: AnytypeConnectionSettings): Promise<{
  ok: boolean;
  message: string;
  spaces?: AnytypeSpace[];
  status?: number;
  statusText?: string;
}> {
  const settings = normalizeConnectionSettings(payload);

  if (!settings.apiToken) {
    return {
      ok: false,
      message: 'No API key saved yet.',
    };
  }

  try {
    const response = await fetchSpacesResponse(settings);
    const data = await safeJson(response);
    const spaces = extractSpaces(data);

    return {
      ok: response.ok,
      spaces,
      status: response.status,
      statusText: response.statusText,
      message: response.ok ? 'Spaces loaded.' : 'Failed to load spaces.',
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : 'Failed to reach the local Anytype API.',
    };
  }
}

async function createChallenge(
  payload: AnytypeConnectionSettings,
): Promise<AnytypeChallengeResult> {
  const settings = normalizeConnectionSettings(payload);

  if (!settings.baseUrl) {
    return {
      ok: false,
      message: 'Base URL is required.',
    };
  }

  try {
    const response = await fetch(`${settings.baseUrl}/v1/auth/challenges`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Anytype-Version': ANYTYPE_API_VERSION,
      },
      body: JSON.stringify({
        app_name: settings.appName,
      }),
    });

    const data = (await safeJson(response)) as { challenge_id?: string } | null;

    if (!response.ok || !data?.challenge_id) {
      return {
        ok: false,
        status: response.status,
        statusText: response.statusText,
        message: 'Failed to create an authentication challenge.',
      };
    }

    return {
      ok: true,
      challengeId: data.challenge_id,
      status: response.status,
      statusText: response.statusText,
      message:
        'Challenge created. Check the Anytype desktop app for the 4-digit code.',
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : 'Failed to reach the local Anytype API.',
    };
  }
}

async function createApiKey(
  payload: AnytypeConnectionSettings,
  challengeId: string,
  code: string,
): Promise<AnytypeApiKeyResult> {
  const settings = normalizeConnectionSettings(payload);

  if (!settings.baseUrl) {
    return {
      ok: false,
      message: 'Base URL is required.',
    };
  }

  try {
    const response = await fetch(`${settings.baseUrl}/v1/auth/api_keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Anytype-Version': ANYTYPE_API_VERSION,
      },
      body: JSON.stringify({
        challenge_id: challengeId.trim(),
        code: code.trim(),
      }),
    });

    const data = (await safeJson(response)) as { api_key?: string } | null;

    if (!response.ok || !data?.api_key) {
      return {
        ok: false,
        status: response.status,
        statusText: response.statusText,
        message: 'Failed to exchange the challenge for an API key.',
      };
    }

    return {
      ok: true,
      apiKey: data.api_key,
      status: response.status,
      statusText: response.statusText,
      message: 'API key created successfully.',
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : 'Failed to reach the local Anytype API.',
    };
  }
}

async function safeJson(response: Response): Promise<unknown | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function fetchSpacesResponse(settings: AnytypeConnectionSettings) {
  return fetch(`${settings.baseUrl}/v1/spaces`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${settings.apiToken}`,
    },
  });
}

function extractSpaces(data: unknown): AnytypeSpace[] {
  const candidates = Array.isArray(data)
    ? data
    : Array.isArray((data as { spaces?: unknown })?.spaces)
      ? (data as { spaces: unknown[] }).spaces
      : Array.isArray((data as { data?: unknown })?.data)
        ? (data as { data: unknown[] }).data
        : [];

  return candidates
    .map((space) => normalizeSpace(space))
    .filter((space): space is AnytypeSpace => Boolean(space));
}

function normalizeSpace(value: unknown): AnytypeSpace | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const id =
    typeof candidate.id === 'string'
      ? candidate.id
      : typeof candidate.space_id === 'string'
        ? candidate.space_id
        : typeof candidate.spaceId === 'string'
          ? candidate.spaceId
          : '';
  const name =
    typeof candidate.name === 'string'
      ? candidate.name
      : typeof candidate.title === 'string'
        ? candidate.title
        : typeof candidate.space_name === 'string'
          ? candidate.space_name
          : '';

  if (!id) {
    return null;
  }

  return {
    id,
    name: name || 'Untitled Space',
  };
}
