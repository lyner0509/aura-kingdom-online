import assert from 'node:assert/strict';
import test from 'node:test';
import { buildKickCommand, isKickNoReplyTimeout, isSuccessfulKickResponse, kickOnlineCharacter, KickOnlineError } from '../src/server/kick-online.js';

test('buildKickCommand builds the documented ZoneServer command', () => {
  assert.equal(buildKickCommand(10482), 'kick_out 10482 0');
  assert.equal(buildKickCommand(50000001), 'kick_out 50000001 0');
});

test('buildKickCommand rejects invalid character IDs', () => {
  for (const value of [0, -1, 1.5, Number.NaN]) {
    assert.throws(() => buildKickCommand(value), KickOnlineError);
  }
});

test('isSuccessfulKickResponse only accepts explicit acknowledgements', () => {
  assert.equal(isSuccessfulKickResponse('DONE'), true);
  assert.equal(isSuccessfulKickResponse('Command SUCCESS'), true);
  assert.equal(isSuccessfulKickResponse('OK kick'), true);
  assert.equal(isSuccessfulKickResponse('ERROR unknown command'), false);
  assert.equal(isSuccessfulKickResponse(''), false);
});

test('isKickNoReplyTimeout only recognizes the known CGI timeout', () => {
  assert.equal(isKickNoReplyTimeout(new Error('Koneksi ke ZoneServer CGI (10.11.18.118:20060) timeout.')), true);
  assert.equal(isKickNoReplyTimeout(new Error('connection refused')), false);
  assert.equal(isKickNoReplyTimeout('timeout'), false);
});

test('kickOnlineCharacter validates reason and completes safely in development', async () => {
  const result = await kickOnlineCharacter(10482, { reason: 'bug_glitch', note: 'Stuck di map' }, 'test-operator');
  assert.equal(result.ok, true);
  assert.equal(result.characterName, 'AstraVale');

  await assert.rejects(
    kickOnlineCharacter(10482, { reason: 'other', note: '' }, 'test-operator'),
    (error: unknown) => error instanceof KickOnlineError && error.status === 400,
  );
});
