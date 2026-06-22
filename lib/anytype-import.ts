import {
  REQUIRED_PAPER_PROPERTIES,
} from '@/lib/anytype';
import type {
  AnytypeConnectionSettings,
  AnytypeImportDebugEntry,
  AnytypeImportItemResult,
  AnytypeImportResult,
  AnytypeObjectPropertyValue,
  AnytypeProperty,
  ParsedBibEntry,
} from '@/lib/anytype';
import {
  buildDeduplicationKeys,
  getEntryDisplayName,
  parseBibtexEntries,
} from '@/lib/bibtex';
import {
  createCustomProperty,
  createObject,
  getType,
  listObjects,
  listProperties,
} from '@/lib/anytype-client';
import {
  normalizePropertyKey,
  normalizePropertyName,
} from '@/lib/anytype-normalize';

export async function importBibtex(
  settings: AnytypeConnectionSettings,
  bibtex: string,
): Promise<AnytypeImportResult> {
  const debug: AnytypeImportDebugEntry[] = [];
  const addDebugEntry = (entry: AnytypeImportDebugEntry) => {
    debug.push(entry);
  };
  const parsedEntries = parseBibtexEntries(bibtex);

  if (parsedEntries.length === 0) {
    return {
      ok: false,
      message: 'No BibTeX entries were found.',
      parsedCount: 0,
      importedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      results: [],
      debug,
    };
  }

  const results: AnytypeImportItemResult[] = [];
  const seenKeys = new Set<string>();
  const uniqueEntries: ParsedBibEntry[] = [];

  for (const entry of parsedEntries) {
    const dedupeKeys = buildDeduplicationKeys(entry);
    const duplicateKey = dedupeKeys.find((key) => seenKeys.has(key));

    if (duplicateKey) {
      results.push({
        name: getEntryDisplayName(entry),
        status: 'skipped',
        reason: 'Duplicate within pasted BibTeX.',
      });
      continue;
    }

    dedupeKeys.forEach((key) => seenKeys.add(key));
    uniqueEntries.push(entry);
  }

  let warning = '';
  const existingObjectKeys = new Set<string>();
  const existingObjectKeyMap = new Map<string, { id: string; name: string }>();
  const existingObjectsResult = await listObjects(settings);
  const propertiesResult = await listProperties(settings);
  const typeResult = await getType(settings, settings.targetTypeId);
  const availableProperties = propertiesResult.properties ?? [];
  const propertyMap = buildPropertyMap(availableProperties);
  const typeProperties = typeResult.ok ? typeResult.type?.properties ?? [] : [];

  if (existingObjectsResult.ok) {
    for (const object of existingObjectsResult.objects ?? []) {
      for (const key of buildExistingObjectKeys(object.properties, object.name)) {
        existingObjectKeys.add(key);
        if (!existingObjectKeyMap.has(key)) {
          existingObjectKeyMap.set(key, {
            id: object.id,
            name: object.name,
          });
        }
      }
    }
  } else if (!propertiesResult.ok) {
    warning = 'Imported without checking existing Anytype objects for duplicates.';
  } else if (!existingObjectsResult.ok) {
    warning = 'Imported without checking existing Anytype objects for duplicates.';
  }

  if (!typeResult.ok || !typeResult.type) {
    return {
      ok: false,
      message: typeResult.message,
      parsedCount: parsedEntries.length,
      importedCount: 0,
      skippedCount: 0,
      failedCount: parsedEntries.length,
      results: parsedEntries.map((entry) => ({
        name: getEntryDisplayName(entry),
        status: 'failed' as const,
        reason: typeResult.message,
      })),
      debug,
    };
  }

  const overrideResult = await ensureOverrideProperties(
    settings,
    availableProperties,
    typeProperties,
    addDebugEntry,
  );
  if (!overrideResult.ok) {
    return {
      ok: false,
      message: overrideResult.message,
      parsedCount: parsedEntries.length,
      importedCount: 0,
      skippedCount: 0,
      failedCount: parsedEntries.length,
      results: parsedEntries.map((entry) => ({
        name: getEntryDisplayName(entry),
        status: 'failed' as const,
        reason: overrideResult.message,
      })),
      debug,
    };
  }

  const overridePropertyMap = buildOverridePropertyMap(
    settings,
    typeProperties,
  );
  console.info('[Anytype Import] Resolved override properties', overridePropertyMap.overrides);
  addDebugEntry({
    label: 'Resolved override properties',
    data: overridePropertyMap.overrides,
  });
  if (overridePropertyMap.warnings.length > 0) {
    warning = [warning, ...overridePropertyMap.warnings].filter(Boolean).join(' ');
  }

  for (const entry of uniqueEntries) {
    const displayName = getEntryDisplayName(entry);
    const dedupeKeys = buildDeduplicationKeys(entry);
    const matchedExistingKeys = dedupeKeys.filter((key) => existingObjectKeys.has(key));
    const hasExistingDuplicate = matchedExistingKeys.length > 0;

    if (hasExistingDuplicate) {
      addDebugEntry({
        label: 'Existing object dedupe match',
        data: {
          entry: displayName,
          dedupeKeys,
          matchedKeys: matchedExistingKeys,
          matchedObjects: matchedExistingKeys.map((key) => ({
            key,
            object: existingObjectKeyMap.get(key) ?? null,
          })),
        },
      });
      results.push({
        name: displayName,
        status: 'skipped',
        reason: 'Likely already exists in Anytype.',
      });
      continue;
    }

    const createResult = await createObject(settings, {
      name: displayName,
      properties: buildObjectProperties(entry, propertyMap, overridePropertyMap.overrides),
      bodyMarkdown: settings.targetTemplateId
        ? undefined
        : buildInitialBody(entry, displayName),
    }, addDebugEntry);

    if (!createResult.ok) {
      results.push({
        name: displayName,
        status: 'failed',
        reason: createResult.message,
      });
      continue;
    }

    dedupeKeys.forEach((key) => existingObjectKeys.add(key));
    results.push({
      name: displayName,
      status: 'imported',
      reason: 'Imported successfully.',
    });
  }

  const importedCount = results.filter((result) => result.status === 'imported').length;
  const skippedCount = results.filter((result) => result.status === 'skipped').length;
  const failedCount = results.filter((result) => result.status === 'failed').length;
  const messageParts = [
    importedCount > 0 ? `${importedCount} imported` : '',
    skippedCount > 0 ? `${skippedCount} exists` : '',
    failedCount > 0 ? `${failedCount} failed` : '',
  ].filter(Boolean);

  return {
    ok: importedCount > 0 && failedCount === 0,
    message: messageParts.join(', '),
    parsedCount: parsedEntries.length,
    importedCount,
    skippedCount,
    failedCount,
    results,
    warning: warning || undefined,
    debug,
  };
}

function buildObjectProperties(
  entry: ParsedBibEntry,
  propertyMap: Record<string, { key: string; format: string }>,
  overridePropertyMap: Array<{ key: string; format: string; value: string | string[] }>,
) {
  const properties: AnytypeObjectPropertyValue[] = [];

  assignProperty(properties, propertyMap, 'title', entry.title);
  assignProperty(properties, propertyMap, 'authors', entry.authors?.join(', '));
  assignProperty(properties, propertyMap, 'venue', entry.venue);
  assignProperty(properties, propertyMap, 'doi', entry.doi);
  assignProperty(properties, propertyMap, 'url', entry.url);
  assignProperty(properties, propertyMap, 'abstract', entry.abstract);
  assignProperty(properties, propertyMap, 'citationKey', entry.citationKey);
  assignProperty(properties, propertyMap, 'rawBibtex', entry.rawBibtex);

  const year = Number(entry.year);
  if (Number.isFinite(year) && year > 0) {
    assignProperty(properties, propertyMap, 'year', year);
  } else if (entry.year?.trim()) {
    assignProperty(properties, propertyMap, 'year', entry.year.trim());
  }

  appendOverrideProperties(properties, overridePropertyMap);

  return properties;
}

function assignProperty(
  properties: AnytypeObjectPropertyValue[],
  propertyMap: Record<string, { key: string; format: string }>,
  logicalKey: string,
  value?: string | number,
) {
  if (typeof value === 'number') {
    properties.push({
      key: resolveProperty(propertyMap, logicalKey).key,
      number: value,
    });
    return;
  }

  const trimmedValue = value?.trim();

  if (trimmedValue) {
    const property = resolveProperty(propertyMap, logicalKey);

    if (normalizePropertyName(property.format) === 'url') {
      properties.push({
        key: property.key,
        url: trimmedValue,
      });
      return;
    }

    if (normalizePropertyName(property.format) === 'number') {
      const numberValue = Number(trimmedValue);
      properties.push(
        Number.isFinite(numberValue)
          ? {
              key: property.key,
              number: numberValue,
            }
          : {
              key: property.key,
              text: trimmedValue,
            },
      );
      return;
    }

    properties.push({
      key: property.key,
      text: trimmedValue,
    });
  }
}

function buildInitialBody(entry: ParsedBibEntry, fallbackName: string) {
  const title = entry.title?.trim() || fallbackName.trim();

  if (!title) {
    return '';
  }

  return `# ${title}`;
}

function appendOverrideProperties(
  properties: AnytypeObjectPropertyValue[],
  overridePropertyMap: Array<{ key: string; format: string; value: string | string[] }>,
) {
  for (const override of overridePropertyMap) {
    const propertyKey = override.key.trim();
    const propertyValue = Array.isArray(override.value)
      ? override.value.map((item) => item.trim()).filter(Boolean)
      : override.value.trim();

    if (
      !propertyKey ||
      (Array.isArray(propertyValue) ? propertyValue.length === 0 : !propertyValue)
    ) {
      continue;
    }

    const normalizedFormat = normalizePropertyName(override.format);

    if (
      normalizedFormat.includes('select') ||
      normalizedFormat.includes('tag') ||
      normalizedFormat.includes('status')
    ) {
      properties.push({
        key: propertyKey,
        multi_select: Array.isArray(propertyValue) ? propertyValue : [propertyValue],
      });
      continue;
    }

    if (Array.isArray(propertyValue)) {
      properties.push({
        key: propertyKey,
        text: propertyValue.join(', '),
      });
      continue;
    }

    if (normalizedFormat === 'url') {
      properties.push({
        key: propertyKey,
        url: propertyValue,
      });
      continue;
    }

    if (normalizedFormat === 'number') {
      const numberValue = Number(propertyValue);
      properties.push(
        Number.isFinite(numberValue)
          ? {
              key: propertyKey,
              number: numberValue,
            }
          : {
              key: propertyKey,
              text: propertyValue,
            },
      );
      continue;
    }

    properties.push({
      key: propertyKey,
      text: propertyValue,
    });
  }
}

async function ensureOverrideProperties(
  settings: AnytypeConnectionSettings,
  availableProperties: AnytypeProperty[],
  typeProperties: AnytypeProperty[],
  addDebugEntry: (entry: AnytypeImportDebugEntry) => void,
) {
  const nextProperties = [...availableProperties];

  for (const override of settings.targetPropertyOverrides) {
    const propertyName = override.propertyName.trim();
    if (!propertyName) {
      continue;
    }

    const attachedTypeProperty = typeProperties.find((property) =>
      normalizePropertyName(property.name) === normalizePropertyName(propertyName),
    );

    if (attachedTypeProperty) {
      continue;
    }

    const existingProperty = nextProperties.find((property) =>
      normalizePropertyName(property.name) === normalizePropertyName(propertyName),
    );

    if (existingProperty) {
      return {
        ok: false,
        message: `Override property "${propertyName}" exists in the space but is not attached to the selected type.`,
        properties: nextProperties,
      };
    }

    const createdProperty = await createCustomProperty(settings, {
      name: propertyName,
      format: inferOverridePropertyFormat(propertyName, override.value),
    }, addDebugEntry);

    if (!createdProperty.ok || !createdProperty.property) {
      return {
        ok: false,
        message: createdProperty.message,
        properties: nextProperties,
      };
    }

    return {
      ok: false,
      message: `Override property "${propertyName}" was created in the space but is not attached to the selected type yet.`,
      properties: [...nextProperties, createdProperty.property],
    };
  }

  return {
    ok: true,
    message: 'Override properties ready.',
    properties: nextProperties,
  };
}

function buildOverridePropertyMap(
  settings: AnytypeConnectionSettings,
  properties: AnytypeProperty[],
) {
  const overrides: Array<{ key: string; format: string; value: string | string[] }> = [];
  const warnings: string[] = [];

  for (const override of settings.targetPropertyOverrides) {
    const propertyName = override.propertyName.trim();
    const value = override.value.trim();

    if (!propertyName || !value) {
      continue;
    }

    const property = properties.find(
      (item) => normalizePropertyName(item.name) === normalizePropertyName(propertyName),
    );

    if (!property?.key) {
      continue;
    }

    const normalizedFormat = normalizePropertyName(property.format);
    const supportsOverrideFormat =
      normalizedFormat === '' ||
      normalizedFormat === 'text' ||
      normalizedFormat === 'number' ||
      normalizedFormat === 'url' ||
      normalizedFormat.includes('select') ||
      normalizedFormat.includes('tag') ||
      normalizedFormat.includes('status');

    if (!supportsOverrideFormat) {
      warnings.push(
        `Skipped override "${property.name}" because ${property.format} properties are not supported yet.`,
      );
      continue;
    }

    overrides.push({
      key: property.key,
      format: property.format,
      value:
        normalizedFormat.includes('select') ||
        normalizedFormat.includes('tag') ||
        normalizedFormat.includes('status')
          ? parseOverrideListValue(value, propertyName)
          : value,
    });
  }

  return {
    overrides,
    warnings,
  };
}

function inferOverridePropertyFormat(propertyName: string, value: string) {
  return parseOverrideListValue(value, propertyName).length > 0 ? 'multi_select' : 'text';
}

function parseOverrideListValue(value: string, propertyName?: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return [];
  }

  if (isDefaultMultiSelectOverride(propertyName)) {
    return trimmedValue.startsWith('[') && trimmedValue.endsWith(']')
      ? parseOverrideJsonList(trimmedValue)
      : [trimmedValue];
  }

  if (!trimmedValue.startsWith('[') || !trimmedValue.endsWith(']')) {
    return [];
  }

  return parseOverrideJsonList(trimmedValue);
}

function parseOverrideJsonList(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function isDefaultMultiSelectOverride(propertyName?: string) {
  return normalizePropertyName(propertyName ?? '') === normalizePropertyName('Resource Type');
}

function buildPropertyMap(properties: AnytypeProperty[]) {
  const propertyMap: Record<string, { key: string; format: string }> = {};

  for (const requiredProperty of REQUIRED_PAPER_PROPERTIES) {
    const matchedProperty = properties.find((property) =>
      propertyMatchesRequired(property, requiredProperty),
    );

    propertyMap[normalizePropertyKey(requiredProperty.key)] = {
      key: matchedProperty?.key ?? normalizePropertyKey(requiredProperty.key),
      format: matchedProperty?.format ?? requiredProperty.format,
    };
  }

  return propertyMap;
}

function resolveProperty(
  propertyMap: Record<string, { key: string; format: string }>,
  logicalKey: string,
) {
  return (
    propertyMap[normalizePropertyKey(logicalKey)] ?? {
      key: normalizePropertyKey(logicalKey),
      format: 'text',
    }
  );
}

function propertyMatchesRequired(
  property: AnytypeProperty,
  requiredProperty: (typeof REQUIRED_PAPER_PROPERTIES)[number],
) {
  return normalizePropertyKey(property.key) === normalizePropertyKey(requiredProperty.key);
}

function buildExistingObjectKeys(
  properties: Record<string, string | number>,
  fallbackName: string,
) {
  const doi = readObjectProperty(properties, 'doi');
  const citationKey = readObjectProperty(properties, 'citationKey');
  const title = readObjectProperty(properties, 'title');
  const year = readObjectProperty(properties, 'year');
  const keys: string[] = [];

  if (doi) {
    keys.push(`doi:${doi}`);
  }

  if (citationKey) {
    keys.push(`citation:${citationKey}`);
  }

  if (title && year) {
    keys.push(`title-year:${title}:${year}`);
  }

  if (keys.length === 0 && fallbackName.trim()) {
    keys.push(`citation:${fallbackName.trim().toLowerCase()}`);
  }

  return keys;
}

function readObjectProperty(
  properties: Record<string, string | number>,
  targetKey: string,
) {
  const normalizedTargetKey = normalizePropertyKey(targetKey);

  for (const [key, value] of Object.entries(properties)) {
    if (normalizePropertyKey(key) !== normalizedTargetKey) {
      continue;
    }

    return String(value).trim().toLowerCase();
  }

  return '';
}
