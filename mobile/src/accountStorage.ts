import {isLang} from './i18n';
import {Platform} from 'react-native';
import {File, Paths} from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import {ImageManipulator,SaveFormat} from 'expo-image-manipulator';
import {catalogueServiceId} from './services';

export type AccountData = {
  name:string;
  email:string;
  phone:string;
  company:string;
  license:string;
  photo:string;
  favorites:string[];
  language?:import('./i18n').Lang;
};

export const emptyAccount:AccountData = {
  name:'',email:'',phone:'',company:'',license:'',photo:'',favorites:[],
};

const storageKey='truthful-pro-account-preview-v1';
const maxPhotoSize=2*1024*1024;
const PHOTO_PX=512;
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
      ...(isLang(parsed.language)?{language:parsed.language}:{}),
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

/**
 * Profile photo from the photo library (gallery), cropped to a square by the system editor, then
 * re-encoded as a 512 px JPEG so it is small enough to keep on the device (iPhone HEIC and large camera
 * photos are converted, not rejected). Returns a data URI, or null if the person cancelled.
 * Errors: 'permission' (library access refused), 'format' (unreadable image).
 */
export async function chooseAccountPhoto():Promise<string|null> {
  if(Platform.OS!=='web'){
    const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
    if(!permission.granted) throw Error('permission');
  }
  const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],shape:'oval',quality:1,exif:false});
  if(result.canceled||!result.assets?.length) return null;
  const context=ImageManipulator.manipulate(result.assets[0].uri);
  context.resize({width:PHOTO_PX});
  const image=await context.renderAsync();
  const saved=await image.saveAsync({format:SaveFormat.JPEG,compress:0.82,base64:true});
  const data=saved.base64?(saved.base64.startsWith('data:')?saved.base64:'data:image/jpeg;base64,'+saved.base64):'';
  if(!data.startsWith('data:image/jpeg;base64,/9j/')) throw Error('format');
  if(data.length>Math.ceil(maxPhotoSize/3)*4+30) throw Error('size');
  return data;
}

