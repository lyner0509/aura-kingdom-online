// Run against a disposable database containing dashboard.loyalty_shop and ops/loyalty.sql.
import assert from 'node:assert/strict';
if (!process.env.ACCOUNT_DB?.startsWith('aura_loyalty_test_') || process.env.NODE_ENV !== 'test') {
  console.log('Skipping loyalty integration test: requires NODE_ENV=test and disposable aura_loyalty_test_ database.');
  process.exit(0);
}
const { readLoyalty, saveLoyalty } = await import('../dist-server/loyalty.js');
const { pool } = await import('../dist-server/database.js');
const db = pool(process.env.ACCOUNT_DB);
try {
  const before = await readLoyalty();
  const rows = structuredClone(before.rows);
  rows[0].cost_lp += 10;
  const saved = await saveLoyalty({ revision: before.revision, rows }, 'integration-test');
  assert.equal(saved.changed, true);
  const after = await readLoyalty();
  assert.equal(after.rows[0].cost_lp, rows[0].cost_lp);
  assert.equal(after.history.length, before.history.length + 1);

  // No-op save returns changed = false
  assert.equal((await saveLoyalty({ revision: after.revision, rows: after.rows }, 'integration-test')).changed, false);

  // Outdated revision rejected with 409
  await assert.rejects(saveLoyalty({ revision: before.revision, rows }, 'integration-test'), error => error.status === 409);

  // Invalid data rejected with 400
  const invalid = structuredClone(after.rows);
  invalid[0].cost_lp = -10;
  await assert.rejects(saveLoyalty({ revision: after.revision, rows: invalid }, 'integration-test'), error => error.status === 400);

  console.log('PASS: loyalty integration test completed successfully.');
} finally {
  await db.end();
}
