declare namespace NodeJS {
  export interface ProcessEnv {
    readonly ARCJET_KEY: string;
    readonly AI_GATEWAY_API_KEY?: string;
    readonly OPENAI_API_KEY?: string;
    readonly STRANDS_MODEL?: string;
    readonly PORT?: string;
    readonly ARCJET_LOG_LEVEL?: string;
  }
}
