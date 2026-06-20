# 1. firestore rules for access control, routing in the browser

- Status: accepted
- Date: 2026-06-20

## Context
campus-nav has no backend of its own; Firebase is the only server. Pathfinding runs over the campus
walk graph, which is small.

## Decision
Enforce all data access in `firestore.rules` (admin-only writes, shape validation on create). Run A*
routing client-side over an in-memory graph (`src/lib/graph.ts`, `src/lib/routing.ts`,
`src/hooks/useRouting.ts`).

## Consequences
Nothing to host beyond Firebase and the static Next app. The rules are the security boundary, so they
have their own tests (`npm run test:rules`). Routing cost grows with the graph; fine at campus scale,
revisit if it grows a lot.
