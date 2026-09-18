declare namespace NodeJS {
  export interface ProcessEnv {
    readonly ARCJET_KEY: string;
    readonly PORT?: string;
    readonly ARCJET_LOG_LEVEL?: string;
    readonly CLOUDFLARE_THINK_MODEL?: string;
  }
}

interface Env {
  readonly ARCJET_KEY: string;
}
