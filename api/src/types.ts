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
  OWNER_SETUP_KEY?: string      // secret, 24+ random chars: lets the owner enrol their authenticator app once
  WEBAUTHN_RP_ID?: string       // e.g. ops.example.com (defaults to the request host)
  WEBAUTHN_ORIGINS?: string     // e.g. https://ops.example.com (comma separated; defaults to the request origin)
  SCANNER_MODE?: string         // 'fake-test' enables the explicit test scanner (ignored in production); anything else = no scanner
  GOV_PAY_HOSTS?: string        // extra allowed suffixes for official payment links, e.g. ".rta.ae,.dubaipolice.gov.ae" (default: .gov.ae)
  COMPANY_NAME_AR?: string
  COMPANY_NAME_EN?: string
  OWNER_PHONE?: string          // E.164; the first sign-in with this number creates the owner account
  WA_BUSINESS_NUMBER?: string   // digits only, e.g. 9715XXXXXXXX
  WA_APP_SECRET?: string        // Meta app secret (signs webhooks)
  WA_VERIFY_TOKEN?: string      // any random string you also enter in Meta's webhook setup
  WA_TOKEN?: string             // optional: lets us send a free confirmation reply
  WA_PHONE_NUMBER_ID?: string   // optional, needed with WA_TOKEN
  WA_OTP_TEMPLATE?: string      // name of the approved WhatsApp *authentication* template (paid by Meta per message)
  WA_GRAPH_BASE?: string        // defaults to https://graph.facebook.com/v21.0 (override only for local tests)
}
export type Vars = { userId: string; sessionId: string; staffId: string; staffRole: 'owner' | 'manager' | 'agent' | 'accountant' }
