import { ArcjetMetadata } from "../metadata.js";
import "../types.js";
//#region src/agents/vocabulary.d.ts
/**
 * Security dimensions passed to guard evaluations.
 *
 * Optional metadata fields (key-value pairs) attached to tool calls and actions
 * for audit, policy decisions, and observability. Values are suggestions where
 * noted; at runtime, any string is accepted. Arcjet's guard enforces server-side
 * limits on the number of keys, key length, and value serialization size, so
 * large or deeply nested maps may be dropped server-side — see the Metadata
 * section of the `@arcjet/guard` README for current limits.
 *
 * Thread via `securityMetadata()` or merge directly into `ArcjetAgentContext.metadata`.
 */
interface SecurityMetadataFields {
  /**
   * Whose authority the agent acts under (opaque ID, not PII).
   */
  user?: string;
  /**
   * Type or identity of the AI agent performing the action.
   */
  agent?: string;
  /**
   * Workflow stage or process name this request belongs to.
   */
  workflow?: string;
  /**
   * Data classification level (suggested: public, internal, confidential, regulated).
   */
  dataClass?: string;
  /**
   * Where the result or action is sent (service, system, user, external).
   */
  destination?: string;
  /**
   * Whether the action can be reversed (suggested: reversible, compensable, irreversible).
   */
  reversibility?: string;
  /**
   * Resource identifier affected by this action.
   */
  resource?: string;
}
/**
 * Map security metadata fields to their wire keys for Arcjet guard evaluation.
 *
 * Each field's value is passed through unchanged (type unions are suggestions,
 * not runtime validation). Undefined fields are omitted; empty strings you pass
 * are kept.
 *
 * @param fields - Security metadata dimensions
 * @returns A record mapping wire keys to string values, ready for guard context
 *
 * @example
 * ```ts
 * import { createAgentContext, securityMetadata } from "@arcjet/guard/vercel-ai/v7";
 *
 * const ctx = createAgentContext({
 *   correlationId: "req_12345",
 *   metadata: securityMetadata({
 *     user: "user_alice",
 *     dataClass: "confidential",
 *     destination: "audit_service",
 *   }),
 * });
 * // → context has metadata: { user: "user_alice", "data-class": "confidential", destination: "audit_service" }
 * ```
 */
declare function securityMetadata(fields: SecurityMetadataFields): ArcjetMetadata;
//#endregion
export { SecurityMetadataFields, securityMetadata };