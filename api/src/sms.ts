import type { Env } from './types'

/** Delivers the OTP. In production a missing provider is a hard failure, never a silent skip. */
export async function sendOtp(env: Env, phone: string, code: string, lang: 'ar' | 'en'): Promise<boolean> {
  const body = lang === 'ar'
    ? `رمز التحقق من تروثفل برو: ${code}. صالح لمدة 5 دقائق. لا تشاركه مع أحد.`
    : `Your TRUTHFUL PRO verification code is ${code}. Valid for 5 minutes. Do not share it.`
  if (env.TWILIO_SID && env.TWILIO_TOKEN && env.TWILIO_FROM) {
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_SID}/Messages.json`, {
      method: 'POST',
      headers: { authorization: 'Basic ' + btoa(`${env.TWILIO_SID}:${env.TWILIO_TOKEN}`), 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: phone, From: env.TWILIO_FROM, Body: body }),
    })
    return r.ok
  }
  return env.ENVIRONMENT !== 'production' && env.DEV_OTP_ECHO === '1'
}

/** Sends a login code through an approved WhatsApp authentication template (Meta bills the business for these). */
export async function sendWhatsAppCode(env: Env, toDigits: string, code: string, lang: 'ar' | 'en'): Promise<boolean> {
  if (!env.WA_TOKEN || !env.WA_PHONE_NUMBER_ID || !env.WA_OTP_TEMPLATE) return false
  try {
    const r = await fetch(`${env.WA_GRAPH_BASE ?? 'https://graph.facebook.com/v21.0'}/${env.WA_PHONE_NUMBER_ID}/messages`, {
      method: 'POST', headers: { authorization: `Bearer ${env.WA_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp', to: toDigits, type: 'template',
        template: { name: env.WA_OTP_TEMPLATE, language: { code: lang }, components: [
          { type: 'body', parameters: [{ type: 'text', text: code }] },
          { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
        ] },
      }),
    })
    return r.ok
  } catch { return false }
}
