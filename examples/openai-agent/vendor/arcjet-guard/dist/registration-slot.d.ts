import { ArcjetGuard } from "./index.js";
//#region src/registration-slot.d.ts
/**
 * What actually goes in the global slot.
 *
 * The client is wrapped rather than stored bare so the version travels with it,
 * and so registering never has to mutate an object the caller owns.
 *
 * @internal
 */
type Registration = {
  version: string;
  client: ArcjetGuard;
};
/**
 * Whether a registration was written by this exact build of the SDK.
 *
 * `Symbol.for` is realm-wide, so the slot is shared by every copy of
 * `@arcjet/guard` in the process — including copies at other versions, which is
 * the normal outcome of one dependency pinning a different range than another.
 * What is stored is a live object, and its usable surface is more than the three
 * public methods: the diagnostics symbol, the decision shape, and the internal
 * symbols on it are only guaranteed within a single build.
 *
 * So the check is exact string equality, not a range. A copy that finds a
 * registration it did not write treats it as absent and fails open, which is the
 * same degradation as nothing being registered at all. The cost is that two
 * versions in one process do not share a client — each keeps whatever it
 * registered, and the one that lost the race fails open rather than calling into
 * a shape it cannot verify.
 *
 * @internal
 */
declare function isCurrentVersion(registration: Registration): boolean;
/**
 * Read and validate whatever is in the global slot.
 *
 * Validated on the way out, not only on the way in. The slot lives on
 * `globalThis` under a well-known symbol, so anything in the process can write
 * to it — a `null`, a half-built value, or a record from a version whose shape
 * this build cannot vouch for. Any of those reaching a call site would surface
 * as a TypeError thrown from `capture()` deep in application code, which is what
 * the never-throw contract exists to prevent.
 *
 * Returns the record regardless of version so callers can tell "nothing is
 * registered" from "another version registered", which need different handling:
 * the first is a free slot, the second is somebody else's.
 *
 * @internal
 */
declare function readRegistration(): Registration | undefined;
/**
 * The registered client, if this build wrote it.
 *
 * @internal
 */
declare function registeredClient(): ArcjetGuard | undefined;
/**
 * Stamp a client with this build's version and put it in the slot.
 *
 * @internal
 */
declare function writeRegistration(client: ArcjetGuard): void;
/** Empty the slot. @internal */
declare function clearRegistration(): void;
/**
 * Whether the slot holds anything at all, valid or not.
 *
 * Deliberately unvalidated, unlike {@link readRegistration}. The test-only
 * registration uses this to detect a leak from an earlier test, and a record
 * this build cannot parse is just as much a leak as one it can.
 *
 * @internal
 */
declare function hasRegistration(): boolean;
/**
 * Whether a value can actually serve the free calls.
 *
 * Structural rather than an instance check, because the test client and
 * hand-rolled fakes are legitimate registrations and none of them are built by
 * `launchArcjet()`.
 *
 * @internal
 */
declare function isClient(value: unknown): value is ArcjetGuard;
//#endregion
export { Registration, clearRegistration, hasRegistration, isClient, isCurrentVersion, readRegistration, registeredClient, writeRegistration };