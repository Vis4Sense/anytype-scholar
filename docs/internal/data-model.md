# Anytype Scholar Data Model

## Goal

For the MVP, the data flow should stay simple:

1. user pastes BibTeX
2. the extension parses one or more BibTeX entries
3. each entry is converted into an Anytype object payload
4. the payload is sent to the local Anytype API

This project does not currently need a heavy intermediate domain model. The main task is to convert BibTeX fields into a stable Anytype object shape.

## Naming rule

For MVP, the Anytype object `name` should prefer the BibTeX `citationKey`.

Why:

- it is usually short
- it is easier to reference later
- it avoids very long object names in Anytype relations
- it is often already close to `author + year + short title token`

Recommended fallback order:

1. `citationKey`
2. `firstAuthorLastName + year`
3. truncated `title`

Examples:

- `vaswani2017attention`
- `brown2020fewshot`
- `smith2024`

The full paper title should still be stored separately in a `title` property.

## Parsed BibTeX entry

The parser only needs to produce a thin temporary structure for import:

```ts
type ParsedBibEntry = {
  citationKey?: string;
  entryType?: string;
  title?: string;
  authors?: string[];
  year?: string;
  venue?: string;
  doi?: string;
  url?: string;
  abstract?: string;
  keywords?: string[];
  rawBibtex: string;
};
```

This is an implementation detail for import, not a long-term app-level domain model.

## Field conversion

Recommended BibTeX to Anytype mapping for MVP:

- object `name` <- `citationKey` preferred, then fallback name rule
- `title` <- BibTeX `title`
- `authors` <- BibTeX `author`
- `year` <- BibTeX `year`
- `venue` <- BibTeX `journal` or `booktitle`
- `doi` <- BibTeX `doi`
- `url` <- BibTeX `url`
- `abstract` <- BibTeX `abstract`
- `citationKey` <- parsed entry key
- `rawBibtex` <- original BibTeX text

Optional later fields:

- `keywords`
- `arxivId`
- `publisher`
- `volume`
- `number`
- `pages`

## Notes on Anytype object shape

For MVP, treat Anytype as the destination storage format:

- `name` is the short display and reference label
- `title` is the full paper title
- `body` can stay empty, or later store abstract / notes
- paper metadata should live in explicit properties

This keeps the first import path simple while leaving room to refine object types later.

## Type selection and schema updates

The importer should support two storage modes:

1. create a new `Paper` type
2. use an existing type such as `Resource`

If the user chooses a new `Paper` type, the extension can create the required properties automatically.

If the user chooses an existing type, the extension should:

1. inspect which required properties already exist
2. compute the missing properties needed for the selected mapping
3. show the user exactly which properties will be added
4. ask for explicit approval before updating the existing type schema

This is important because updating an existing type affects the user's broader Anytype schema, not just the imported paper objects.

Recommended MVP behavior:

- support existing type selection
- support adding missing properties to the selected existing type
- require explicit user confirmation before modifying that type
- do not silently mutate an existing type schema

Recommended required properties for paper import:

- `title`
- `authors`
- `year`
- `venue`
- `doi`
- `url`
- `abstract`
- `citationKey`
- `rawBibtex`

If the user declines schema updates, the importer can either:

- continue with only the properties that already exist, or
- ask the user to choose a different type

The exact UI can be decided later, but the data model behavior should assume that existing type updates are supported and approval-gated.

## Design tradeoff

This naming choice intentionally optimizes for reference usability over browse readability.

That means:

- references and linked objects are shorter to read
- object names are more citation-like
- users still retain full title information in a dedicated property

If later user testing shows that browsing by `citationKey` is too opaque, the naming rule can be revisited without changing the stored metadata fields.
