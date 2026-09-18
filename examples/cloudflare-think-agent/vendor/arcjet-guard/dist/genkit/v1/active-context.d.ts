//#region src/genkit/v1/active-context.d.ts
/**
 * Attach the ALS generate context onto a tool-call options / middleware
 * `ctx` object when that object does not already carry `context`.
 */
export declare function withActiveGenkitContext(options: unknown): Promise<unknown>;
//#endregion