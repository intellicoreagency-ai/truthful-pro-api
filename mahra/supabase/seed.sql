-- مهرة: بيانات مرجعية (الوكلاء وفئات الخدمة). المصدر: دليل الوكلاء v18.
-- dialect = لهجة الوكيل عند التحدث بالعربية (jordanian | lebanese | syrian | egyptian | saudi). مهرة إماراتية.

insert into agents (id, name_ar, name_en, gender, dialect, status, has_commission) values
  ('jalal',   'جلال',   'Jalal',   'm', 'jordanian',      'live', true),
  ('layla',   'ليلى',   'Layla',   'f', 'syrian',      'soon', true),
  ('noura',   'نورة',   'Noura',   'f', 'lebanese', 'soon', false),
  ('talal',   'طلال',   'Talal',   'm', 'jordanian',   'soon', true),
  ('khaled',  'خالد',   'Khaled',  'm', 'egyptian',      'soon', true),
  ('sara',    'سارة',   'Sara',    'f', 'syrian',      'soon', true),
  ('rashid',  'راشد',   'Rashid',  'm', 'saudi',      'soon', true),
  ('karim',   'كريم',   'Karim',   'm', 'saudi',      'soon', true),
  ('reem',    'د. ريم', 'Dr Reem', 'f', 'lebanese',      'soon', true),
  ('dana',    'دانة',   'Dana',    'f', 'jordanian',      'soon', true),
  ('omar',    'أ. عمر', 'Mr Omar', 'm', 'egyptian',      'soon', false),
  ('tareq',   'طارق',   'Tareq',   'm', 'egyptian',      'soon', true),
  ('mansour', 'منصور',  'Mansour', 'm', 'syrian',      'soon', false),
  ('faisal',  'فيصل',   'Faisal',  'm', 'saudi',      'soon', false),
  ('meera',   'ميرا',   'Meera',   'f', 'lebanese',      'soon', false);

-- المسار الأول: السيارات. عمولة 20% على السطحات والورش؛ الإنقاذ الطرقي كذلك.
insert into service_categories (id, agent_id, name_ar, name_en, commission_rate, flow) values
  ('car_tow',      'jalal', 'سطحة',                 'Tow truck',        0.2000, 'rfq'),
  ('car_roadside', 'jalal', 'مساعدة على الطريق',    'Roadside help',    0.2000, 'rfq'),
  ('car_garage',   'jalal', 'ورشة سيارات',          'Car garage',       0.2000, 'rfq'),
  ('home_ac',      'talal', 'صيانة تكييف',          'AC maintenance',   0.2000, 'rfq'),
  ('home_clean',   'sara',  'تنظيف المنزل',         'Home cleaning',    0.2000, 'rfq'),
  ('deco_project', 'khaled','ديكور ومقاولات',       'Décor and works',  0.2000, 'inspect_first');
