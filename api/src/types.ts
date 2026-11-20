export interface Env {
  DB: D1Database
  DOCS: R2Bucket
  ENVIRONMENT: string
  OTP_TTL_SECONDS?: string
  PEPPER: string
  DATA_KEY: string
  TWILIO_SID?: string
  TWILIO_TOKEN?: string
  TWILIO_FROM?: string
  DEV_OTP_ECHO?: string
  ALLOWED_ORIGINS?: string
  WA_BUSINESS_NUMBER?: string   // digits only, e.g. 9715XXXXXXXX
  WA_APP_SECRET?: string        // Meta app secret (signs webhooks)
  WA_VERIFY_TOKEN?: string      // any random string you also enter in Meta's webhook setup
  WA_TOKEN?: string             // optional: lets us send a free confirmation reply
  WA_PHONE_NUMBER_ID?: string   // optional, needed with WA_TOKEN
}
export type Vars = { userId: string; sessionId: string }
