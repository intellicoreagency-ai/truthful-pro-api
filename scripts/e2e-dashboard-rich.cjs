// Browser smoke test for overview, board quick-move, override, customers and quick search. Same prerequisites as e2e-dashboard.cjs; run on a fresh local DB.
const {chromium}=require('playwright');const crypto=require('crypto');const fs=require('fs');
const B='http://localhost:8788';
const post=(path,body,token)=>fetch(B+path,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body)}).then(async r=>({s:r.status,j:await r.json().catch(()=>({}))}));
const deliver=async(from,code)=>{const raw=JSON.stringify({entry:[{changes:[{value:{messages:[{from,type:'text',text:{body:code}}]}}]}]});const sig='sha256='+crypto.createHmac('sha256','e2e-secret').update(raw).digest('hex');await fetch(B+'/webhooks/whatsapp',{method:'POST',headers:{'x-hub-signature-256':sig,'content-type':'application/json'},body:raw})};
async function customer(phone,intl,name,titles){
 const st=(await post('/v1/auth/wa/start',{phone})).j;await deliver(intl,st.code);
 const tok=(await post('/v1/auth/wa/poll',{phone,challengeId:st.challengeId,pollToken:st.pollToken})).j.accessToken;const ids=[];
 for(const t of titles){const id=(await post('/v1/requests',{serviceId:'emirates-id',data:{name,title:t}},tok)).j.id;
  await fetch(`${B}/v1/requests/${id}/files`,{method:'PUT',headers:{authorization:'Bearer '+tok},body:fs.readFileSync('doc.pdf')});
  await fetch(`${B}/v1/requests/${id}`,{method:'PATCH',headers:{authorization:'Bearer '+tok,'content-type':'application/json'},body:JSON.stringify({status:'submitted'})});ids.push(id)}
 return ids}
(async()=>{
 await customer('+971529990001','971529990001','خالد الأحمد',[{ar:'تجديد الهوية',en:'Renew an Emirates ID'},{ar:'إصدار إقامة',en:'Residence visa'}]);
 await customer('+971529990002','971529990002','Sara Ali',[{ar:'تجديد رخصة تجارية',en:'Trade licence renewal'}]);
 const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1280,height:800}});const p=await ctx.newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,140))});
 let ws=null;p.on('response',async r=>{if(r.url().endsWith('/staff/v1/auth/wa/start')&&r.ok())ws=await r.json()});
 await p.goto(B+'/');await p.waitForTimeout(1000);
 await p.getByRole('tab',{name:'واتساب'}).click();await p.getByLabel('رقم الجوال').fill('0501234567');await p.getByRole('button',{name:'التحقق عبر واتساب'}).click();await p.waitForTimeout(1500);
 await deliver('971501234567',ws.code);await p.waitForTimeout(4500);
 console.log('overview:',(await p.locator('body').innerText()).includes('طلبات جديدة اليوم'));await p.screenshot({path:'r1.png',fullPage:true});
 // board + quick move
 await p.getByRole('link',{name:'الطلبات',exact:true}).click();await p.waitForTimeout(800);await p.getByRole('button',{name:'اللوحة'}).click();await p.waitForTimeout(1000);
 await p.screenshot({path:'r2.png'});
 const before=await p.locator('section.col').first().locator('.kcard').count();
 await p.locator('.kcard').first().getByRole('button').last().click();await p.waitForTimeout(1200);
 const after=await p.locator('section.col').first().locator('.kcard').count();console.log('board quick move:',before,'->',after);
 // detail: quick bar + override
 await p.locator('.kmain').first().click();await p.waitForTimeout(1200);
 console.log('quick bar:',await p.locator('.quick').count());
 await p.screenshot({path:'r3.png',fullPage:true});
 await p.getByLabel('فرض حالة').selectOption('completed');await p.getByLabel('السبب (إلزامي)').fill('تم الإنجاز يدوياً في المكتب');
 p.once('dialog',d=>d.accept());await p.getByRole('button',{name:'تنفيذ التجاوز'}).click();await p.waitForTimeout(1200);
 console.log('override applied:',(await p.locator('body').innerText()).includes('منجزة'),'| internal log:',(await p.locator('body').innerText()).includes('OVERRIDE'));
 // customers
 await p.getByRole('link',{name:'العملاء',exact:true}).click();await p.waitForTimeout(1000);await p.screenshot({path:'r4.png'});
 await p.locator('button.item').first().click();await p.waitForTimeout(1000);console.log('customer detail:',(await p.locator('body').innerText()).includes('الموافقات'));
 // global search
 await p.getByRole('searchbox',{name:'بحث سريع…'}).fill('Sara');await p.keyboard.press('Enter');await p.waitForTimeout(1200);
 console.log('search results (board cards):',await p.locator('.kcard').count(),'| list items:',await p.locator('button.item').count());await p.screenshot({path:'r5.png'});
 console.log('errors:',JSON.stringify(errs));
 await b.close()})().catch(e=>{console.error('FAIL',e.message.slice(0,300));process.exit(1)});
