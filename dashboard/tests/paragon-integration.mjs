// Run against a disposable database containing a copy of lottery and ops/paragon.sql.
import assert from 'node:assert/strict';
if (!process.env.ACCOUNT_DB?.startsWith('aura_paragon_test_') || process.env.NODE_ENV !== 'test') {
  throw new Error('Integration checks require NODE_ENV=test and a disposable aura_paragon_test_ database.');
}
const { readParagon, saveParagon } = await import('../dist-server/paragon.js');
const { pool } = await import('../dist-server/database.js');
const db = pool(process.env.ACCOUNT_DB);
try {
  const before = await readParagon();
  const rows = structuredClone(before.rows);
  rows[0].max_stack += 1;
  const saved = await saveParagon({ revision: before.revision, rows }, 'integration-test');
  assert.equal(saved.changed, true);
  const after = await readParagon();
  assert.equal(after.rows[0].max_stack, rows[0].max_stack);
  assert.equal(after.history.length, before.history.length + 1);
  assert.equal((await saveParagon({ revision: after.revision, rows: after.rows }, 'integration-test')).changed, false);
  await assert.rejects(saveParagon({ revision: before.revision, rows }, 'integration-test'), error => error.status === 409);
  const invalid = structuredClone(after.rows); invalid[0].drop_rate += 1;
  await assert.rejects(saveParagon({ revision: after.revision, rows: invalid }, 'integration-test'), error => error.status === 400);

  // A real PostgreSQL UPDATE must roll back when the subsequent audit write fails.
  const connect = db.connect.bind(db);
  db.connect = async () => {
    const client = await connect();
    const query = client.query;
    const release = client.release;
    client.query = function (sql, ...args) {
      if (String(sql).includes('insert into dashboard.paragon_history')) throw new Error('Simulated audit failure');
      return query.call(this, sql, ...args);
    };
    client.release = function (...args) { client.query = query; client.release = release; return release.apply(this, args); };
    return client;
  };
  const failed = structuredClone(after.rows); failed[0].max_stack += 1;
  await assert.rejects(saveParagon({ revision: after.revision, rows: failed }, 'integration-test'), /Simulated audit failure/);
  db.connect = connect;
  assert.equal((await readParagon()).revision, after.revision);
  assert.equal((await readParagon()).history.length, after.history.length);

  const competing = structuredClone(after.rows); competing[0].max_stack += 2;
  const results = await Promise.allSettled([
    saveParagon({ revision: after.revision, rows: failed }, 'editor-a'),
    saveParagon({ revision: after.revision, rows: competing }, 'editor-b'),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.status, 409);
  await assert.rejects(db.query('update public.lottery set category=999 where false'), /permission denied/);
  await assert.rejects(db.query('delete from public.lottery where false'), /permission denied/);
  console.log('PASS: save, no-op, audit snapshots, stale revisions, invalid totals, rollback, concurrent editors, restricted privileges');
} finally { await db.end(); }
