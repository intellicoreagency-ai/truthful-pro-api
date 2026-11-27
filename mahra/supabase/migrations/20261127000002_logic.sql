-- مهرة: منطق العمل داخل قاعدة البيانات.
-- المبدأ: القواعد المالية والحالات تُفرض هنا (لا في التطبيقات) كي لا يتجاوزها أي عميل.

-- ───────────── مساعدات ─────────────
create function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where user_id = auth.uid());
$$;

create function staff_has_role(roles staff_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where user_id = auth.uid() and role = any (roles));
$$;

create function current_provider_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from providers where user_id = auth.uid();
$$;

-- يضيف n يوم عمل (يتخطى السبت والأحد وأي عطلة مسجلة في public_holidays)
create function add_business_days(d date, n int) returns date
language plpgsql stable as $$
declare cur date := d; left_days int := n;
begin
  while left_days > 0 loop
    cur := cur + 1;
    if extract(isodow from cur) not in (6, 7)
       and not exists (select 1 from public_holidays h where h.day = cur) then
      left_days := left_days - 1;
    end if;
  end loop;
  return cur;
end $$;

-- ───────────── اكتمال وثائق المزود ─────────────
-- require_accepted=false: «أخضر» = كل المطلوب موجود (للمراجعة).
-- require_accepted=true : شرط الاعتماد = الوثائق مقبولة وغير منتهية.
create function provider_missing_items(p uuid, require_accepted boolean default false) returns text[]
language plpgsql stable as $$
declare m text[] := '{}'; r providers%rowtype; kinds text[] := array['trade_license','tenancy_contract']; k text;
begin
  select * into r from providers where id = p;
  if r.phone is null or r.phone = '' then m := m || 'phone'; end if;
  if r.whatsapp is null or r.whatsapp = '' then m := m || 'whatsapp'; end if;
  if r.maps_url is null or r.maps_url = '' then m := m || 'maps_url'; end if;
  if not exists (select 1 from provider_categories where provider_id = p) then m := m || 'categories'; end if;
  if not exists (select 1 from provider_coverage where provider_id = p) then m := m || 'coverage'; end if;
  foreach k in array kinds loop
    if not exists (
      select 1 from provider_documents d
      where d.provider_id = p and d.kind = k::doc_kind
        and (d.expires_on is null or d.expires_on >= current_date)
        and (case when require_accepted then d.status = 'accepted' else d.status in ('uploaded','accepted') end)
    ) then m := m || k; end if;
  end loop;
  return m;
end $$;

create view provider_readiness as
select p.id as provider_id, p.company_name, p.status,
       provider_missing_items(p.id) as missing,
       case when cardinality(provider_missing_items(p.id)) = 0 then 'green' else 'red' end as dot
from providers p;

-- ───────────── حراسة حالة المزود + التدقيق ─────────────
create function providers_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if new.status is distinct from old.status then
    if old.status = 'terminated' then
      raise exception 'a terminated provider cannot be reinstated';
    end if;
    if new.status = 'approved' and cardinality(provider_missing_items(new.id, true)) > 0 then
      raise exception 'provider cannot be approved: missing %', provider_missing_items(new.id, true);
    end if;
  end if;
  return new;
end $$;
create trigger providers_guard before update on providers for each row execute function providers_guard();

create function audit_status_change() returns trigger language plpgsql security definer set search_path = public as $$
declare who uuid := auth.uid();
begin
  if new.status is distinct from old.status then
    insert into audit_log (actor, actor_kind, action, entity, entity_id, before, after)
    values (who, case when who is null then 'auto' else 'user' end,
            tg_table_name || '.status', tg_table_name, new.id::text,
            jsonb_build_object('status', old.status), jsonb_build_object('status', new.status));
  end if;
  return new;
end $$;
create trigger providers_audit after update on providers for each row execute function audit_status_change();
create trigger commissions_audit after update on commissions for each row execute function audit_status_change();

-- ───────────── العروض ─────────────
-- يحسب السعر النهائي ويفرض: مزود معتمد، مدعوّ للطلب، وبحد أقصى 3 عروض.
create function offers_before_insert() returns trigger language plpgsql security definer set search_path = public as $$
declare r requests%rowtype; p providers%rowtype; d request_dispatches%rowtype; n int; rate numeric(5,4);
begin
  select * into r from requests where id = new.request_id for update;   -- يسلسل العروض المتزامنة
  if not found then raise exception 'request not found'; end if;
  if r.status not in ('rfq_sent','offers_received') then
    raise exception 'request is not accepting offers (status %)', r.status;
  end if;
  select * into p from providers where id = new.provider_id;
  if p.status <> 'approved' then raise exception 'provider is not approved'; end if;
  select * into d from request_dispatches where request_id = new.request_id and provider_id = new.provider_id;
  if not found or d.status not in ('sent','offered') then
    raise exception 'provider was not asked to quote this request';
  end if;
  select count(*) into n from offers where request_id = new.request_id and status = 'submitted';
  if n >= 3 then raise exception 'maximum of 3 offers reached'; end if;

  select commission_rate into rate from service_categories where id = r.category_id;
  new.commission_rate := rate;
  new.commission_fils := round(new.provider_price_fils * rate);
  new.customer_price_fils := new.provider_price_fils + new.commission_fils;
  return new;
end $$;
create trigger offers_before_insert before insert on offers for each row execute function offers_before_insert();

create function offers_after_insert() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update request_dispatches set status = 'offered', responded_at = now()
   where request_id = new.request_id and provider_id = new.provider_id;
  update requests set status = 'offers_received', updated_at = now()
   where id = new.request_id and status = 'rfq_sent';
  return new;
end $$;
create trigger offers_after_insert after insert on offers for each row execute function offers_after_insert();

-- العميل لا يرى سعر المزود ولا العمولة ولا رقمه: عرض مقيّد بصاحب الطلب
create view customer_offers with (security_barrier) as
select o.id, o.request_id, p.company_name, p.rating_avg, p.rating_count,
       o.eta_min, o.customer_price_fils as price_fils, o.status
from offers o
join requests r on r.id = o.request_id
join providers p on p.id = o.provider_id
where r.customer_id = auth.uid() and o.status in ('submitted','accepted');

-- يحوّل الطلب إلى أفضل مزودين مطابقين (فئة + إمارة) لم يُرسَل إليهم بعد.
-- يُستعمل عند البدء وعند إعادة التوجيه بعد رفض مزود.
create function dispatch_request(p_request_id uuid, p_limit int default 6, p_deadline_minutes int default 5)
returns int language plpgsql security definer set search_path = public as $$
declare r requests%rowtype; n int;
begin
  select * into r from requests where id = p_request_id for update;
  if not found then raise exception 'request not found'; end if;
  if r.status not in ('draft','diagnosing','rfq_sent','offers_received') then
    raise exception 'request cannot be dispatched in status %', r.status;
  end if;

  with picked as (
    select p.id from providers p
    join provider_categories pc on pc.provider_id = p.id and pc.category_id = r.category_id
    where p.status = 'approved'
      and (r.emirate is null or exists (select 1 from provider_coverage c where c.provider_id = p.id and c.emirate = r.emirate))
      and not exists (select 1 from request_dispatches d where d.request_id = r.id and d.provider_id = p.id)
    order by p.rating_avg desc nulls last, p.created_at
    limit p_limit
  )
  insert into request_dispatches (request_id, provider_id) select r.id, id from picked;
  get diagnostics n = row_count;

  update requests
     set status = case when status in ('draft','diagnosing') then 'rfq_sent' else status end,
         offers_deadline = coalesce(offers_deadline, now() + make_interval(mins => p_deadline_minutes)),
         updated_at = now()
   where id = r.id;
  return n;
end $$;

-- المزود يرفض الطلب فيُسجَّل الرفض؛ إعادة التوجيه تتم بطلب dispatch_request من الخلفية
create function decline_dispatch(p_request_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare pid uuid := current_provider_id();
begin
  if pid is null then raise exception 'not a provider'; end if;
  update request_dispatches set status = 'declined', responded_at = now()
   where request_id = p_request_id and provider_id = pid and status in ('sent');
  if not found then raise exception 'no open request to decline'; end if;
end $$;

-- ───────────── قبول عرض (ذرّي) ─────────────
create function accept_offer(p_offer_id uuid, p_method payment_method) returns uuid
language plpgsql security definer set search_path = public as $$
declare o offers%rowtype; r requests%rowtype; v_job uuid;
begin
  select * into o from offers where id = p_offer_id;
  if not found then raise exception 'offer not found'; end if;
  select * into r from requests where id = o.request_id for update;
  if r.customer_id is distinct from auth.uid() then raise exception 'not your request'; end if;
  if r.status <> 'offers_received' then raise exception 'request is not open for acceptance (status %)', r.status; end if;
  if o.status <> 'submitted' then raise exception 'offer is no longer available'; end if;

  update offers set status = 'accepted' where id = o.id;
  update offers set status = 'closed' where request_id = r.id and id <> o.id and status = 'submitted';   -- إغلاق آلي لبقية العروض
  update request_dispatches set status = 'closed' where request_id = r.id and provider_id <> o.provider_id and status in ('sent','offered');
  update requests set status = 'accepted', accepted_offer_id = o.id, updated_at = now() where id = r.id;

  insert into jobs (request_id, offer_id, customer_id, provider_id, payment_method)
  values (r.id, o.id, r.customer_id, o.provider_id, p_method) returning id into v_job;
  return v_job;
end $$;

-- رقم المزود لا يظهر إلا لصاحب الطلب بعد القبول
create function accepted_provider_contact(p_request_id uuid)
returns table (company_name text, phone text, whatsapp text, maps_url text)
language sql stable security definer set search_path = public as $$
  select p.company_name, p.phone, p.whatsapp, p.maps_url
  from jobs j join providers p on p.id = j.provider_id
  where j.request_id = p_request_id and j.customer_id = auth.uid() and j.status <> 'cancelled';
$$;

-- ───────────── تنفيذ العمل والمدفوعات والعمولة ─────────────
create function provider_set_job_status(p_job_id uuid, p_status job_status) returns void
language plpgsql security definer set search_path = public as $$
declare j jobs%rowtype;
begin
  select * into j from jobs where id = p_job_id for update;
  if not found or j.provider_id is distinct from current_provider_id() then raise exception 'not your job'; end if;
  if not ((j.status = 'accepted'    and p_status in ('in_progress','cancelled'))
       or (j.status = 'in_progress' and p_status in ('completed','cancelled'))) then
    raise exception 'invalid job transition % -> %', j.status, p_status;
  end if;
  update jobs set status = p_status, completed_at = case when p_status = 'completed' then now() end where id = j.id;
  update requests set status = case p_status when 'in_progress' then 'in_progress'::request_status
                                             when 'completed'   then 'done'::request_status
                                             else 'cancelled'::request_status end,
                    updated_at = now()
   where id = j.request_id;
end $$;

-- المزود يسجل ما حصّله فعلاً من العميل. العمولة تتبع كل دفعة (نسبياً) وتُستحق بعد 3 أيام عمل.
-- نحسب بالتراكم لتفادي انحراف التقريب: مجموع العمولات = عمولة العرض بالضبط عند اكتمال السداد.
create function record_payment(p_job_id uuid, p_amount_fils bigint) returns uuid
language plpgsql security definer set search_path = public as $$
declare j jobs%rowtype; o offers%rowtype; collected bigint; accrued bigint; target bigint; pay uuid; comm bigint;
begin
  select * into j from jobs where id = p_job_id for update;
  if not found or j.provider_id is distinct from current_provider_id() then raise exception 'not your job'; end if;
  if j.status = 'cancelled' then raise exception 'job was cancelled'; end if;
  select * into o from offers where id = j.offer_id;

  select coalesce(sum(amount_fils), 0) into collected from job_payments where job_id = j.id;
  if collected + p_amount_fils > o.customer_price_fils then
    raise exception 'payments exceed the agreed price';
  end if;

  insert into job_payments (job_id, amount_fils) values (j.id, p_amount_fils) returning id into pay;
  select coalesce(sum(amount_fils), 0) into accrued from commissions where job_id = j.id;
  target := round((collected + p_amount_fils)::numeric * o.commission_fils / o.customer_price_fils);
  comm := target - accrued;
  insert into commissions (job_id, payment_id, provider_id, amount_fils, due_on)
  values (j.id, pay, j.provider_id, comm, add_business_days(current_date, 3));
  return pay;
end $$;

-- ───────────── التحصيل: الإثبات والمطابقة ─────────────
create function _mark_commission_paid(p_id uuid, p_by text) returns void
language plpgsql security definer set search_path = public as $$
declare c commissions%rowtype;
begin
  update commissions set status = 'paid', paid_at = now(), marked_by = p_by where id = p_id returning * into c;
  insert into vat_ledger (commission_id, base_fils, vat_fils)
  values (c.id, c.amount_fils, round(c.amount_fils * 0.05))
  on conflict (commission_id) do nothing;
end $$;

create function _unmark_commission_paid(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update commissions
     set status = case when due_on < current_date then 'overdue'::commission_status else 'due'::commission_status end,
         paid_at = null, marked_by = null
   where id = p_id;
  delete from vat_ledger where commission_id = p_id;
end $$;

create function submit_commission_proof(p_commission_ids uuid[], p_path text, p_declared_fils bigint, p_reference text, p_date date)
returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid := current_provider_id(); total bigint; cnt int; v_proof uuid;
begin
  if pid is null then raise exception 'not a provider'; end if;
  select coalesce(sum(amount_fils), 0), count(*) into total, cnt
    from commissions where id = any (p_commission_ids) and provider_id = pid and status in ('due','overdue','needs_review');
  if cnt <> cardinality(p_commission_ids) then raise exception 'some commissions are not yours or not payable'; end if;
  if total <> p_declared_fils then raise exception 'declared amount (%) must equal the selected commissions (%)', p_declared_fils, total; end if;

  insert into commission_proofs (provider_id, storage_path, declared_amount_fils, reference, transfer_date)
  values (pid, p_path, p_declared_fils, p_reference, p_date) returning id into v_proof;
  insert into commission_proof_items select v_proof, unnest(p_commission_ids);
  update commissions set status = 'proof_uploaded' where id = any (p_commission_ids);
  return v_proof;
end $$;

-- تستدعيها خلفية المسح (OCR). تسجل «مدفوعة» آلياً فقط عند مطابقة كاملة، وإلا «بحاجة مراجعة».
-- المطابقة: المبلغ = المصرَّح به، الحساب المستفيد = حساب مهرة، مرجع موجود وغير مكرر.
create function apply_proof_ocr(p_proof_id uuid, p_ocr jsonb) returns match_status
language plpgsql security definer set search_path = public as $$
declare pr commission_proofs%rowtype; ok boolean; v_ref text := nullif(p_ocr->>'reference', ''); item record;
begin
  select * into pr from commission_proofs where id = p_proof_id for update;
  if not found then raise exception 'proof not found'; end if;
  ok := (p_ocr->>'amount_fils')::bigint = pr.declared_amount_fils
        and coalesce((p_ocr->>'iban_match')::boolean, false)
        and v_ref is not null
        and not exists (select 1 from commission_proofs x where x.reference = v_ref and x.id <> pr.id);

  update commission_proofs set ocr = p_ocr, match = case when ok then 'matched'::match_status else 'mismatch'::match_status end,
                              reference = coalesce(v_ref, reference)
   where id = pr.id;
  for item in select commission_id from commission_proof_items where proof_id = pr.id loop
    if ok then perform _mark_commission_paid(item.commission_id, 'auto');
    else update commissions set status = 'needs_review' where id = item.commission_id;
    end if;
  end loop;
  return case when ok then 'matched'::match_status else 'mismatch'::match_status end;
end $$;

create function staff_review_proof(p_proof_id uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare item record;
begin
  if not staff_has_role(array['owner','finance']::staff_role[]) then raise exception 'not allowed'; end if;
  update commission_proofs set match = case when p_approve then 'matched'::match_status else 'mismatch'::match_status end,
                               reviewed_by = auth.uid(), reviewed_at = now() where id = p_proof_id;
  for item in select commission_id from commission_proof_items where proof_id = p_proof_id loop
    if p_approve then perform _mark_commission_paid(item.commission_id, auth.uid()::text);
    else perform _unmark_commission_paid(item.commission_id);
    end if;
  end loop;
end $$;

-- لوحة العمولات: خانتا «نعم/لا» (هل سُدّدت عمولة مهرة؟)
create function staff_set_commission_paid(p_commission_id uuid, p_paid boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not staff_has_role(array['owner','finance']::staff_role[]) then raise exception 'not allowed'; end if;
  if p_paid then perform _mark_commission_paid(p_commission_id, auth.uid()::text);
  else perform _unmark_commission_paid(p_commission_id);
  end if;
end $$;

-- ───────────── الإيقاف الآلي + override المدير ─────────────
-- تُجدول يومياً. «overdue» لعمولة مستحقة تجاوزت موعدها ولم يُرفع لها إثبات.
-- من رفع إثباتاً لا يُوقَف حتى يراجعه المدير. من لديه override ساري لا يُوقَف.
create function suspend_overdue_providers() returns setof uuid
language plpgsql security definer set search_path = public as $$
begin
  update commissions set status = 'overdue' where status = 'due' and due_on < current_date;
  return query
  update providers p set status = 'suspended', status_reason = 'overdue_commission'
   where p.status = 'approved'
     and exists (select 1 from commissions c where c.provider_id = p.id and c.status = 'overdue')
     and not exists (select 1 from provider_overrides o where o.provider_id = p.id and o.until_date >= current_date)
  returning p.id;
end $$;

create function staff_set_provider_status(p_provider_id uuid, p_status provider_status, p_reason text, p_override_days int default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not staff_has_role(array['owner','support']::staff_role[]) then raise exception 'not allowed'; end if;
  if p_status in ('suspended','terminated') and coalesce(p_reason, '') = '' then
    raise exception 'a reason is required to suspend or terminate';
  end if;
  update providers set status = p_status, status_reason = p_reason where id = p_provider_id;
  if p_override_days is not null then
    insert into provider_overrides (provider_id, until_date, set_by, note)
    values (p_provider_id, current_date + p_override_days, auth.uid(), p_reason)
    on conflict (provider_id) do update set until_date = excluded.until_date, set_by = excluded.set_by, note = excluded.note;
  end if;
end $$;

-- ───────────── مراجعة الوثائق ─────────────
create function staff_review_document(p_doc_id uuid, p_accept boolean, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  if not staff_has_role(array['owner','reviewer']::staff_role[]) then raise exception 'not allowed'; end if;
  if not p_accept and coalesce(p_reason, '') = '' then raise exception 'a reason is required to reject a document'; end if;
  update provider_documents set status = case when p_accept then 'accepted'::doc_status else 'rejected'::doc_status end,
         reject_reason = case when p_accept then null else p_reason end, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_doc_id returning provider_id into pid;
end $$;

-- المزود يطلب المراجعة عند اكتمال ما يخصه
create function provider_submit_for_review() returns provider_status
language plpgsql security definer set search_path = public as $$
declare pid uuid := current_provider_id(); s provider_status;
begin
  if pid is null then raise exception 'not a provider'; end if;
  s := case when cardinality(provider_missing_items(pid)) = 0 then 'pending_review'::provider_status else 'incomplete'::provider_status end;
  update providers set status = s where id = pid and status in ('invited','incomplete','pending_review');
  return s;
end $$;

-- ───────────── التقييم ─────────────
create function rate_job(p_job_id uuid, p_stars smallint, p_comment text default null) returns void
language plpgsql security definer set search_path = public as $$
declare j jobs%rowtype;
begin
  select * into j from jobs where id = p_job_id;
  if not found or j.customer_id is distinct from auth.uid() then raise exception 'not your job'; end if;
  if j.status <> 'completed' then raise exception 'only completed jobs can be rated'; end if;
  insert into ratings (job_id, customer_id, provider_id, stars, comment) values (j.id, j.customer_id, j.provider_id, p_stars, p_comment);
  update providers p set rating_count = s.n, rating_avg = s.a
    from (select count(*) n, round(avg(stars)::numeric, 2) a from ratings where provider_id = j.provider_id) s
   where p.id = j.provider_id;
end $$;
