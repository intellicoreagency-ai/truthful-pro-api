const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,locale:'ar-AE'})).newPage();
await p.goto('http://localhost:8099/');await p.waitForTimeout(2500);await p.screenshot({path:process.argv[2]+'/look-login.png'});
console.log(await p.evaluate(()=>[...new Set([...document.querySelectorAll('*')].map(e=>getComputedStyle(e).fontFamily))].join(' | ')));
console.log(await p.evaluate(()=>[...document.fonts].map(f=>f.family+':'+f.status).join(', ')));
await b.close();})();
