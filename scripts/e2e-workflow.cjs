// Browser + API acceptance flow for batch 2 (conflict UI, document rules/override, delivery draft/publish/versions, per-version acknowledgement, cross-customer access). Needs wrangler dev :8788 on a fresh DB with OWNER_PHONE=+971501234567, OWNER_SETUP_KEY=local-owner-setup-key-12345, WA_BUSINESS_NUMBER, WA_APP_SECRET=e2e-secret; doc.pdf and photo.jpg in the cwd.
const {launch}=require('./lib.cjs');const crypto=require('crypto');const fs=require('fs');
const B='http://localhost:8788';
function unb32(s){const A='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits=0,v=0;const o=[];for(const c of s){v=(v<<5)|A.indexOf(c);bits+=5;if(bits>=8){o.push((v>>>(bits-8))&255);bits-=8}}return Buffer.from(o)}
function code(secret,off=0){const c=Math.floor(Date.now()/30000)+off;const b=Buffer.alloc(8);b.writeBigUInt64BE(BigInt(c));const h=crypto.createHmac('sha1',unb32(secret)).update(b).digest();const o=h[19]&15;const n=((h[o]&0x7f)<<24)|(h[o+1]<<16)|(h[o+2]<<8)|h[o+3];return String(n%1000000).padStart(6,'0')}
const J=(m,p,b,t,extra={})=>fetch(B+p,{method:m,headers:{'content-type':'application/json',...(t?{authorization:'Bearer '+t}:{}),...extra},body:b===undefined?undefined:JSON.stringify(b)}).then(async r=>({s:r.status,j:await r.json().catch(()=>({}))}));
const deliver=async(from,c)=>{const raw=JSON.stringify({entry:[{changes:[{value:{messages:[{from,type:'text',text:{body:c}}]}}]}]});const sig='sha256='+crypto.createHmac('sha256','e2e-secret').update(raw).digest('hex');await fetch(B+'/webhooks/whatsapp',{method:'POST',headers:{'x-hub-signature-256':sig,'content-type':'application/json'},body:raw})};
async function customer(phone){const st=(await J('POST','/v1/auth/wa/start',{phone})).j;await deliver(phone.replace('+',''),st.code);const t=(await J('POST','/v1/auth/wa/poll',{phone,challengeId:st.challengeId,pollToken:st.pollToken})).j.accessToken;await J('PATCH','/v1/me',{email:`c${phone.slice(-4)}@example.test`},t);return t} // the email is required before submitting
const ok=(label,cond)=>{console.log((cond?'PASS ':'FAIL ')+label);if(!cond)process.exitCode=1};
(async()=>{
 // owner enrols (API) and signs in through the UI with the authenticator
 const st=(await J('POST','/staff/v1/auth/setup/start',{phone:'+971501234567',setupKey:'local-owner-setup-key-12345'})).j;
 const owner=(await J('POST','/staff/v1/auth/setup/confirm',{phone:'+971501234567',code:code(st.secret)})).j.accessToken;
 // customers
 const A=await customer('+971529990101'),Bc=await customer('+971529990102');
 const rid=(await J('POST','/v1/requests',{serviceId:'emirates-id',data:{name:'Mona',title:{ar:'تجديد الهوية',en:'Renew an Emirates ID'}}},A)).j.id;
 const src=await (await fetch(`${B}/v1/requests/${rid}/files`,{method:'PUT',headers:{authorization:'Bearer '+A,'x-file-name':'passport.pdf'},body:fs.readFileSync('doc.pdf')})).json();
 await J('PATCH',`/v1/requests/${rid}`,{status:'submitted'},A);
 const b=await launch();const ctx=await b.newContext({viewport:{width:1280,height:900}});const p=await ctx.newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 p.on('dialog',async d=>{const m=d.message();if(d.type()==='prompt'){await d.accept(m.includes('مرجع')?'AUTH-2026-77':'جاء العميل بجواز مجدد وتم التحقق منه أمامي');}else await d.accept()});
 await p.goto(B+'/');await p.waitForTimeout(1000);
 await p.getByRole('tab',{name:'تطبيق المصادقة'}).click();await p.getByLabel('رقم الجوال').fill('0501234567');await p.getByLabel('الرمز المكوّن من 6 أرقام').fill(code(st.secret,1));await p.getByRole('button',{name:'دخول',exact:true}).click();await p.waitForTimeout(1500);
 await p.getByRole('link',{name:'الطلبات',exact:true}).click();await p.waitForTimeout(800);
 await p.locator('button.item').first().click();await p.waitForTimeout(1200);
 // 1. conflict between two staff members
 await J('POST',`/staff/v1/requests/${rid}/status`,{status:'review'},owner); // "colleague" changes it after this page loaded
 await p.getByRole('button',{name:/الخطوة التالية/}).click();await p.waitForTimeout(1200);
 const msg=await p.locator('.msg').first().innerText().catch(()=>'');
 ok('conflict shown in the dashboard UI',msg.includes('عدّل شخص آخر'));
 ok('page reloaded to the latest status',(await p.locator('body').innerText()).includes('قيد المراجعة'));
 // 2. document rule + blocking + override, from the UI
 const soon=new Date(Date.now()+3*30*86400000).toISOString().slice(0,10);
 await p.locator('input[type=date]').first().fill(soon);await p.getByRole('button',{name:'قراءة انتهاء الجواز'}).click();await p.waitForTimeout(1000);
 ok('passport check failed (6-month rule)',(await p.locator('body').innerText()).includes('غير مطابق'));
 await p.getByRole('button',{name:/الخطوة التالية/}).click();await p.waitForTimeout(1000);
 ok('blocked from "Ready to submit" with failed document',(await p.locator('.msg').first().innerText()).includes('غير مطابقة'));
 await p.getByRole('button',{name:'قبول بعد المراجعة'}).click();await p.waitForTimeout(1200);
 ok('override recorded and shown',(await p.locator('body').innerText()).includes('قُبل داخلياً'));
 await p.getByRole('button',{name:/الخطوة التالية/}).click();await p.waitForTimeout(1200);
 ok('now Ready to submit',(await p.locator('body').innerText()).includes('جاهزة للتقديم'));
 const cust1=(await J('GET',`/v1/requests/${rid}`,undefined,A)).j;
 ok('customer bar still shows only Review (status label hidden rule data)',!JSON.stringify(cust1).includes('passport_validity')&&!JSON.stringify(cust1).includes('جاء العميل'));
 // 3. submission reference prompt, then complete via API
 await p.getByRole('button',{name:/الخطوة التالية/}).click();await p.waitForTimeout(1200);
 ok('with authority after reference',(await p.locator('body').innerText()).includes('AUTH-2026-77'));
 for(const s of ['decision','completed'])await J('POST',`/staff/v1/requests/${rid}/status`,{status:s},owner);
 await p.reload();await p.waitForTimeout(1500);
 // 4. delivery draft is hidden until published
 await p.goto(B+'/#/requests/'+rid);await p.waitForTimeout(1500);
 const [fc]=await Promise.all([p.waitForEvent('filechooser'),p.locator('input[type=file]').first().click()]);await fc.setFiles('doc.pdf');
 await p.getByLabel('وصف الملف').fill('الهوية الإماراتية الجديدة');await p.getByRole('button',{name:'حفظ',exact:true}).nth(0).click();await p.waitForTimeout(1500);
 const txt=await p.locator('body').innerText();ok('draft package shown to staff',txt.includes('مسودة (لا يراها العميل)'));
 const c2=(await J('GET',`/v1/requests/${rid}`,undefined,A)).j;ok('draft file NOT visible to the customer',c2.files.every(f=>f.kind==='source'));
 const draftFile=(await J('GET',`/staff/v1/requests/${rid}`,undefined,owner)).j.files.find(f=>f.kind==='final');
 ok('draft file download refused to customer',(await fetch(`${B}/v1/files/${draftFile.id}`,{headers:{authorization:'Bearer '+A}})).status===404);
 await p.getByRole('button',{name:'نشر للعميل'}).click();await p.waitForTimeout(1500);
 ok('published (version 1) in UI',(await p.locator('body').innerText()).includes('النسخة 1'));
 const c3=(await J('GET',`/v1/requests/${rid}`,undefined,A)).j;ok('customer sees the published file',c3.files.some(f=>f.kind==='final')&&c3.request.delivery_version===1);
 ok('other customer cannot download it (IDOR)',(await fetch(`${B}/v1/files/${draftFile.id}`,{headers:{authorization:'Bearer '+Bc}})).status===404);
 ok('other customer cannot acknowledge it',(await J('POST',`/v1/requests/${rid}/acknowledgments`,{deliveryVersion:1},Bc)).s===404);
 // 5. each version needs its own acknowledgement
 await J('POST',`/v1/requests/${rid}/acknowledgments`,{deliveryVersion:1},A);
 await p.reload();await p.waitForTimeout(1500);ok('acknowledgement of v1 shown to staff',(await p.locator('body').innerText()).includes('تأكيد الاستلام'));
 const [fc2]=await Promise.all([p.waitForEvent('filechooser'),p.locator('input[type=file]').first().click()]);await fc2.setFiles('photo.jpg');
 await p.getByLabel('وصف الملف').fill('نسخة معدلة');await p.getByRole('button',{name:'حفظ',exact:true}).nth(0).click();await p.waitForTimeout(1200);
 await p.getByRole('button',{name:'نشر للعميل'}).click();await p.waitForTimeout(1500);
 const c4=(await J('GET',`/v1/requests/${rid}`,undefined,A)).j;
 ok('version 2 published; v1 acknowledgement does not carry over',c4.request.delivery_version===2&&c4.request.acknowledged_version===1);
 ok('v1 ack refused for the new delivery',(await J('POST',`/v1/requests/${rid}/acknowledgments`,{deliveryVersion:1},A)).s===409);
 ok('v2 ack accepted',(await J('POST',`/v1/requests/${rid}/acknowledgments`,{deliveryVersion:2},A)).s===200);
 await p.screenshot({path:'f1.png',fullPage:true});
 ok('no page errors',errs.length===0);
 await b.close()})().catch(e=>{console.error('FAIL',e.message.slice(0,300));process.exit(1)});
