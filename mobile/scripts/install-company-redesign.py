"""Slice reviewed business artwork and synchronize the pre-exported web component.
Individual artwork and its renderer are intentionally untouched.
"""
import json, re, shutil
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[2]
app = root / 'expo_app'
ids = list(json.loads((app / 'src/companyBannerCopy.json').read_text()))
assets = app / 'assets/company_redesign'
out = root / 'dist/assets/company-redesign'
out.mkdir(parents=True, exist_ok=True)
for lang in ('ar', 'en'):
    image = Image.open(assets / f'{lang}-sheet.png')
    # Reviewed row boundaries on the square source sheets.
    edges = [0, 180, 360, 540, 720, 887, 1057, 1254] if lang == 'ar' else [0, 183, 361, 540, 720, 894, 1067, 1254]
    for index, service in enumerate(ids):
        x = index % 2 * image.width // 2
        y = index // 2
        tile = image.crop((x, edges[y], x + image.width // 2, edges[y+1]))
        tile.save(assets / f'{service}-{lang}.png')
        shutil.copy2(assets / f'{service}-{lang}.png', out)

aliases = {'ejari-companies':'commercial-ejari', 'license-renewal':'trade-licenses', 'license-amendments':'trade-licenses', 'moa-amendments':'trade-licenses', 'work-permits':'labor-employment'}
source = '''import React from 'react';
import {Image, View} from 'react-native';
import copy from './companyBannerCopy.json';
// Text and icons are part of the reviewed artwork, as in the individual catalogue.
export const companyBannerFonts = {};
const aliases: Record<string,string> = ALIASES;
const artwork: Record<string, {ar: number; en: number}> = {
ASSETS
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
'''.replace('ALIASES',json.dumps(aliases)).replace('ASSETS',',\n'.join(json.dumps(k)+": {ar: require('../assets/company_redesign/"+k+"-ar.png'), en: require('../assets/company_redesign/"+k+"-en.png')}" for k in ids))
(app / 'src/CompanyBanner.tsx').write_text(source)
bundle = next((root/'dist/_expo/static/js/web').glob('AppEntry-*.js'))
text = bundle.read_text()
start = text.index('_e.CompanyBanner=function(')
end = text.index('},r(d[0]);', start)
replacement = '''_e.CompanyBanner=function({id:e,language:u,width:y}){const x=p[e]??e,j=h.default[x];if(!j)return null;return(0,v.jsx)(o.default,{style:b.frame,children:(0,v.jsx)(t.default,{source:{uri:'/assets/company-redesign/'+x+'-'+u+'.png'},resizeMode:'stretch',style:{width:'100%',height:'100%'},accessibilityLabel:j[u].title+'. '+j[u].subtitle})})}'''
text = text[:start]+replacement+text[end+1:]
bundle.write_text(text)
print('Installed 28 company banners; individual renderer and artwork preserved.')
