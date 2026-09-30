import assert from 'node:assert/strict';
import test from 'node:test';
import { parseInstallOffer, shouldShowInstallOffer, snoozeInstallOffer } from '../lib/pwa-install.ts';

const now = Date.parse('2026-09-25T12:00:00Z');
const day = 24 * 60 * 60 * 1000;

test('install offer shows until the visitor dismisses it', () => {
  assert.equal(shouldShowInstallOffer(null, now), true);
  assert.equal(shouldShowInstallOffer(parseInstallOffer('nope'), now), true);
  assert.equal(shouldShowInstallOffer(parseInstallOffer('{"snoozeUntil":null,"dismissals":1}'), now), true);
});

test('the first later hides the offer for 7 days', () => {
  const next = snoozeInstallOffer(null, now);
  assert.equal(shouldShowInstallOffer(next, now + 6 * day), false);
  assert.equal(shouldShowInstallOffer(next, now + 8 * day), true);
});

test('the third later waits 90 days', () => {
  const twice = snoozeInstallOffer(snoozeInstallOffer(null, now), now);
  const third = snoozeInstallOffer(twice, now);
  assert.equal(third.dismissals, 3);
  assert.equal(shouldShowInstallOffer(third, now + 80 * day), false);
  assert.equal(shouldShowInstallOffer(third, now + 91 * day), true);
});
