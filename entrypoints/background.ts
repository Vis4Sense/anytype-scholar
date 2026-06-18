import {
  ANYTYPE_API_VERSION,
  type AnytypeApiKeyResult,
  type AnytypeChallengeResult,
  type AnytypeConnectionSettings,
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

    return undefined;
  });
});

async function checkConnection(payload: AnytypeConnectionSettings) {
  const settings = normalizeConnectionSettings(payload);

  if (!settings.apiToken) {
    return {
      ok: false,
      message: 'No API key saved yet.',
    };
  }

  try {
    const response = await fetch(`${settings.baseUrl}/v1/spaces`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${settings.apiToken}`,
      },
    });

    return {
      ok: response.ok,
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
