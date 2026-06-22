import {
  ANYTYPE_API_VERSION,
  type AnytypeApiKeyResult,
  type AnytypeChallengeResult,
  type AnytypeConnectionCheckResult,
  type AnytypeConnectionSettings,
  type AnytypeObjectPropertyValue,
  type AnytypeProperty,
  type AnytypeSpace,
  type AnytypeTemplate,
  type AnytypeType,
  type AnytypeTypeDetail,
  REQUIRED_PAPER_PROPERTIES,
  normalizeConnectionSettings,
} from '@/lib/anytype';
import {
  extractApiErrorMessage,
  extractProperties,
  extractSpaces,
  extractTemplates,
  extractTypes,
  normalizeProperty,
  normalizePropertyKey,
  normalizeType,
  normalizeTypeDetail,
  normalizeTypeKey,
  pluralizeTypeName,
  safeJson,
} from '@/lib/anytype-normalize';

export async function checkConnection(
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
      message: response.ok ? 'Connected to Anytype.' : 'Saved credentials are not working.',
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : 'Failed to reach the local Anytype API.',
    };
  }
}

export async function listSpaces(payload: AnytypeConnectionSettings): Promise<{
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

    return {
      ok: response.ok,
      spaces: extractSpaces(data),
      status: response.status,
      statusText: response.statusText,
      message: response.ok ? 'Spaces loaded.' : 'Failed to load spaces.',
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : 'Failed to reach the local Anytype API.',
    };
  }
}

export async function listTypes(payload: AnytypeConnectionSettings): Promise<{
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
        error instanceof Error ? error.message : 'Failed to reach the local Anytype API.',
    };
  }
}

export async function listProperties(payload: AnytypeConnectionSettings): Promise<{
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
        error instanceof Error ? error.message : 'Failed to reach the local Anytype API.',
    };
  }
}

export async function listTemplates(payload: AnytypeConnectionSettings): Promise<{
  ok: boolean;
  message: string;
  templates?: AnytypeTemplate[];
  status?: number;
  statusText?: string;
}> {
  const settings = normalizeConnectionSettings(payload);

  if (!settings.apiToken || !settings.targetSpaceId || !settings.targetTypeId) {
    return {
      ok: false,
      message: 'A connected Anytype type is required.',
    };
  }

  try {
    const response = await fetch(
      `${settings.baseUrl}/v1/spaces/${settings.targetSpaceId}/types/${settings.targetTypeId}/templates`,
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
      templates: extractTemplates(data),
      status: response.status,
      statusText: response.statusText,
      message: response.ok ? 'Templates loaded.' : 'Failed to load templates.',
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : 'Failed to reach the local Anytype API.',
    };
  }
}

export async function getType(
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
    const normalizedTypeSource =
      (data as { type?: unknown } | null)?.type ??
      (data as { data?: unknown } | null)?.data ??
      data;

    return {
      ok: response.ok,
      type: response.ok ? normalizeTypeDetail(normalizedTypeSource) ?? undefined : undefined,
      status: response.status,
      statusText: response.statusText,
      message: response.ok ? 'Type loaded.' : 'Failed to load type details.',
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : 'Failed to reach the local Anytype API.',
    };
  }
}

export async function createType(
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
    const paperPropertyLinks = REQUIRED_PAPER_PROPERTIES.map((property) => ({
      key: normalizePropertyKey(property.key),
      name: property.name,
      format: property.format,
    }));
    const attempts = [
      {
        name: trimmedName,
        plural_name: pluralName,
        layout: 'basic',
        properties: paperPropertyLinks,
      },
      {
        name: trimmedName,
        plural_name: pluralName,
        layout: 'basic',
        key: normalizeTypeKey(trimmedName),
        properties: paperPropertyLinks,
      },
      {
        name: trimmedName,
        pluralName,
        layout: 'basic',
        key: normalizeTypeKey(trimmedName),
        properties: paperPropertyLinks,
      },
      {
        Name: trimmedName,
        PluralName: pluralName,
        Layout: 'basic',
        Key: normalizeTypeKey(trimmedName),
        Properties: paperPropertyLinks,
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
        error instanceof Error ? error.message : 'Failed to reach the local Anytype API.',
    };
  }
}

export async function createProperty(
  settings: AnytypeConnectionSettings,
  property: (typeof REQUIRED_PAPER_PROPERTIES)[number],
): Promise<{
  ok: boolean;
  message: string;
  property?: AnytypeProperty;
  status?: number;
  statusText?: string;
}> {
  const attempts = [
    {
      name: property.name,
      key: normalizePropertyKey(property.key),
      format: property.format,
    },
    {
      name: property.name,
      format: property.format,
    },
    {
      name: property.name,
      type: property.format,
    },
  ];
  let lastResponse: Response | null = null;
  let lastData: unknown = null;

  for (const body of attempts) {
    const response = await fetch(
      `${settings.baseUrl}/v1/spaces/${settings.targetSpaceId}/properties`,
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
    const createdProperty = normalizeProperty(
      (data as { property?: unknown } | null)?.property ??
        (data as { data?: unknown } | null)?.data ??
        data,
    );

    if (response.ok && createdProperty) {
      return {
        ok: true,
        property: createdProperty,
        message: 'Property created.',
      };
    }

    lastResponse = response;
    lastData = data;
  }

  return {
    ok: false,
    status: lastResponse?.status,
    statusText: lastResponse?.statusText,
    message: extractApiErrorMessage(lastData) || `Failed to create ${property.name}.`,
  };
}

export async function updateTypeProperties(
  settings: AnytypeConnectionSettings,
  typeId: string,
  type: AnytypeTypeDetail,
  properties: Array<{
    key: string;
    name: string;
    format: string;
  }>,
): Promise<{
  ok: boolean;
  message: string;
  type?: AnytypeTypeDetail;
  status?: number;
  statusText?: string;
}> {
  const attempts = [
    {
      name: type.name,
      plural_name: type.pluralName,
      layout: type.layout,
      properties,
    },
    {
      name: type.name,
      properties,
    },
  ];
  let lastResponse: Response | null = null;
  let lastData: unknown = null;

  for (const body of attempts) {
    const response = await fetch(
      `${settings.baseUrl}/v1/spaces/${settings.targetSpaceId}/types/${typeId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${settings.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );
    const data = await safeJson(response);
    const updatedType = normalizeTypeDetail(
      (data as { type?: unknown } | null)?.type ??
        (data as { data?: unknown } | null)?.data ??
        data,
    );

    if (response.ok) {
      return {
        ok: true,
        type: updatedType ?? undefined,
        message: 'Type updated.',
      };
    }

    lastResponse = response;
    lastData = data;
  }

  return {
    ok: false,
    status: lastResponse?.status,
    statusText: lastResponse?.statusText,
    message: extractApiErrorMessage(lastData) || 'Failed to update type.',
  };
}

type AnytypeObjectSummary = {
  id: string;
  name: string;
  typeId: string;
  properties: Record<string, string | number>;
};

export async function listObjects(
  payload: AnytypeConnectionSettings,
): Promise<{
  ok: boolean;
  message: string;
  objects?: AnytypeObjectSummary[];
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

  const endpoints = [
    `${settings.baseUrl}/v1/spaces/${settings.targetSpaceId}/objects?type_id=${encodeURIComponent(settings.targetTypeId)}`,
    `${settings.baseUrl}/v1/spaces/${settings.targetSpaceId}/objects?typeId=${encodeURIComponent(settings.targetTypeId)}`,
    `${settings.baseUrl}/v1/spaces/${settings.targetSpaceId}/objects`,
  ];

  let lastResponse: Response | null = null;
  let lastData: unknown = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${settings.apiToken}`,
        },
      });
      const data = await safeJson(response);

      if (response.ok) {
        return {
          ok: true,
          objects: extractObjects(data),
          status: response.status,
          statusText: response.statusText,
          message: 'Objects loaded.',
        };
      }

      lastResponse = response;
      lastData = data;
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error ? error.message : 'Failed to reach the local Anytype API.',
      };
    }
  }

  return {
    ok: false,
    status: lastResponse?.status,
    statusText: lastResponse?.statusText,
    message: extractApiErrorMessage(lastData) || 'Failed to load existing objects.',
  };
}

export async function createObject(
  payload: AnytypeConnectionSettings,
  input: {
    name: string;
    properties: AnytypeObjectPropertyValue[];
    bodyMarkdown?: string;
  },
): Promise<{
  ok: boolean;
  message: string;
  object?: AnytypeObjectSummary;
  status?: number;
  statusText?: string;
}> {
  const settings = normalizeConnectionSettings(payload);
  const trimmedName = input.name.trim();

  if (!settings.apiToken || !settings.targetSpaceId || !settings.targetTypeId) {
    return {
      ok: false,
      message: 'A connected Anytype type is required.',
    };
  }

  if (!trimmedName) {
    return {
      ok: false,
      message: 'Object name is required.',
    };
  }

  const typeKey = await resolveTargetTypeKey(settings);

  const attempts = [
    {
      body: input.bodyMarkdown,
      name: trimmedName,
      template_id: settings.targetTemplateId || undefined,
      type_key: typeKey,
      properties: input.properties,
    },
    {
      body: input.bodyMarkdown,
      name: trimmedName,
      template_id: settings.targetTemplateId || undefined,
      typeKey,
      properties: input.properties,
    },
  ];

  let lastResponse: Response | null = null;
  let lastData: unknown = null;

  for (const body of attempts) {
    try {
      const response = await fetch(
        `${settings.baseUrl}/v1/spaces/${settings.targetSpaceId}/objects`,
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

      if (response.ok) {
        const createdObject = normalizeObject(
          (data as { object?: unknown } | null)?.object ??
            (data as { data?: unknown } | null)?.data ??
            data,
        );

        return {
          ok: true,
          object: createdObject,
          status: response.status,
          statusText: response.statusText,
          message: 'Object created.',
        };
      }

      lastResponse = response;
      lastData = data;
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error ? error.message : 'Failed to reach the local Anytype API.',
      };
    }
  }

  return {
    ok: false,
    status: lastResponse?.status,
    statusText: lastResponse?.statusText,
    message: extractApiErrorMessage(lastData) || 'Failed to create object.',
  };
}

export async function createChallenge(
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
      message: 'Challenge created. Check the Anytype desktop app for the 4-digit code.',
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : 'Failed to reach the local Anytype API.',
    };
  }
}

export async function createApiKey(
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
        error instanceof Error ? error.message : 'Failed to reach the local Anytype API.',
    };
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

async function resolveTargetTypeKey(settings: AnytypeConnectionSettings) {
  if (!settings.targetTypeId.trim()) {
    return '';
  }

  const typeResult = await getType(settings, settings.targetTypeId);
  if (typeResult.ok && typeResult.type?.key) {
    return typeResult.type.key;
  }

  const typesResult = await listTypes(settings);
  if (!typesResult.ok) {
    return '';
  }

  return (
    typesResult.types?.find((type) => type.id === settings.targetTypeId)?.key ?? ''
  );
}

async function updateObject(
  settings: AnytypeConnectionSettings,
  objectId: string,
  input: {
    name: string;
    properties: AnytypeObjectPropertyValue[];
    bodyMarkdown?: string;
  },
) {
  const attempts = [
    {
      name: input.name,
      properties: input.properties,
      markdown: input.bodyMarkdown,
    },
    {
      name: input.name,
      properties: input.properties,
      body: input.bodyMarkdown,
    },
    {
      name: input.name,
      properties: input.properties,
      body_markdown: input.bodyMarkdown,
    },
    {
      name: input.name,
      properties: input.properties,
      bodyMarkdown: input.bodyMarkdown,
    },
    {
      details: input.properties,
      body: input.bodyMarkdown,
    },
    {
      details: input.properties,
      body_markdown: input.bodyMarkdown,
    },
    {
      details: input.properties,
      bodyMarkdown: input.bodyMarkdown,
    },
    {
      body: input.bodyMarkdown,
    },
    {
      body_markdown: input.bodyMarkdown,
    },
    {
      bodyMarkdown: input.bodyMarkdown,
    },
    {
      markdown: input.bodyMarkdown,
    },
  ];

  for (const body of attempts) {
    try {
      const response = await fetch(`${settings.baseUrl}/v1/spaces/${settings.targetSpaceId}/objects/${objectId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${settings.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        return;
      }
    } catch {
      return;
    }
  }
}

function trimBody(value: string) {
  return value.replace(/\n{3,}/g, '\n\n').trim();
}

function normalizeBodyForCompare(value: string | null | undefined) {
  return typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim() : '';
}

function extractObjects(data: unknown): AnytypeObjectSummary[] {
  const candidates = Array.isArray(data)
    ? data
    : Array.isArray((data as { objects?: unknown })?.objects)
      ? ((data as { objects: unknown[] }).objects ?? [])
      : Array.isArray((data as { data?: unknown })?.data)
        ? ((data as { data: unknown[] }).data ?? [])
        : [];

  return candidates
    .map((value) => normalizeObject(value))
    .filter((value): value is AnytypeObjectSummary => Boolean(value));
}

function normalizeObject(value: unknown): AnytypeObjectSummary | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  const id =
    typeof candidate.id === 'string'
      ? candidate.id
      : typeof candidate.object_id === 'string'
        ? candidate.object_id
        : '';
  const name =
    typeof candidate.name === 'string'
      ? candidate.name
      : typeof candidate.title === 'string'
        ? candidate.title
        : '';
  const typeId =
    typeof candidate.type_id === 'string'
      ? candidate.type_id
      : typeof candidate.typeId === 'string'
        ? candidate.typeId
        : typeof candidate.type === 'string'
          ? candidate.type
          : '';
  const properties = collectObjectProperties(candidate);

  if (!id && !name && !typeId) {
    return undefined;
  }

  return {
    id: id || name || typeId,
    name: name || String(properties.name ?? ''),
    typeId,
    properties,
  };
}

function collectObjectProperties(candidate: Record<string, unknown>) {
  const values = [
    candidate.properties,
    candidate.fields,
    candidate.details,
    candidate.relations,
  ];
  const properties: Record<string, string | number> = {};

  for (const value of values) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (!entry || typeof entry !== 'object') {
          continue;
        }

        const property = entry as Record<string, unknown>;
        const key = typeof property.key === 'string' ? property.key : '';
        const propertyValue =
          typeof property.text === 'string' || typeof property.text === 'number'
            ? property.text
            : typeof property.number === 'number'
              ? property.number
              : typeof property.url === 'string'
                ? property.url
                : undefined;

        if (key && (typeof propertyValue === 'string' || typeof propertyValue === 'number')) {
          properties[key] = propertyValue;
        }
      }

      continue;
    }

    if (!value || typeof value !== 'object') {
      continue;
    }

    for (const [key, entry] of Object.entries(value)) {
      if (typeof entry === 'string' || typeof entry === 'number') {
        properties[key] = entry;
        continue;
      }

      if (!entry || typeof entry !== 'object') {
        continue;
      }

      const nested = entry as Record<string, unknown>;
      const nestedValue =
        typeof nested.value === 'string' || typeof nested.value === 'number'
          ? nested.value
          : typeof nested.text === 'string'
            ? nested.text
            : typeof nested.name === 'string'
              ? nested.name
              : undefined;

      if (typeof nestedValue === 'string' || typeof nestedValue === 'number') {
        properties[key] = nestedValue;
      }
    }
  }

  return properties;
}
