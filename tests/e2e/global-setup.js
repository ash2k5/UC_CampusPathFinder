import { readFileSync } from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';

// Mirrors APP_ID in src/lib/firebase.ts
const APP_ID = 'campus-nav-v1';

export const ADMIN_EMAIL = 'admin@test.dev';
export const ADMIN_PASSWORD = 'secret123';

// Seeds an admin auth user, its admins/{uid} record, and one shortcut into
// the running emulators. Runs after `firebase emulators:exec` has them up.
export default async function globalSetup() {
  const res = await fetch(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, returnSecureToken: true }),
    },
  );
  if (!res.ok) throw new Error(`Auth emulator seed failed: ${res.status} ${await res.text()}`);
  const { localId } = await res.json();

  const env = await initializeTestEnvironment({
    projectId: 'demo-campus',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins', localId), { grantedAt: Date.now() });
    await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'shortcuts', 'seed-shortcut'), {
      geometry: JSON.stringify({ type: 'LineString', coordinates: [[-84.5174, 39.1325], [-84.5167, 39.1329]] }),
      properties: { creator: localId, timestamp: new Date().toISOString() },
    });
  });
  await env.cleanup();
}
