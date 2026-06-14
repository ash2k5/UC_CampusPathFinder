# UC CampusPathFinder

[![CI](https://github.com/ash2k5/UC_CampusPathFinder/actions/workflows/ci.yml/badge.svg)](https://github.com/ash2k5/UC_CampusPathFinder/actions/workflows/ci.yml)

Live: https://uc-campus-path-finder-beryl.vercel.app

A walking-navigation web app for the University of Cincinnati campus. Search buildings, get
pedestrian routes computed on real OpenStreetMap walkways, and let admins draw custom shortcut
paths that are folded into the routing graph in real time.

Built with Next.js (App Router), React 19, TypeScript, MapLibre GL, and Firebase (Authentication +
Cloud Firestore), on the shared `@ash2k5/cinematic-ds` design system (Tailwind v4, light + dark).

## Features

- Search 100+ campus buildings by name or category.
- Pedestrian routing over the OpenStreetMap walk network using A* with a haversine heuristic.
- Start from GPS or any building; endpoints snap to the nearest walkway.
- Admin-drawn shortcuts (stairs, cut-throughs) merged into the graph and shared live via Firestore.

## Architecture

- `app/api/osm-graph` proxies the Overpass API server-side to avoid CORS. It filters to walkable
  ways, falls back across three Overpass endpoints, and caches the result for 24 hours.
- `app/graph.ts` parses the OSM ways into a node/edge graph, builds a lat/lon grid spatial index
  for nearest-node lookups, merges admin shortcuts as synthetic nodes/edges, and runs A*.
- `app/buildings.ts` holds the building catalog and the search.
- `app/hooks` wrap Firebase auth, the live Firestore shortcuts subscription, the routing graph, and
  the MapLibre map lifecycle.
- `app/components` are presentational; `app/page.tsx` wires the map, routing, and Firestore together.
- `app/globals.css` + `app/theme.css` adopt the `@ash2k5/cinematic-ds` design system: tokens, the
  Bodoni/Inter fonts, and a persisted light/dark theme that swaps via `[data-theme]`.

## Prerequisites

- Node.js 20 or newer
- A GitHub token with `read:packages` (the UI depends on the private `@ash2k5/cinematic-ds` package
  on GitHub Packages; the repo `.npmrc` reads it from `NODE_AUTH_TOKEN`)
- A Firebase project (free Spark plan is sufficient) with:
  - Email/Password authentication enabled
  - A Cloud Firestore database

## Setup

1. Install dependencies. Set `NODE_AUTH_TOKEN` to a GitHub token with `read:packages` first so the
   private `@ash2k5/cinematic-ds` package resolves:

   ```bash
   export NODE_AUTH_TOKEN=<github token with read:packages>
   npm install
   ```

2. Create a Firebase project at https://console.firebase.google.com, then:
   - Enable Authentication with the Email/Password sign-in method.
   - Create a Cloud Firestore database.
   - Open Project settings > General > Your apps and register a Web app to get its config.

3. Copy the env template and fill in your values:

   ```bash
   cp .env.example .env.local
   ```

   | Variable | Description |
   |----------|-------------|
   | `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase web API key |
   | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
   | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project id |
   | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
   | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender id |
   | `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app id |
   | `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Analytics measurement id (optional) |

   These are public Firebase web config values; access is controlled by Firestore security rules,
   not by keeping them secret.

4. Deploy the Firestore security rules (requires the Firebase CLI):

   ```bash
   npx firebase deploy --only firestore:rules
   ```

5. Grant yourself admin so you can draw and delete paths: sign in once through the app to create
   your account, find your user id in the Firebase console under Authentication, then create a
   document at `admins/{your-user-id}` in Firestore (any contents). Any user with a matching
   document in the `admins` collection is treated as an admin.

## Running

Start the development server:

```bash
npm run dev
```

Open http://localhost:3000 and sign in with an account you create through the app. Admin controls
appear for accounts listed in the `admins` collection (see setup step 5).

## Testing

```bash
npm test            # vitest: unit + component tests
npm run lint        # eslint
npm run test:rules  # Firestore rules against the emulator (needs Java + Firebase CLI)
npm run test:e2e    # Playwright E2E against a production build (needs Java + Firebase CLI)
```

Coverage spans the routing graph (A*, spatial index, shortcut merge), building search, the Overpass
proxy route (with `fetch` mocked), and the React components. The rules and E2E suites run under the
Firebase emulator; CI runs all four on every push.

## Production build

```bash
npm run build
npm run start
```
