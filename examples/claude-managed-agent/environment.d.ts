declare namespace NodeJS {
  export interface ProcessEnv {
    readonly ARCJET_KEY: string;
    readonly ANTHROPIC_API_KEY: string;
    readonly CLAUDE_MANAGED_AGENT_ID?: string;
    readonly CLAUDE_MANAGED_ENVIRONMENT_ID?: string;
    readonly CLAUDE_MANAGED_MODEL?: string;
    readonly PORT?: string;
    readonly ARCJET_LOG_LEVEL?: string;
  }
}
