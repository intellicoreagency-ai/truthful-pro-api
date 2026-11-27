-- مهرة: بيانات مرجعية (الوكلاء وفئات الخدمة). المصدر: دليل الوكلاء v18.
-- الشخصية الصوتية (persona): طلال أردني، نورة لبنانية؛ الباقي يحدده المالك.

insert into agents (id, name_ar, name_en, gender, persona, status, has_commission) values
  ('jalal',   'جلال',   'Jalal',   'm', null,      'live', true),
  ('layla',   'ليلى',   'Layla',   'f', null,      'soon', true),
  ('noura',   'نورة',   'Noura',   'f', 'لبنانية', 'soon', false),
  ('talal',   'طلال',   'Talal',   'm', 'أردني',   'soon', true),
  ('khaled',  'خالد',   'Khaled',  'm', null,      'soon', true),
  ('sara',    'سارة',   'Sara',    'f', null,      'soon', true),
  ('rashid',  'راشد',   'Rashid',  'm', null,      'soon', true),
  ('karim',   'كريم',   'Karim',   'm', null,      'soon', true),
  ('reem',    'د. ريم', 'Dr Reem', 'f', null,      'soon', true),
  ('dana',    'دانة',   'Dana',    'f', null,      'soon', true),
  ('omar',    'أ. عمر', 'Mr Omar', 'm', null,      'soon', false),
  ('tareq',   'طارق',   'Tareq',   'm', null,      'soon', true),
  ('mansour', 'منصور',  'Mansour', 'm', null,      'soon', false),
  ('faisal',  'فيصل',   'Faisal',  'm', null,      'soon', false),
  ('meera',   'ميرا',   'Meera',   'f', null,      'soon', false);

-- المسار الأول: السيارات. عمولة 20% على السطحات والورش؛ الإنقاذ الطرقي كذلك.
insert into service_categories (id, agent_id, name_ar, name_en, commission_rate, flow) values
  ('car_tow',      'jalal', 'سطحة',                 'Tow truck',        0.2000, 'rfq'),
  ('car_roadside', 'jalal', 'مساعدة على الطريق',    'Roadside help',    0.2000, 'rfq'),
  ('car_garage',   'jalal', 'ورشة سيارات',          'Car garage',       0.2000, 'rfq'),
  ('home_ac',      'talal', 'صيانة تكييف',          'AC maintenance',   0.2000, 'rfq'),
  ('home_clean',   'sara',  'تنظيف المنزل',         'Home cleaning',    0.2000, 'rfq'),
  ('deco_project', 'khaled','ديكور ومقاولات',       'Décor and works',  0.2000, 'inspect_first');
