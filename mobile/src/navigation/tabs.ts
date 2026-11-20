import type {IconName} from '../Icons';

/** The five root destinations, in display order. `request` is the primary action (raised "+"). */
export type TabKey='home'|'services'|'request'|'requests'|'profile';
export type TabItem={key:TabKey;icon:IconName;primary?:boolean};
export const TABS:readonly TabItem[]=[
  {key:'home',icon:'home'},
  {key:'services',icon:'grid'},
  {key:'request',icon:'plus',primary:true},
  {key:'requests',icon:'folder'},
  {key:'profile',icon:'user'},
];

export type PageKey='welcome'|'home'|'services'|'detail'|'request'|'requests'|'profile'|string;
/** Which tab is highlighted for a page (a service detail belongs to Services). */
export const activeTab=(page:PageKey):TabKey|null=>{
  if(page==='detail')return 'services';
  return TABS.some(t=>t.key===page)?(page as TabKey):null;
};
/** Pages that show the tab bar. */
export const showsTabBar=(page:PageKey)=>page!=='welcome';
