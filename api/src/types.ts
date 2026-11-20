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
}
export type Vars = { userId: string; sessionId: string }
