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
