const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:1})).newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8099/');await p.waitForTimeout(2000);
const labels=/^(اللغة|Language|Язык|Idioma|Langue|语言|भाषा)$/;
for(const l of ['English','Русский','Español','Français','中文','हिन्दी','العربية']){
 await p.getByRole('button',{name:labels}).click();await p.waitForTimeout(250);
 await p.getByRole('button',{name:l,exact:true}).click();await p.waitForTimeout(500);
 await p.screenshot({path:process.argv[2]+'/f-'+l+'.png',clip:{x:0,y:220,width:390,height:520}});
}
console.log('errors',JSON.stringify(errs));await b.close();})();
