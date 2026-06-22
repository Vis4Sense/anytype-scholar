import {
  REQUIRED_PAPER_PROPERTIES,
} from '@/lib/anytype';
import type {
  AnytypeConnectionSettings,
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
  const existingObjectsResult = await listObjects(settings);
  const propertiesResult = await listProperties(settings);
  const availableProperties = propertiesResult.properties ?? [];
  const propertyMap = buildPropertyMap(availableProperties);

  if (existingObjectsResult.ok) {
    for (const object of existingObjectsResult.objects ?? []) {
      for (const key of buildExistingObjectKeys(object.properties, object.name)) {
        existingObjectKeys.add(key);
      }
    }
  } else if (!propertiesResult.ok) {
    warning = 'Imported without checking existing Anytype objects for duplicates.';
  } else if (!existingObjectsResult.ok) {
    warning = 'Imported without checking existing Anytype objects for duplicates.';
  }

  const overrideResult = await ensureOverrideProperties(settings, availableProperties);
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
    };
  }

  const overridePropertyMap = buildOverridePropertyMap(
    settings,
    overrideResult.properties ?? availableProperties,
  );
  if (overridePropertyMap.warnings.length > 0) {
    warning = [warning, ...overridePropertyMap.warnings].filter(Boolean).join(' ');
  }

  for (const entry of uniqueEntries) {
    const displayName = getEntryDisplayName(entry);
    const dedupeKeys = buildDeduplicationKeys(entry);
    const hasExistingDuplicate = dedupeKeys.some((key) => existingObjectKeys.has(key));

    if (hasExistingDuplicate) {
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
    });

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
  };
}

function buildObjectProperties(
  entry: ParsedBibEntry,
  propertyMap: Record<string, { key: string; format: string }>,
  overridePropertyMap: Array<{ key: string; format: string; value: string }>,
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
  overridePropertyMap: Array<{ key: string; format: string; value: string }>,
) {
  for (const override of overridePropertyMap) {
    const propertyKey = override.key.trim();
    const propertyValue = override.value.trim();

    if (!propertyKey || !propertyValue) {
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
        multi_select: [propertyValue],
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
) {
  const nextProperties = [...availableProperties];

  for (const override of settings.targetPropertyOverrides) {
    const propertyName = override.propertyName.trim();
    if (!propertyName) {
      continue;
    }

    const existingProperty = nextProperties.find((property) =>
      normalizePropertyName(property.key) === normalizePropertyName(propertyName) ||
      normalizePropertyName(property.name) === normalizePropertyName(propertyName),
    );

    if (existingProperty) {
      continue;
    }

    const createdProperty = await createCustomProperty(settings, {
      name: propertyName,
      format: 'text',
    });

    if (!createdProperty.ok || !createdProperty.property) {
      return {
        ok: false,
        message: createdProperty.message,
        properties: nextProperties,
      };
    }

    nextProperties.push(createdProperty.property);
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
  const overrides: Array<{ key: string; format: string; value: string }> = [];
  const warnings: string[] = [];

  for (const override of settings.targetPropertyOverrides) {
    const propertyName = override.propertyName.trim();
    const value = override.value.trim();

    if (!propertyName || !value) {
      continue;
    }

    const property = properties.find(
      (item) =>
        normalizePropertyName(item.key) === normalizePropertyName(propertyName) ||
        normalizePropertyName(item.name) === normalizePropertyName(propertyName),
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
      value,
    });
  }

  return {
    overrides,
    warnings,
  };
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
  return (
    normalizePropertyKey(property.key) === normalizePropertyKey(requiredProperty.key) ||
    normalizePropertyName(property.name) === normalizePropertyName(requiredProperty.name)
  );
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
