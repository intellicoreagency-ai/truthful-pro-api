/** يقرأ رابط العودة من المزوّد: code عند النجاح، أو error عند الرفض/الإلغاء من جهة المزوّد. */
export function parseCallback(url: string): { code?: string; error?: string } {
  const u = new URL(url);
  const q = u.searchParams;
  const h = new URLSearchParams(u.hash.startsWith('#') ? u.hash.slice(1) : u.hash);
  const error = q.get('error_description') ?? q.get('error') ?? h.get('error_description') ?? h.get('error') ?? undefined;
  return { code: q.get('code') ?? undefined, error };
}

/** هل رسالة المزوّد تعني إلغاءً/رفضاً من المستخدم (لا خطأ تقني)؟ */
export const isUserCancel = (message: string): boolean => /cancel|denied|access_denied/i.test(message);
