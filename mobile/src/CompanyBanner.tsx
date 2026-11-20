import React from 'react';
import {Image, View} from 'react-native';
import copy from './companyBannerCopy.json';
// Text and icons are part of the reviewed artwork, as in the individual catalogue.
export const companyBannerFonts = {};
const aliases: Record<string,string> = {"ejari-companies": "commercial-ejari", "license-renewal": "trade-licenses", "license-amendments": "trade-licenses", "moa-amendments": "trade-licenses", "work-permits": "labor-employment"};
const artwork: Record<string, {ar: number; en: number}> = {
"trade-licenses": {ar: require('../assets/company_redesign/trade-licenses-ar.png'), en: require('../assets/company_redesign/trade-licenses-en.png')},
"company-formation": {ar: require('../assets/company_redesign/company-formation-ar.png'), en: require('../assets/company_redesign/company-formation-en.png')},
"immigration-visas": {ar: require('../assets/company_redesign/immigration-visas-ar.png'), en: require('../assets/company_redesign/immigration-visas-en.png')},
"labor-employment": {ar: require('../assets/company_redesign/labor-employment-ar.png'), en: require('../assets/company_redesign/labor-employment-en.png')},
"mohre-company-registration": {ar: require('../assets/company_redesign/mohre-company-registration-ar.png'), en: require('../assets/company_redesign/mohre-company-registration-en.png')},
"corporate-tax": {ar: require('../assets/company_redesign/corporate-tax-ar.png'), en: require('../assets/company_redesign/corporate-tax-en.png')},
"commercial-ejari": {ar: require('../assets/company_redesign/commercial-ejari-ar.png'), en: require('../assets/company_redesign/commercial-ejari-en.png')},
"bank-account": {ar: require('../assets/company_redesign/bank-account-ar.png'), en: require('../assets/company_redesign/bank-account-en.png')},
"wage-protection": {ar: require('../assets/company_redesign/wage-protection-ar.png'), en: require('../assets/company_redesign/wage-protection-en.png')},
"legal-translation-companies": {ar: require('../assets/company_redesign/legal-translation-companies-ar.png'), en: require('../assets/company_redesign/legal-translation-companies-en.png')},
"notary-companies": {ar: require('../assets/company_redesign/notary-companies-ar.png'), en: require('../assets/company_redesign/notary-companies-en.png')},
"rta-companies": {ar: require('../assets/company_redesign/rta-companies-ar.png'), en: require('../assets/company_redesign/rta-companies-en.png')},
"courts-legal-companies": {ar: require('../assets/company_redesign/courts-legal-companies-ar.png'), en: require('../assets/company_redesign/courts-legal-companies-en.png')},
"customs": {ar: require('../assets/company_redesign/customs-ar.png'), en: require('../assets/company_redesign/customs-en.png')}
};
export function CompanyBanner({id,language,width}:{id:string;language:'ar'|'en';width:number}) {
  const key=aliases[id]??id;
  const item=copy[key as keyof typeof copy];
  if (!item || !artwork[key]) return null;
  return <View style={{width:'100%',aspectRatio:750/219,overflow:'hidden'}}>
    <Image source={artwork[key][language]} resizeMode="stretch"
      style={{width:'100%',height:'100%'}} accessibilityLabel={`${item[language].title}. ${item[language].subtitle}`}/>
  </View>;
}
