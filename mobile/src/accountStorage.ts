import {Platform} from 'react-native';
import {File, Paths} from 'expo-file-system';
import {getDocumentAsync} from 'expo-document-picker';
import {catalogueServiceId} from './services';

export type AccountData = {
  name:string;
  email:string;
  phone:string;
  company:string;
  license:string;
  photo:string;
  favorites:string[];
  language?:'ar'|'en';
};

export const emptyAccount:AccountData = {
  name:'',email:'',phone:'',company:'',license:'',photo:'',favorites:[],
};

const storageKey='truthful-pro-account-preview-v1';
const maxPhotoSize=2*1024*1024;
const imageFormats:Record<string,string>={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp'};
const dataFile=()=>new File(Paths.document,storageKey+'.json');

export function readAccount():AccountData {
  try {
    const saved=Platform.OS==='web' ? window.localStorage.getItem(storageKey) : dataFile().textSync();
    if(!saved) return emptyAccount;
    const parsed=JSON.parse(saved);
    if(!parsed||typeof parsed!=='object') return emptyAccount;
    const rawFavorites:unknown[]=Array.isArray(parsed.favorites)?parsed.favorites:[];
    const favorites=[...new Set(rawFavorites.filter((id):id is string=>typeof id==='string').map(catalogueServiceId))];
    return {
      ...emptyAccount,
      ...Object.fromEntries(['name','email','phone','company','license'].map(key=>[key,typeof parsed[key]==='string'?parsed[key]:''])),
      photo:typeof parsed.photo==='string'&&/^data:image\/(jpeg|png|webp);base64,/.test(parsed.photo)?parsed.photo:'',
      favorites,
      ...(parsed.language==='ar'||parsed.language==='en'?{language:parsed.language}:{}),
    };
  } catch {
    return emptyAccount;
  }
}

export function saveAccount(account:AccountData) {
  const payload=JSON.stringify(account);
  if(Platform.OS==='web') window.localStorage.setItem(storageKey,payload);
  else dataFile().writeSync(payload);
}

export async function chooseAccountPhoto():Promise<string|null> {
  const result=await getDocumentAsync({
    type:['image/jpeg','image/png','image/webp'],
    multiple:false,
    copyToCacheDirectory:true,
    base64:Platform.OS==='web',
  });
  if(result.canceled) return null;
  const asset=result.assets[0];
  const mime=imageFormats[asset.name.split('.').pop()?.toLowerCase()??''];
  if(!mime||(asset.mimeType&&asset.mimeType!==mime&&asset.mimeType!=='application/octet-stream')) throw Error('format');
  if(asset.size!==undefined&&asset.size>maxPhotoSize) throw Error('size');
  const data=Platform.OS==='web'
    ? asset.base64
    : 'data:'+mime+';base64,'+await new File(asset.uri).base64();
  const signature=mime==='image/jpeg'?'/9j/':mime==='image/png'?'iVBORw0KGgo':'UklGR';
  if(!data||!data.startsWith('data:'+mime+';base64,'+signature)) throw Error('format');
  if(data.length>Math.ceil(maxPhotoSize/3)*4+30) throw Error('size');
  return data;
}

