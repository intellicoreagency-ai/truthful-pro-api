import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { I18nProvider } from '../src/i18n'
import { RequestDetail } from '../src/RequestDetail'
import { RID, detail, fakeServer, finance } from './fakeApi'
import type { Detail, Role } from '../src/api'

const D = `/staff/v1/requests/${RID}`
const show = (role: Role, d: Detail, fin = finance(), meId = 'staff-1') => {
  const srv = fakeServer({ [`GET ${D}`]: d, [`GET ${D}/finance`]: fin })
  render(<I18nProvider><RequestDetail id={RID} me={{ id: meId, role }} back={() => {}} /></I18nProvider>)
  return srv
}
const btn = (name: string | RegExp) => screen.findAllByRole('button', { name }).then((x) => x[0]!)

beforeEach(() => { try { localStorage.setItem('tp.lang', 'ar') } catch { /* */ } vi.spyOn(window, 'confirm').mockReturnValue(true) })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('assignment', () => {
  it('"Assign to me" sends this staff member and the version the page was loaded with', async () => {
    const srv = show('agent', detail())
    fireEvent.click(await btn('إسناد إليّ'))
    await waitFor(() => expect(srv.posts('/assign')).toHaveLength(1))
    expect(srv.posts('/assign')[0]!.body).toEqual({ staffId: 'staff-1', expectedVersion: 3 })
  })
  it('when the request is mine, it offers Release (unassign) instead', async () => {
    const srv = show('agent', detail({ assigneeId: 'staff-1' }))
    fireEvent.click(await btn('إلغاء الإسناد'))
    await waitFor(() => expect(srv.posts('/assign')[0]?.body).toMatchObject({ staffId: null }))
    expect(screen.queryByRole('button', { name: 'إسناد إليّ' })).toBeNull()
  })
})

describe('permissions', () => {
  it('only the owner and managers see the override panel', async () => {
    for (const role of ['owner', 'manager'] as Role[]) { show(role, detail()); expect(await screen.findByText('تجاوز (Override)')).toBeTruthy(); cleanup() }
    for (const role of ['agent', 'accountant'] as Role[]) { show(role, detail()); await btn('إسناد إليّ'); expect(screen.queryByText('تجاوز (Override)')).toBeNull(); cleanup() }
  })
  it('an agent may draft a quotation but cannot send it; an accountant can', async () => {
    const withDraft = finance({ quotes: [{ id: 'q1', version: 1, status: 'draft', number: null, invoiceNumber: null, total_fils: 50000, items: [{ kind: 'service_fee', description_ar: 'أتعاب', description_en: 'Fee', amount_fils: 50000 }], accepted_at: null, declined_at: null, decline_reason: null }] })
    show('agent', detail({ status: 'review' }), withDraft)
    expect(await btn('حفظ المسودة')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'إرسال عرض السعر للعميل للموافقة' })).toBeNull()
    cleanup()
    show('accountant', detail({ status: 'review' }), withDraft)
    expect(await btn('إرسال عرض السعر للعميل للموافقة')).toBeTruthy()
  })
})

describe('missing documents', () => {
  it('cannot be sent until both names are filled; sends the items with the loaded version', async () => {
    const srv = show('agent', detail({ status: 'review' }))
    const send = await btn('إرسال الطلب')
    expect((send as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('اسم المستند (عربي)'), { target: { value: 'صورة الإقامة' } })
    fireEvent.change(screen.getByLabelText('اسم المستند (إنجليزي)'), { target: { value: 'Residence copy' } })
    fireEvent.change(screen.getByLabelText('ملاحظة للعميل (اختيارية)'), { target: { value: 'غير واضحة' } })
    expect((send as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(send)
    await waitFor(() => expect(srv.posts('/missing')).toHaveLength(1))
    expect(srv.posts('/missing')[0]!.body).toEqual({ items: [{ labelAr: 'صورة الإقامة', labelEn: 'Residence copy', noteAr: 'غير واضحة', noteEn: 'غير واضحة' }], expectedVersion: 3 })
  })
  it('is not offered when the request cannot move to "needs documents"', async () => {
    show('agent', detail({ status: 'submitted' }))
    await btn('إسناد إليّ')
    expect(screen.queryByLabelText('اسم المستند (عربي)')).toBeNull()
  })
})

describe('pricing (manual quote approved by the customer)', () => {
  it('saves a draft quote in integer fils, then sends it for the customer\'s approval (no invoice call)', async () => {
    const srv = show('accountant', detail({ status: 'review' }), finance())
    const card = (await screen.findByText('المالية')).closest('section') as HTMLElement
    fireEvent.change(within(card).getByLabelText('المبلغ (درهم)'), { target: { value: '650.50' } })
    fireEvent.change(within(card).getByLabelText('الوصف بالعربية'), { target: { value: 'أتعاب الخدمة' } })
    fireEvent.change(within(card).getByLabelText('الوصف بالإنجليزية'), { target: { value: 'Service fee' } })
    fireEvent.click(within(card).getByRole('button', { name: 'حفظ المسودة' }))
    await waitFor(() => expect(srv.posts('/quotes')).toHaveLength(1))
    expect(srv.posts('/quotes')[0]!.body.items).toEqual([{ kind: 'service_fee', descriptionAr: 'أتعاب الخدمة', descriptionEn: 'Service fee', amountFils: 65050 }])
    expect(srv.calls.some((c) => c.path.endsWith('/invoice'))).toBe(false)
  })
  it('a quotation waiting for the customer is labelled as such; sending calls /issue (send for approval)', async () => {
    const q = (status: 'draft' | 'issued', id: string, v: number) => ({ id, version: v, status, number: status === 'issued' ? 'T-QUO-2026-000001' : null, invoiceNumber: null, total_fils: 50000, items: [], accepted_at: null, declined_at: null, decline_reason: null })
    const srv = show('owner', detail({ status: 'review' }), finance({ quotes: [q('issued', 'q1', 1), q('draft', 'q2', 2)] }))
    expect(await screen.findByText('عرض سعر بانتظار موافقة العميل في التطبيق. لا تصدر الفاتورة قبل موافقته.')).toBeTruthy()
    expect(screen.getAllByText('بانتظار موافقة العميل').length).toBeGreaterThan(0)
    fireEvent.click(await btn('إرسال عرض السعر للعميل للموافقة'))
    await waitFor(() => expect(srv.posts('/quotes/q2/issue')).toHaveLength(1))
  })
  it('a declined quotation shows the customer\'s reason', async () => {
    show('owner', detail({ status: 'review' }), finance({ quotes: [{ id: 'q1', version: 1, status: 'superseded', number: 'T-QUO-2026-000001', invoiceNumber: null, total_fils: 50000, items: [], accepted_at: null, declined_at: 5, decline_reason: 'السعر مرتفع' }] }))
    expect(await screen.findByText('اعتذر العميل')).toBeTruthy()
    expect(screen.getByText(/السعر مرتفع/)).toBeTruthy()
  })
})

describe('publishing and receipt confirmation', () => {
  const pkg = (files: Detail['files']) => detail({ status: 'completed' }, { deliveries: [{ id: 'dl1', version: null, status: 'draft', published_at: null, created_at: 1, acknowledged_at: null }], files })
  const f = (kind: 'final' | 'invoice') => ({ id: 'f-' + kind, name: kind + '.pdf', mime: 'application/pdf', size: 2048, kind, label: kind === 'final' ? 'الهوية الجديدة' : null, created_at: 1, delivery_id: 'dl1', extracted: null })
  it('a package needs at least one delivery file before it can be published', async () => {
    show('agent', pkg([f('invoice')]))
    expect(((await btn('نشر للعميل')) as HTMLButtonElement).disabled).toBe(true)
  })
  it('publishing asks for confirmation and sends the loaded version', async () => {
    const srv = show('agent', pkg([f('final')]))
    fireEvent.click(await btn('نشر للعميل'))
    await waitFor(() => expect(srv.posts('/deliveries/publish')).toHaveLength(1))
    expect(window.confirm).toHaveBeenCalled()
    expect(srv.posts('/deliveries/publish')[0]!.body).toEqual({ expectedVersion: 3 })
  })
  it('a published version shows "waiting for the customer" until they confirm receipt, then the confirmation time', async () => {
    const pub = (ack: number | null) => detail({ status: 'completed', deliveryVersion: 1 }, { deliveries: [{ id: 'dl1', version: 1, status: 'published', published_at: 1, created_at: 1, acknowledged_at: ack }] })
    show('agent', pub(null))
    expect(await screen.findByText('بانتظار تأكيد العميل')).toBeTruthy()
    cleanup()
    show('agent', pub(1_700_000_000_000))
    expect(await screen.findByText(/✓ تأكيد الاستلام/)).toBeTruthy()
    expect(screen.queryByText('بانتظار تأكيد العميل')).toBeNull()
  })
})
