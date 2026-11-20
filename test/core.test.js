import test from 'node:test';
import assert from 'node:assert/strict';

import { parseAcceptEncoding, selectEncoding } from '../src/index.js';

test('parses a single coding', () => {
  assert.deepEqual(parseAcceptEncoding('gzip'), [{ coding: 'gzip', quality: 1 }]);
});

test('parses explicit quality values', () => {
  assert.deepEqual(parseAcceptEncoding('gzip;q=0.5, deflate;q=0.8'), [
    { coding: 'deflate', quality: 0.8 },
    { coding: 'gzip', quality: 0.5 },
  ]);
});

test('sorts by descending quality and keeps header order on ties', () => {
  assert.deepEqual(parseAcceptEncoding('br;q=0.5, gzip;q=0.9, deflate;q=0.5'), [
    { coding: 'gzip', quality: 0.9 },
    { coding: 'br', quality: 0.5 },
    { coding: 'deflate', quality: 0.5 },
  ]);
});

test('keeps q=0 entries so callers can see explicit refusals', () => {
  assert.deepEqual(parseAcceptEncoding('gzip;q=0, deflate'), [
    { coding: 'deflate', quality: 1 },
    { coding: 'gzip', quality: 0 },
  ]);
});

test('drops empty segments from stray commas', () => {
  assert.deepEqual(parseAcceptEncoding(', gzip ,, deflate ,'), [
    { coding: 'gzip', quality: 1 },
    { coding: 'deflate', quality: 1 },
  ]);
});

test('ignores unknown parameters but honours q', () => {
  assert.deepEqual(parseAcceptEncoding('gzip;level=9;q=0.4'), [
    { coding: 'gzip', quality: 0.4 },
  ]);
});

test('clamps out-of-range quality values', () => {
  assert.deepEqual(parseAcceptEncoding('gzip;q=2, deflate;q=-1'), [
    { coding: 'gzip', quality: 1 },
    { coding: 'deflate', quality: 0 },
  ]);
});

test('treats unparsable quality as 1 rather than throwing', () => {
  assert.deepEqual(parseAcceptEncoding('gzip;q=abc'), [{ coding: 'gzip', quality: 1 }]);
});

test('preserves duplicate codings', () => {
  assert.deepEqual(parseAcceptEncoding('gzip;q=0.3, gzip;q=0.9'), [
    { coding: 'gzip', quality: 0.9 },
    { coding: 'gzip', quality: 0.3 },
  ]);
});

test('returns an empty list for an empty header', () => {
  assert.deepEqual(parseAcceptEncoding(''), []);
});

test('rejects non-string input', () => {
  assert.throws(() => parseAcceptEncoding(null), TypeError);
});

test('selects the highest-quality supported coding', () => {
  const parsed = parseAcceptEncoding('br;q=0.5, gzip;q=0.9');
  assert.equal(selectEncoding(parsed, ['gzip', 'br']), 'gzip');
});

test('skips codings the caller cannot produce', () => {
  const parsed = parseAcceptEncoding('br;q=0.9, gzip;q=0.5');
  assert.equal(selectEncoding(parsed, ['gzip']), 'gzip');
});

test('returns null when nothing is acceptable', () => {
  const parsed = parseAcceptEncoding('gzip;q=0, deflate;q=0');
  assert.equal(selectEncoding(parsed, ['gzip', 'deflate']), null);
});

test('treats identity as acceptable unless explicitly listed', () => {
  const parsed = parseAcceptEncoding('gzip;q=0, identity;q=0.5');
  assert.equal(selectEncoding(parsed, ['gzip']), 'identity');
});

test('respects an explicit refusal of identity', () => {
  const parsed = parseAcceptEncoding('gzip;q=0, identity;q=0');
  assert.equal(selectEncoding(parsed, ['gzip', 'identity']), null);
});

test('matches supported codings case-insensitively', () => {
  const parsed = parseAcceptEncoding('GZIP');
  assert.equal(selectEncoding(parsed, ['gzip']), 'GZIP');
});
