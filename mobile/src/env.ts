/**
 * Build flavour. Sample screens and on-device "demo" requests exist for development and staging testing only;
 * a production build (App Store / Google Play) never shows them.
 * Staging builds set EXPO_PUBLIC_ENVIRONMENT=staging (mobile/eas.json "staging" profile, scripts/build-staging-previews.sh).
 */
export const PREVIEW_TOOLS:boolean=__DEV__||process.env.EXPO_PUBLIC_ENVIRONMENT==='staging';
