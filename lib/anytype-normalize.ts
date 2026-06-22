import type {
  AnytypeProperty,
  AnytypeSpace,
  AnytypeTemplate,
  AnytypeType,
  AnytypeTypeDetail,
} from '@/lib/anytype';

export async function safeJson(response: Response): Promise<unknown | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function extractSpaces(data: unknown): AnytypeSpace[] {
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

export function normalizeSpace(value: unknown): AnytypeSpace | null {
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

export function extractTypes(data: unknown): AnytypeType[] {
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

export function normalizeType(value: unknown): AnytypeType | null {
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

export function extractTemplates(data: unknown): AnytypeTemplate[] {
  const candidates = Array.isArray(data)
    ? data
    : Array.isArray((data as { templates?: unknown })?.templates)
      ? (data as { templates: unknown[] }).templates
      : Array.isArray((data as { data?: unknown })?.data)
        ? (data as { data: unknown[] }).data
        : [];

  return candidates
    .map((template) => normalizeTemplate(template))
    .filter((template): template is AnytypeTemplate => Boolean(template));
}

export function normalizeTemplate(value: unknown): AnytypeTemplate | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const id =
    typeof candidate.id === 'string'
      ? candidate.id
      : typeof candidate.template_id === 'string'
        ? candidate.template_id
        : typeof candidate.templateId === 'string'
          ? candidate.templateId
          : '';
  const name =
    typeof candidate.name === 'string'
      ? candidate.name
      : typeof candidate.title === 'string'
        ? candidate.title
        : '';
  const icon =
    typeof candidate.icon === 'string'
      ? candidate.icon
      : typeof candidate.emoji_icon === 'string'
        ? candidate.emoji_icon
        : typeof candidate.emojiIcon === 'string'
          ? candidate.emojiIcon
          : undefined;

  if (!id) {
    return null;
  }

  return {
    id,
    name: name || 'Untitled Template',
    icon,
  };
}

export function extractProperties(data: unknown): AnytypeProperty[] {
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

export function normalizeProperty(value: unknown): AnytypeProperty | null {
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
          : '';

  if (!id && !key && !(name && format)) {
    return null;
  }

  return {
    id: id || key || name,
    key: key || id || name,
    name: name || key || id || 'Untitled Property',
    format: format || 'text',
  };
}

export function normalizeTypeDetail(value: unknown): AnytypeTypeDetail | null {
  const type = normalizeType(value);

  if (!type || !value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const properties = extractLinkedProperties(candidate);
  const propertyKeys =
    properties.length > 0
      ? properties.map((property) => property.key)
      : extractPropertyKeys(candidate);

  return {
    ...type,
    layout:
      typeof candidate.layout === 'string'
        ? candidate.layout
        : typeof candidate.type_layout === 'string'
          ? candidate.type_layout
          : undefined,
    pluralName:
      typeof candidate.plural_name === 'string'
        ? candidate.plural_name
        : typeof candidate.pluralName === 'string'
          ? candidate.pluralName
          : undefined,
    properties,
    propertyKeys,
  };
}

export function extractLinkedProperties(candidate: Record<string, unknown>): AnytypeProperty[] {
  const values = [
    candidate.properties,
    candidate.property_links,
    candidate.recommended_properties,
    candidate.relations,
  ];
  const collected = new Map<string, AnytypeProperty>();

  for (const value of values) {
    for (const property of collectNestedProperties(value)) {
      collected.set(normalizePropertyKey(property.key), property);
    }
  }

  return [...collected.values()];
}

export function extractPropertyKeys(candidate: Record<string, unknown>): string[] {
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

export function collectPropertyKeys(value: unknown): string[] {
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
    const key =
      typeof candidate.key === 'string'
        ? candidate.key
        : typeof candidate.property_key === 'string'
          ? candidate.property_key
          : typeof candidate.relation_key === 'string'
            ? candidate.relation_key
            : typeof candidate.id === 'string'
              ? candidate.id
              : '';

    return key ? [key] : [];
  });
}

function collectNestedProperties(value: unknown): AnytypeProperty[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectNestedProperties(entry));
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  const property = normalizeProperty(value);
  if (property) {
    return [property];
  }

  return Object.values(value as Record<string, unknown>).flatMap((entry) =>
    collectNestedProperties(entry),
  );
}

export function normalizePropertyName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function normalizePropertyKey(value: string) {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function normalizeTypeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function extractApiErrorMessage(value: unknown): string {
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

export function formatApiErrorMessage(message: string) {
  if (
    message.includes("CreateTypeRequest.Name") ||
    message.includes("CreateTypeRequest.PluralName") ||
    message.includes("CreateTypeRequest.Layout")
  ) {
    return 'Type creation needs a name, plural name, and layout.';
  }

  return message;
}

export function pluralizeTypeName(value: string) {
  if (value.endsWith('s')) {
    return value;
  }

  return `${value}s`;
}
