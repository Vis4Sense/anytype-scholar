# Privacy Policy for Anytype Scholar

Last updated: June 26, 2026

Anytype Scholar is a browser extension that helps users import BibTeX paper metadata into a local Anytype workspace.

## What data the extension processes

The extension may process:

- BibTeX content pasted by the user
- Paper metadata derived from that BibTeX content, such as title, authors, year, venue, DOI, URL, abstract, citation key, and raw BibTeX
- Local extension settings, such as the selected Anytype space, type, template, and property overrides
- A locally stored authorization key used to reconnect to the user's local Anytype app

## How the data is used

The extension uses this data only to:

- authenticate the connection to the user's local Anytype app during setup using a short verification code shown in that app
- connect to the user's local Anytype API
- load Anytype spaces, types, templates, and properties
- create or update structured paper objects in the user's local Anytype workspace
- preserve local extension settings for future use

## Where data is stored

The extension stores settings and the local authorization key in the browser's extension storage on the user's device.

The extension sends BibTeX content and related paper metadata only to the user's local Anytype API running on `http://127.0.0.1` or `http://localhost`, depending on the user's setup.

The developer does not operate a remote server that receives this data.

## What the extension does not do

The extension does not:

- collect browsing history
- read webpage content for import in the current version
- track clicks, keystrokes, or other user activity across websites
- sell user data
- send imported paper data to a developer-operated remote server

## Permissions

The extension uses:

- `storage` to save local settings and the local authorization key
- local host permissions for `http://127.0.0.1/*` and `http://localhost/*` to communicate with the user's local Anytype API

## User control

Users can:

- remove pasted BibTeX before importing
- disconnect or stop using the extension at any time
- clear extension data through the browser's extension settings
- remove the extension to delete its locally stored data from the browser

## Changes to this policy

This policy may be updated as the extension evolves. Updates will be reflected by revising the "Last updated" date above.
