/**
 * Public entry point for tiny-http-accept-encoding-header-parse.
 *
 * Keeping the barrel file separate from core.js means consumers can import
 * from the package root without pulling in the test tree, and it gives us a
 * single place to document the public surface.
 */
export { parseAcceptEncoding, selectEncoding } from './core.js';
