# Changelog

## 2026-06-14

### Changed
- Migrate the UI layer to TypeScript and rebuild it on the shared `@ash2k5/cinematic-ds` design
  system (Cinematic Editorial), with light + dark themes and a persisted, no-flash theme toggle.
  Components, `page`, `layout`, and `firebase` are now `.tsx`/`.ts`. The map keeps the interface
  register (glass panels over the live map, no aurora); the login screen is the editorial surface.
- Migrate the routing, map, and data modules to TypeScript (`graph`, `routing`, `buildings`,
  `constants`, the OSM proxy route, and the `useAuth`/`useShortcuts`/`useRouting`/`useCampusMap`
  hooks). The graph carries real `NodeId`/`GraphNode`/`RoutingGraph` types and `planRoute` returns a
  typed `RoutePlan`, so the boundary casts in `page` are gone. With no `app/*.js` left, the vitest
  JSX-in-.js transform plugin was removed.

## 2026-06-12

### Security
- Pin `@grpc/grpc-js` to `1.9.16` via `overrides` to clear a high-severity transitive CVE
  (crash on malformed message) shipped through `firebase`.
- Validate the shortcut document shape in `firestore.rules` on create: geometry must be a
  bounded string, only the expected keys are allowed, and the creator must match the caller.
- Add baseline security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Strict-Transport-Security`, `Permissions-Policy`) in `next.config.mjs`.
- Use a generic signup error message instead of surfacing raw Firebase error codes.

### Added
- GitHub Actions CI: lint, test, and build on Node 20 and 22, plus an `npm audit` gate and
  emulator-backed Firestore rules and Playwright E2E jobs.
- Firestore rules tests against the emulator covering admin create/delete, creator spoofing,
  document-shape validation, public read, and the admins roster.
- Playwright E2E for the sign-in -> search -> directions journey and the admin editor controls.
- `Cache-Control` on the Overpass proxy so Vercel's edge caches the walk network across instances.
- Component tests with React Testing Library, plus tests for the Overpass proxy route.
- Accessible names for the search, start-location, and login inputs; a live region for toasts.
- MIT license.

### Changed
- Extract routing (`useRouting` + a pure `planRoute`) and the map lifecycle (`useCampusMap`) out
  of `page.js` so the routing logic is unit-testable and the page is wiring.
- Cache the Overpass walk-network response for 24 hours to avoid rate limits and speed up loads.

### Fixed
- Skip Firestore shortcuts with invalid geometry instead of breaking the whole layer.
- Skip degenerate (fewer than two points) shortcuts and malformed OSM ways when building the graph,
  including the client-side overlay builder (`page.js`).
- Break A* ties by node id so equal-cost routes render deterministically.
