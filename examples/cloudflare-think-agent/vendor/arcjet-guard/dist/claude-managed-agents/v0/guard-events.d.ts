import { ActorResolver, InputsResolver } from "../../agents/actor-inputs.js";
import { ArcjetMetadata } from "../../metadata.js";
import { Decision, RuleWithInput } from "../../types.js";
import { ArcjetAgentClient } from "../../agents/capture.js";
import { OnGuardError } from "../../agents/guard-action.js";
import { ClaudeManagedAgentsContext } from "./context.js";
import { EventSendBody, ManagedAgentsEventParams } from "./types.js";
//#region src/claude-managed-agents/v0/guard-events.d.ts
/**
 * Inbound screen applied to `user.message` events (including those sent as
 * `sessions.create({ initial_events })`) before `sessions.events.send`.
 */
export interface GuardEventsInbound {
  /** Guard label and capture action. Defaults to `"message.received"`. */
  action?: string;
  /**
   * Rules to evaluate. Omitting this, or returning `[]`, still submits a
   * guard call. The factory receives the concatenated `user.message` text.
   */
  rules?: RuleWithInput[] | ((input: {
    text: string;
    events: readonly ManagedAgentsEventParams[];
  }) => RuleWithInput[]);
  /**
   * Trusted actor identity, or a resolver over the inbound events. Derive it
   * from authenticated server-side context; never trust the message text as
   * the actor identity.
   */
  actor?: ActorResolver<[{
    text: string;
    events: readonly ManagedAgentsEventParams[];
  }]>;
  /**
   * Typed remote-policy inputs, or a resolver over the inbound events. Build
   * each value with {@link policyInput}.
   */
  inputs?: InputsResolver<[{
    text: string;
    events: readonly ManagedAgentsEventParams[];
  }]>;
  /** How to respond when guard evaluation is unavailable. Default `"deny"`. */
  onGuardError?: OnGuardError;
}
/**
 * Policy for `guardEvents()` — gate outbound `user.message` / `initial_events`
 * before the caller invokes `sessions.events.send` (or `sessions.create`).
 *
 * Generic over the event array so a caller who passes
 * `EventSendParams["events"]` gets that type back on `send`.
 */
export interface GuardEventsPolicy<TEvent extends ManagedAgentsEventParams = ManagedAgentsEventParams> {
  /** Events that would be sent if the gate allows. */
  events: readonly TEvent[];
  inbound: GuardEventsInbound;
  /**
   * Caller-owned correlation from `claudeManagedAgentsContext`. Never an
   * Anthropic session or event id.
   */
  context?: ClaudeManagedAgentsContext;
  /** Metadata merged over the context's. */
  metadata?: ArcjetMetadata;
}
/**
 * Verdict from `guardEvents()`. `allowed: true` means `send` already ran.
 */
export type GuardEventsResult<T> = {
  allowed: true;
  sent: T;
} | {
  allowed: false;
  outcome: "DENY" | "UNAVAILABLE";
  message: string;
  decision?: Decision;
};
/**
 * Gate `user.message` / `initial_events` **before** `sessions.events.send`.
 *
 * Anthropic runs the hosted tool loop. There is no PreToolUse. This helper
 * screens the text the app is about to send; on DENY (or a fail-closed
 * outage) `user.message` events are not sent.
 *
 * Events that are not `user.message` (interrupt, custom_tool_result, …)
 * pass through without an inbound screen — they are not a user turn.
 * A mixed batch that includes a `user.message` still forwards those
 * non-message events when the turn is denied, so a batched
 * `user.custom_tool_result` does not leave the session idle.
 *
 * Default `always_allow` on Anthropic-cloud bash/read/write **cannot** be
 * gated here. `web_search` / `web_fetch` always run on Anthropic.
 *
 * @example
 * ```ts
 * import { launchArcjet, detectPromptInjection } from "@arcjet/guard";
 * import {
 *   claudeManagedAgentsContext,
 *   guardEvents,
 * } from "@arcjet/guard/claude-managed-agents/v0";
 *
 * const arcjet = launchArcjet({ key: process.env["ARCJET_KEY"]! });
 * const events = [
 *   { type: "user.message" as const, content: [{ type: "text" as const, text }] },
 * ];
 *
 * const verdict = await guardEvents(
 *   arcjet,
 *   {
 *     events,
 *     inbound: {
 *       action: "message.received",
 *       rules: ({ text }) => [detectPromptInjection()(text)],
 *     },
 *     context: claudeManagedAgentsContext({ correlationId: conversationId }),
 *   },
 *   (body) => client.beta.sessions.events.send(session.id, body),
 * );
 *
 * if (!verdict.allowed) {
 *   return verdict.message;
 * }
 * ```
 */
export declare function guardEvents<T, TEvent extends ManagedAgentsEventParams = ManagedAgentsEventParams>(client: ArcjetAgentClient, policy: GuardEventsPolicy<TEvent>, send: (body: EventSendBody<TEvent>) => Promise<T>): Promise<GuardEventsResult<T>>;
//#endregion