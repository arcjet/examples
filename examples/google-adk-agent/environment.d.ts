declare namespace NodeJS {
  export interface ProcessEnv {
    readonly ARCJET_KEY: string;
    readonly GOOGLE_GENAI_API_KEY?: string;
    readonly GOOGLE_API_KEY?: string;
    readonly GEMINI_API_KEY?: string;
    readonly GOOGLE_ADK_MODEL?: string;
    readonly PORT?: string;
    readonly ARCJET_LOG_LEVEL?: string;
  }
}
