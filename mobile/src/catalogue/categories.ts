/**
 * Unified service catalogue (owner decision, 21 Nov 2026).
 * One list of main services shared by Individuals and Companies, so the same service always has the same name;
 * the audience tab only decides which branches appear under it.
 * Branches point at the existing service IDs (see `catalogueServices` in ../services), so saved requests, favourites
 * and the backend keep working unchanged.
 */
import {catalogueServiceId,catalogueServices,type Service} from '../services';

export type Bi={ar:string;en:string};
export type CategoryId='residency'|'emirates-id'|'business'|'labour'|'ejari'|'notary'|'courts'|'translation'|'attestation'|'rta'|'tax'|'bank'|'customs';
export type Branch={serviceId:string;title:Bi;desc:Bi};
export type Category={id:CategoryId;title:Bi;desc:Bi;individuals:Branch[];companies:Branch[]};

const b=(serviceId:string,ar:string,en:string,descAr:string,descEn:string):Branch=>({serviceId,title:{ar,en},desc:{ar:descAr,en:descEn}});

export const CATEGORIES:Category[]=[
  {id:'residency',title:{ar:'الإقامة والتأشيرات',en:'Residency & Visas'},desc:{ar:'إصدار وتجديد الإقامات والتأشيرات وشؤون الجوازات',en:'Issue and renew residency, visas and passport matters'},
    individuals:[
      b('residency-individuals','الإقامة','Residency','إصدار وتجديد وإلغاء الإقامة','Issue, renew and cancel residency'),
      b('family-sponsorship','لمّ شمل العائلة','Family sponsorship','كفالة الزوجة والأبناء والوالدين','Sponsor your spouse, children and parents'),
      b('residency-fines','مخالفات الإقامة','Residency fines','الاستعلام عن المخالفات وخيارات تسويتها','Check fines and settlement options'),
    ],
    companies:[
      b('immigration-visas','تأشيرات وإقامات الموظفين','Employee visas & residency','تأشيرات العمل والإقامة وشؤون جوازات الموظفين','Work visas, residency and employee passport matters'),
    ]},
  {id:'emirates-id',title:{ar:'الهوية الإماراتية',en:'Emirates ID'},desc:{ar:'إصدار وتجديد وتحديث بطاقة الهوية',en:'Issue, renew and update your Emirates ID'},
    individuals:[b('emirates-id','الهوية الإماراتية','Emirates ID','إصدار وتجديد وبدل فاقد وتحديث البيانات','Issue, renew, replace and update')],
    companies:[]},
  {id:'business',title:{ar:'تأسيس الشركات والرخص التجارية',en:'Company Setup & Trade Licences'},desc:{ar:'تأسيس الشركات وإصدار الرخص وتجديدها وتعديلها',en:'Form companies, issue, renew and amend licences'},
    individuals:[],
    companies:[
      b('company-formation','تأسيس شركة','Company formation','اختيار الشكل القانوني والنشاط وتأسيس الشركة','Legal form, activity and incorporation'),
      b('trade-licenses','الرخصة التجارية','Trade licence','إصدار وتجديد وتعديل الرخصة وعقد التأسيس','Issue, renew and amend the licence and MOA'),
    ]},
  {id:'labour',title:{ar:'الموارد البشرية والعمالة',en:'Human Resources & Labour'},desc:{ar:'معاملات وزارة الموارد البشرية والتوطين',en:'Ministry of Human Resources and Emiratisation (MOHRE)'},
    individuals:[],
    companies:[
      b('mohre-company-registration','تسجيل المنشأة','Establishment registration','تسجيل المنشأة وتحديث بياناتها لدى الوزارة','Register and update the establishment with MOHRE'),
      b('labor-employment','عقود وتصاريح العمل','Work contracts & permits','عقود العمل وتصاريح العمل وشؤون العمال','Employment contracts, work permits and staff matters'),
      b('wage-protection','نظام حماية الأجور (WPS)','Wage Protection System (WPS)','التسجيل في النظام ومتابعة الرواتب','Enrol and keep salaries compliant'),
    ]},
  {id:'ejari',title:{ar:'إيجاري',en:'Ejari'},desc:{ar:'تسجيل عقود الإيجار وتجديدها وإلغاؤها',en:'Register, renew and cancel tenancy contracts'},
    individuals:[b('ejari-individuals','إيجاري سكني','Residential Ejari','تسجيل عقد الإيجار السكني وتجديده وإلغاؤه','Register, renew and cancel a residential tenancy')],
    companies:[b('commercial-ejari','إيجاري تجاري','Commercial Ejari','عقد إيجار مقر الشركة لإصدار الرخصة وتجديدها','Company premises tenancy for the licence')]},
  {id:'notary',title:{ar:'كاتب العدل',en:'Notary Public'},desc:{ar:'التوكيلات والإقرارات وتوثيق المحررات',en:'Powers of attorney, declarations and notarisation'},
    individuals:[b('notary-individuals','كاتب العدل للأفراد','Notary for individuals','توكيلات وإقرارات شخصية','Personal powers of attorney and declarations')],
    companies:[b('notary-companies','كاتب العدل للشركات','Notary for companies','توكيلات الشركات وقرارات الشركاء','Company powers of attorney and partner resolutions')]},
  {id:'courts',title:{ar:'المحاكم والخدمات القانونية',en:'Courts & Legal Services'},desc:{ar:'متابعة القضايا والطلبات أمام المحاكم',en:'Follow cases and applications with the courts'},
    individuals:[b('courts-individuals','الخدمات القضائية للأفراد','Court services for individuals','رفع الطلبات ومتابعة القضايا','File applications and follow cases')],
    companies:[b('courts-legal-companies','الخدمات القضائية للشركات','Court services for companies','القضايا التجارية والعمالية للشركات','Commercial and labour cases for companies')]},
  {id:'translation',title:{ar:'الترجمة القانونية',en:'Legal Translation'},desc:{ar:'ترجمة معتمدة للمستندات الرسمية',en:'Certified translation of official documents'},
    individuals:[b('legal-translation-individuals','ترجمة مستندات شخصية','Personal documents','شهادات وعقود ومستندات شخصية','Certificates, contracts and personal papers')],
    companies:[b('legal-translation-companies','ترجمة مستندات الشركات','Company documents','عقود ورخص ومستندات الشركات','Contracts, licences and company papers')]},
  {id:'attestation',title:{ar:'تصديق المستندات',en:'Document Attestation'},desc:{ar:'تصديق الشهادات والمستندات من الجهات المختصة',en:'Attest certificates and documents with the authorities'},
    individuals:[b('attestation-individuals','تصديق المستندات','Document attestation','الشهادات الدراسية والعائلية والمستندات الرسمية','Educational, family and official documents')],
    companies:[]},
  {id:'rta',title:{ar:'هيئة الطرق والمواصلات',en:'Roads & Transport Authority'},desc:{ar:'معاملات المركبات والرخص (RTA)',en:'Vehicle and licensing transactions (RTA)'},
    individuals:[b('rta-individuals','معاملات الأفراد','Individual transactions','تسجيل المركبات ورخص القيادة','Vehicle registration and driving licences')],
    companies:[b('rta-companies','معاملات الشركات','Company transactions','مركبات الشركة وتصاريحها','Company vehicles and permits')]},
  {id:'tax',title:{ar:'الضرائب',en:'Tax'},desc:{ar:'التسجيل في ضريبة الشركات',en:'Corporate tax registration'},
    individuals:[],
    companies:[b('corporate-tax','ضريبة الشركات','Corporate tax','التسجيل لدى الهيئة الاتحادية للضرائب','Registration with the Federal Tax Authority')]},
  {id:'bank',title:{ar:'الحسابات البنكية',en:'Bank Accounts'},desc:{ar:'تجهيز ملف فتح حساب الشركة',en:'Prepare the company account opening file'},
    individuals:[],
    companies:[b('bank-account','فتح حساب للشركة','Company account opening','تجهيز المستندات ومتابعة طلب البنك','Prepare documents and follow the bank application')]},
  {id:'customs',title:{ar:'الجمارك',en:'Customs'},desc:{ar:'التسجيل الجمركي والمعاملات المرتبطة به',en:'Customs registration and related transactions'},
    individuals:[],
    companies:[b('customs','الخدمات الجمركية','Customs services','كود جمركي وتسجيل المنشأة لدى الجمارك','Customs code and registration')]},
];

const byService=new Map(catalogueServices.map(s=>[s.id,s]));

export const branchesFor=(c:Category,business:boolean)=>business?c.companies:c.individuals;
export const categoriesFor=(business:boolean)=>CATEGORIES.filter(c=>branchesFor(c,business).length>0);
export const serviceForBranch=(br:Branch):Service|undefined=>byService.get(br.serviceId);

/** The main service and branch a (possibly historical) service ID belongs to. */
export function locate(serviceId:string):{category:Category;branch:Branch;business:boolean}|undefined{
  const id=catalogueServiceId(serviceId);
  for(const category of CATEGORIES){
    for(const business of [false,true]){
      const branch=branchesFor(category,business).find(x=>x.serviceId===id);
      if(branch)return {category,branch,business};
    }
  }
  return undefined;
}
