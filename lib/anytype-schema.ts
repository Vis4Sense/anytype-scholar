import {
  type AnytypeConnectionSettings,
  type AnytypeProperty,
  type AnytypeTypeDetail,
  REQUIRED_PAPER_PROPERTIES,
} from '@/lib/anytype';
import {
  createProperty,
  getType,
  listProperties,
  updateTypeProperties,
} from '@/lib/anytype-client';
import { normalizePropertyKey, normalizePropertyName } from '@/lib/anytype-normalize';

export async function preparePaperType(
  payload: AnytypeConnectionSettings,
  typeId: string,
  typeName: string,
): Promise<{
  ok: boolean;
  message: string;
  type?: AnytypeTypeDetail;
  status?: number;
  statusText?: string;
}> {
  const trimmedTypeId = typeId.trim();

  if (!payload.apiToken || !payload.targetSpaceId || !trimmedTypeId) {
    return {
      ok: false,
      message: 'A connected Anytype type is required.',
    };
  }

  try {
    const [propertiesResult, typeResult] = await Promise.all([
      listProperties(payload),
      getType(payload, trimmedTypeId),
    ]);

    if (!propertiesResult.ok) {
      return {
        ok: false,
        message: propertiesResult.message,
        status: propertiesResult.status,
        statusText: propertiesResult.statusText,
      };
    }

    if (!typeResult.ok || !typeResult.type) {
      return {
        ok: false,
        message: typeResult.message,
        status: typeResult.status,
        statusText: typeResult.statusText,
      };
    }

    const currentProperties = propertiesResult.properties ?? [];
    const currentTypeProperties = typeResult.type.properties;
    const ensuredProperties: AnytypeProperty[] = [];

    for (const requiredProperty of REQUIRED_PAPER_PROPERTIES) {
      const existingProperty = currentProperties.find((property) =>
        propertyMatchesRequired(property, requiredProperty),
      );

      if (existingProperty) {
        ensuredProperties.push(existingProperty);
        continue;
      }

      const createdProperty = await createProperty(payload, requiredProperty);

      if (!createdProperty.ok || !createdProperty.property) {
        return {
          ok: false,
          message: createdProperty.message,
          status: createdProperty.status,
          statusText: createdProperty.statusText,
        };
      }

      ensuredProperties.push(createdProperty.property);
      currentProperties.push(createdProperty.property);
    }

    const updateResult = await updateTypeProperties(
      payload,
      trimmedTypeId,
      {
        ...typeResult.type,
        name: typeName.trim() || typeResult.type.name,
      },
      mergeTypeProperties(currentTypeProperties, ensuredProperties),
    );

    if (!updateResult.ok) {
      return updateResult;
    }

    const refreshedType = await getType(payload, trimmedTypeId);

    if (!refreshedType.ok || !refreshedType.type) {
      return {
        ok: false,
        message: refreshedType.message,
        status: refreshedType.status,
        statusText: refreshedType.statusText,
      };
    }

    return {
      ok: typeHasRequiredProperties(refreshedType.type),
      type: refreshedType.type,
      message: typeHasRequiredProperties(refreshedType.type)
        ? 'Type updated.'
        : 'Anytype updated the type, but the paper fields are not visible on it yet.',
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : 'Failed to update the Anytype schema.',
    };
  }
}

function propertyMatchesRequired(
  property: AnytypeProperty,
  requiredProperty: (typeof REQUIRED_PAPER_PROPERTIES)[number],
) {
  return (
    normalizePropertyKey(property.key) === normalizePropertyKey(requiredProperty.key) ||
    normalizePropertyName(property.name) === normalizePropertyName(requiredProperty.name)
  );
}

function mergeTypeProperties(
  currentTypeProperties: AnytypeProperty[],
  ensuredProperties: AnytypeProperty[],
) {
  const existingLinks = currentTypeProperties.map((property) => ({
    key: property.key,
    name: property.name,
    format: property.format,
  }));
  const ensuredLinks = ensuredProperties.map((property) => ({
    key: property.key,
    name: property.name,
    format: property.format,
  }));
  const linksByNormalizedKey = new Map<string, (typeof ensuredLinks)[number]>();

  for (const property of [...existingLinks, ...ensuredLinks]) {
    linksByNormalizedKey.set(normalizePropertyKey(property.key), property);
  }

  return [...linksByNormalizedKey.values()];
}

function typeHasRequiredProperties(type: AnytypeTypeDetail) {
  const attachedKeys = new Set(type.propertyKeys.map((key) => normalizePropertyKey(key)));

  return REQUIRED_PAPER_PROPERTIES.every((property) =>
    attachedKeys.has(normalizePropertyKey(property.key)),
  );
}
