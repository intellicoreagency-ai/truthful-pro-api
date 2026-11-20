// Manual smoke test: customer submits a request, the owner signs in to the dashboard and processes it.
// Needs: wrangler dev on :8788 with OWNER_PHONE=+971501234567, WA_APP_SECRET=e2e-secret, WA_BUSINESS_NUMBER set; a doc.pdf in the cwd; playwright installed.
const {chromium}=require('playwright');const crypto=require('crypto');const fs=require('fs');
const B='http://localhost:8788';
const post=(path,body,token,extra={})=>fetch(B+path,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{}),...extra},body:JSON.stringify(body)}).then(async r=>({s:r.status,j:await r.json().catch(()=>({}))}));
const deliver=async(from,code)=>{const raw=JSON.stringify({entry:[{changes:[{value:{messages:[{from,type:'text',text:{body:code}}]}}]}]});const sig='sha256='+crypto.createHmac('sha256','e2e-secret').update(raw).digest('hex');await fetch(B+'/webhooks/whatsapp',{method:'POST',headers:{'x-hub-signature-256':sig,'content-type':'application/json'},body:raw})};
(async()=>{
 // 1) a customer submits a request with a document
 const phone='+971529990001';
 const st=(await post('/v1/auth/wa/start',{phone})).j;await deliver('971529990001',st.code);
 const tok=(await post('/v1/auth/wa/poll',{phone,challengeId:st.challengeId,pollToken:st.pollToken})).j.accessToken;
 const rq=(await post('/v1/requests',{serviceId:'emirates-id',data:{name:'خالد الأحمد',phone:'0529990001',title:{ar:'تجديد الهوية',en:'Renew an Emirates ID'},fields:{'passport-no':'N1234567'}}},tok)).j.id;
 await fetch(`${B}/v1/requests/${rq}/files`,{method:'PUT',headers:{authorization:'Bearer '+tok,'x-file-name':encodeURIComponent('passport.pdf')},body:fs.readFileSync('doc.pdf')});
 await fetch(`${B}/v1/requests/${rq}`,{method:'PATCH',headers:{authorization:'Bearer '+tok,'content-type':'application/json'},body:JSON.stringify({status:'submitted'})});
 // 2) the owner opens the dashboard
 const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1});const p=await ctx.newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
 let ws=null;p.on('response',async r=>{if(r.url().endsWith('/staff/v1/auth/wa/start')&&r.ok())ws=await r.json()});
 await p.goto(B+'/');await p.waitForTimeout(1200);await p.screenshot({path:'d0.png'});
 await p.getByPlaceholder('05XXXXXXXX').fill('0501234567');await p.getByRole('button',{name:'التحقق عبر واتساب'}).click();await p.waitForTimeout(1500);
 await deliver('971501234567',ws.code);await p.waitForTimeout(4500);
 console.log('logged in:',await p.getByText('نظرة عامة').count()>0);
 await p.screenshot({path:'d1.png'});
 await p.getByRole('link',{name:'الطلبات'}).click();await p.waitForTimeout(1200);await p.screenshot({path:'d2.png'});
 await p.locator('button.item').first().click();await p.waitForTimeout(1500);await p.screenshot({path:'d3.png',fullPage:true});
 // actions
 await p.getByRole('button',{name:'إسناد إليّ'}).click();await p.waitForTimeout(800);
 await p.getByLabel('الحالة الجديدة').selectOption('review');await p.getByRole('button',{name:'تطبيق'}).click();await p.waitForTimeout(900);
 const t1=await p.locator('body').innerText();console.log('status review:',t1.includes('قيد المراجعة'));
 await p.getByLabel('اسم المستند (عربي)').fill('صورة الإقامة');await p.getByLabel('اسم المستند (إنجليزي)').fill('Residence copy');
 await p.getByRole('button',{name:'إرسال الطلب'}).click();await p.waitForTimeout(900);
 console.log('needs docs:',(await p.locator('body').innerText()).includes('بانتظار العميل'));
 await p.getByLabel('ملاحظة داخلية').fill('اتصلت بالعميل');await p.getByRole('button',{name:'حفظ',exact:true}).last().click();await p.waitForTimeout(700);
 // open document
 await p.getByRole('button',{name:'عرض'}).first().click();await p.waitForTimeout(1200);await p.screenshot({path:'d4.png'});
 console.log('viewer open:',await p.locator('.preview iframe, .preview img').count());
 await p.getByRole('button',{name:'رجوع'}).last().click();await p.waitForTimeout(400);
 await p.screenshot({path:'d5.png',fullPage:true});
 // mobile + English
 const m=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});const mp=await m.newPage();
 await mp.goto(B+'/');await mp.waitForTimeout(1200);await mp.screenshot({path:'m0.png'});
 console.log('errors:',JSON.stringify(errs.slice(0,4)));
 await b.close();
})().catch(e=>{console.error('FAIL',e.message.slice(0,300));process.exit(1)});
