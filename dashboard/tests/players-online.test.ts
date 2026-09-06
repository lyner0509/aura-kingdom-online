import test from 'node:test';
import assert from 'node:assert/strict';
import { listPlayers, playerSummary } from '../src/server/database.js';

test('playerSummary returns demo stats in development/test environment', async () => {
  const summary = await playerSummary();
  assert.equal(summary.total, 1264);
  assert.equal(summary.online, 38);
  assert.equal(summary.maxLevel, 99);
});

test('listPlayers filters and returns demo players in development/test environment', async () => {
  const players = await listPlayers('Astra', 10);
  assert.equal(players.length, 1);
  assert.equal(players[0].name, 'Astra Vale');
  assert.equal(players[0].online, true);
});

test('listPlayers respects limit parameter', async () => {
  const players = await listPlayers('', 2);
  assert.equal(players.length, 2);
});
