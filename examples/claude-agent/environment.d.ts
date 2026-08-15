declare namespace NodeJS {
  export interface ProcessEnv {
    readonly ARCJET_KEY: string;
    readonly ANTHROPIC_API_KEY?: string;
    readonly CLAUDE_MODEL?: string;
    readonly PORT?: string;
  }
}
