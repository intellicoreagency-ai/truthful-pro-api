// Cycle smoke test: customer submits in the app UI -> team reviews, asks for a document, submits to authority (with reference), completes and delivers via the staff API -> customer sees each change and confirms receipt -> server records the acknowledgement. Needs wrangler dev :8788 (fresh DB, OWNER_PHONE/OWNER_SETUP_KEY), the web build served on :8767, and scripts/lib.cjs.
const {chromium}=require('playwright');const crypto=require('crypto');const fs=require('fs');const {login}=require('./lib.cjs');
const B='http://localhost:8788';
function unb32(s){const A='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits=0,v=0;const o=[];for(const c of s){v=(v<<5)|A.indexOf(c);bits+=5;if(bits>=8){o.push((v>>>(bits-8))&255);bits-=8}}return Buffer.from(o)}
function totp(secret){const c=Math.floor(Date.now()/30000);const b=Buffer.alloc(8);b.writeBigUInt64BE(BigInt(c));const h=crypto.createHmac('sha1',unb32(secret)).update(b).digest();const o=h[19]&15;const n=((h[o]&0x7f)<<24)|(h[o+1]<<16)|(h[o+2]<<8)|h[o+3];return String(n%1000000).padStart(6,'0')}
const J=(m,p,b,t,extra={})=>fetch(B+p,{method:m,headers:{'content-type':'application/json',...(t?{authorization:'Bearer '+t}:{}),...extra},body:b===undefined?undefined:JSON.stringify(b)}).then(async r=>({s:r.status,j:await r.json().catch(()=>({}))}));
module.exports={J,totp,B,fs};
if(require.main===module)(async()=>{
 const st=(await J('POST','/staff/v1/auth/setup/start',{phone:'+971501234567',setupKey:'local-owner-setup-key-12345'})).j;
 const owner=(await J('POST','/staff/v1/auth/setup/confirm',{phone:'+971501234567',code:totp(st.secret)})).j.accessToken;
 const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:1})).newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await login(p,'0529990011','971529990011');
 await p.getByText('بدء معاملة').first().click();await p.waitForTimeout(1200);await p.mouse.click(195,460);await p.waitForTimeout(1500);
 await p.getByText('تجديد الهوية',{exact:true}).first().click();await p.waitForTimeout(500);await p.getByText('بدء الطلب',{exact:true}).last().click();await p.waitForTimeout(1500);
 const inp=p.locator('input');await inp.nth(0).fill('منى العلي');await inp.nth(1).fill('0529990011');await p.getByText('التالي',{exact:true}).click();await p.waitForTimeout(900);
 for(let i=0;i<2;i++){const [fc]=await Promise.all([p.waitForEvent('filechooser'),p.getByText('رفع الملف',{exact:true}).first().click()]);await fc.setFiles(['doc.pdf','photo.jpg'][i]);await p.waitForTimeout(800)}
 await p.getByText('التالي',{exact:true}).click();await p.waitForTimeout(900);await p.getByRole('checkbox').last().click();
 await p.getByText('التالي',{exact:true}).click();await p.waitForTimeout(600);await p.getByText('التالي',{exact:true}).click();await p.waitForTimeout(600);
 await p.getByText('تأكيد الطلب',{exact:true}).click();await p.waitForTimeout(3500);
 // ---- the team acts ----
 const list=(await J('GET','/staff/v1/requests',undefined,owner)).j.requests;const rid=list[0].id;console.log('staff sees request:',list.length);
 await J('POST',`/staff/v1/requests/${rid}/status`,{status:'review',expectedAt:'2026-12-10'},owner);
 await J('POST',`/staff/v1/requests/${rid}/missing`,{items:[{labelAr:'صورة الإقامة الحالية',labelEn:'Current residence copy',noteAr:'الصورة غير واضحة',noteEn:'Unclear'}]},owner);
 // ---- the customer opens My Requests again ----
 await p.getByText('الرئيسية',{exact:true}).last().click();await p.waitForTimeout(500);await p.getByText('طلباتي',{exact:true}).last().click();await p.waitForTimeout(3500);
 let t=await p.locator('body').innerText();console.log('customer sees action required:',t.includes('مطلوب استكمال')||t.includes('إجراء مطلوب'));
 await p.screenshot({path:'c1.png'});
  console.log('errors',JSON.stringify(errs.slice(0,3)));
 
 // ---- the customer answers the request ----
 await p.getByText('استكمال',{exact:true}).first().click();await p.waitForTimeout(1500);
 t=await p.locator('body').innerText();console.log('missing screen shows staff request:',t.includes('صورة الإقامة الحالية'),'| note:',t.includes('الصورة غير واضحة'));
 await p.screenshot({path:'c2.png'});
 const [fc]=await Promise.all([p.waitForEvent('filechooser'),p.getByText('اضغط لرفع الملف').first().click()]);await fc.setFiles('photo.jpg');await p.waitForTimeout(1200);
 await p.getByText('إرسال المستندات للاستكمال').first().click();await p.waitForTimeout(4500);
 const after=(await J('GET',`/staff/v1/requests/${rid}`,undefined,owner)).j;
 console.log('server status after customer reply:',after.request.status,'| missing resolved:',after.missing.every(m=>m.resolved_at),'| files:',after.files.length);
 // ---- the team finishes and delivers ----
 for(const s of ['ready_for_authority','authority','decision','completed'])await J('POST',`/staff/v1/requests/${rid}/status`,{status:s,reference:'AUTH-2026-0042',overrideReason:'test: fees settled offline'},owner);
 await fetch(`${B}/staff/v1/requests/${rid}/files?kind=final`,{method:'PUT',headers:{authorization:'Bearer '+owner,'x-file-name':encodeURIComponent('emirates-id.pdf'),'x-file-label':encodeURIComponent('الهوية الإماراتية الجديدة')},body:fs.readFileSync('doc.pdf')});
 await J('POST',`/staff/v1/requests/${rid}/deliveries/publish`,{},owner);
 await p.screenshot({path:'c2b.png'});await p.mouse.click(344,30);await p.waitForTimeout(800);
 if(!(await p.getByText('الرئيسية',{exact:true}).count())){await p.mouse.click(367,12);await p.waitForTimeout(800)}
 await p.getByText('الرئيسية',{exact:true}).last().click();await p.waitForTimeout(500);await p.getByText('طلباتي',{exact:true}).last().click();await p.waitForTimeout(3500);
 t=await p.locator('body').innerText();
 console.log('customer sees completed:',t.includes('منجزة')||t.includes('مكتمل'),'| delivery file label:',t.includes('الهوية الإماراتية الجديدة'));
 await p.screenshot({path:'c3.png',fullPage:true});
 await p.getByText('استلام الملفات',{exact:true}).first().click();await p.waitForTimeout(1500);
 console.log('receipt screen:',(await p.locator('body').innerText()).slice(0,300).replace(/\n/g,' | '));await p.screenshot({path:'c4.png'});
 const btns=await p.getByRole('button').allInnerTexts();console.log('buttons:',btns.filter(x=>x.trim()).join(' | ').slice(0,300));
 await p.getByText(/تأكيد استلام|تأكيد الاستلام/).last().click();await p.waitForTimeout(3500);
 const fin=(await J('GET',`/staff/v1/requests/${rid}`,undefined,owner)).j.request;
 console.log('server: deliveryVersion',fin.deliveryVersion,'| acknowledgedVersion',fin.acknowledgedVersion,'| ack time set:',!!fin.acknowledgedAt);
 await b.close()})().catch(e=>{console.error('FAIL',e.message.slice(0,300));process.exit(1)});
