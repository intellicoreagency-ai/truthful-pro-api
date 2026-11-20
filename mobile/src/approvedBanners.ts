import type {ImageSourcePropType} from 'react-native';

type Language='ar'|'en';
type BannerSet=Partial<Record<Language|'bilingual',ImageSourcePropType>>;
const REGISTRY:Record<string,BannerSet>={
  "complete-business":{bilingual:require('../assets/approved_banners/bilingual/complete-business.webp')},
  "category-companies":{bilingual:require('../assets/approved_banners/bilingual/category-companies.webp')},
  "immigration-visas":{bilingual:require('../assets/approved_banners/bilingual/immigration-visas.webp')},
  "moa-amendments":{bilingual:require('../assets/approved_banners/bilingual/moa-amendments.webp')},
  "bank-account":{bilingual:require('../assets/approved_banners/bilingual/bank-account.webp')},
  "ejari-companies":{bilingual:require('../assets/approved_banners/bilingual/ejari-companies.webp')},
  "rta-companies":{bilingual:require('../assets/approved_banners/bilingual/rta-companies.webp')},
  "courts-legal-companies":{bilingual:require('../assets/approved_banners/bilingual/courts-legal-companies.webp')},
  "corporate-tax":{bilingual:require('../assets/approved_banners/bilingual/corporate-tax.webp')},
  "mohre-company-registration":{bilingual:require('../assets/approved_banners/bilingual/mohre-company-registration.webp')},
  "labor-employment":{bilingual:require('../assets/approved_banners/bilingual/labor-employment.webp')},
  "residency-individuals":{ar:require('../assets/approved_banners/ar/residency-individuals.webp'),en:require('../assets/approved_banners/en/residency-individuals.webp')},
  "emirates-id":{ar:require('../assets/approved_banners/ar/emirates-id.webp'),en:require('../assets/approved_banners/en/emirates-id.webp')},
  "ejari-individuals":{ar:require('../assets/approved_banners/ar/ejari-individuals.webp'),en:require('../assets/approved_banners/en/ejari-individuals.webp')},
  "notary-individuals":{ar:require('../assets/approved_banners/ar/notary-individuals.webp'),en:require('../assets/approved_banners/en/notary-individuals.webp')},
  "courts-individuals":{ar:require('../assets/approved_banners/ar/courts-individuals.webp'),en:require('../assets/approved_banners/en/courts-individuals.webp')},
  "legal-translation-individuals":{ar:require('../assets/approved_banners/ar/legal-translation-individuals.webp'),en:require('../assets/approved_banners/en/legal-translation-individuals.webp')},
  "attestation-individuals":{ar:require('../assets/approved_banners/ar/attestation-individuals.webp'),en:require('../assets/approved_banners/en/attestation-individuals.webp')},
  "rta-individuals":{ar:require('../assets/approved_banners/ar/rta-individuals.webp'),en:require('../assets/approved_banners/en/rta-individuals.webp')},
  "family-sponsorship":{ar:require('../assets/approved_banners/ar/family-sponsorship.webp'),en:require('../assets/approved_banners/en/family-sponsorship.webp')},
  "residency-fines":{ar:require('../assets/approved_banners/ar/residency-fines.webp'),en:require('../assets/approved_banners/en/residency-fines.webp')},
  "company-formation":{ar:require('../assets/approved_banners/ar/company-formation.webp'),en:require('../assets/approved_banners/en/company-formation.webp')},
  "trade-licenses":{ar:require('../assets/approved_banners/ar/trade-licenses.webp'),en:require('../assets/approved_banners/en/trade-licenses.webp')},
  "customs":{ar:require('../assets/approved_banners/ar/customs.webp'),en:require('../assets/approved_banners/en/customs.webp')},
  "notary-companies":{ar:require('../assets/approved_banners/ar/notary-companies.webp'),en:require('../assets/approved_banners/en/notary-companies.webp')},
  "legal-translation-companies":{ar:require('../assets/approved_banners/ar/legal-translation-companies.webp'),en:require('../assets/approved_banners/en/legal-translation-companies.webp')},
  "license-renewal":{ar:require('../assets/approved_banners/ar/license-renewal.webp'),en:require('../assets/approved_banners/en/license-renewal.webp')},
  "license-amendments":{ar:require('../assets/approved_banners/ar/license-amendments.webp'),en:require('../assets/approved_banners/en/license-amendments.webp')},
  "work-permits":{ar:require('../assets/approved_banners/ar/work-permits.webp'),en:require('../assets/approved_banners/en/work-permits.webp')},
  "wage-protection":{ar:require('../assets/approved_banners/ar/wage-protection.webp'),en:require('../assets/approved_banners/en/wage-protection.webp')},
};
export const approvedBannerFor=(id:string,lang:Language):ImageSourcePropType|undefined=>REGISTRY[id]?.[lang]??REGISTRY[id]?.bilingual;
export const approvedBannerCount=()=>Object.keys(REGISTRY).length;


// Visible bounds of the approved artwork inside the padded source files.
const FRAMES:Record<string,Record<string,readonly [number,number,number,number]>>={
  "ar": {
    "attestation-individuals": [
      110,
      0,
      740,
      226
    ],
    "company-formation": [
      139,
      0,
      683,
      226
    ],
    "courts-individuals": [
      110,
      0,
      740,
      226
    ],
    "customs": [
      152,
      0,
      656,
      226
    ],
    "ejari-individuals": [
      110,
      0,
      740,
      226
    ],
    "emirates-id": [
      108,
      0,
      758,
      226
    ],
    "family-sponsorship": [
      110,
      0,
      740,
      226
    ],
    "legal-translation-companies": [
      151,
      6,
      659,
      220
    ],
    "legal-translation-individuals": [
      108,
      0,
      758,
      226
    ],
    "license-amendments": [
      102,
      2,
      757,
      224
    ],
    "license-renewal": [
      147,
      6,
      674,
      220
    ],
    "notary-companies": [
      148,
      0,
      670,
      226
    ],
    "notary-individuals": [
      108,
      0,
      758,
      226
    ],
    "residency-fines": [
      108,
      0,
      758,
      226
    ],
    "residency-individuals": [
      110,
      0,
      740,
      226
    ],
    "rta-individuals": [
      108,
      0,
      758,
      226
    ],
    "trade-licenses": [
      134,
      0,
      698,
      226
    ],
    "wage-protection": [
      8,
      14,
      923,
      190
    ],
    "work-permits": [
      96,
      2,
      775,
      223
    ]
  },
  "bilingual": {
    "bank-account": [
      0,
      28,
      956,
      171
    ],
    "category-companies": [
      42,
      24,
      918,
      182
    ],
    "complete-business": [
      0,
      24,
      956,
      180
    ],
    "corporate-tax": [
      0,
      27,
      955,
      166
    ],
    "courts-legal-companies": [
      41,
      32,
      919,
      163
    ],
    "ejari-companies": [
      0,
      27,
      960,
      174
    ],
    "immigration-visas": [
      0,
      28,
      956,
      172
    ],
    "labor-employment": [
      0,
      44,
      958,
      135
    ],
    "moa-amendments": [
      42,
      26,
      918,
      178
    ],
    "mohre-company-registration": [
      45,
      27,
      915,
      170
    ],
    "rta-companies": [
      0,
      33,
      956,
      161
    ]
  },
  "en": {
    "attestation-individuals": [
      110,
      0,
      740,
      222
    ],
    "company-formation": [
      148,
      0,
      674,
      226
    ],
    "courts-individuals": [
      110,
      0,
      740,
      223
    ],
    "customs": [
      160,
      0,
      648,
      226
    ],
    "ejari-individuals": [
      110,
      0,
      740,
      226
    ],
    "emirates-id": [
      108,
      3,
      758,
      223
    ],
    "family-sponsorship": [
      110,
      0,
      740,
      215
    ],
    "legal-translation-companies": [
      159,
      2,
      651,
      216
    ],
    "legal-translation-individuals": [
      108,
      0,
      758,
      224
    ],
    "license-amendments": [
      110,
      0,
      749,
      226
    ],
    "license-renewal": [
      148,
      2,
      664,
      216
    ],
    "notary-companies": [
      149,
      0,
      661,
      226
    ],
    "notary-individuals": [
      108,
      0,
      758,
      226
    ],
    "residency-fines": [
      108,
      0,
      758,
      215
    ],
    "residency-individuals": [
      110,
      3,
      740,
      223
    ],
    "rta-individuals": [
      108,
      0,
      758,
      221
    ],
    "trade-licenses": [
      135,
      0,
      689,
      226
    ],
    "wage-protection": [
      0,
      9,
      960,
      197
    ],
    "work-permits": [
      98,
      0,
      764,
      226
    ]
  }
};
export function bannerFrameFor(id:string,language:Language) {
  const locale=REGISTRY[id]?.[language]!==undefined?language:'bilingual';
  const source=REGISTRY[id]?.[locale];
  const bounds=FRAMES[locale]?.[id];
  return source!==undefined&&bounds?{source,bounds,shared:locale==='bilingual'}:undefined;
}
 
const individualReferences = {
  ar: require('../assets/approved_banners/individuals-reference-ar.jpg'),
  en: require('../assets/approved_banners/individuals-reference-en.jpg'),
};

const referenceOrder = [
  'residency-individuals', 'emirates-id',
  'ejari-individuals', 'notary-individuals',
  'courts-individuals', 'legal-translation-individuals',
  'attestation-individuals', 'rta-individuals',
  'family-sponsorship', 'residency-fines',
];
const referenceRows = {
  ar: [[61, 284], [305, 529], [548, 772], [793, 1017], [1037, 1261]],
  en: [[67, 285], [308, 525], [547, 766], [787, 1007], [1028, 1246]],
};

export function individualCatalogueBannerFor(id: string, language: Language) {
  const index = referenceOrder.indexOf(id);
  if (index < 0) return undefined;

  const [top, bottom] = referenceRows[language][Math.floor(index / 2)];
  const left = index % 2 === 0 ? 9 : 777;
  const right = index % 2 === 0 ? 761 : 1528;
  return {
    source: individualReferences[language],
    bounds: [left, top, right - left, bottom - top] as const,
    shared: false,
    width: 1536,
    height: 1280,
  };
}

const companyArabicSheet = require('../assets/approved_banners/company-reference-ar.jpg');
const companyBilingualSheet = require('../assets/approved_banners/company-reference-bilingual.jpg');

type Bounds = readonly [left:number, top:number, width:number, height:number];
const arabicCompanyFrames: Partial<Record<string, Bounds>> = {
  'company-formation': [10, 55, 750, 240],
  'trade-licenses': [776, 55, 751, 240],
  'customs': [10, 317, 750, 257],
  'notary-companies': [776, 317, 751, 257],
  'legal-translation-companies': [10, 597, 750, 246],
  'wage-protection': [341, 1096, 854, 168],
};
const bilingualCompanyFrames: Partial<Record<string, Bounds>> = {
  'immigration-visas': [9, 161, 754, 133],
  'bank-account': [9, 305, 754, 131],
  'commercial-ejari': [776, 305, 754, 131],
  'rta-companies': [9, 444, 754, 123],
  'courts-legal-companies': [776, 444, 754, 123],
  'corporate-tax': [9, 576, 754, 127],
  'mohre-company-registration': [776, 576, 754, 127],
  'labor-employment': [262, 716, 1011, 136],
};

export function arabicCompanyBannerFor(id: string) {
  const arabicBounds = arabicCompanyFrames[id];
  const bounds = arabicBounds ?? bilingualCompanyFrames[id];
  if(!bounds) return undefined;
  const source = arabicBounds ? companyArabicSheet : companyBilingualSheet;
  const width = 1536;
  const height = arabicBounds ? 1280 : 864;
  return {source,bounds,width,height};
}


