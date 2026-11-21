// Dashboard acceptance (redesigned board): overview, board columns, drag a card to "In progress", card drawer, owner override with a
// reason, customers and their consents, quick search. LOCAL TEST DATA ONLY (scripts/e2e-run.sh: fresh DB, wrangler dev :8788).
const fs=require('fs');const {launch,ok,J,owner,webhook,dashLogin,B}=require('./lib.cjs');
async function customer(phone,name,titles){const intl=phone.slice(1);
 const st=(await J('POST','/v1/auth/wa/start',{phone})).j;await webhook(intl,st.code);
 const tok=(await J('POST','/v1/auth/wa/poll',{phone,challengeId:st.challengeId,pollToken:st.pollToken})).j.accessToken;
 await J('PATCH','/v1/me',{email:`c${intl.slice(-4)}@example.test`,displayName:name},tok);await J('POST','/v1/consents',{type:'terms',version:'2026-11',accepted:true},tok);
 const ids=[];for(const t of titles){const id=(await J('POST','/v1/requests',{serviceId:'emirates-id',data:{name,title:t}},tok)).j.id;
  await fetch(`${B}/v1/requests/${id}/files`,{method:'PUT',headers:{authorization:'Bearer '+tok,'x-file-name':'p.pdf'},body:fs.readFileSync('doc.pdf')});
  await J('PATCH',`/v1/requests/${id}`,{status:'submitted'},tok);ids.push(id)}
 return ids}
(async()=>{
 const [k1]=await customer('+971529990001','خالد الأحمد',[{ar:'تجديد الهوية',en:'Renew an Emirates ID'},{ar:'إصدار إقامة',en:'Residence visa'}]);
 await customer('+971529990002','Sara Ali',[{ar:'تجديد رخصة تجارية',en:'Trade licence renewal'}]);
 const {token,secret}=await owner();
 const b=await launch();const p=await (await b.newContext({viewport:{width:1360,height:860}})).newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
 await dashLogin(p,secret);
 ok('overview shows today\'s new requests',(await p.locator('body').innerText()).includes('طلبات جديدة اليوم'));
 // board
 await p.getByRole('link',{name:'الطلبات',exact:true}).click();await p.waitForTimeout(800);await p.getByRole('button',{name:'اللوحة'}).click();await p.waitForTimeout(1500);
 const newCol=p.locator('section[data-col=new]'),progCol=p.locator('section[data-col=progress]');
 ok('board shows the three new requests in "New"',await newCol.locator('.kb-card').count()===3);
 // drag the first card into "In progress" (pointer drag, like a person)
 const card=newCol.locator('.kb-card').first(),cb=await card.boundingBox(),pb=await progCol.boundingBox();
 await p.mouse.move(cb.x+cb.width/2,cb.y+cb.height/2);await p.mouse.down();
 for(let i=1;i<=12;i++){await p.mouse.move(cb.x+cb.width/2+(pb.x+pb.width/2-cb.x-cb.width/2)*i/12,cb.y+cb.height/2+(pb.y+80-cb.y-cb.height/2)*i/12);await p.waitForTimeout(25)}
 await p.mouse.up();await p.waitForTimeout(2000);
 const statuses=(await J('GET','/staff/v1/requests',undefined,token)).j.requests.map(r=>r.status);
 ok('dragging a card to "In progress" moves that request to review on the server',statuses.filter(s=>s==='review').length===1&&await progCol.locator('.kb-card').count()===1);
 // card drawer
 await newCol.locator('.kb-card').first().click();await p.waitForTimeout(1200);
 ok('a card opens the request drawer',await p.locator('.kb-drawer').count()===1);
 await p.keyboard.press('Escape');await p.waitForTimeout(500);
 // owner override with a reason, on the full request page
 await p.goto(B+'/#/requests/'+k1);await p.waitForTimeout(1500);
 await p.getByLabel('فرض حالة').selectOption('completed');await p.getByLabel('السبب (إلزامي)').fill('تم الإنجاز يدوياً في المكتب');
 await p.getByRole('button',{name:'تنفيذ التجاوز'}).click();await p.waitForTimeout(1500);
 const d=(await J('GET',`/staff/v1/requests/${k1}`,undefined,token)).j;
 ok('override applied and recorded with its reason',d.request.status==='completed'&&JSON.stringify(d.log).includes('تم الإنجاز يدوياً في المكتب'));
 // customers and their consents
 await p.getByRole('link',{name:'العملاء',exact:true}).click();await p.waitForTimeout(1200);
 ok('customers are listed',await p.locator('button.item').count()===2);
 await p.locator('button.item').filter({hasText:'Sara Ali'}).first().click();await p.waitForTimeout(1200);
 ok('customer page shows their consents',(await p.locator('body').innerText()).includes('الموافقات'));
 // quick search
 await p.getByRole('searchbox',{name:'بحث سريع…'}).fill('Sara');await p.keyboard.press('Enter');await p.waitForTimeout(1500);
 const listed=await p.locator('button.item').allInnerTexts(),cards=await p.locator('.kb-card').allInnerTexts(),all=listed.concat(cards);
 ok('quick search finds only Sara\'s request',all.length===1&&all[0].includes('Sara'));
 ok('no page errors',errs.length===0);if(errs.length)console.log(errs.slice(0,3));
 await b.close()})().catch(e=>{console.error('FAIL',e.message.slice(0,300));process.exit(1)});
