# UC CampusPathFinder

A walking-navigation web app for the University of Cincinnati campus. Search buildings, get
pedestrian routes computed on real OpenStreetMap walkways, and (as an admin) draw custom
shortcuts that fold into the routing graph live.

https://uc-campus-path-finder-beryl.vercel.app

Built with Next.js, React, TypeScript, MapLibre, and Firebase (Auth + Firestore), on the
shared `@ash2k5/ui` design system (light + dark).

## Run locally

Needs Node 20+ and a Firebase project (the free Spark plan is fine) with email/password auth
and a Cloud Firestore database enabled.

```bash
npm install
cp .env.example .env.local   # fill in your Firebase web config
npm run dev
```

The `NEXT_PUBLIC_FIREBASE_*` values come from the Firebase console > Project settings > Your
apps. They're public web config, not secrets; Firestore rules control access. Open
http://localhost:3000 and sign in with an account you create in the app.

Admin controls (drawing shortcuts) need the Firestore rules deployed
(`firebase deploy --only firestore:rules`) and your user ID added as a document at
`admins/{your-uid}` in Firestore.

## Run with Docker

Runs the app against the Firebase emulators, so no real Firebase project or local Java is
needed (just Docker Desktop running):

```bash
docker compose up --build
```

Production build:

```bash
docker compose -f compose.prod.yaml up --build
```

## Tests

```bash
npm test            # unit + component tests
npm run lint
npm run test:rules  # Firestore rules against the emulator (needs Java + Firebase CLI)
npm run test:e2e    # Playwright against a production build (needs Java + Firebase CLI)
```
