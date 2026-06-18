import {
  ANYTYPE_API_VERSION,
  type AnytypeApiKeyResult,
  type AnytypeChallengeResult,
  type AnytypeConnectionCheckResult,
  type AnytypeProperty,
  type AnytypeConnectionSettings,
  type AnytypeSpace,
  type AnytypeType,
  type AnytypeTypeDetail,
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
    }
  | {
      type: 'anytype:list-types';
      payload: AnytypeConnectionSettings;
    }
  | {
      type: 'anytype:list-properties';
      payload: AnytypeConnectionSettings;
    }
  | {
      type: 'anytype:get-type';
      payload: {
        settings: AnytypeConnectionSettings;
        typeId: string;
      };
    }
  | {
      type: 'anytype:create-type';
      payload: {
        settings: AnytypeConnectionSettings;
        name: string;
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

    if (message?.type === 'anytype:list-spaces') {
      return listSpaces(message.payload);
    }

    if (message?.type === 'anytype:list-types') {
      return listTypes(message.payload);
    }

    if (message?.type === 'anytype:list-properties') {
      return listProperties(message.payload);
    }

    if (message?.type === 'anytype:get-type') {
      return getType(message.payload.settings, message.payload.typeId);
    }

    if (message?.type === 'anytype:create-type') {
      return createType(message.payload.settings, message.payload.name);
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

async function listTypes(payload: AnytypeConnectionSettings): Promise<{
  ok: boolean;
  message: string;
  types?: AnytypeType[];
  status?: number;
  statusText?: string;
}> {
  const settings = normalizeConnectionSettings(payload);

  if (!settings.apiToken || !settings.targetSpaceId) {
    return {
      ok: false,
      message: 'A connected Anytype space is required.',
    };
  }

  try {
    const response = await fetch(
      `${settings.baseUrl}/v1/spaces/${settings.targetSpaceId}/types`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${settings.apiToken}`,
        },
      },
    );
    const data = await safeJson(response);

    return {
      ok: response.ok,
      types: extractTypes(data),
      status: response.status,
      statusText: response.statusText,
      message: response.ok ? 'Types loaded.' : 'Failed to load types.',
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

async function listProperties(payload: AnytypeConnectionSettings): Promise<{
  ok: boolean;
  message: string;
  properties?: AnytypeProperty[];
  status?: number;
  statusText?: string;
}> {
  const settings = normalizeConnectionSettings(payload);

  if (!settings.apiToken || !settings.targetSpaceId) {
    return {
      ok: false,
      message: 'A connected Anytype space is required.',
    };
  }

  try {
    const response = await fetch(
      `${settings.baseUrl}/v1/spaces/${settings.targetSpaceId}/properties`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${settings.apiToken}`,
        },
      },
    );
    const data = await safeJson(response);

    return {
      ok: response.ok,
      properties: extractProperties(data),
      status: response.status,
      statusText: response.statusText,
      message: response.ok ? 'Properties loaded.' : 'Failed to load properties.',
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

async function getType(
  payload: AnytypeConnectionSettings,
  typeId: string,
): Promise<{
  ok: boolean;
  message: string;
  type?: AnytypeTypeDetail;
  status?: number;
  statusText?: string;
}> {
  const settings = normalizeConnectionSettings(payload);

  if (!settings.apiToken || !settings.targetSpaceId || !typeId.trim()) {
    return {
      ok: false,
      message: 'A connected Anytype type is required.',
    };
  }

  try {
    const response = await fetch(
      `${settings.baseUrl}/v1/spaces/${settings.targetSpaceId}/types/${typeId.trim()}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${settings.apiToken}`,
        },
      },
    );
    const data = await safeJson(response);

    return {
      ok: response.ok,
      type: response.ok ? normalizeTypeDetail(data) ?? undefined : undefined,
      status: response.status,
      statusText: response.statusText,
      message: response.ok ? 'Type loaded.' : 'Failed to load type details.',
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

async function createType(
  payload: AnytypeConnectionSettings,
  name: string,
): Promise<{
  ok: boolean;
  message: string;
  type?: AnytypeType;
  status?: number;
  statusText?: string;
}> {
  const settings = normalizeConnectionSettings(payload);
  const trimmedName = name.trim();

  if (!settings.apiToken || !settings.targetSpaceId) {
    return {
      ok: false,
      message: 'A connected Anytype space is required.',
    };
  }

  if (!trimmedName) {
    return {
      ok: false,
      message: 'Type name is required.',
    };
  }

  try {
    const pluralName = pluralizeTypeName(trimmedName);
    const attempts = [
      {
        name: trimmedName,
        plural_name: pluralName,
        layout: 'basic',
      },
      {
        name: trimmedName,
        plural_name: pluralName,
        layout: 'basic',
        key: normalizeTypeKey(trimmedName),
      },
      {
        name: trimmedName,
        pluralName,
        layout: 'basic',
        key: normalizeTypeKey(trimmedName),
      },
      {
        Name: trimmedName,
        PluralName: pluralName,
        Layout: 'basic',
        Key: normalizeTypeKey(trimmedName),
      },
      {
        title: trimmedName,
        plural_name: pluralName,
        layout: 'basic',
        key: normalizeTypeKey(trimmedName),
      },
    ];

    let lastResponse: Response | null = null;
    let lastData: unknown = null;

    for (const body of attempts) {
      const response = await fetch(
        `${settings.baseUrl}/v1/spaces/${settings.targetSpaceId}/types`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${settings.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
      );
      const data = await safeJson(response);
      const createdType = normalizeType(
        (data as { type?: unknown } | null)?.type ??
          (data as { data?: unknown } | null)?.data ??
          data,
      );

      if (response.ok && createdType) {
        return {
          ok: true,
          type: createdType,
          status: response.status,
          statusText: response.statusText,
          message: 'Type created.',
        };
      }

      lastResponse = response;
      lastData = data;
    }

    return {
      ok: false,
      status: lastResponse?.status,
      statusText: lastResponse?.statusText,
      message: extractApiErrorMessage(lastData) || 'Failed to create type.',
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

function extractTypes(data: unknown): AnytypeType[] {
  const candidates = Array.isArray(data)
    ? data
    : Array.isArray((data as { types?: unknown })?.types)
      ? (data as { types: unknown[] }).types
      : Array.isArray((data as { data?: unknown })?.data)
        ? (data as { data: unknown[] }).data
        : [];

  return candidates
    .map((type) => normalizeType(type))
    .filter((type): type is AnytypeType => Boolean(type));
}

function normalizeType(value: unknown): AnytypeType | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const id =
    typeof candidate.id === 'string'
      ? candidate.id
      : typeof candidate.type_id === 'string'
        ? candidate.type_id
        : '';
  const key =
    typeof candidate.key === 'string'
      ? candidate.key
      : typeof candidate.type_key === 'string'
        ? candidate.type_key
        : '';
  const name =
    typeof candidate.name === 'string'
      ? candidate.name
      : typeof candidate.title === 'string'
        ? candidate.title
        : typeof candidate.display_name === 'string'
          ? candidate.display_name
          : '';

  if (!id) {
    return null;
  }

  return {
    id,
    key: key || id,
    name: name || key || 'Untitled Type',
  };
}

function extractProperties(data: unknown): AnytypeProperty[] {
  const candidates = Array.isArray(data)
    ? data
    : Array.isArray((data as { properties?: unknown })?.properties)
      ? (data as { properties: unknown[] }).properties
      : Array.isArray((data as { data?: unknown })?.data)
        ? (data as { data: unknown[] }).data
        : [];

  return candidates
    .map((property) => normalizeProperty(property))
    .filter((property): property is AnytypeProperty => Boolean(property));
}

function normalizeProperty(value: unknown): AnytypeProperty | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const id =
    typeof candidate.id === 'string'
      ? candidate.id
      : typeof candidate.property_id === 'string'
        ? candidate.property_id
        : '';
  const key =
    typeof candidate.key === 'string'
      ? candidate.key
      : typeof candidate.property_key === 'string'
        ? candidate.property_key
        : '';
  const name =
    typeof candidate.name === 'string'
      ? candidate.name
      : typeof candidate.title === 'string'
        ? candidate.title
        : '';
  const format =
    typeof candidate.format === 'string'
      ? candidate.format
      : typeof candidate.type === 'string'
        ? candidate.type
        : typeof candidate.property_format === 'string'
          ? candidate.property_format
          : 'text';

  if (!id && !key && !name) {
    return null;
  }

  return {
    id: id || key || name,
    key: key || id || name,
    name: name || key || id || 'Untitled Property',
    format,
  };
}

function normalizeTypeDetail(value: unknown): AnytypeTypeDetail | null {
  const type = normalizeType(value);

  if (!type || !value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const propertyKeys = extractPropertyKeys(candidate);

  return {
    ...type,
    propertyKeys,
  };
}

function extractPropertyKeys(candidate: Record<string, unknown>): string[] {
  const directKeys = [
    candidate.properties,
    candidate.property_keys,
    candidate.recommended_properties,
    candidate.relations,
    candidate.relation_keys,
  ];

  const nestedKeys = directKeys.flatMap((value) => collectPropertyKeys(value));
  return [...new Set(nestedKeys.filter(Boolean))];
}

function collectPropertyKeys(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (typeof entry === 'string') {
      return [entry];
    }

    if (!entry || typeof entry !== 'object') {
      return [];
    }

    const candidate = entry as Record<string, unknown>;
    return [
      typeof candidate.key === 'string' ? candidate.key : '',
      typeof candidate.property_key === 'string' ? candidate.property_key : '',
      typeof candidate.relation_key === 'string' ? candidate.relation_key : '',
      typeof candidate.id === 'string' ? candidate.id : '',
    ].filter(Boolean);
  });
}

function normalizeTypeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extractApiErrorMessage(value: unknown): string {
  if (!value || typeof value !== 'object') {
    return '';
  }

  const candidate = value as Record<string, unknown>;
  const directMessage =
    typeof candidate.message === 'string'
      ? candidate.message
      : typeof candidate.error === 'string'
        ? candidate.error
        : typeof candidate.detail === 'string'
          ? candidate.detail
          : '';

  if (directMessage) {
    return formatApiErrorMessage(directMessage);
  }

  if (Array.isArray(candidate.errors)) {
    const firstError = candidate.errors.find((entry) => typeof entry === 'string');
    return typeof firstError === 'string' ? formatApiErrorMessage(firstError) : '';
  }

  return '';
}

function formatApiErrorMessage(message: string) {
  if (
    message.includes("CreateTypeRequest.Name") ||
    message.includes("CreateTypeRequest.PluralName") ||
    message.includes("CreateTypeRequest.Layout")
  ) {
    return 'Type creation needs a name, plural name, and layout.';
  }

  return message;
}

function pluralizeTypeName(value: string) {
  if (value.endsWith('s')) {
    return value;
  }

  return `${value}s`;
}
