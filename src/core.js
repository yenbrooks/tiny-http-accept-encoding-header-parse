/**
 * Parser for the HTTP `Accept-Encoding` request header (RFC 9110 section 12.5.3).
 *
 * The header is a comma-separated list of content codings, each of which may
 * carry a `;q=` weight. We return the codings sorted by descending quality,
 * with a stable tie-break on the order they appeared in the header. That keeps
 * the output deterministic even though the RFC only requires that the relative
 * order of equal-quality codings be preserved by a sender.
 */

/**
 * Parse a quality value as defined by RFC 9110 section 12.4.2.
 *
 * The grammar allows up to three decimal places. Values outside [0, 1] are
 * not valid qvalues; we clamp rather than throw so that a malformed header
 * still yields a usable list instead of an exception at the edge of a request
 * pipeline. `q=0` is meaningful ("not acceptable") so it is kept, not dropped.
 *
 * @param {string} raw
 * @returns {number}
 */
function parseQuality(raw) {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return 1;
  }
  const value = Number(trimmed);
  if (Number.isNaN(value)) {
    return 1;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

/**
 * Split the header on commas, ignoring empty segments produced by stray
 * commas, and trim surrounding whitespace from each segment.
 *
 * @param {string} header
 * @returns {string[]}
 */
function splitSegments(header) {
  const segments = [];
  for (const part of header.split(',')) {
    const trimmed = part.trim();
    if (trimmed !== '') {
      segments.push(trimmed);
    }
  }
  return segments;
}

/**
 * Parse an `Accept-Encoding` header value into an ordered list of codings.
 *
 * Each entry is `{ coding, quality }`. The list is sorted by descending
 * quality. Ties keep the original header order, which is the only ordering
 * information the sender gave us. Duplicate codings are preserved rather than
 * merged: the header grammar does not forbid them, and collapsing them would
 * silently discard information the caller might want to inspect.
 *
 * @param {string} header
 * @returns {{coding: string, quality: number}[]}
 */
export function parseAcceptEncoding(header) {
  if (typeof header !== 'string') {
    throw new TypeError('header must be a string');
  }

  const entries = [];
  const segments = splitSegments(header);

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const parts = segment.split(';');
    const coding = parts[0].trim();
    if (coding === '') {
      continue;
    }

    let quality = 1;
    for (let partIndex = 1; partIndex < parts.length; partIndex += 1) {
      const parameter = parts[partIndex].trim();
      if (parameter === '') {
        continue;
      }
      const eq = parameter.indexOf('=');
      if (eq === -1) {
        continue;
      }
      const name = parameter.slice(0, eq).trim().toLowerCase();
      if (name !== 'q') {
        continue;
      }
      quality = parseQuality(parameter.slice(eq + 1));
    }

    entries.push({ coding, quality, order: index });
  }

  entries.sort((a, b) => {
    if (b.quality !== a.quality) {
      return b.quality - a.quality;
    }
    return a.order - b.order;
  });

  return entries.map(({ coding, quality }) => ({ coding, quality }));
}

/**
 * Pick the best coding from a parsed list, given a set of codings the caller
 * is willing to produce. The first acceptable entry in quality order wins.
 *
 * A coding is acceptable when it is present in `supported` and its quality is
 * greater than zero. `identity` is treated as always supported unless the
 * caller explicitly listed it in `supported`, because RFC 9110 says identity
 * is acceptable unless explicitly refused with `identity;q=0`.
 *
 * @param {{coding: string, quality: number}[]} parsed
 * @param {string[]} supported
 * @returns {string | null}
 */
export function selectEncoding(parsed, supported) {
  if (!Array.isArray(parsed)) {
    throw new TypeError('parsed must be an array');
  }
  if (!Array.isArray(supported)) {
    throw new TypeError('supported must be an array');
  }

  const supportedSet = new Set(supported.map((value) => String(value).toLowerCase()));
  const identityExplicitlyListed = supportedSet.has('identity');

  for (const entry of parsed) {
    const coding = String(entry.coding).toLowerCase();
    if (entry.quality <= 0) {
      continue;
    }
    if (supportedSet.has(coding)) {
      return entry.coding;
    }
    if (coding === 'identity' && !identityExplicitlyListed) {
      return entry.coding;
    }
  }

  return null;
}
