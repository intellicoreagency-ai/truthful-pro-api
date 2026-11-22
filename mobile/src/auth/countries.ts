/**
 * Country dialling codes for the phone field. The UAE comes first, then the Gulf and Arab countries, then the rest of the
 * world (customers and investors may write from anywhere). Any code not listed can still be typed in the picker's search.
 * [ISO 3166 code, dialling code without "+", English name, Arabic name]
 */
export type Country={iso:string;dial:string;en:string;ar:string};
const C=(iso:string,dial:string,en:string,ar:string):Country=>({iso,dial,en,ar});

export const COUNTRIES:readonly Country[]=[
  C('AE','971','United Arab Emirates','الإمارات'),
  C('SA','966','Saudi Arabia','السعودية'),C('KW','965','Kuwait','الكويت'),C('QA','974','Qatar','قطر'),C('BH','973','Bahrain','البحرين'),C('OM','968','Oman','عُمان'),
  C('EG','20','Egypt','مصر'),C('JO','962','Jordan','الأردن'),C('LB','961','Lebanon','لبنان'),C('SY','963','Syria','سوريا'),C('IQ','964','Iraq','العراق'),
  C('PS','970','Palestine','فلسطين'),C('YE','967','Yemen','اليمن'),C('SD','249','Sudan','السودان'),C('LY','218','Libya','ليبيا'),C('TN','216','Tunisia','تونس'),
  C('DZ','213','Algeria','الجزائر'),C('MA','212','Morocco','المغرب'),C('MR','222','Mauritania','موريتانيا'),C('SO','252','Somalia','الصومال'),C('DJ','253','Djibouti','جيبوتي'),C('KM','269','Comoros','جزر القمر'),
  C('IN','91','India','الهند'),C('PK','92','Pakistan','باكستان'),C('BD','880','Bangladesh','بنغلاديش'),C('LK','94','Sri Lanka','سريلانكا'),C('NP','977','Nepal','نيبال'),C('AF','93','Afghanistan','أفغانستان'),
  C('PH','63','Philippines','الفلبين'),C('CN','86','China','الصين'),C('HK','852','Hong Kong','هونغ كونغ'),C('JP','81','Japan','اليابان'),C('KR','82','South Korea','كوريا الجنوبية'),
  C('SG','65','Singapore','سنغافورة'),C('MY','60','Malaysia','ماليزيا'),C('ID','62','Indonesia','إندونيسيا'),C('TH','66','Thailand','تايلاند'),C('VN','84','Vietnam','فيتنام'),
  C('RU','7','Russia','روسيا'),C('KZ','7','Kazakhstan','كازاخستان'),C('UZ','998','Uzbekistan','أوزبكستان'),C('UA','380','Ukraine','أوكرانيا'),C('AZ','994','Azerbaijan','أذربيجان'),
  C('GE','995','Georgia','جورجيا'),C('AM','374','Armenia','أرمينيا'),C('BY','375','Belarus','بيلاروسيا'),C('KG','996','Kyrgyzstan','قيرغيزستان'),C('TJ','992','Tajikistan','طاجيكستان'),C('TM','993','Turkmenistan','تركمانستان'),
  C('TR','90','Türkiye','تركيا'),C('IR','98','Iran','إيران'),C('CY','357','Cyprus','قبرص'),
  C('GB','44','United Kingdom','المملكة المتحدة'),C('FR','33','France','فرنسا'),C('DE','49','Germany','ألمانيا'),C('IT','39','Italy','إيطاليا'),C('ES','34','Spain','إسبانيا'),
  C('NL','31','Netherlands','هولندا'),C('BE','32','Belgium','بلجيكا'),C('CH','41','Switzerland','سويسرا'),C('AT','43','Austria','النمسا'),C('IE','353','Ireland','أيرلندا'),
  C('PT','351','Portugal','البرتغال'),C('GR','30','Greece','اليونان'),C('SE','46','Sweden','السويد'),C('NO','47','Norway','النرويج'),C('DK','45','Denmark','الدنمارك'),C('FI','358','Finland','فنلندا'),
  C('PL','48','Poland','بولندا'),C('CZ','420','Czechia','التشيك'),C('HU','36','Hungary','المجر'),C('RO','40','Romania','رومانيا'),C('BG','359','Bulgaria','بلغاريا'),C('RS','381','Serbia','صربيا'),
  C('US','1','United States','الولايات المتحدة'),C('CA','1','Canada','كندا'),C('MX','52','Mexico','المكسيك'),C('BR','55','Brazil','البرازيل'),C('AR','54','Argentina','الأرجنتين'),
  C('CO','57','Colombia','كولومبيا'),C('CL','56','Chile','تشيلي'),C('PE','51','Peru','بيرو'),
  C('NG','234','Nigeria','نيجيريا'),C('KE','254','Kenya','كينيا'),C('ET','251','Ethiopia','إثيوبيا'),C('ER','291','Eritrea','إريتريا'),C('UG','256','Uganda','أوغندا'),
  C('TZ','255','Tanzania','تنزانيا'),C('GH','233','Ghana','غانا'),C('ZA','27','South Africa','جنوب أفريقيا'),C('SN','221','Senegal','السنغال'),C('CM','237','Cameroon','الكاميرون'),
  C('AU','61','Australia','أستراليا'),C('NZ','64','New Zealand','نيوزيلندا'),
];
export const DEFAULT_COUNTRY=COUNTRIES[0]!;

/** Flag emoji from the ISO code (regional indicator letters); a globe for a typed code that is not in the list. */
export const flagOf=(iso:string)=>/^[A-Z]{2}$/.test(iso)?String.fromCodePoint(...[...iso].map(c=>0x1F1E6+c.charCodeAt(0)-65)):'🌐';

/** Country name in the app language: Arabic and English from the list, the others from the device (Intl) when it can. */
export function countryName(c:Country,lang:string):string{
  if(lang==='ar')return c.ar;
  if(lang==='en')return c.en;
  try{const D=(Intl as unknown as {DisplayNames?:new(l:string[],o:{type:'region'})=>{of:(code:string)=>string|undefined}}).DisplayNames;
    if(D&&/^[A-Z]{2}$/.test(c.iso))return new D([lang],{type:'region'}).of(c.iso)??c.en;}catch{/* fall back to English */}
  return c.en;
}
