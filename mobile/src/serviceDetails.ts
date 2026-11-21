import {tr} from './i18n';
import {SERVICES, Service} from './services';

/** Templates transcribed and normalized from the user's 42-page visual reference.
 * The screenshots are visual examples, not verified government advice.
 * Missing or case-specific documents must be checked with competent authorities
 * before activating a transaction for real customers.
 */
export type Bilingual = import('./i18n').Bi;
export type DocumentRequirement = Bilingual & {id:string; optional?:boolean; field?:'text'; minimumAge?:number};
export type ServiceAction = Bilingual & {id:string; icon:string; documents:DocumentRequirement[]};
export type ServiceStructure = {
  id:string;
  about:Bilingual;
  actions:ServiceAction[];
  documents:DocumentRequirement[];
  notes:Bilingual[];
  sourcePages:number[];
  contentStatus:'reference'|'review-required';
  feeStatus:'not-verified';
};
const bi=(ar:string,en:string):Bilingual=>({ar,en});
const doc=(id:string,ar:string,en:string,optional=false):DocumentRequirement=>({id,ar,en,optional});
const draftNote=bi('تختلف المتطلبات والمستندات حسب نوع المعاملة وحالة العميل؛ يلزم تأكيدها قبل التقديم.','Requirements and documents depend on the transaction and applicant; confirm them before submission.');
const govFeeNote=bi('الرسوم والمدة لا تُعرض كأرقام إلا بعد التحقق من الجهة الرسمية.','Exact fees and timelines are not displayed until verified with the authority.');
const definitions:Record<string,Partial<Omit<ServiceStructure,'actions'>>>={
'complete-business':{
 sourcePages:[13],documents:[doc('licence','الرخصة التجارية إن وجدت','Trade Licence, if applicable',true),doc('owner-id','هوية المالك أو جواز سفره','Owner ID or Passport')],
 notes:[draftNote],contentStatus:'reference'
},
'immigration-visas':{
 sourcePages:[3],about:bi(
  'إدارة معاملات التأشيرات والإقامة للشركات وموظفيها لدى الجهات المعنية بالإقامة وشؤون الأجانب.',
  'Assistance with visa and residency transactions for companies and their employees through the relevant immigration authorities.'
 ),documents:[
  doc('signatory','الهوية الإماراتية للمخوّل بالتوقيع','Emirates ID of the Authorized Signatory'),
  doc('trade','الرخصة التجارية السارية','Valid Trade Licence'),
  doc('employment','عقد العمل أو عرض العمل','Employment Contract or Job Offer'),
  doc('passport','صورة جواز السفر','Passport Copy'),
  doc('photo','صورة شخصية حديثة بخلفية بيضاء','Recent Personal Photo (White Background)'),
  doc('residency','نسخة الإقامة الحالية عند الحاجة','Current Residency Copy, if applicable',true),
 ],
 notes:[draftNote],contentStatus:'reference'
},
'moa-amendments':{
 sourcePages:[4],documents:[doc('owners','هويات / جوازات الشركاء','Partners’ IDs or Passports'),doc('licence','الرخصة التجارية القائمة إن وجدت','Existing Trade Licence, if any',true),doc('moa','عقد التأسيس الحالي عند التعديل','Current MOA for amendments',true),doc('authority','وكالة أو تفويض عند الحاجة','Authorization or POA if applicable',true)],
 notes:[draftNote],contentStatus:'reference'
},
'bank-account':{
 sourcePages:[5],documents:[doc('trade','الرخصة التجارية','Trade Licence'),doc('moa','عقد التأسيس','Memorandum of Association'),doc('owners','هويات / جوازات المفوضين','Signatories’ IDs or Passports'),doc('bank','مستندات البنك حسب متطلباته','Bank-Specific Documents',true)],
 notes:[bi('الموافقة على فتح الحساب وقرارات الامتثال من اختصاص البنك.','Account approval and compliance decisions rest with the bank.'),draftNote],contentStatus:'reference'
},
'ejari-companies':{
 sourcePages:[6],documents:[doc('licence','الرخصة التجارية','Trade Licence'),doc('id','هوية المالك أو المفوض','Owner/Authorized Person ID'),doc('contract','عقد الإيجار التجاري','Commercial Tenancy Contract'),doc('property','بيانات العقار أو إثبات الملكية عند الحاجة','Property Evidence, if required',true)],
 notes:[draftNote],contentStatus:'reference'
},
'rta-companies':{
 sourcePages:[7],documents:[doc('licence','الرخصة التجارية السارية','Valid Trade Licence'),doc('id','هوية المفوض','Authorized Person ID'),doc('vehicle','ملكية المركبة أو ملفها','Vehicle Registration / File'),doc('approval','تفويض عند الحاجة','Authorization, if required',true)],
 notes:[draftNote],contentStatus:'reference'
},
'courts-legal-companies':{
 sourcePages:[8],documents:[doc('licence','الرخصة التجارية','Trade Licence'),doc('contracts','العقود والمستندات المتعلقة بالقضية','Case-Related Contracts / Records'),doc('notice','إشعار المحكمة إن وجد','Court Notice, if available',true),doc('poa','وكالة قانونية عند اللزوم','Power of Attorney, if needed',true)],
 notes:[bi('الخدمات القانونية تُنفّذ حسب اختصاص الجهات والمختصين المرخصين.','Legal services are subject to relevant authorities and licensed professionals.'),draftNote],contentStatus:'reference'
},
'corporate-tax':{
 sourcePages:[9],documents:[doc('licence','رخصة تجارية سارية','Valid Trade Licence'),doc('moa','عقد التأسيس أو شهادة التأسيس','MOA / Incorporation Certificate'),doc('id','هويات أو جوازات المالكين أو المفوضين','Owners’ or Signatories’ IDs'),doc('authority','تفويض للممثل عند الحاجة','Representative Authorization, if applicable',true)],
 notes:[govFeeNote,draftNote],contentStatus:'reference'
},
'mohre-company-registration':{
 sourcePages:[10],documents:[doc('licence','الرخصة التجارية','Trade Licence'),doc('id','هوية المالك أو المفوض','Owner / Authorized Person ID'),doc('moa','عقد التأسيس إن طُلب','MOA, if requested',true),doc('extra','مستندات إضافية حسب نوع المنشأة','Additional Establishment Documents',true)],
 notes:[draftNote],contentStatus:'reference'
},
'commercial-ejari':{
 sourcePages:[11],documents:[doc('licence','الرخصة التجارية','Trade Licence'),doc('id','هوية صاحب المنشأة','Establishment Owner ID'),doc('contract','عقد الإيجار الموقّع','Signed Tenancy Agreement'),doc('owner','مستندات مالك العقار عند الحاجة','Landlord Documents, if required',true)],
 notes:[draftNote],contentStatus:'reference'
},
'labor-employment':{
 sourcePages:[12,19],documents:[
  doc('licence','الرخصة التجارية السارية','Valid Trade Licence'),
  doc('owner-id','هوية صاحب المنشأة','Owner Emirates ID'),
  doc('passport','جواز سفر العامل وصورة شخصية','Worker Passport and Personal Photo'),
  doc('permit','نسخة تصريح العمل الحالي','Current Work Permit'),
  doc('offer','عرض العمل أو العقد إن وجد','Job Offer or Employment Contract, if available',true),
  doc('extra','مستندات إضافية حسب نوع المعاملة','Additional Case Documents',true),
 ],
 notes:[bi('قد تختلف الوثائق بحسب نوع التصريح ووضع العامل والمنشأة.','Documents vary by permit type and worker / company circumstances.'),draftNote],contentStatus:'reference'
},
'company-formation':{
 sourcePages:[22],about:bi(
  'مسار تأسيس شركة جديدة في البر الرئيسي لدبي، من اختيار النشاط والشكل القانوني إلى إصدار الرخصة الأولى.',
  'Set up a new Dubai mainland business, from choosing the activity and legal form to issuing its first licence.'
 ),documents:[{"id": "trade-name-1", "ar": "1. الاسم التجاري المقترح (الأولوية الأولى)", "en": "1. Proposed trade name (first preference)", "field": "text"},{"id": "trade-name-2", "ar": "2. الاسم التجاري المقترح", "en": "2. Proposed trade name", "field": "text"},{"id": "trade-name-3", "ar": "3. الاسم التجاري المقترح", "en": "3. Proposed trade name", "field": "text"},doc('partners','جوازات الشركاء','Partners’ Passport Copies'),doc('id','الهويات الإماراتية إن وجدت','Emirates IDs, if any',true),doc('approval','الموافقة الأولية إذا طُلبت','Initial Approval, if required',true),doc('moa','عقد التأسيس عند انطباقه','MOA, where applicable',true)],
 notes:[bi("يرجى إدخال ثلاثة أسماء تجارية مقترحة حسب الأولوية. حجز الاسم يخضع لتوافره وموافقة دائرة الاقتصاد والسياحة بدبي.","Enter three proposed trade names in order of preference. Reservation is subject to availability and approval by Dubai Department of Economy and Tourism."),draftNote],contentStatus:'reference'
},
'legal-translation-companies':{
 sourcePages:[14],documents:[doc('source','المستند المطلوب ترجمته','Document to Translate'),doc('identity','مستند إثبات الهوية عند الحاجة','ID, if requested',true),{...doc('language','اللغة المطلوبة','Target Language'),field:'text'}],
 notes:[draftNote],contentStatus:'reference'
},
'residency-individuals':{
 sourcePages:[27,29],documents:[doc('passport','نسخة جواز السفر','Passport Copy'),doc('id','نسخة الهوية الإماراتية إن وجدت','Emirates ID Copy, if available',true),doc('photo','صورة شخصية حديثة','Recent Personal Photo'),doc('support','عقد عمل أو مستند الكفيل حسب الحالة','Employment / Sponsor Evidence, if applicable',true),doc('amend-passport','جواز سفر المكفول','Sponsored Person Passport'),doc('establishment','بطاقة المنشأة للمستثمر أو الشريك حسب الحالة','Establishment Card for Investor or Partner, if applicable',true),doc('profession','خطاب تغيير المهنة إذا كان الكفيل جهة حكومية','Profession Change Letter for Government Sponsor, if applicable',true),doc('employment','عقد العمل أو بطاقة العمل إذا كان الكفيل من القطاع الخاص','Employment Contract or Labour Card for Private Sponsor, if applicable',true)],
 notes:[draftNote],contentStatus:'reference'
},
'ejari-individuals':{
 sourcePages:[17],documents:[doc('tenancy','عقد الإيجار الموقّع','Signed Tenancy Contract'),doc('id','الهوية الإماراتية للمستأجر','Tenant Emirates ID'),doc('owner','مستندات المالك أو التفويض عند الحاجة','Landlord / Authority Documents, if required',true)],
 notes:[draftNote],contentStatus:'reference'
},
'notary-individuals':{
 sourcePages:[21],documents:[doc('id','الهوية أو جواز السفر','Emirates ID or Passport'),doc('document','المستند المطلوب توثيقه','Document for Notarization'),doc('translation','ترجمة قانونية عند الحاجة','Legal Translation, if required',true)],
 notes:[draftNote],contentStatus:'reference'
},
'courts-individuals':{
 sourcePages:[20],documents:[doc('id','الهوية الإماراتية أو جواز السفر','Emirates ID or Passport'),doc('notice','إشعار القضية إن وجد','Case Notice, if available',true),doc('evidence','المستندات الداعمة','Supporting Documents'),doc('poa','وكالة قانونية إذا لزمت','Power of Attorney, if applicable',true)],
 notes:[draftNote],contentStatus:'reference'
},
'legal-translation-individuals':{
 sourcePages:[14,15],documents:[doc('document','المستند المراد ترجمته','Document to Translate'),{...doc('target','اللغة المطلوبة','Target Language'),field:'text'}],
 notes:[draftNote],contentStatus:'reference'
},
'attestation-individuals':{
 sourcePages:[23],documents:[doc('original','المستند الأصلي أو صورة واضحة','Original or Clear Document Copy'),doc('certificate','شهادة التصديق السابقة عند الحاجة','Previous Attestation if Required',true),doc('support','المستندات الداعمة','Supporting Documents',true)],
 notes:[draftNote],contentStatus:'reference'
},
'rta-individuals':{
 sourcePages:[18],documents:[doc('id','الهوية الإماراتية','Emirates ID'),doc('licence','رخصة القيادة عند الحاجة','Driving Licence, if applicable',true),doc('vehicle','ملكية المركبة عند الحاجة','Vehicle Registration, if applicable',true)],
 notes:[draftNote],contentStatus:'reference'
},
'trade-licenses':{
 about:bi('معاملات الرخص التجارية للشركات القائمة في البر الرئيسي لدبي، بما فيها التجديد وتعديلات بيانات الشركة وعقد التأسيس والإلغاء.',
  'Licence services for existing Dubai mainland businesses, including renewal, company and MOA amendments, and cancellation.'),
 documents:[
  doc('id','هوية المالك أو المفوض','Owner or Authorized Signatory ID'),
  doc('licence','نسخة الرخصة الحالية','Current Trade Licence Copy'),
  doc('tenancy','عقد إيجار أو إيجاري عند الحاجة','Tenancy or Ejari Record, if applicable',true),
  doc('moa','عقد التأسيس الحالي أو ملحق التعديل عند الحاجة','Current MOA or amendment appendix, if applicable',true),
  doc('owners','هويات أو جوازات الشركاء المعنيين عند الحاجة','Relevant partners’ IDs or passports, if applicable',true),
  doc('resolution','قرار الشركاء أو الجهة المخوّلة عند الحاجة','Shareholders’ or authorized body resolution, if applicable',true),
  doc('activity','مستندات النشاط أو الموافقات الخاصة به عند الحاجة','Activity documents or approvals, if applicable',true),
  doc('voucher','إذن دفع التجديد إن صدر','Renewal payment voucher, if issued',true),
  doc('audit','تقرير مدقق الحسابات عند انطباقه','Auditor’s report, if applicable',true),
  doc('sale','عقد التنازل أو البيع عند انطباقه','Transfer or sale agreement, if applicable',true),
  doc('cancellation','مستندات الإلغاء أو التصفية حسب الشكل القانوني','Cancellation or liquidation documents, depending on legal form',true),
 ],
 notes:[bi('تُراجع الرخصة والنشاط والشكل القانوني لتحديد المستندات والموافقات اللازمة لدى الجهة المختصة.',
  'Required documents and approvals depend on the licence, activity and legal form.'),govFeeNote,draftNote],
},
'license-renewal':{documents:[
 doc('licence','نسخة الرخصة الحالية','Current Trade Licence'),
 doc('id','هوية المالك أو المفوض','Owner or Signatory ID'),
 doc('tenancy','عقد الإيجار أو إيجاري عند الحاجة','Tenancy or Ejari Record, if applicable',true),
]},
'license-amendments':{documents:[
 doc('licence','نسخة الرخصة الحالية','Current Trade Licence'),
 doc('id','هوية المفوض','Signatory ID'),
 doc('activity','مستندات النشاط الجديد إن توفرت','New Activity Documents, if available',true),
 doc('resolution','قرار الشركاء عند الحاجة','Shareholders’ Resolution, if applicable',true),
]},
'work-permits':{documents:[
 doc('licence','الرخصة التجارية','Trade Licence'),
 doc('passport','جواز سفر العامل','Worker Passport'),
 doc('permit','نسخة تصريح العمل الحالي','Current Work Permit'),
 doc('offer','عرض العمل أو العقد إن وجد','Job Offer or Employment Contract, if available',true),
]},
'wage-protection':{documents:[
 doc('licence','الرخصة التجارية','Trade Licence'),
 doc('payroll','المستندات المتعلقة بالأجور','Relevant Payroll Documents',true),
 doc('notice','الإشعار أو الملاحظة إن وجدت','Notice, if available',true),
]},
'notary-companies':{documents:[
 doc('licence','الرخصة التجارية','Trade Licence'),
 doc('id','هوية المفوض','Signatory ID'),
 doc('instrument','المستند المراد توثيقه','Document for Notarization'),
 doc('authority','إثبات صلاحية التوقيع عند الحاجة','Proof of Signing Authority, if applicable',true),
]},
'customs':{documents:[
 doc('licence','الرخصة التجارية','Trade Licence'),
 doc('invoice','الفاتورة التجارية إن وجدت','Commercial Invoice, if available',true),
 doc('shipment','مستندات الشحنة إن وجدت','Shipment Documents, if available',true),
 doc('declaration','نسخة البيان الجمركي إن وجد','Customs Declaration, if available',true),
]},
'emirates-id':{documents:[
 doc('passport','جواز السفر','Passport'),
 doc('photo','صورة شخصية حديثة وفق معايير الهيئة؛ مختلفة عن صورة البطاقة الحالية عند التجديد','Recent ICAO-compliant photo; different from the current card photo when renewing'),
 doc('residency','صورة إذن الدخول أو الإقامة أو الكنسلة حسب الحالة','Entry permit, residence or residence cancellation copy, according to case'),
 doc('cancellation','صورة الكنسلة إذا كانت الإقامة ملغاة','Residence cancellation copy, if residence is cancelled',true),
]},
'family-sponsorship':{documents:[
 doc('passport','صورة جواز سفر المكفول','Sponsored Person Passport Copy'),
 doc('photo','صورة شخصية حديثة بخلفية بيضاء','Recent Personal Photo with White Background'),
 {...doc('medical','فحص اللياقة الطبية المعتمد لمن أتم ١٨ سنة','Approved Medical Fitness Certificate for Applicants Aged 18+'),minimumAge:18},
 doc('sponsor-passport','صورة جواز الكفيل','Sponsor Passport Copy'),
 doc('sponsor-residency','صورة إقامة الكفيل','Sponsor Residence Copy'),
 doc('sponsor-id','صورة هوية الكفيل','Sponsor Emirates ID Copy'),
 doc('renewal','صورة الإقامة الحالية للمكفول','Sponsored Person Current Residence Copy'),
 doc('sponsored-id','صورة الهوية الحالية للمكفول','Sponsored Person Current Emirates ID Copy'),
 doc('cancel-sponsor-passport','جواز سفر الكفيل','Sponsor Passport'),
 doc('cancel-sponsored-passport','جواز سفر المكفول','Sponsored Person Passport'),
]},
'residency-fines':{documents:[
 doc('passport','نسخة جواز السفر','Passport Copy'),
 doc('notice','إشعار المخالفة إن وجد','Fine Notice, if available',true),
 doc('residency','نسخة التأشيرة أو الإقامة إن وجدت','Visa or Residency Copy, if available',true),
]},
};

type ActionSpec = readonly [id:string, ar:string, en:string, documentIds:string];
const actionSpecs:Record<string,readonly ActionSpec[]>={
 'complete-business':[
  ["notarize","توثيق عقود الشركات","Notarize Company Contracts","licence owner-id"],
  ["enquire-investor","خدمات المستثمرين","Investor Services Enquiry",""],
  ["enquire-labour","خدمات العمل والعمال","Labour and Employment Enquiry","licence"],
  ["enquire-tax","التسجيل الضريبي","Tax Registration Enquiry","licence"],
  ["enquire-address","العنوان التجاري","Business Address Enquiry",""],
 ],
 'immigration-visas':[
  ["issue-residency","إصدار إقامة جديدة","New Residency Issuance","signatory trade employment passport photo"],
  ["renew-residency","تجديد الإقامة","Residency Renewal","signatory trade passport residency photo"],
  ["cancel-residency","إلغاء الإقامة","Residency Cancellation","signatory trade passport residency"],
  ["transfer-residency","نقل الإقامة (تغيير جهة العمل)","Residency Transfer (Change of Employer)","signatory trade employment passport residency"],
  ["amend-residency","تعديل بيانات الإقامة","Update Residency Details","passport residency"],
  ["issue-entry-visa","إصدار تأشيرة دخول","Entry Visa Issuance","signatory trade passport photo"],
 ],
 'moa-amendments':[
  ["prepare-moa","إعداد عقد التأسيس","Prepare MOA","owners licence authority"],
  ["amend-company","تعديل بيانات الشركة","Amend Company Details","owners licence moa authority"],
  ["amend-partners","إضافة أو انسحاب شريك","Add or Remove a Partner","owners licence moa authority"],
  ["amend-activity","تغيير أو إضافة نشاط","Change or Add a Business Activity","licence moa authority"],
  ["amend-capital","تعديل رأس المال","Modify Share Capital","owners licence moa"],
  ["close-company","حل وتصفية الشركة","Dissolve and Liquidate Company","licence moa authority"],
 ],
 'bank-account':[
  ["open-account","فتح حساب بنكي جديد","Open a New Bank Account","trade moa owners bank"],
  ["activate-account","تفعيل حساب حالي","Activate an Existing Account","trade owners bank"],
  ["amend-account","تحديث بيانات الحساب","Update Account Details","trade owners bank"],
  ["amend-signatories","إضافة أو حذف مفوضين","Add or Remove Signatories","owners moa bank"],
  ["issue-cards","إصدار بطاقات الشركة","Request Company Cards","owners bank"],
  ["close-account","إغلاق حساب الشركة","Close Company Account","owners bank"],
 ],
 'ejari-companies':[
  ["register-tenancy","تسجيل عقد إيجار جديد","Register a Tenancy Contract","licence id contract property"],
  ["renew-tenancy","تجديد عقد الإيجار","Renew a Tenancy Contract","licence id contract"],
  ["amend-tenancy","تعديل بيانات العقد","Amend Tenancy Details","id contract property"],
  ["cancel-tenancy","إلغاء عقد الإيجار","Cancel a Tenancy Contract","id contract"],
  ["issue-certificate","إصدار شهادة إيجاري","Request an Ejari Certificate","id contract"],
 ],
 'rta-companies':[
  ["register-vehicle","تسجيل مركبة جديدة","Register a New Vehicle","licence id vehicle approval"],
  ["renew-vehicle","تجديد ملكية مركبة","Renew Vehicle Registration","licence id vehicle"],
  ["transfer-vehicle","نقل ملكية مركبة","Transfer Vehicle Ownership","id vehicle approval"],
  ["cancel-vehicle","إلغاء تسجيل مركبة","Deregister a Vehicle","id vehicle approval"],
  ["manage-fleet","إدارة أسطول المركبات","Manage Company Fleet","licence vehicle approval"],
  ["issue-traffic-card","إصدار بطاقة المرور للشركة","Request Company Traffic Card","licence id approval"],
 ],
 'courts-legal-companies':[
  ["file-claim","رفع دعوى تجارية","Commercial Lawsuit Enquiry","licence contracts poa"],
  ["enforce-judgment","تنفيذ الأحكام","Judgment Enforcement Enquiry","notice contracts poa"],
  ["respond-notice","الرد على الإنذارات القانونية","Respond to Legal Notices","notice contracts poa"],
  ["review-cheque","قضايا الشيكات","Cheque Case Enquiry","contracts notice"],
  ["collect-claims","تحصيل المطالبات المالية","Debt and Claims Enquiry","licence contracts notice"],
  ["settle-dispute","التسوية الودية","Amicable Settlement Enquiry","contracts notice"],
 ],
 'corporate-tax':[
  ["register-tax","التسجيل في ضريبة الشركات","Corporate Tax Registration","licence moa id authority"],
  ["amend-tax","تعديل بيانات التسجيل","Amend Tax Registration","licence id authority"],
 ],
 'mohre-company-registration':[
  ["register-company","تسجيل منشأة جديدة","Register an Establishment","licence id moa extra"],
  ["amend-company","تحديث بيانات المنشأة","Update Establishment Details","licence id extra"],
  ["add-delegate","إضافة مفوض","Add an Authorized User","licence id extra"],
  ["cancel-company-file","إلغاء أو إيقاف ملف المنشأة","Cancel or Suspend Establishment File","licence id extra"],
  ["manage-permissions","إدارة صلاحيات المنشأة","Manage Establishment Permissions","licence id extra"],
  ["link-company","ربط المنشأة بالنظام","Link Establishment to the System","licence id"],
 ],
 'commercial-ejari':[
  ["issue-ejari","إصدار إيجاري تجاري","Issue Commercial Ejari","licence id contract owner"],
  ["renew-ejari","تجديد إيجاري تجاري","Renew Commercial Ejari","licence id contract"],
  ["amend-contract","تعديل بيانات العقد","Amend Contract Details","id contract owner"],
  ["cancel-ejari","إلغاء إيجاري تجاري","Cancel Commercial Ejari","id contract"],
  ["amend-tenant","تحديث بيانات المستأجر","Update Tenant Details","licence id contract"],
  ["issue-copy","إصدار نسخة معتمدة","Request a Certified Copy","id contract"],
 ],
 'labor-employment':[
  ["issue-permit","إصدار تصريح عمل","Issue a Work Permit","licence owner-id passport offer extra"],
  ["renew-permit","تجديد تصريح العمل","Renew a Work Permit","licence passport permit extra"],
  ["amend-permit","تعديل بيانات تصريح العمل","Amend Work Permit Details","passport permit offer"],
  ["cancel-permit","إلغاء تصريح العمل","Cancel a Work Permit","owner-id passport permit extra"],
  ["amend-worker","تعديل بيانات العامل","Update Worker Details","passport extra"],
  ["transfer-worker","نقل العامل","Transfer a Worker","licence passport extra"],
  ["manage-establishment","إصدار أو تجديد تصريح منشأة","Issue or Renew an Establishment Permit","licence owner-id extra"],
  ["register-wps","التسجيل في نظام حماية الأجور","Register for WPS","licence owner-id extra"],
  ["issue-contract","إصدار عقد عمل","Issue an Employment Contract","licence passport extra"],
 ],
 'company-formation':[
  ['form-company','تأسيس شركة جديدة','Form a New Company','trade-name-1 trade-name-2 trade-name-3 partners id approval moa'],
  ['choose-activity','اختيار النشاط التجاري','Choose a Business Activity',''],
  ['choose-structure','اختيار الشكل القانوني','Choose a Legal Form',''],
  ['reserve-name','حجز الاسم التجاري','Reserve a Trade Name','trade-name-1 trade-name-2 trade-name-3 partners id'],
  ['review-initial-approval','الموافقة المبدئية للتأسيس','Initial Approval for Company Formation','partners id'],
  ['prepare-moa','إعداد عقد تأسيس شركة جديدة','Prepare the New Company MOA','partners id approval'],
  ['issue-licence','إصدار الرخصة الأولى للشركة','Issue the Company’s First Licence','partners id approval moa'],
 ],
 'trade-licenses':[
  ['renew-licence','تجديد الرخصة التجارية','Renew the Trade Licence','licence id tenancy activity'],
  ['review-renewal','مراجعة متطلبات التجديد','Review Renewal Requirements','licence tenancy activity'],
  ['review-renewal-payment','متابعة إذن دفع التجديد','Follow Up on a Renewal Payment Voucher','licence voucher'],
  ['amend-licence','تعديل بيانات الرخصة','Amend Licence Details','licence id'],
  ['amend-trade-name','تعديل الاسم التجاري','Change the Trade Name','licence id resolution'],
  ['amend-activity','إضافة أو تعديل أو حذف نشاط تجاري','Add, Change or Remove a Business Activity','licence id activity'],
  ['amend-location','تغيير موقع الشركة','Change the Business Location','licence id tenancy activity'],
  ['amend-manager','تعديل بيانات المدير أو تغييره','Change the Manager or Their Details','licence id resolution moa'],
  ['amend-contact','تحديث بيانات اتصال الشركة','Update Business Contact Details','licence id'],
  ['amend-moa','تعديل عقد التأسيس أو إعداد ملحق تعديل','Amend the MOA or Prepare an Appendix','licence id moa resolution'],
  ['add-partner','إضافة شريك','Add a Partner','licence id moa owners resolution'],
  ['remove-partner','انسحاب أو إخراج شريك','Remove or Exit a Partner','licence id moa owners resolution sale'],
  ['transfer-shares','نقل الحصص أو تعديل نسبها','Transfer Shares or Change Ownership Percentages','licence id moa owners resolution sale'],
  ['amend-capital','زيادة أو تخفيض رأس المال','Increase or Reduce Share Capital','licence id moa resolution audit'],
  ['amend-beneficial-owner','إضافة أو تعديل المستفيد الحقيقي','Add or Update a Beneficial Owner','licence id owners'],
  ['issue-commercial-permit','إصدار تصريح تجاري','Issue a Commercial Permit','licence id activity'],
  ['cancel-licence','إلغاء رخصة الشركة أو الفرع','Cancel a Company or Branch Licence','licence id cancellation'],
  ['close-company','حل الشركة وتصفيتها','Dissolve and Liquidate the Company','licence id moa resolution cancellation'],
 ],
 'customs':[
  ["register-customs","التسجيل الجمركي للشركة","Customs Registration Enquiry","licence"],
  ["file-declaration","تقديم بيان جمركي","Customs Declaration Enquiry","invoice shipment"],
  ["review-declaration","متابعة بيان جمركي","Follow Up a Customs Declaration","declaration shipment"],
 ],
 'notary-companies':[
  ["notarize-contract","توثيق عقد شركة","Notarize a Company Contract","licence id instrument authority"],
  ["notarize-poa","توثيق وكالة تجارية","Notarize a Company Power of Attorney","id instrument authority"],
  ["notarize-resolution","توثيق قرار الشركاء","Notarize a Shareholder Resolution","licence id instrument"],
 ],
 'legal-translation-companies':[
  ["translate-document","ترجمة قانونية معتمدة","Certified Legal Translation","source language identity"],
  ["translate-contract","ترجمة عقد شركة","Translate a Company Contract","source language"],
  ["translate-incorporation","ترجمة مستند تأسيس","Translate an Incorporation Document","source language"],
 ],
 'residency-individuals':[
  ["issue-residency","إصدار إقامة","Issue Residency","passport photo support"],
  ["renew-residency","تجديد الإقامة","Renew Residency","passport id photo support"],
  ["amend-residency","تعديل بيانات الإقامة","Update Residency Details","amend-passport photo establishment profession employment"],
 ],
 'emirates-id':[
  ["issue-id","إصدار هوية إماراتية","Apply for an Emirates ID","passport photo residency"],
  ["renew-id","تجديد الهوية","Renew an Emirates ID","passport photo cancellation"],
  ["replace-id","بدل فاقد أو تالف للهوية","Replace a Lost or Damaged Emirates ID","passport photo"],
  ["amend-id","تحديث الهاتف والبريد والعنوان","Update Contact Details and Address",""],
 ],
 'ejari-individuals':[
  ["register-tenancy","تسجيل إيجاري سكني","Register Residential Ejari","tenancy id owner"],
  ["renew-tenancy","تجديد إيجاري سكني","Renew Residential Ejari","tenancy id"],
  ["cancel-tenancy","إلغاء إيجاري سكني","Cancel Residential Ejari","id tenancy"],
 ],
 'notary-individuals':[
  ["notarize-poa","توثيق وكالة","Notarize a Power of Attorney","id document translation"],
  ["notarize-declaration","إقرار أو تعهد","Notarize a Declaration or Undertaking","id document"],
  ["notarize-instrument","توثيق محرر","Notarize a Document","id document translation"],
 ],
 'courts-individuals':[
  ["review-case","متابعة قضية","Follow Up a Case","id notice"],
  ["file-request","تقديم طلب للمحكمة","Prepare a Court Request","id evidence poa"],
  ["file-evidence","إيداع مستندات","Submit Supporting Documents","id notice evidence"],
 ],
 'legal-translation-individuals':[
  ["translate-legal","ترجمة قانونية","Request Legal Translation","document target"],
  ["translate-official","ترجمة مستند رسمي","Translate an Official Document","document target"],
 ],
 'attestation-individuals':[
  ["attest-document","تصديق مستند","Attest a Document","original support"],
  ["attest-certificate","تصديق شهادة","Attest a Certificate","original certificate support"],
 ],
 'rta-individuals':[
  ["renew-vehicle","تجديد تسجيل مركبة","Renew Vehicle Registration","id vehicle"],
  ["transfer-vehicle","نقل ملكية مركبة","Transfer Vehicle Ownership","id vehicle"],
  ["review-licence","معاملات رخصة القيادة","Driving Licence Enquiry","id licence"],
 ],
 'license-renewal':[
  ["renew-licence","تجديد الرخصة التجارية","Renew the Trade Licence","licence id tenancy"],
  ["review-renewal","مراجعة متطلبات التجديد","Review Renewal Requirements","licence"],
 ],
 'license-amendments':[
  ["amend-details","تعديل بيانات الرخصة","Update Licence Details","licence id"],
  ["amend-activity","تغيير أو إضافة نشاط","Change or Add a Business Activity","licence id activity"],
  ["amend-owners","تعديل بيانات الشركاء","Update Shareholder Details","licence id resolution"],
 ],
 'work-permits':[
  ["issue-permit","إصدار تصريح عمل","Issue a Work Permit","licence passport offer"],
  ["renew-permit","تجديد تصريح العمل","Renew a Work Permit","licence passport permit"],
  ["amend-permit","تعديل بيانات التصريح","Amend Work Permit Details","passport permit offer"],
  ["cancel-permit","إلغاء تصريح العمل","Cancel a Work Permit","passport permit"],
 ],
 'wage-protection':[
  ["register-wps","التسجيل في نظام حماية الأجور","Register for WPS","licence"],
  ["review-wps","متابعة حالة الأجور","Review WPS Status","licence payroll"],
  ["respond-notice","مراجعة إشعار حماية الأجور","Review a WPS Notice","notice payroll"],
 ],
 'family-sponsorship':[
  ["issue-family","إصدار إقامة لفرد من العائلة","Sponsor a Family Member","passport photo medical sponsor-passport sponsor-residency sponsor-id"],
  ["renew-family","تجديد إقامة العائلة","Renew Family Residency","passport photo medical sponsor-passport sponsor-residency sponsor-id renewal sponsored-id"],
  ["cancel-family","إلغاء إقامة فرد من الأسرة","Cancel Family Residence","cancel-sponsor-passport cancel-sponsored-passport"],
  ["review-eligibility","استفسار عن كفالة العائلة","Family Sponsorship Enquiry",""],
 ],
 'residency-fines':[
  ["review-fine","الاستعلام عن مخالفة إقامة","Check a Residency Fine","passport notice"],
  ["review-options","مراجعة خيارات تسوية المخالفة","Review Residency Fine Options","passport notice residency"],
 ],
};

const actionIcons:Record<string,string>={
  remove:'×', issue:'＋', form:'＋', register:'＋', add:'＋', open:'＋',
  renew:'↻', activate:'↻', amend:'✎', prepare:'▤', notarize:'▤', attest:'▤',
  transfer:'⇄', link:'⇄', cancel:'×', close:'×', file:'▤',
  translate:'文', choose:'☷', review:'?', enquire:'?',
};

export const SERVICE_STRUCTURES:Record<string,ServiceStructure>=Object.fromEntries(
 SERVICES.map(service=>{
  const ref=definitions[service.id];
  const documents=ref.documents??[];
  const documentsById=new Map(documents.map(item=>[item.id,item]));
  const actions=actionSpecs[service.id].map(([id,ar,en,documentIds]):ServiceAction=>({
    id, ar, en,
    icon:actionIcons[id.split('-')[0]]??'▤',
    documents:documentIds.split(' ').filter(Boolean).map(documentId=>{
      const item=documentsById.get(documentId);
      if(!item) throw Error('Unknown document '+service.id+'/'+id+'/'+documentId);
      return item;
    }),
  }));
  return [service.id,{
    id:service.id,
    about:ref.about??bi(service.descAr,service.descEn),
    actions,documents,
    notes:ref.notes??[draftNote],
    sourcePages:ref.sourcePages??[],
    contentStatus:ref.contentStatus??'review-required',
    feeStatus:'not-verified',
  } satisfies ServiceStructure];
 }));
export const structureFor=(id:string)=>SERVICE_STRUCTURES[id];
export const wording=(item:Bilingual,language:import('./i18n').Lang)=>tr(item,language);

export const tradeLicenceSectionTitles: Readonly<Record<string, Bilingual>> = {
  'renew-licence': bi('تجديد الرخصة', 'Licence Renewal'),
  'amend-licence': bi('بيانات الرخصة والنشاط', 'Licence and Activity Details'),
  'amend-moa': bi('عقد التأسيس والشركاء والحصص', 'MOA, Partners and Shares'),
  'issue-commercial-permit': bi('التصاريح والإلغاء', 'Permits and Cancellation'),
};

