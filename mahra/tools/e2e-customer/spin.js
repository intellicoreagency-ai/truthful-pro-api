const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,locale:'ar-AE'})).newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8099/');await p.waitForTimeout(1500);
await p.screenshot({path:process.argv[2]+'/spin-a.png',clip:{x:90,y:30,width:210,height:190}});
await p.waitForTimeout(4000);
await p.screenshot({path:process.argv[2]+'/spin-b.png',clip:{x:90,y:30,width:210,height:190}});
await p.screenshot({path:process.argv[2]+'/look-login.png'});
console.log('errors',JSON.stringify(errs));await b.close();})();
