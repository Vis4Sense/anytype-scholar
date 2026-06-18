# Anytype Scholar MVP

## What it is

Anytype Scholar is an external companion tool for saving academic papers and research metadata into Anytype.

It is not a native in-app Anytype plugin. The current integration surface is Anytype's local external API, so this project should treat Anytype as the destination system and send data into it from outside the app.

## Product shape

The preferred product shape is a browser extension built with WXT.

Why this shape:

- fits the "save while browsing" workflow
- can later support quick save from paper pages
- can also host a larger import surface for pasted or uploaded BibTeX
- avoids depending on internal Anytype UI extension points

## MVP goal

The first version should provide the smallest reliable path from `BibTeX` into structured Anytype objects, without requiring Zotero.

Core MVP flow:

1. connect to the local Anytype API
2. let the user choose a target Space
3. paste BibTeX into the extension
4. parse entries into normalized paper metadata
5. create or reuse a `Paper`-like object type in Anytype
6. deduplicate obvious repeats before import
7. show a simple import result summary

## Suggested field mapping

- `title` -> object name
- `author` -> author text
- `year` -> publication year
- `journal` / `booktitle` -> venue
- `doi` -> DOI
- `url` -> source URL
- `abstract` -> notes or body
- `citation key` -> citation key
- `keywords` -> tags or text
- `raw BibTeX` -> original BibTeX field

## Deduplication

MVP deduplication can use:

- DOI
- arXiv ID
- citation key
- normalized title + year

## Non-goals for v1

These should stay out of the first version unless they are needed to unblock the core import flow:

- Zotero sync
- full bibliography synchronization
- PDF attachment upload
- one-click page capture from arbitrary paper sites
- advanced author / venue object linking

## Later

Possible follow-up features:

- DOI-based import
- metadata enrichment from arXiv, OpenAlex, or Crossref
- save current page with one click
- batch `.bib` upload
- PDF capture and attachment support
- author, venue, and topic linking
- reading notes and literature review workflows

## Constraint

The main platform constraint is that Anytype currently exposes a local API rather than a true internal plugin SDK. That means this project should be designed as an external browser-based companion tool, not as an embedded Anytype plugin.
