-- مهرة: الأمان. الأصل «ممنوع» ثم نمنح الحد الأدنى.
-- الخلفية (service_role) تتجاوز RLS وتُستعمل للوكلاء وروبوت الاستقطاب والمسح الآلي فقط.

do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

alter view provider_readiness set (security_invoker = true);

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- ───────────── صلاحيات الجداول (RLS تقيّدها بالصفوف) ─────────────
grant select on agents, service_categories, public_holidays to authenticated;
grant select on customers, staff, providers, provider_categories, provider_coverage, provider_documents,
               provider_overrides, conversations, agent_threads, messages, handoffs, requests, request_media,
               request_dispatches, offers, jobs, job_payments, commissions, commission_proofs, commission_proof_items,
               ratings, provider_reports, vat_ledger, audit_log, outreach_candidates, do_not_contact
      to authenticated;
grant select on provider_readiness, customer_offers to authenticated;

grant insert on customers, conversations, requests, request_media, provider_reports to authenticated;
grant insert (conversation_id, agent_id, role, content, lang) on messages to authenticated;
grant usage on sequence messages_id_seq to authenticated;
grant update (lang, whatsapp) on customers to authenticated;

-- المزود لا يستطيع تغيير حالته ولا تقييمه: أعمدة محددة فقط
grant update (company_name, phone, whatsapp, maps_url) on providers to authenticated;
grant insert, delete on provider_categories, provider_coverage to authenticated;
grant insert (provider_id, kind, storage_path, expires_on) on provider_documents to authenticated;
grant delete on provider_documents to authenticated;
grant insert (request_id, provider_id, provider_price_fils, eta_min, notes) on offers to authenticated;
grant update (status) on offers to authenticated;

-- ───────────── السياسات ─────────────
create policy ref_read on agents for select to authenticated using (true);
create policy ref_read on service_categories for select to authenticated using (true);
create policy ref_read on public_holidays for select to authenticated using (true);

-- العملاء
create policy own_read on customers for select to authenticated using (id = auth.uid() or is_staff());
create policy own_insert on customers for insert to authenticated with check (id = auth.uid());
create policy own_update on customers for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy staff_read on staff for select to authenticated using (user_id = auth.uid());

-- المزودون
create policy own_read on providers for select to authenticated using (user_id = auth.uid() or is_staff());
create policy own_update on providers for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_read on provider_categories for select to authenticated using (provider_id = current_provider_id() or is_staff());
create policy own_write on provider_categories for insert to authenticated with check (provider_id = current_provider_id());
create policy own_delete on provider_categories for delete to authenticated using (provider_id = current_provider_id());
create policy own_read on provider_coverage for select to authenticated using (provider_id = current_provider_id() or is_staff());
create policy own_write on provider_coverage for insert to authenticated with check (provider_id = current_provider_id());
create policy own_delete on provider_coverage for delete to authenticated using (provider_id = current_provider_id());
create policy own_read on provider_documents for select to authenticated using (provider_id = current_provider_id() or is_staff());
create policy own_write on provider_documents for insert to authenticated with check (provider_id = current_provider_id());
create policy own_delete on provider_documents for delete to authenticated using (provider_id = current_provider_id() and status <> 'accepted');
create policy staff_read on provider_overrides for select to authenticated using (is_staff());

-- المحادثات (للعميل صاحبها، وللدعم قراءة فقط)
create policy own_read on conversations for select to authenticated
  using (customer_id = auth.uid() or staff_has_role(array['owner','support']::staff_role[]));
create policy own_insert on conversations for insert to authenticated with check (customer_id = auth.uid());
create policy own_read on agent_threads for select to authenticated
  using (exists (select 1 from conversations c where c.id = conversation_id and (c.customer_id = auth.uid() or staff_has_role(array['owner','support']::staff_role[]))));
create policy own_read on messages for select to authenticated
  using (exists (select 1 from conversations c where c.id = conversation_id and (c.customer_id = auth.uid() or staff_has_role(array['owner','support']::staff_role[]))));
create policy own_insert on messages for insert to authenticated
  with check (role = 'user' and exists (select 1 from conversations c where c.id = conversation_id and c.customer_id = auth.uid()));
create policy own_read on handoffs for select to authenticated
  using (exists (select 1 from conversations c where c.id = conversation_id and (c.customer_id = auth.uid() or staff_has_role(array['owner','support']::staff_role[]))));

-- الطلبات: العميل صاحبها، والمزود المدعو إليها، والموظف
create policy visible_read on requests for select to authenticated using (
  customer_id = auth.uid() or is_staff()
  or exists (select 1 from request_dispatches d where d.request_id = requests.id and d.provider_id = current_provider_id()));
create policy own_insert on requests for insert to authenticated with check (customer_id = auth.uid() and status in ('draft','diagnosing'));
create policy visible_read on request_media for select to authenticated using (
  exists (select 1 from requests r where r.id = request_id) );   -- يرث رؤية الطلب عبر RLS
create policy own_insert on request_media for insert to authenticated
  with check (exists (select 1 from requests r where r.id = request_id and r.customer_id = auth.uid()));
create policy own_read on request_dispatches for select to authenticated using (provider_id = current_provider_id() or is_staff());

-- العروض: يراها المزود صاحبها والموظف فقط. العميل يقرأ customer_offers (بلا سعر المزود/العمولة/الرقم)
create policy own_read on offers for select to authenticated using (provider_id = current_provider_id() or is_staff());
create policy own_insert on offers for insert to authenticated with check (provider_id = current_provider_id());
create policy own_withdraw on offers for update to authenticated
  using (provider_id = current_provider_id() and status = 'submitted')
  with check (provider_id = current_provider_id() and status = 'withdrawn');

-- الأعمال والمال
create policy party_read on jobs for select to authenticated using (customer_id = auth.uid() or provider_id = current_provider_id() or is_staff());
create policy party_read on job_payments for select to authenticated using (
  exists (select 1 from jobs j where j.id = job_id and (j.provider_id = current_provider_id() or is_staff())));
create policy own_read on commissions for select to authenticated using (provider_id = current_provider_id() or is_staff());
create policy own_read on commission_proofs for select to authenticated using (provider_id = current_provider_id() or is_staff());
create policy own_read on commission_proof_items for select to authenticated using (
  exists (select 1 from commission_proofs p where p.id = proof_id and (p.provider_id = current_provider_id() or is_staff())));
create policy finance_read on vat_ledger for select to authenticated using (staff_has_role(array['owner','finance']::staff_role[]));
create policy finance_read on audit_log for select to authenticated using (staff_has_role(array['owner','finance','support']::staff_role[]));

-- التقييم والبلاغات والاستقطاب
create policy party_read on ratings for select to authenticated using (customer_id = auth.uid() or provider_id = current_provider_id() or is_staff());
create policy own_insert on provider_reports for insert to authenticated with check (customer_id = auth.uid());
create policy staff_read on provider_reports for select to authenticated using (is_staff());
create policy staff_read on outreach_candidates for select to authenticated using (is_staff());
create policy staff_read on do_not_contact for select to authenticated using (is_staff());

-- ───────────── صلاحيات الدوال ─────────────
-- للمستخدمين المسجلين (كل دالة تتحقق من هويتها/دورها داخلها)
grant execute on function
  is_staff(), staff_has_role(staff_role[]), current_provider_id(), add_business_days(date, int),
  provider_missing_items(uuid, boolean),
  accept_offer(uuid, payment_method), accepted_provider_contact(uuid), decline_dispatch(uuid),
  provider_set_job_status(uuid, job_status), record_payment(uuid, bigint),
  submit_commission_proof(uuid[], text, bigint, text, date), provider_submit_for_review(),
  staff_review_proof(uuid, boolean), staff_set_commission_paid(uuid, boolean),
  staff_set_provider_status(uuid, provider_status, text, int), staff_review_document(uuid, boolean, text),
  rate_job(uuid, smallint, text)
to authenticated;

-- للخلفية فقط (الوكلاء، المسح الآلي، الجدولة)
grant execute on function dispatch_request(uuid, int, int), apply_proof_ocr(uuid, jsonb), suspend_overdue_providers() to service_role;
