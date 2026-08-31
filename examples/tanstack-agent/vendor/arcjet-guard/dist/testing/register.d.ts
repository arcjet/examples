import { ArcjetGuard } from "../index.js";
//#region src/testing/register.d.ts
/**
 * Register a client, refusing to displace or share with an incumbent.
 *
 * The test client uses this instead of `registerArcjet()` because the failure
 * modes invert under test. In an application a second registration should be
 * survivable, so it warns and carries on. In a test suite a client left
 * registered by an earlier test is a leak that makes the current test assert
 * against the wrong recorder — quietly, and usually somewhere else. So this
 * throws.
 *
 * The check is deliberately unvalidated: anything in the slot is a leak,
 * including a record written by another version of the SDK, which
 * `registeredClient()` would report as absent.
 *
 * @internal
 */
declare function registerArcjetForTesting(client: ArcjetGuard): void;
//#endregion
export { registerArcjetForTesting };