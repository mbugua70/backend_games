import { webcrypto } from "node:crypto";

/**
 * The mongodb driver's SCRAM auth reads globalThis.crypto directly. Some
 * hosting environments run a Node build/version where that global isn't
 * exposed, causing "ReferenceError: crypto is not defined" during the
 * Atlas handshake. Must be imported before anything that touches mongoose.
 */
if (!globalThis.crypto) {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto });
}
