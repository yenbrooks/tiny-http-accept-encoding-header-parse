# tiny-http-accept-encoding-header-parse

Parse an HTTP `Accept-Encoding` header into an ordered list of codings with
their quality factors.

```js
import { parseAcceptEncoding, selectEncoding } from './src/index.js';

const parsed = parseAcceptEncoding('br;q=0.5, gzip;q=0.9, deflate;q=0');
// [
//   { coding: 'gzip', quality: 0.9 },
//   { coding: 'br', quality: 0.5 },
//   { coding: 'deflate', quality: 0 },
// ]

selectEncoding(parsed, ['gzip', 'br']); // 'gzip'
selectEncoding(parsed, ['br']);          // 'br'
selectEncoding(parsed, ['deflate']);     // null
```

## Why this exists

The header is a comma-separated list where each coding may carry a `;q=`
weight, and a server has to answer a single question: which coding do I use?
The common shortcut is to scan for the first coding whose name matches
something the server supports, which silently ignores quality and the order
the client asked for. This library does the small amount of work required to
answer the question correctly, and nothing more.

The trade-off is that the parser is deliberately lenient rather than strict.
A malformed quality value such as `q=abc`, or a quality outside `[0, 1]`, is
clamped or defaulted instead of raising. A request pipeline should not fail
because one client sent a slightly wrong header; the cost is that the caller
cannot tell a malformed header apart from a well-formed one. If you need that
distinction, validate the raw header before calling `parseAcceptEncoding`.

## API

### `parseAcceptEncoding(header)`

Returns an array of `{ coding, quality }` objects sorted by descending
quality. Ties keep the order in which the codings appeared in the header,
which is the only ordering information the client supplied. Entries with
`quality: 0` are kept so callers can observe an explicit refusal. Duplicate
codings are preserved rather than merged. Empty segments caused by stray
commas are skipped. Throws `TypeError` if `header` is not a string.

### `selectEncoding(parsed, supported)`

Given the result of `parseAcceptEncoding` and an array of codings the caller
can produce, returns the coding name from the parsed list (original casing)
or `null` if none is acceptable. A coding is acceptable when its quality is
greater than zero and it appears in `supported`, case-insensitively.

`identity` is treated as always supported unless the caller lists it in
`supported`; that matches RFC 9110, which says identity is acceptable unless
explicitly refused with `identity;q=0`.

## The awkward edge

`identity` is the one coding that is acceptable even when it is not named in
the header. If you pass `['gzip']` as `supported` and the client sent
`gzip;q=0`, the result is `'identity'`, not `null`. If you do not want that
fallback, include `'identity'` in `supported` and the parser will honour the
client's explicit `identity;q=0` instead.
