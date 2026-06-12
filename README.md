# UC CampusPathFinder

[![CI](https://github.com/ash2k5/UC_CampusPathFinder/actions/workflows/ci.yml/badge.svg)](https://github.com/ash2k5/UC_CampusPathFinder/actions/workflows/ci.yml)

Live: https://uc-campus-path-finder-beryl.vercel.app

A walking-navigation web app for the University of Cincinnati campus. Search buildings, get
pedestrian routes computed on real OpenStreetMap walkways, and let admins draw custom shortcut
paths that are folded into the routing graph in real time.

Built with Next.js (App Router), React 19, MapLibre GL, Tailwind CSS, and Firebase
(Authentication + Cloud Firestore).

## Features

- Search 100+ campus buildings by name or category.
- Pedestrian routing over the OpenStreetMap walk network using A* with a haversine heuristic.
- Start from GPS or any building; endpoints snap to the nearest walkway.
- Admin-drawn shortcuts (stairs, cut-throughs) merged into the graph and shared live via Firestore.

## Architecture

- `app/api/osm-graph` proxies the Overpass API server-side to avoid CORS. It filters to walkable
  ways, falls back across three Overpass endpoints, and caches the result for 24 hours.
- `app/graph.js` parses the OSM ways into a node/edge graph, builds a lat/lon grid spatial index
  for nearest-node lookups, merges admin shortcuts as synthetic nodes/edges, and runs A*.
- `app/buildings.js` holds the building catalog and the search.
- `app/hooks` wrap Firebase auth state and the live Firestore shortcuts subscription.
- `app/components` are presentational; `app/page.js` wires the map, routing, and Firestore together.

## Prerequisites

- Node.js 18.18 or newer
- A Firebase project (free Spark plan is sufficient) with:
  - Email/Password authentication enabled
  - A Cloud Firestore database

## Setup

1. Install dependencies:

   ```bash
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
npm test       # vitest: unit + component tests
npm run lint   # eslint
```

Coverage spans the routing graph (A*, spatial index, shortcut merge), building search, the Overpass
proxy route (with `fetch` mocked), and the React components.

## Production build

```bash
npm run build
npm run start
```

## Deployment (Vercel)

1. Push to GitHub and import the repository at https://vercel.com/new (Next.js is auto-detected).
2. Add the `NEXT_PUBLIC_FIREBASE_*` values from `.env.example` under Project Settings >
   Environment Variables.
3. In the Firebase console, add the Vercel domain under Authentication > Settings >
   Authorized domains.
4. Deploy, then deploy the Firestore rules once with `npx firebase deploy --only firestore:rules`.
