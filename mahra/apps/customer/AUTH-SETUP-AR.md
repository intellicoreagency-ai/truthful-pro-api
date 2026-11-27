# تشغيل الدخول الفعلي (Google وApple والبصمة)

الكود جاهز خلف أعلام. كل طريقة تُفعَّل بمتغير `EXPO_PUBLIC_AUTH_LIVE` بعد اختبارها على جهاز مدعوم، مثال: `EXPO_PUBLIC_AUTH_LIVE=google` ثم `google,apple` ثم `google,apple,biometric`.

## ما يجب إعداده (الإجراءات منك)
1. **مشروع Supabase** (لم يُنشأ بعد). بعد إنشائه: `EXPO_PUBLIC_SUPABASE_URL` و`EXPO_PUBLIC_SUPABASE_ANON_KEY` (المفتاح العام فقط).
2. **Supabase ← Authentication ← URL Configuration ← Redirect URLs**: أضف `mohra://auth/callback`.
3. **Google**: Google Cloud Console ← APIs & Services ← OAuth consent screen (أكمله)، ثم Credentials ← Create credentials ← OAuth client ID ← Web application، وفي Authorized redirect URIs ضع `https://<PROJECT_REF>.supabase.co/auth/v1/callback`. انسخ Client ID وSecret إلى Supabase ← Authentication ← Providers ← Google ← Enable.
4. **Apple** (يحتاج عضوية Apple Developer): Certificates, Identifiers & Profiles ← Identifiers ← App ID بخاصية Sign in with Apple. في Supabase ← Providers ← Apple ضع معرّف التطبيق (Bundle ID) في Client IDs. لتسجيل Apple خارج iOS أضف Services ID ومفتاح `.p8` وTeam ID وKey ID.
5. **معرّفات التطبيق** (دائمة): `ios.bundleIdentifier` و`android.package` في `app.json` غير محدَّدين بعد.
6. **بناء تطوير على الجهاز**: `eas build --profile development`؛ لا يكفي Expo Go لـApple الأصلي وFace ID.

## الأسرار
لا أسرار في التطبيق. أسرار Google/Apple تُحفظ في إعدادات Supabase فقط.

## الاختبار الذي أُجري بلا جهاز
`node --experimental-strip-types mahra/tools/auth-tests/oauth-parse.test.mts` يتحقق من قراءة رجوع المزوّد وتمييز الإلغاء.
