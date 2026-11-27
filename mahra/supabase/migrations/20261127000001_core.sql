-- مهرة: المخطط الأساسي (Postgres محمول؛ يعمل على Supabase أو أي Postgres 15+).
-- كل المبالغ بالفلس (1 درهم = 100 فلس).

-- ───────────── الأنواع ─────────────
create type emirate as enum ('abu_dhabi','dubai','sharjah','ajman','umm_al_quwain','ras_al_khaimah','fujairah');
create type provider_status as enum ('invited','incomplete','pending_review','approved','suspended','terminated');
create type doc_kind as enum ('trade_license','tenancy_contract','owner_id','other');
create type doc_status as enum ('uploaded','accepted','rejected');
create type request_status as enum ('draft','diagnosing','rfq_sent','offers_received','accepted','in_progress','done','expired','cancelled','disputed');
create type dispatch_status as enum ('sent','declined','offered','expired','closed');
create type offer_status as enum ('submitted','accepted','closed','withdrawn');
create type payment_method as enum ('card','cash');
create type job_status as enum ('accepted','in_progress','completed','cancelled','disputed');
create type commission_status as enum ('due','proof_uploaded','paid','needs_review','overdue','waived');
create type staff_role as enum ('owner','finance','support','reviewer');
create type match_status as enum ('pending','matched','mismatch');
create type msg_role as enum ('user','agent','system');
create type thread_status as enum ('active','parked');
create type outreach_status as enum ('found','vetted','invited','accepted','declined','do_not_contact');

-- ───────────── مراجع ثابتة ─────────────
create table agents (
  id text primary key,
  name_ar text not null,
  name_en text not null,
  gender char(1) not null check (gender in ('m','f')),
  dialect text not null check (dialect in ('emirati','jordanian','lebanese','syrian','egyptian','saudi')),  -- لهجة/جنسية الوكيل بالعربية (لا مغاربية؛ راشد إماراتي)
  status text not null default 'soon' check (status in ('live','soon')),
  has_commission boolean not null default true
);

create table service_categories (
  id text primary key,
  agent_id text not null references agents(id),
  name_ar text not null,
  name_en text not null,
  commission_rate numeric(5,4) not null default 0.2000 check (commission_rate >= 0 and commission_rate <= 0.5),
  flow text not null default 'rfq' check (flow in ('rfq','inspect_first','direct')),   -- direct = مزود وحيد بلا مناقصة (راشد)
  active boolean not null default true
);

create table public_holidays (day date primary key, name text);

-- ───────────── المستخدمون ─────────────
create table customers (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text not null unique,
  whatsapp text not null,
  lang text not null default 'ar',
  created_at timestamptz not null default now()
);

create table staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role staff_role not null,
  created_at timestamptz not null default now()
);

-- ───────────── المزودون ─────────────
create table providers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  company_name text not null,
  phone text,
  whatsapp text,
  maps_url text,
  status provider_status not null default 'invited',
  status_reason text,
  rating_avg numeric(3,2),
  rating_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table provider_categories (
  provider_id uuid not null references providers(id) on delete cascade,
  category_id text not null references service_categories(id),
  primary key (provider_id, category_id)
);

create table provider_coverage (
  provider_id uuid not null references providers(id) on delete cascade,
  emirate emirate not null,
  primary key (provider_id, emirate)
);

create table provider_documents (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references providers(id) on delete cascade,
  kind doc_kind not null,
  storage_path text not null,
  status doc_status not null default 'uploaded',
  reject_reason text,
  expires_on date,
  uploaded_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz
);

-- إيقاف مؤقت لإيقاف الإيقاف الآلي بعد override من المدير
create table provider_overrides (
  provider_id uuid primary key references providers(id) on delete cascade,
  until_date date not null,
  set_by uuid references auth.users(id),
  note text
);

-- ───────────── المحادثات والوكلاء ─────────────
create table conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  current_agent text references agents(id),
  lang text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- لكل وكيل خيط خاص داخل المحادثة: يحتفظ بمحادثته عند التحويل ويستأنف عند العودة
create table agent_threads (
  conversation_id uuid not null references conversations(id) on delete cascade,
  agent_id text not null references agents(id),
  status thread_status not null default 'active',
  summary text,
  primary key (conversation_id, agent_id)
);

create table messages (
  id bigserial primary key,
  conversation_id uuid not null references conversations(id) on delete cascade,
  agent_id text references agents(id),
  role msg_role not null,
  content text not null,
  lang text,
  created_at timestamptz not null default now()
);
create index messages_conv_idx on messages (conversation_id, id);

create table handoffs (
  id bigserial primary key,
  conversation_id uuid not null references conversations(id) on delete cascade,
  from_agent text references agents(id),
  to_agent text not null references agents(id),
  reason text,
  packet jsonb not null,            -- حزمة التحويل (دليل الوكلاء 10.4)
  created_at timestamptz not null default now()
);

-- ───────────── الطلبات والعروض ─────────────
create table requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  conversation_id uuid references conversations(id),
  agent_id text not null references agents(id),
  category_id text not null references service_categories(id),
  title text not null,
  detail text,
  lat double precision,
  lng double precision,
  emirate emirate,
  vehicle jsonb,
  status request_status not null default 'draft',
  accepted_offer_id uuid,
  offers_deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index requests_customer_idx on requests (customer_id, created_at desc);

create table request_media (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  storage_path text not null,
  kind text not null default 'photo'
);

create table request_dispatches (
  request_id uuid not null references requests(id) on delete cascade,
  provider_id uuid not null references providers(id) on delete cascade,
  status dispatch_status not null default 'sent',
  sent_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (request_id, provider_id)
);

create table offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  provider_id uuid not null references providers(id),
  provider_price_fils bigint not null check (provider_price_fils > 0),
  commission_rate numeric(5,4) not null,           -- نسبة الفئة وقت العرض (لا تتأثر بتغييرها لاحقاً)
  commission_fils bigint not null,
  customer_price_fils bigint not null,
  eta_min int check (eta_min > 0),
  notes text,
  status offer_status not null default 'submitted',
  created_at timestamptz not null default now(),
  unique (request_id, provider_id),
  check (customer_price_fils = provider_price_fils + commission_fils)
);
alter table requests add constraint requests_accepted_offer_fk foreign key (accepted_offer_id) references offers(id);

-- ───────────── الأعمال والمال ─────────────
create table jobs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references requests(id),
  offer_id uuid not null unique references offers(id),
  customer_id uuid not null references customers(id),
  provider_id uuid not null references providers(id),
  payment_method payment_method not null,
  status job_status not null default 'accepted',
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- مبلغ حصّله المزود من العميل (شامل هامش مهرة)، يسجله المزود بنفسه
create table job_payments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  amount_fils bigint not null check (amount_fils > 0),
  collected_on date not null default current_date,
  created_at timestamptz not null default now()
);

create table commissions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id),
  payment_id uuid not null unique references job_payments(id),
  provider_id uuid not null references providers(id),
  amount_fils bigint not null check (amount_fils >= 0),
  status commission_status not null default 'due',
  due_on date not null,
  paid_at timestamptz,
  marked_by text,                                 -- 'auto' أو معرّف موظف
  created_at timestamptz not null default now()
);
create index commissions_status_idx on commissions (status, due_on);

create table commission_proofs (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references providers(id),
  storage_path text not null,
  declared_amount_fils bigint not null check (declared_amount_fils > 0),
  reference text,
  transfer_date date,
  ocr jsonb,
  match match_status not null default 'pending',
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table commission_proof_items (
  proof_id uuid not null references commission_proofs(id) on delete cascade,
  commission_id uuid not null references commissions(id),
  primary key (proof_id, commission_id)
);

-- مخصصات الضريبة (5%). وعاء الاحتساب بانتظار تأكيد المحاسب؛ نخزن الوعاء والنسبة صراحةً.
create table vat_ledger (
  id uuid primary key default gen_random_uuid(),
  commission_id uuid not null unique references commissions(id),
  base_kind text not null default 'commission',
  base_fils bigint not null,
  rate numeric(5,4) not null default 0.0500,
  vat_fils bigint not null,
  created_at timestamptz not null default now()
);

-- ───────────── الجودة والسلامة ─────────────
create table ratings (
  job_id uuid primary key references jobs(id) on delete cascade,
  customer_id uuid not null references customers(id),
  provider_id uuid not null references providers(id),
  stars smallint not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

-- بلاغ عميل: اتفاق خارج التطبيق، سوء أدب، إلخ
create table provider_reports (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references providers(id),
  customer_id uuid references customers(id),
  request_id uuid references requests(id),
  reason text not null check (reason in ('off_platform','rude','no_show','overcharge','other')),
  note text,
  created_at timestamptz not null default now()
);

create table audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor uuid,
  actor_kind text not null default 'user',       -- user | system | auto
  action text not null,
  entity text not null,
  entity_id text,
  before jsonb,
  after jsonb
);

-- ───────────── الاستقطاب الآلي ─────────────
create table outreach_candidates (
  id uuid primary key default gen_random_uuid(),
  category_id text not null references service_categories(id),
  emirate emirate,
  name text not null,
  phone text,
  whatsapp text,
  google_place_id text unique,
  rating numeric(3,2),
  score numeric(5,2),
  status outreach_status not null default 'found',
  notes text,
  created_at timestamptz not null default now()
);

create table do_not_contact (
  phone text primary key,
  added_at timestamptz not null default now(),
  reason text
);
