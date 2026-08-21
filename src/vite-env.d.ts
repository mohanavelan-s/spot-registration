/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly OFFLINE_REGISTRATION_SHEET_ID?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly [key: string]: any;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
