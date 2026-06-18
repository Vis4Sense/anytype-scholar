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
import { createObject, listObjects, listProperties } from '@/lib/anytype-client';
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
  const propertyMap = buildPropertyMap(propertiesResult.properties ?? []);

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
      properties: buildObjectProperties(entry, propertyMap),
      bodyMarkdown: buildInitialBody(entry, displayName),
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
