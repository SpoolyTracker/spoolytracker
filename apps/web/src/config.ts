declare global {
  interface Window {
    __SPOOLY_CONFIG__?: {
      API_PUBLIC_URL?: string;
      AI_ENGINE_PUBLIC_URL?: string;
      SELF_HOSTED?: string | boolean;
      GOOGLE_CLIENT_ID?: string;
      FIREBASE_URL?: string;
      APPSTORE_URL?: string;
      PLAYSTORE_URL?: string;
      DISCORD_URL?: string;
    };
  }
}

const runtimeConfig = window.__SPOOLY_CONFIG__ || {};

const truthy = (value: unknown) =>
  ['true', '1', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());

export const appConfig = {
  apiUrl:
    runtimeConfig.API_PUBLIC_URL ||
    import.meta.env.VITE_API_URL ||
    'http://localhost:3000',
  aiEngineUrl:
    runtimeConfig.AI_ENGINE_PUBLIC_URL ||
    import.meta.env.VITE_AI_ENGINE_URL ||
    'http://localhost:8000',
  selfHosted: truthy(runtimeConfig.SELF_HOSTED ?? import.meta.env.VITE_SELF_HOSTED),
  googleClientId:
    runtimeConfig.GOOGLE_CLIENT_ID || import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  firebaseUrl:
    runtimeConfig.FIREBASE_URL || import.meta.env.VITE_FIREBASE_URL || '',
  appStoreUrl:
    runtimeConfig.APPSTORE_URL || import.meta.env.VITE_APPSTORE_URL || '',
  playStoreUrl:
    runtimeConfig.PLAYSTORE_URL || import.meta.env.VITE_PLAYSTORE_URL || '',
  discordUrl:
    runtimeConfig.DISCORD_URL || import.meta.env.VITE_DISCORD_URL || '',
};

export const isSelfHostedMode = () => appConfig.selfHosted;
