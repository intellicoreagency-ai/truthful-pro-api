// Dashboard acceptance: a customer submits a request (API) -> the owner signs in to the dashboard WITH WHATSAPP and processes it in the UI:
// assign to me, move to review, ask for a missing document, internal note, open the customer's file. LOCAL TEST DATA ONLY (scripts/e2e-run.sh).
const fs=require('fs');const {launch,ok,J,webhook,B}=require('./lib.cjs');
(async()=>{
 const phone='+971529990001';
 const st=(await J('POST','/v1/auth/wa/start',{phone})).j;await webhook('971529990001',st.code);
 const tok=(await J('POST','/v1/auth/wa/poll',{phone,challengeId:st.challengeId,pollToken:st.pollToken})).j.accessToken;
 await J('PATCH','/v1/me',{email:'k529990001@example.test'},tok); // the email is required before submitting
 const rq=(await J('POST','/v1/requests',{serviceId:'emirates-id',data:{name:'خالد الأحمد',phone:'0529990001',title:{ar:'تجديد الهوية',en:'Renew an Emirates ID'},fields:{'passport-no':'N1234567'}}},tok)).j.id;
 await fetch(`${B}/v1/requests/${rq}/files`,{method:'PUT',headers:{authorization:'Bearer '+tok,'x-file-name':encodeURIComponent('passport.pdf')},body:fs.readFileSync('doc.pdf')});
 ok('customer request submitted',(await J('PATCH',`/v1/requests/${rq}`,{status:'submitted'},tok)).j.status==='submitted');
 const b=await launch();const p=await (await b.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1})).newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 let ws=null;p.on('response',async r=>{if(r.url().endsWith('/staff/v1/auth/wa/start')&&r.ok())ws=await r.json()});
 p.on('dialog',d=>d.accept());
 await p.goto(B+'/');await p.waitForTimeout(1200);
 // first sign-in of the owner by WhatsApp (OWNER_PHONE): the code is shown, the "message" arrives through the signed webhook
 await p.getByRole('tab',{name:'واتساب'}).click();await p.getByLabel('رقم الجوال').fill('0501234567');
 await p.getByRole('button',{name:'التحقق عبر واتساب'}).click();await p.waitForTimeout(1500);
 ok('the dashboard shows a WhatsApp code to send',!!ws?.code);
 await webhook('971501234567',ws.code);await p.waitForTimeout(4500);
 const later=p.getByRole('button',{name:'لاحقاً'});if(await later.count())await later.first().click();
 ok('signed in (overview visible)',await p.getByText('نظرة عامة').count()>0);
 await p.getByRole('link',{name:'الطلبات',exact:true}).click();await p.waitForTimeout(1200);
 ok('the request is listed with the customer name',(await p.locator('button.item').first().innerText()).includes('خالد الأحمد'));
 await p.locator('button.item').first().click();await p.waitForTimeout(1500);
 await p.getByRole('button',{name:'إسناد إليّ'}).first().click();await p.waitForTimeout(900);
 await p.getByLabel('الحالة الجديدة').selectOption('review');await p.getByRole('button',{name:'تطبيق'}).click();await p.waitForTimeout(1200);
 ok('status moved to review in the UI',(await p.locator('body').innerText()).includes('قيد المراجعة'));
 // ask for a missing document
 await p.getByLabel('اسم المستند (عربي)').fill('صورة الإقامة');await p.getByLabel('اسم المستند (إنجليزي)').fill('Residence copy');
 await p.getByRole('button',{name:'إرسال الطلب',exact:true}).click();await p.waitForTimeout(1200);
 const cust=(await J('GET',`/v1/requests/${rq}`,undefined,tok)).j;
 ok('the customer now sees a missing-document request',cust.request.status==='needs_documents'&&cust.missing.some(m=>m.label_ar==='صورة الإقامة'));
 // internal note never reaches the customer
 await p.getByLabel('ملاحظة داخلية').fill('اتصلت بالعميل');await p.getByRole('button',{name:'حفظ',exact:true}).last().click();await p.waitForTimeout(900);
 ok('internal note saved and marked internal for staff',(await p.locator('body').innerText()).includes('اتصلت بالعميل'));
 ok('internal note is not visible to the customer',!JSON.stringify((await J('GET',`/v1/requests/${rq}`,undefined,tok)).j).includes('اتصلت بالعميل'));
 // open the customer's file in the viewer
 await p.getByRole('button',{name:'عرض'}).first().click();await p.waitForTimeout(1500);
 ok('document viewer opens',await p.locator('.preview iframe, .preview img').count()>0);
 await p.getByRole('button',{name:'رجوع'}).last().click();await p.waitForTimeout(400);
 // the sign-in page also works on a phone-sized screen
 const mp=await (await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2})).newPage();await mp.goto(B+'/');await mp.waitForTimeout(1200);
 ok('mobile sign-in page renders',await mp.getByRole('tab',{name:'واتساب'}).count()>0);
 ok('no page errors',errs.length===0);if(errs.length)console.log(errs.slice(0,3));
 await b.close()})().catch(e=>{console.error('FAIL',e.message.slice(0,300));process.exit(1)});
