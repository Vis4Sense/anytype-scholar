# Anytype Scholar

Save papers, BibTeX, and research metadata to Anytype.

## Positioning

Anytype Scholar is a browser extension companion for importing academic references into Anytype.

This project is not a native Anytype plugin in the traditional sense. The current Anytype integration surface is a local external API, so the extension is designed to run outside the app and send structured paper data into Anytype.

## Features

- import BibTeX entries into Anytype objects
- connect to the local Anytype API
- choose a target Space
- parse paper metadata into a `Paper`-like object
- use `citationKey` as the default object name when available
- deduplicate obvious repeats before import
- show a simple import result
- leave room for future quick-save and paper-page capture flows

## Development

Install dependencies:

```bash
pnpm install
```

Start the extension in development mode:

```bash
pnpm dev
```

Type-check the project:

```bash
pnpm compile
```

More product notes:

- [docs/mvp.md](/Users/yuhanguo/yuhan/codes/anytype-scholar/docs/mvp.md)
- [docs/data_model.md](/Users/yuhanguo/yuhan/codes/anytype-scholar/docs/data_model.md)
