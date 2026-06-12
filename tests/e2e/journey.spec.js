import { test, expect } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from './global-setup.js';

// Deterministic walk network: Swift Hall -> midpoint -> Baldwin Hall.
const OSM_STUB = { elements: [
  { type: 'node', id: 1, lat: 39.1324590, lon: -84.5173983 }, // Swift Hall
  { type: 'node', id: 2, lat: 39.1326580, lon: -84.5170660 },
  { type: 'node', id: 3, lat: 39.1328570, lon: -84.5167338 }, // Baldwin Hall
  { type: 'way', id: 100, nodes: [1, 2, 3], tags: { highway: 'footway' } },
]};

// Minimal offline MapLibre style so the map loads without external tiles.
const MAP_STYLE_STUB = {
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {},
  layers: [],
};

test.beforeEach(async ({ page }) => {
  await page.route('https://tiles.openfreemap.org/**', route => route.fulfill({ status: 404, body: '' }));
  await page.route('https://tiles.openfreemap.org/styles/liberty', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MAP_STYLE_STUB) }));
  await page.route('**/api/osm-graph', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(OSM_STUB) }));
});

test('a signed-in user can search a building and get walking directions', async ({ page }) => {
  await page.goto('/');

  // Create a fresh account against the Auth emulator
  await page.getByRole('button', { name: 'Create Account' }).first().click();
  await page.getByLabel('Email').fill(`user_${Date.now()}@test.dev`);
  await page.getByLabel('Password').fill('secret123');
  await page.locator('form').getByRole('button').click();

  // Reaches the app shell
  const search = page.getByLabel('Search campus buildings');
  await expect(search).toBeVisible();

  // Pick a destination
  await search.fill('Baldwin');
  await page.getByRole('button', { name: 'Baldwin Hall' }).click();

  // Pick a start building (avoids GPS) and route
  const startInput = page.getByLabel('Starting point');
  await expect(startInput).toBeVisible();
  await startInput.fill('Swift');
  await page.getByRole('button', { name: 'Swift Hall' }).click();
  await page.getByRole('button', { name: /Get Walking Directions/i }).click();

  // Route summary renders
  await expect(page.getByText(/\d+\.\d+ mi/)).toBeVisible();
  await expect(page.getByText(/\d+ min/)).toBeVisible();
});

test('an admin sees the editor controls after signing in', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.locator('form').getByRole('button').click();

  await expect(page.getByText('Admin')).toBeVisible();
  await expect(page.getByText('Collaborative Editor')).toBeVisible();
  await expect(page.getByRole('button', { name: /Start New Path/i })).toBeVisible();
});
