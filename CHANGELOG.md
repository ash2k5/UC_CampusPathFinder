# Changelog

## 2026-06-14

- Moved the whole app to TypeScript and rebuilt the UI on the shared `@ash2k5/cinematic-ds`
  design system, with light + dark themes and a no-flash theme toggle. The map keeps glass
  panels over the live map; the login screen is the editorial surface.
- The routing, map, and data modules carry real types now (`NodeId`, `RoutingGraph`,
  `RoutePlan`), so the boundary casts in `page` are gone.

## 2026-06-12

- Pinned `@grpc/grpc-js` to clear a transitive CVE from Firebase.
- Validate the shortcut document shape in `firestore.rules` on create, and added baseline
  security headers in `next.config.mjs`.
- Signup shows a generic error instead of raw Firebase codes.
- Added CI (lint, test, build on Node 20 and 22), Firestore rules tests and Playwright E2E
  against the emulator, component tests, and a `Cache-Control` cache on the Overpass proxy.
- Accessible names for the search, start-location, and login inputs, and a live region for
  toasts.
- Extracted routing (`useRouting` + a pure `planRoute`) and the map lifecycle (`useCampusMap`)
  out of the page so the logic is unit-testable.
- Skip shortcuts with invalid or degenerate geometry and malformed OSM ways; break A* ties by
  node ID so routes render deterministically.
