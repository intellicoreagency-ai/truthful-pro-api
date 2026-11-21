// Lets Node's type-stripping tests import app modules the way Metro does: extensionless, file before folder.
import {register} from 'node:module';
register('data:text/javascript,'+encodeURIComponent(`
export async function resolve(spec,ctx,next){
  if(/^\\.{1,2}\\//.test(spec)&&!/\\.[cm]?[jt]sx?$/.test(spec)){
    for(const ext of ['.ts','.tsx']){try{return await next(spec+ext,ctx)}catch{}}
  }
  return next(spec,ctx);
}`));
