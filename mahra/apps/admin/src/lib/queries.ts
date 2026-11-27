import { asStaff, rows } from './db';

export type Dashboard = {
  pending_providers: number; docs_to_review: number; approved_n: number; suspended_n: number;
  due_n: number; due_fils: string; overdue_n: number; overdue_fils: string; review_n: number;
  month_paid_fils: string; vat_fils: string;
};

export const getDashboard = () =>
  asStaff(async (db) => (await rows<Dashboard>(db, `
    select
      (select count(*) from providers where status = 'pending_review')::int as pending_providers,
      (select count(*) from provider_documents where status = 'uploaded')::int as docs_to_review,
      (select count(*) from providers where status = 'approved')::int as approved_n,
      (select count(*) from providers where status = 'suspended')::int as suspended_n,
      (select count(*) from commissions where status in ('due','proof_uploaded'))::int as due_n,
      (select coalesce(sum(amount_fils),0) from commissions where status in ('due','proof_uploaded'))::text as due_fils,
      (select count(*) from commissions where status = 'overdue')::int as overdue_n,
      (select coalesce(sum(amount_fils),0) from commissions where status = 'overdue')::text as overdue_fils,
      (select count(*) from commissions where status = 'needs_review')::int as review_n,
      (select coalesce(sum(amount_fils),0) from commissions where status = 'paid'
         and date_trunc('month', paid_at) = date_trunc('month', now()))::text as month_paid_fils,
      (select coalesce(sum(vat_fils),0) from vat_ledger)::text as vat_fils`))[0]);

export type ProviderRow = {
  id: string; company_name: string; status: string; status_reason: string | null; dot: 'green' | 'red';
  missing: string[]; rating_avg: string | null; categories: string | null; emirates: string[] | null; open_commissions: number;
};

export const listProviders = (status?: string) =>
  asStaff((db) => rows<ProviderRow>(db, `
    select p.id, p.company_name, p.status, p.status_reason, r.dot, r.missing, p.rating_avg::text,
      (select string_agg(c.name_ar, '، ') from provider_categories pc join service_categories c on c.id = pc.category_id where pc.provider_id = p.id) as categories,
      (select array_agg(cv.emirate::text order by cv.emirate) from provider_coverage cv where cv.provider_id = p.id) as emirates,
      (select count(*)::int from commissions c where c.provider_id = p.id and c.status <> 'paid' and c.status <> 'waived') as open_commissions
    from providers p join provider_readiness r on r.provider_id = p.id
    where ($1::text is null or p.status::text = $1)
    order by case p.status when 'pending_review' then 0 when 'incomplete' then 1 when 'invited' then 2 when 'suspended' then 3 when 'approved' then 4 else 5 end, p.company_name`,
    [status ?? null]));

export const countProvidersByStatus = () =>
  asStaff((db) => rows<{ status: string; n: number }>(db, `select status::text, count(*)::int n from providers group by status`));

export type ProviderDetail = {
  p: { id: string; company_name: string; phone: string | null; whatsapp: string | null; maps_url: string | null; status: string; status_reason: string | null; rating_avg: string | null; rating_count: number; created_at: Date };
  missing: string[]; dot: 'green' | 'red'; missing_accepted: string[];
  categories: string[]; emirates: string[];
  docs: { id: string; kind: string; status: string; storage_path: string; reject_reason: string | null; expires_on: Date | null; uploaded_at: Date }[];
  commissions: { id: string; amount_fils: string; status: string; due_on: Date; title: string }[];
  audit: { at: Date; action: string; actor_kind: string; before: { status?: string } | null; after: { status?: string } | null }[];
};

export const getProvider = (id: string) =>
  asStaff(async (db): Promise<ProviderDetail | null> => {
    const [p] = await rows<ProviderDetail['p']>(db, `select id, company_name, phone, whatsapp, maps_url, status::text, status_reason, rating_avg::text, rating_count, created_at from providers where id = $1`, [id]);
    if (!p) return null;
    const [r] = await rows<{ missing: string[]; dot: 'green' | 'red'; missing_accepted: string[] }>(db,
      `select missing, dot, provider_missing_items(provider_id, true) as missing_accepted from provider_readiness where provider_id = $1`, [id]);
    return {
      p, missing: r.missing, dot: r.dot, missing_accepted: r.missing_accepted,
      categories: (await rows<{ name_ar: string }>(db, `select c.name_ar from provider_categories pc join service_categories c on c.id = pc.category_id where pc.provider_id = $1`, [id])).map((x) => x.name_ar),
      emirates: (await rows<{ emirate: string }>(db, `select emirate::text from provider_coverage where provider_id = $1`, [id])).map((x) => x.emirate),
      docs: await rows(db, `select id, kind::text, status::text, storage_path, reject_reason, expires_on, uploaded_at from provider_documents where provider_id = $1 order by uploaded_at`, [id]),
      commissions: await rows(db, `select c.id, c.amount_fils::text, c.status::text, c.due_on, rq.title from commissions c join jobs j on j.id = c.job_id join requests rq on rq.id = j.request_id where c.provider_id = $1 order by c.due_on desc`, [id]),
      audit: await rows(db, `select at, action, actor_kind, before, after from audit_log where entity_id = $1 and entity = 'providers' order by at desc limit 20`, [id]),
    };
  });

export type CommissionRow = {
  id: string; amount_fils: string; status: string; due_on: Date; paid_at: Date | null; marked_by: string | null;
  provider_id: string; company_name: string; title: string; days_late: number; proof_id: string | null;
};

export const listCommissions = (filter: 'open' | 'overdue' | 'review' | 'paid' | 'all') =>
  asStaff((db) => rows<CommissionRow>(db, `
    select c.id, c.amount_fils::text, c.status::text, c.due_on, c.paid_at, c.marked_by,
      p.id as provider_id, p.company_name, rq.title, (current_date - c.due_on)::int as days_late,
      (select pr.id from commission_proof_items i join commission_proofs pr on pr.id = i.proof_id where i.commission_id = c.id order by pr.created_at desc limit 1) as proof_id
    from commissions c join providers p on p.id = c.provider_id
      join jobs j on j.id = c.job_id join requests rq on rq.id = j.request_id
    where case $1::text
      when 'open' then c.status not in ('paid','waived')
      when 'overdue' then c.status = 'overdue'
      when 'review' then c.status in ('needs_review','proof_uploaded')
      when 'paid' then c.status = 'paid'
      else true end
    order by case c.status when 'overdue' then 0 when 'needs_review' then 1 when 'proof_uploaded' then 2 when 'due' then 3 else 4 end, c.due_on`,
    [filter]));

export type ProofRow = {
  id: string; declared_amount_fils: string; reference: string | null; transfer_date: Date | null;
  ocr: { amount_fils?: number; iban_match?: boolean; reference?: string } | null; match: string; storage_path: string;
  company_name: string; created_at: Date; n: number;
};

export const listProofsToReview = () =>
  asStaff((db) => rows<ProofRow>(db, `
    select pr.id, pr.declared_amount_fils::text, pr.reference, pr.transfer_date, pr.ocr, pr.match::text, pr.storage_path,
      p.company_name, pr.created_at, (select count(*)::int from commission_proof_items i where i.proof_id = pr.id) as n
    from commission_proofs pr join providers p on p.id = pr.provider_id
    where pr.match <> 'matched' and pr.reviewed_at is null order by pr.created_at`));

export type Revenue = {
  total_paid: string; pending: string;
  byMonth: { m: string; fils: string; n: number }[];
  byProvider: { company_name: string; fils: string; n: number }[];
  byCategory: { name_ar: string; fils: string; n: number }[];
};

export const getRevenue = () =>
  asStaff(async (db): Promise<Revenue> => {
    const [t] = await rows<{ total_paid: string; pending: string }>(db, `
      select coalesce(sum(amount_fils) filter (where status = 'paid'), 0)::text as total_paid,
             coalesce(sum(amount_fils) filter (where status not in ('paid','waived')), 0)::text as pending from commissions`);
    return {
      ...t,
      byMonth: await rows(db, `select to_char(date_trunc('month', paid_at), 'YYYY-MM') as m, sum(amount_fils)::text as fils, count(*)::int as n from commissions where status = 'paid' group by 1 order by 1 desc`),
      byProvider: await rows(db, `select p.company_name, sum(c.amount_fils)::text as fils, count(*)::int as n from commissions c join providers p on p.id = c.provider_id where c.status = 'paid' group by p.company_name order by sum(c.amount_fils) desc`),
      byCategory: await rows(db, `select sc.name_ar, sum(c.amount_fils)::text as fils, count(*)::int as n from commissions c join jobs j on j.id = c.job_id join requests r on r.id = j.request_id join service_categories sc on sc.id = r.category_id where c.status = 'paid' group by sc.name_ar order by sum(c.amount_fils) desc`),
    };
  });

export type VatRow = { id: string; base_fils: string; rate: string; vat_fils: string; created_at: Date; company_name: string; title: string; base_kind: string };

export const listVat = () =>
  asStaff((db) => rows<VatRow>(db, `
    select v.id, v.base_fils::text, v.rate::text, v.vat_fils::text, v.created_at, v.base_kind, p.company_name, rq.title
    from vat_ledger v join commissions c on c.id = v.commission_id join providers p on p.id = c.provider_id
      join jobs j on j.id = c.job_id join requests rq on rq.id = j.request_id order by v.created_at desc`));

export type Attention = { kind: 'overdue' | 'review' | 'provider'; text: string; href: string; tone: 'danger' | 'warn' | 'info' };
