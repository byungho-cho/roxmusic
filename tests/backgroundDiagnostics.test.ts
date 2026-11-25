import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backgroundEvents, recordBackground } from '../src/backgroundDiagnostics';

test('diagnostics retain only 100 snapshots and callers cannot mutate stored entries', () => {
  for (let position = 0; position < 105; position++) recordBackground('timer_sample', { position });
  const events = backgroundEvents();
  assert.equal(events.length, 100);
  const first = events[0];
  assert.ok(first);
  assert.equal(first.position, 5);
  assert.equal(events[99]?.position, 104);
  first.position = -1;
  assert.equal(backgroundEvents()[0]?.position, 5);
  assert.equal(first.hidden, false);
});
