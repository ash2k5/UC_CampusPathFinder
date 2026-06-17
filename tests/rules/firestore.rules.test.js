import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

// Mirrors APP_ID in src/lib/firebase.ts
const APP_ID = 'campus-nav-v1';
const ADMIN = 'admin-uid';
const OTHER = 'other-uid';

let testEnv;

const shortcut = (db, id) =>
  doc(db, 'artifacts', APP_ID, 'public', 'data', 'shortcuts', id);

const validDoc = (creator = ADMIN) => ({
  geometry: JSON.stringify({ type: 'LineString', coordinates: [[-84.51, 39.13], [-84.5, 39.14]] }),
  properties: { creator, timestamp: new Date().toISOString() },
});

async function seedAdmin(uid) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'admins', uid), { grantedAt: Date.now() });
  });
}

async function seedShortcut(id, creator = ADMIN) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(shortcut(ctx.firestore(), id), validDoc(creator));
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-campus',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => { await testEnv.cleanup(); });
beforeEach(async () => { await testEnv.clearFirestore(); });

describe('shortcuts read', () => {
  it('is world-readable, even unauthenticated', async () => {
    await seedShortcut('p1');
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(shortcut(db, 'p1')));
  });
});

describe('shortcuts create', () => {
  beforeEach(() => seedAdmin(ADMIN));

  it('denies an unauthenticated create', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(shortcut(db, 'p1'), validDoc(ADMIN)));
  });

  it('denies a non-admin create', async () => {
    const db = testEnv.authenticatedContext(OTHER).firestore();
    await assertFails(setDoc(shortcut(db, 'p1'), validDoc(OTHER)));
  });

  it('denies an admin create whose creator is not their own uid', async () => {
    const db = testEnv.authenticatedContext(ADMIN).firestore();
    await assertFails(setDoc(shortcut(db, 'p1'), validDoc(OTHER)));
  });

  it('allows an admin create with a well-formed document', async () => {
    const db = testEnv.authenticatedContext(ADMIN).firestore();
    await assertSucceeds(setDoc(shortcut(db, 'p1'), validDoc(ADMIN)));
  });

  it('denies a non-string geometry', async () => {
    const db = testEnv.authenticatedContext(ADMIN).firestore();
    await assertFails(setDoc(shortcut(db, 'p1'), {
      geometry: { type: 'LineString', coordinates: [] },
      properties: { creator: ADMIN, timestamp: new Date().toISOString() },
    }));
  });

  it('denies an empty geometry string', async () => {
    const db = testEnv.authenticatedContext(ADMIN).firestore();
    await assertFails(setDoc(shortcut(db, 'p1'), {
      geometry: '',
      properties: { creator: ADMIN, timestamp: new Date().toISOString() },
    }));
  });

  it('denies an oversized geometry string', async () => {
    const db = testEnv.authenticatedContext(ADMIN).firestore();
    await assertFails(setDoc(shortcut(db, 'p1'), {
      geometry: 'x'.repeat(100001),
      properties: { creator: ADMIN, timestamp: new Date().toISOString() },
    }));
  });

  it('denies an unexpected top-level field', async () => {
    const db = testEnv.authenticatedContext(ADMIN).firestore();
    await assertFails(setDoc(shortcut(db, 'p1'), { ...validDoc(ADMIN), extra: 'nope' }));
  });

  it('denies an unexpected properties field', async () => {
    const db = testEnv.authenticatedContext(ADMIN).firestore();
    await assertFails(setDoc(shortcut(db, 'p1'), {
      geometry: validDoc(ADMIN).geometry,
      properties: { creator: ADMIN, timestamp: new Date().toISOString(), role: 'super' },
    }));
  });

  it('denies a missing timestamp', async () => {
    const db = testEnv.authenticatedContext(ADMIN).firestore();
    await assertFails(setDoc(shortcut(db, 'p1'), {
      geometry: validDoc(ADMIN).geometry,
      properties: { creator: ADMIN },
    }));
  });
});

describe('shortcuts delete', () => {
  beforeEach(() => seedAdmin(ADMIN));

  it('denies a non-admin delete', async () => {
    await seedShortcut('p1');
    const db = testEnv.authenticatedContext(OTHER).firestore();
    await assertFails(deleteDoc(shortcut(db, 'p1')));
  });

  it('allows an admin delete', async () => {
    await seedShortcut('p1');
    const db = testEnv.authenticatedContext(ADMIN).firestore();
    await assertSucceeds(deleteDoc(shortcut(db, 'p1')));
  });

  it('round-trips an admin create then delete', async () => {
    const db = testEnv.authenticatedContext(ADMIN).firestore();
    await assertSucceeds(setDoc(shortcut(db, 'rt'), validDoc(ADMIN)));
    await assertSucceeds(deleteDoc(shortcut(db, 'rt')));
  });
});

describe('admins roster', () => {
  it('lets a user read only their own admin record', async () => {
    await seedAdmin(ADMIN);
    const db = testEnv.authenticatedContext(ADMIN).firestore();
    await assertSucceeds(getDoc(doc(db, 'admins', ADMIN)));
  });

  it('denies reading another user admin record', async () => {
    await seedAdmin(ADMIN);
    const db = testEnv.authenticatedContext(OTHER).firestore();
    await assertFails(getDoc(doc(db, 'admins', ADMIN)));
  });

  it('denies any client write to the admins roster', async () => {
    const db = testEnv.authenticatedContext(ADMIN).firestore();
    await assertFails(setDoc(doc(db, 'admins', ADMIN), { grantedAt: Date.now() }));
  });
});
