/** Migrated from the existing approved 30-service Flutter catalogue.
 *  Illustrative UI text only: authority eligibility/requirements still need audit.
 */
export type Service = {id:string; business:boolean; ar:string; en:string; descAr:string; descEn:string; slug:string};
export const SERVICES: Service[] = [
  {
    "id": "complete-business",
    "business": true,
    "ar": "خدمات متكاملة للشركات",
    "en": "Complete Business Services",
    "descAr": "خدمات الشركات وإدارة وتطوير الأعمال",
    "descEn": "Company setup and business services",
    "slug": "complete-business"
  },
  {
    "id": "immigration-visas",
    "business": true,
    "ar": "خدمات التأشيرات والهجرة والجوازات",
    "en": "Immigration & Visa Services",
    "descAr": "تأشيرات الموظفين والإقامة وشؤون الجوازات",
    "descEn": "Immigration and visa processing",
    "slug": "immigration-visas"
  },
  {
    "id": "moa-amendments",
    "business": true,
    "ar": "عقد تأسيس الشركات وتعديلاته",
    "en": "Company Incorporation & Amendments",
    "descAr": "إعداد وتوثيق وتعديل عقود تأسيس الشركات",
    "descEn": "MOA and company amendments",
    "slug": "moa-amendments"
  },
  {
    "id": "bank-account",
    "business": true,
    "ar": "خدمات فتح الحسابات البنكية للشركات",
    "en": "Bank Account Opening for Companies",
    "descAr": "المساعدة في تجهيز متطلبات الحسابات البنكية",
    "descEn": "Corporate banking assistance",
    "slug": "bank-account"
  },
  {
    "id": "ejari-companies",
    "business": true,
    "ar": "خدمات إيجاري للعقارات التجارية",
    "en": "Ejari Services for Companies",
    "descAr": "توثيق وإدارة عقود الإيجار التجاري",
    "descEn": "Commercial tenancy documentation",
    "slug": "ejari-companies"
  },
  {
    "id": "rta-companies",
    "business": true,
    "ar": "خدمات هيئة الطرق والمواصلات (RTA)",
    "en": "RTA Services for Companies",
    "descAr": "معاملات المركبات والنقل للشركات",
    "descEn": "Vehicle and transport services",
    "slug": "rta-companies"
  },
  {
    "id": "courts-legal-companies",
    "business": true,
    "ar": "المحاكم والخدمات القانونية للشركات",
    "en": "Court & Legal Services for Companies",
    "descAr": "متابعة المعاملات القضائية للشركات",
    "descEn": "Corporate legal procedures",
    "slug": "courts-legal-companies"
  },
  {
    "id": "corporate-tax",
    "business": true,
    "ar": "التسجيل في ضريبة الشركات",
    "en": "Corporate Tax Registration",
    "descAr": "إجراءات التسجيل لدى الهيئة الاتحادية للضرائب",
    "descEn": "FTA corporate tax registration",
    "slug": "corporate-tax"
  },
  {
    "id": "mohre-company-registration",
    "business": true,
    "ar": "خدمات وزارة العمل",
    "en": "Ministry of Labour Services",
    "descAr": "تسجيل المنشأة وإدارة ملفها لدى وزارة الموارد البشرية (تسهيل)",
    "descEn": "Establishment registration and file management with MOHRE (TAS-HEEL)",
    "slug": "mohre-company-registration"
  },
  {
    "id": "commercial-ejari",
    "business": true,
    "ar": "إيجاري تجاري (مقر الشركة)",
    "en": "Commercial Ejari (Company Premises)",
    "descAr": "تسجيل وتجديد وتعديل وإلغاء إيجاري للعقارات التجارية",
    "descEn": "Register, renew, amend or cancel a commercial Ejari",
    "slug": "commercial-ejari"
  },
  {
    "id": "labor-employment",
    "business": true,
    "ar": "خدمات العمل والعمال",
    "en": "Employment & Labour Services",
    "descAr": "تصاريح العمل وعقود الموظفين ونظام حماية الأجور",
    "descEn": "Work permits, employment contracts and wage protection",
    "slug": "labor-employment"
  },
  {
    "id": "company-formation",
    "business": true,
    "ar": "تأسيس الشركات",
    "en": "Company Formation",
    "descAr": "تأسيس شركة جديدة في دبي وإصدار رخصتها الأولى",
    "descEn": "Set up a new company in Dubai and issue its first licence",
    "slug": "company-formation"
  },
  {
    "id": "trade-licenses",
    "business": true,
    "ar": "الرخص التجارية",
    "en": "Trade Licences",
    "descAr": "تجديد وتعديل وإلغاء رخص الشركات القائمة في دبي",
    "descEn": "Renew, amend or cancel a licence for an existing Dubai business",
    "slug": "trade-licenses"
  },
  {
    "id": "customs",
    "business": true,
    "ar": "الخدمات الجمركية",
    "en": "Customs Services",
    "descAr": "المعاملات الجمركية للشركات",
    "descEn": "Business customs services",
    "slug": "customs"
  },
  {
    "id": "notary-companies",
    "business": true,
    "ar": "كاتب العدل للشركات",
    "en": "Notary Public for Companies",
    "descAr": "عقود الشركة والتوثيق",
    "descEn": "Corporate notarization services",
    "slug": "notary-companies"
  },
  {
    "id": "legal-translation-companies",
    "business": true,
    "ar": "الترجمة القانونية للشركات",
    "en": "Corporate Legal Translation",
    "descAr": "ترجمة مستندات الشركة",
    "descEn": "Corporate legal translation",
    "slug": "legal-translation-companies"
  },
  {
    "id": "residency-individuals",
    "business": false,
    "ar": "الإقامة والتأشيرات",
    "en": "Residency & Visas",
    "descAr": "إصدار وتجديد الإقامات والتأشيرات",
    "descEn": "Residency and visa services",
    "slug": "residency-individuals"
  },
  {
    "id": "emirates-id",
    "business": false,
    "ar": "الهوية الإماراتية",
    "en": "Emirates ID",
    "descAr": "إصدار وتجديد وتعديل بيانات الهوية",
    "descEn": "Emirates ID services",
    "slug": "emirates-id"
  },
  {
    "id": "ejari-individuals",
    "business": false,
    "ar": "إيجاري للأفراد",
    "en": "Personal Ejari Services",
    "descAr": "توثيق عقود الإيجار",
    "descEn": "Tenancy contract registration",
    "slug": "ejari-individuals"
  },
  {
    "id": "notary-individuals",
    "business": false,
    "ar": "كاتب العدل للأفراد",
    "en": "Notary Public",
    "descAr": "توثيق وتعديل المحررات",
    "descEn": "Personal notarization services",
    "slug": "notary-individuals"
  },
  {
    "id": "courts-individuals",
    "business": false,
    "ar": "خدمات المحاكم",
    "en": "Courts & Legal Services",
    "descAr": "متابعة المعاملات القضائية",
    "descEn": "Court and legal procedures",
    "slug": "courts-individuals"
  },
  {
    "id": "legal-translation-individuals",
    "business": false,
    "ar": "الترجمة القانونية",
    "en": "Legal Translation",
    "descAr": "ترجمة المستندات الرسمية",
    "descEn": "Certified legal translation",
    "slug": "legal-translation-individuals"
  },
  {
    "id": "attestation-individuals",
    "business": false,
    "ar": "تصديق المستندات",
    "en": "Document Attestation",
    "descAr": "توثيق وتصديق المستندات",
    "descEn": "Document attestation",
    "slug": "attestation-individuals"
  },
  {
    "id": "rta-individuals",
    "business": false,
    "ar": "خدمات هيئة الطرق والمواصلات",
    "en": "RTA Services",
    "descAr": "معاملات المركبات والمرور",
    "descEn": "Roads and transport services",
    "slug": "rta-individuals"
  },
  {
    "id": "license-renewal",
    "business": true,
    "ar": "تجديد الرخص التجارية",
    "en": "Trade Licence Renewal",
    "descAr": "تجديد الرخصة التجارية ومراجعة المتطلبات",
    "descEn": "Business licence renewals and requirements",
    "slug": "license-renewal"
  },
  {
    "id": "license-amendments",
    "business": true,
    "ar": "تعديل الرخص التجارية",
    "en": "Trade Licence Amendments",
    "descAr": "تعديل بيانات الرخصة التجارية والأنشطة",
    "descEn": "Changes to trade licences and activities",
    "slug": "license-amendments"
  },
  {
    "id": "work-permits",
    "business": true,
    "ar": "تصاريح العمل",
    "en": "Work Permits",
    "descAr": "إجراءات تصاريح العمل للموظفين",
    "descEn": "Employee work permit support",
    "slug": "work-permits"
  },
  {
    "id": "wage-protection",
    "business": true,
    "ar": "حماية الأجور WPS",
    "en": "Wage Protection System (WPS)",
    "descAr": "متابعة معاملات نظام حماية الأجور",
    "descEn": "Wage protection system support",
    "slug": "wage-protection"
  },
  {
    "id": "family-sponsorship",
    "business": false,
    "ar": "لم شمل العائلة",
    "en": "Family Sponsorship",
    "descAr": "استفسارات معاملات إقامة العائلة",
    "descEn": "Family residency and sponsorship support",
    "slug": "family-sponsorship"
  },
  {
    "id": "residency-fines",
    "business": false,
    "ar": "مخالفات الإقامة",
    "en": "Residency Fines",
    "descAr": "مراجعة الوضع والخيارات المتاحة",
    "descEn": "Residency status and available options",
    "slug": "residency-fines"
  }
];
export const serviceLabel = (s:Service,language:'ar'|'en')=>language==='ar'?s.ar:s.en;
export const serviceDescription = (s:Service,language:'ar'|'en')=>language==='ar'?s.descAr:s.descEn;

// Editorial priority until the catalogue has real request counts.
const cataloguePriority = [
  'residency-individuals', 'emirates-id', 'ejari-individuals',
  'family-sponsorship', 'attestation-individuals', 'legal-translation-individuals',
  'residency-fines', 'notary-individuals', 'rta-individuals', 'courts-individuals',
  'trade-licenses', 'company-formation', 'immigration-visas',
  'labor-employment', 'mohre-company-registration',
  'corporate-tax', 'commercial-ejari',
  'bank-account', 'wage-protection',
  'legal-translation-companies', 'notary-companies', 'rta-companies',
  'courts-legal-companies', 'customs',
];
const priorityById = new Map(cataloguePriority.map((id, index) => [id, index]));
// Keep historical IDs readable by saved requests and favourites.
const catalogueAliases = new Map([
  ['ejari-companies', 'commercial-ejari'],
  ['license-renewal', 'trade-licenses'],
  ['license-amendments', 'trade-licenses'],
  ['moa-amendments', 'trade-licenses'],
  ['work-permits', 'labor-employment'],
]);
export const catalogueServiceId = (id:string) => catalogueAliases.get(id) ?? id;
export const catalogueServices = SERVICES.filter(service =>
  service.id !== 'complete-business' && !catalogueAliases.has(service.id),
).sort((a, b) =>
  (priorityById.get(a.id) ?? cataloguePriority.length) -
  (priorityById.get(b.id) ?? cataloguePriority.length),
);

