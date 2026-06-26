import type { ParsedBibEntry } from '@/lib/anytype';

export function parseBibtexEntries(input: string): ParsedBibEntry[] {
  const entries: ParsedBibEntry[] = [];
  const source = input.trim();

  if (!source) {
    return entries;
  }

  let cursor = 0;

  while (cursor < source.length) {
    const start = source.indexOf('@', cursor);

    if (start === -1) {
      break;
    }

    const typeMatch = /^@([a-zA-Z0-9_-]+)\s*([({])/.exec(source.slice(start));
    if (!typeMatch) {
      cursor = start + 1;
      continue;
    }

    const entryType = typeMatch[1]?.trim().toLowerCase() ?? '';
    const opener = typeMatch[2] ?? '{';
    const closer = opener === '(' ? ')' : '}';
    const bodyStart = start + typeMatch[0].length;
    const bodyEnd = findMatchingDelimiter(source, bodyStart - 1, opener, closer);

    if (bodyEnd === -1) {
      break;
    }

    const rawBibtex = source.slice(start, bodyEnd + 1).trim();
    const body = source.slice(bodyStart, bodyEnd).trim();
    const entry = parseBibtexBody(body, entryType, rawBibtex);

    if (entry) {
      entries.push(entry);
    }

    cursor = bodyEnd + 1;
  }

  return entries;
}

export function getEntryDisplayName(entry: ParsedBibEntry) {
  const citationKey = entry.citationKey?.trim();
  if (citationKey) {
    return citationKey;
  }

  const firstAuthor = entry.authors?.[0]?.trim() ?? '';
  const lastName = firstAuthor.split(/\s+/).filter(Boolean).pop() ?? '';
  const year = entry.year?.trim() ?? '';

  if (lastName || year) {
    return `${slugToken(lastName) || 'paper'}${year}`.trim();
  }

  const title = entry.title?.trim() ?? '';
  if (!title) {
    return 'Untitled paper';
  }

  return title.length > 60 ? `${title.slice(0, 57).trim()}...` : title;
}

export function buildDeduplicationKeys(entry: ParsedBibEntry) {
  const keys: string[] = [];
  const doi = normalizeLooseValue(entry.doi);
  const citationKey = normalizeLooseValue(entry.citationKey);
  const title = normalizeLooseValue(entry.title);
  const year = normalizeYear(entry.year);

  if (doi) {
    keys.push(`doi:${doi}`);
  }

  if (citationKey) {
    keys.push(`citation:${citationKey}`);
  }

  if (title && year) {
    keys.push(`title-year:${title}:${year}`);
  }

  return keys;
}

export function normalizeParsedEntry(entry: ParsedBibEntry): ParsedBibEntry {
  return {
    ...entry,
    citationKey: cleanFieldValue(entry.citationKey),
    title: cleanFieldValue(entry.title),
    authors: entry.authors?.map((author) => normalizeAuthorName(author)).filter(Boolean),
    year: normalizeYear(entry.year),
    venue: cleanFieldValue(entry.venue),
    doi: normalizeDoi(entry.doi),
    url: cleanFieldValue(entry.url),
    abstract: cleanFieldValue(entry.abstract),
    keywords: entry.keywords?.map((keyword) => cleanFieldValue(keyword)).filter(Boolean),
    rawBibtex: entry.rawBibtex.trim(),
  };
}

function parseBibtexBody(
  body: string,
  entryType: string,
  rawBibtex: string,
): ParsedBibEntry | null {
  const commaIndex = findTopLevelComma(body);

  if (commaIndex === -1) {
    return null;
  }

  const citationKey = body.slice(0, commaIndex).trim();
  const fieldSource = body.slice(commaIndex + 1);
  const fields = parseFields(fieldSource);
  const title = fields.get('title');
  const authors = splitAuthors(fields.get('author'));
  const keywords = splitKeywords(fields.get('keywords'));

  return normalizeParsedEntry({
    citationKey,
    entryType,
    title,
    authors,
    year: fields.get('year'),
    venue: fields.get('journal') || fields.get('booktitle'),
    doi: fields.get('doi'),
    url: fields.get('url'),
    abstract: fields.get('abstract'),
    keywords,
    rawBibtex,
  });
}

function parseFields(source: string) {
  const fields = new Map<string, string>();
  let cursor = 0;

  while (cursor < source.length) {
    cursor = skipDelimiters(source, cursor);
    if (cursor >= source.length) {
      break;
    }

    const keyStart = cursor;
    while (cursor < source.length && /[a-zA-Z0-9_.:-]/.test(source[cursor] ?? '')) {
      cursor += 1;
    }

    const key = source.slice(keyStart, cursor).trim().toLowerCase();
    cursor = skipWhitespace(source, cursor);

    if (!key || source[cursor] !== '=') {
      cursor += 1;
      continue;
    }

    cursor += 1;
    cursor = skipWhitespace(source, cursor);
    const { value, nextIndex } = readBibtexValue(source, cursor);
    cursor = nextIndex;

    if (key && value) {
      fields.set(key, value);
    }
  }

  return fields;
}

function readBibtexValue(source: string, start: number) {
  const marker = source[start];

  if (marker === '{') {
    return readWrappedValue(source, start, '{', '}');
  }

  if (marker === '"') {
    return readQuotedValue(source, start);
  }

  let cursor = start;
  while (cursor < source.length && source[cursor] !== ',') {
    cursor += 1;
  }

  return {
    value: source.slice(start, cursor).trim(),
    nextIndex: cursor < source.length ? cursor + 1 : cursor,
  };
}

function readWrappedValue(
  source: string,
  start: number,
  opener: '{',
  closer: '}',
) {
  let depth = 0;
  let cursor = start;

  while (cursor < source.length) {
    const character = source[cursor];

    if (character === opener) {
      depth += 1;
    } else if (character === closer) {
      depth -= 1;

      if (depth === 0) {
        const value = source.slice(start + 1, cursor);
        return {
          value,
          nextIndex: cursor + 1 < source.length && source[cursor + 1] === ','
            ? cursor + 2
            : cursor + 1,
        };
      }
    }

    cursor += 1;
  }

  return {
    value: source.slice(start + 1).trim(),
    nextIndex: source.length,
  };
}

function readQuotedValue(source: string, start: number) {
  let cursor = start + 1;
  let escaped = false;

  while (cursor < source.length) {
    const character = source[cursor];

    if (character === '"' && !escaped) {
      return {
        value: source.slice(start + 1, cursor),
        nextIndex: cursor + 1 < source.length && source[cursor + 1] === ','
          ? cursor + 2
          : cursor + 1,
      };
    }

    escaped = character === '\\' ? !escaped : false;
    cursor += 1;
  }

  return {
    value: source.slice(start + 1).trim(),
    nextIndex: source.length,
  };
}

function findMatchingDelimiter(
  source: string,
  openIndex: number,
  opener: string,
  closer: string,
) {
  let depth = 0;
  let inQuote = false;

  for (let index = openIndex; index < source.length; index += 1) {
    const character = source[index];
    const previous = source[index - 1];

    if (character === '"' && previous !== '\\') {
      inQuote = !inQuote;
    }

    if (inQuote) {
      continue;
    }

    if (character === opener) {
      depth += 1;
    } else if (character === closer) {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function findTopLevelComma(source: string) {
  let depth = 0;
  let inQuote = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const previous = source[index - 1];

    if (character === '"' && previous !== '\\') {
      inQuote = !inQuote;
    }

    if (inQuote) {
      continue;
    }

    if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth = Math.max(0, depth - 1);
    } else if (character === ',' && depth === 0) {
      return index;
    }
  }

  return -1;
}

function splitAuthors(value?: string) {
  const normalized = cleanFieldValue(value);

  if (!normalized) {
    return [];
  }

  return normalized
    .split(/\s+and\s+/i)
    .map((author) => normalizeAuthorName(author))
    .filter(Boolean);
}

function normalizeAuthorName(value?: string) {
  const normalized = cleanFieldValue(value);

  if (!normalized) {
    return '';
  }

  const commaParts = normalized.split(',').map((part) => cleanFieldValue(part)).filter(Boolean);

  // Only flip the common "Family, Given" form; more complex comma-separated
  // BibTeX names are left untouched to avoid mangling suffixes or particles.
  if (commaParts.length === 2) {
    return `${commaParts[1]} ${commaParts[0]}`.trim();
  }

  return normalized;
}

function splitKeywords(value?: string) {
  const normalized = cleanFieldValue(value);

  if (!normalized) {
    return [];
  }

  return normalized
    .split(/[;,]/)
    .map((keyword) => cleanFieldValue(keyword))
    .filter(Boolean);
}

function cleanFieldValue(value?: string) {
  if (!value) {
    return '';
  }

  return value
    .replace(/\s+/g, ' ')
    .replace(/[{}]/g, '')
    .replace(/\\"/g, '"')
    .trim();
}

function normalizeDoi(value?: string) {
  const normalized = cleanFieldValue(value)
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '');

  return normalized || '';
}

function normalizeYear(value?: string) {
  const normalized = cleanFieldValue(value);
  const match = normalized.match(/\b\d{4}\b/);

  return match?.[0] ?? normalized;
}

function normalizeLooseValue(value?: string) {
  return cleanFieldValue(value).toLowerCase();
}

function slugToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function skipWhitespace(source: string, cursor: number) {
  let nextCursor = cursor;

  while (nextCursor < source.length && /\s/.test(source[nextCursor] ?? '')) {
    nextCursor += 1;
  }

  return nextCursor;
}

function skipDelimiters(source: string, cursor: number) {
  let nextCursor = cursor;

  while (
    nextCursor < source.length &&
    /[\s,]/.test(source[nextCursor] ?? '')
  ) {
    nextCursor += 1;
  }

  return nextCursor;
}
