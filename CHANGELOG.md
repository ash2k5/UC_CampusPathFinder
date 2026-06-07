# Changelog

## [Unreleased]

### Added
- GitHub Actions CI: lint, test, and build on Node 20 and 22.
- Component tests with React Testing Library, plus tests for the Overpass proxy route.
- Accessible names for the search, start-location, and login inputs; a live region for toasts.
- MIT license.

### Changed
- Cache the Overpass walk-network response for 24 hours to avoid rate limits and speed up loads.

### Fixed
- Skip Firestore shortcuts with invalid geometry instead of breaking the whole layer.
- Skip degenerate (fewer than two points) shortcuts and malformed OSM ways when building the graph.
