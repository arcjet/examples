import { ActorResolver, InputsResolver } from "../../agents/actor-inputs.js";
import { ArcjetMetadata } from "../../metadata.js";
import { RuleWithInput } from "../../types.js";
import { ArcjetAgentClient } from "../../agents/capture.js";
import { OnGuardError } from "../../agents/guard-action.js";
import { MastraRequestContextLike } from "./context.js";
import { ProcessInputArgs, ProcessInputResult, ProcessInputStepArgs, ProcessInputStepResult, ProcessOutputResultArgs, Processor } from "@mastra/core/processors";
//#region src/mastra/v1/guard-processor.d.ts
/**
 * Text and context passed to `rules` / `metadata` callbacks on `guardProcessor`.
 */
export interface GuardProcessorInput {
  /** Concatenated text from the messages being screened. */
  text: string;
  /** The processor-stage messages (user/assistant, not system). */
  messages: unknown[];
  requestContext?: MastraRequestContextLike;
}
/**
 * Policy for `guardProcessor()` — a Mastra `Processor` for `inputProcessors`
 * and `outputProcessors`.
 */
export interface GuardProcessorPolicy {
  /** Guard label and capture action: `"resource.verb"`, past tense. */
  action: string;
  /**
   * Processor `id`. Defaults to `"arcjet-guard"`. Required by Mastra's
   * `Processor` interface.
   */
  id?: string;
  /** Optional display name. Defaults to `"Arcjet Guard"`. */
  name?: string;
  /**
   * Rules to evaluate, static or computed from the extracted text. Omitting
   * this still performs the guard call.
   */
  rules?: RuleWithInput[] | ((input: GuardProcessorInput) => RuleWithInput[]);
  /**
   * Trusted actor identity, or a resolver `(input, requestContext) => …`
   * matching Mastra processor args. Derive it from `requestContext`; never
   * trust model-produced text as the actor identity.
   */
  actor?: ActorResolver<[GuardProcessorInput, MastraRequestContextLike?]>;
  /**
   * Typed remote-policy inputs, or a resolver `(input, requestContext) => …`.
   * Build each value with {@link policyInput}.
   */
  inputs?: InputsResolver<[GuardProcessorInput, MastraRequestContextLike?]>;
  /** Metadata merged over the derived Mastra context. */
  metadata?: ArcjetMetadata | ((input: GuardProcessorInput) => ArcjetMetadata);
  /** How to respond when guard evaluation is unavailable. Default `"deny"`. */
  onGuardError?: OnGuardError;
}
/**
 * Mastra `Processor` that screens input (and optionally output) with Arcjet.
 *
 * On DENY, calls `abort(reason)` so Mastra raises a tripwire and the turn
 * stops. Channels already run through `processInput`, so there is no separate
 * `guardInbound`.
 *
 * @example
 * ```ts
 * import { launchArcjet, detectPromptInjection } from "@arcjet/guard";
 * import { guardProcessor } from "@arcjet/guard/mastra/v1";
 * import { Agent } from "@mastra/core/agent";
 *
 * const arcjet = launchArcjet({ key: process.env["ARCJET_KEY"]! });
 *
 * const inbound = guardProcessor(arcjet, {
 *   action: "message.received",
 *   rules: ({ text }) => [detectPromptInjection()(text)],
 * });
 *
 * export const agent = new Agent({
 *   id: "support-agent",
 *   name: "support-agent",
 *   instructions: "Help the user.",
 *   model: "openai/gpt-4o",
 *   inputProcessors: [inbound],
 * });
 * ```
 */
/**
 * Processor returned by `guardProcessor()`. `processInput` and
 * `processOutputResult` are required so the value is assignable to Mastra's
 * `inputProcessors` / `outputProcessors` unions (those require one of the
 * phase methods, which a bare `Processor` does not).
 */
export type GuardProcessor = Processor & {
  readonly id: string;
  processInput: (args: ProcessInputArgs) => Promise<ProcessInputResult>;
  processInputStep: (args: ProcessInputStepArgs) => Promise<ProcessInputStepResult | ProcessInputStepArgs["messages"]>;
  processOutputResult: (args: ProcessOutputResultArgs) => Promise<ProcessOutputResultArgs["messages"]>;
};
export declare function guardProcessor(client: ArcjetAgentClient, policy: GuardProcessorPolicy): GuardProcessor;
//#endregion