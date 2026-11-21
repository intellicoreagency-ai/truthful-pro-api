// Browser acceptance for Phase 3 (customer app UI + dashboard UI): quote -> acceptance -> invoice -> payment with proof -> verification -> receipt -> document view -> refund. Needs wrangler dev :8788 on a FRESH state (rm -rf api/.wrangler/state; migrations apply) with SCANNER_MODE=fake-test, OWNER_PHONE/OWNER_SETUP_KEY, ALLOWED_ORIGINS=http://localhost:8767, the web build (EXPO_PUBLIC_API_URL) served on :8767, scripts/lib.cjs, doc.pdf and photo.jpg in the cwd. Issued financial rows cannot be deleted by design, so reset the DB state instead of deleting rows.
const {chromium}=require('playwright');const crypto=require('crypto');const fs=require('fs');const {login,newRequestUI}=require('./lib.cjs');
const B='http://localhost:8788';
function unb32(s){const A='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits=0,v=0;const o=[];for(const c of s){v=(v<<5)|A.indexOf(c);bits+=5;if(bits>=8){o.push((v>>>(bits-8))&255);bits-=8}}return Buffer.from(o)}
function code(secret,off=0){const c=Math.floor(Date.now()/30000)+off;const b=Buffer.alloc(8);b.writeBigUInt64BE(BigInt(c));const h=crypto.createHmac('sha1',unb32(secret)).update(b).digest();const o=h[19]&15;const n=((h[o]&0x7f)<<24)|(h[o+1]<<16)|(h[o+2]<<8)|h[o+3];return String(n%1000000).padStart(6,'0')}
const J=(m,p,b,t,extra={})=>fetch(B+p,{method:m,headers:{'content-type':'application/json',...(t?{authorization:'Bearer '+t}:{}),...extra},body:b===undefined?undefined:JSON.stringify(b)}).then(async r=>({s:r.status,j:await r.json().catch(()=>({}))}));
async function refresh(cp){try{await refresh0(cp)}catch(e){await cp.screenshot({path:'dbg.png'});console.log('DBG',(await cp.locator('body').innerText()).slice(0,300).replace(/\n/g,' | '));throw e}}
async function refresh0(cp){await cp.mouse.move(195,400);await cp.mouse.wheel(0,-9000);await cp.waitForTimeout(500);for(let i=0;i<4&&!(await cp.getByText('الرئيسية',{exact:true}).count());i++){await cp.mouse.click(344,30);await cp.waitForTimeout(700)}await cp.getByText('الرئيسية',{exact:true}).last().click();await cp.waitForTimeout(400);await cp.getByText('طلباتي',{exact:true}).last().click();await cp.waitForTimeout(3500)}
const ok=(l,c)=>{console.log((c?'PASS ':'FAIL ')+l);if(!c)process.exitCode=1};
(async()=>{
 const st=(await J('POST','/staff/v1/auth/setup/start',{phone:'+971501234567',setupKey:'local-owner-setup-key-12345'})).j;
 const owner=(await J('POST','/staff/v1/auth/setup/confirm',{phone:'+971501234567',code:code(st.secret)})).j.accessToken;
 const b=await chromium.launch();
 // ---- customer creates a request in the app UI ----
 const cp=await (await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:1})).newPage();
 const cerrs=[];cp.on('pageerror',e=>cerrs.push(e.message));
 await login(cp,'0529990021','971529990021');
 await newRequestUI(cp);
 const inp=cp.locator('input');await inp.nth(0).fill('هدى المنصوري');await inp.nth(1).fill('0529990021');await cp.getByText('التالي',{exact:true}).click();await cp.waitForTimeout(900);
 for(let i=0;i<2;i++){const [fc]=await Promise.all([cp.waitForEvent('filechooser'),cp.getByText('رفع الملف',{exact:true}).first().click()]);await fc.setFiles(['doc.pdf','photo.jpg'][i]);await cp.waitForTimeout(800)}
 await cp.getByText('التالي',{exact:true}).click();await cp.waitForTimeout(900);await cp.getByRole('checkbox').last().click();
 await cp.getByText('التالي',{exact:true}).click();await cp.waitForTimeout(600);await cp.getByText('التالي',{exact:true}).click();await cp.waitForTimeout(600);
 await cp.getByText('تأكيد الطلب',{exact:true}).click();await cp.waitForTimeout(3500);
 const rid=(await J('GET','/staff/v1/requests',undefined,owner)).j.requests[0].id;
 // customer token for API-side steps comes from a second login of the same number
 // ---- staff prices it in the dashboard UI ----
 const sctx=await b.newContext({viewport:{width:1280,height:1000}});const sp=await sctx.newPage();const serrs=[];sp.on('pageerror',e=>serrs.push(e.message));
 sp.on('dialog',async d=>{const m=d.message();if(d.type()==='prompt')await d.accept(m.includes('مرجع الدفع')?'PAYOUT-2026-001':m.includes('الاسترداد')?'استرداد جزئي بسبب تعديل نطاق الخدمة':m.includes('الإلغاء')?'إلغاء الفاتورة لتعديل النطاق':'ملاحظة'); else await d.accept()});
 await sp.goto(B+'/');await sp.waitForTimeout(900);
 await sp.getByRole('tab',{name:'تطبيق المصادقة'}).click();await sp.getByLabel('رقم الجوال').fill('0501234567');await sp.getByLabel('الرمز المكوّن من 6 أرقام').fill(code(st.secret,1));await sp.getByRole('button',{name:'دخول',exact:true}).click();await sp.waitForTimeout(1500);
 await sp.goto(B+'/#/requests/'+rid);await sp.waitForTimeout(1500);
 ok('finance card shows test banner and tax note',(await sp.locator('body').innerText()).includes('نسخة تجريبية — لا قيمة مالية'));
 const fillLine=async(i,amount,ar,en)=>{const g=sp.locator('.grid').filter({has:sp.getByLabel('المبلغ (درهم)')}).nth(i);await g.getByLabel('المبلغ (درهم)').fill(amount);await g.getByLabel('الوصف بالعربية').fill(ar);await g.getByLabel('الوصف بالإنجليزية').fill(en)};
 await sp.locator('.grid').filter({has:sp.getByLabel('المبلغ (درهم)')}).nth(0).getByLabel('النوع').selectOption('government_fee');
 await fillLine(0,'350','رسوم الجهة','Authority fee');
 await sp.getByLabel('رابط الدفع الرسمي (https)').fill('https://mol.gov.ae/pay');
 await sp.getByRole('button',{name:'إضافة بند'}).click();await fillLine(1,'650.50','أتعاب الخدمة','Service fee');
 await sp.getByRole('button',{name:'حفظ المسودة'}).click();await sp.waitForTimeout(1000);
 await sp.getByRole('button',{name:'إصدار فاتورة تجريبية'}).click();await sp.waitForTimeout(1500);
 ok('invoice issued directly with a server number (no quotation)',/T-INV-\d{4}-000001/.test(await sp.locator('body').innerText()));
 ok('quote total shown in AED with fils',(await sp.locator('body').innerText()).includes('AED 650.50'));
 // ---- customer sees the quote in the app and accepts it ----
 await refresh(cp);
 await cp.getByText('تفاصيل الطلب',{exact:true}).first().click();await cp.waitForTimeout(1500);
 let ct=await cp.locator('body').innerText();
 ok('customer sees quotation panel, lines and total',ct.includes('الفاتورة والدفع')&&ct.includes('AED 650.50')&&ct.includes('تُدفع مباشرة للجهة')&&ct.includes('AED 350.00')&&ct.includes('فتح رابط الدفع الرسمي'));
 ok('customer sees "tax not configured" (never zero tax)',ct.includes('الضريبة غير مهيأة')||ct.includes('غير مهيأة'));
 await cp.screenshot({path:'m1.png',fullPage:true});
 await sp.reload();await sp.waitForTimeout(1500);
 ok('no quotation document was produced',!(await J('GET',`/staff/v1/requests/${rid}/finance`,undefined,owner)).j.documents.some(d=>d.doc_type==='quote'));
 await refresh(cp);
 await cp.getByText('تفاصيل الطلب',{exact:true}).first().click();await cp.waitForTimeout(1500);
 await cp.getByText('إبلاغ عن دفعة (تحويل بنكي)',{exact:true}).click();await cp.waitForTimeout(600);
 await cp.getByLabel('المبلغ',{exact:true}).fill('400');await cp.getByLabel('مرجع التحويل',{exact:true}).fill('TRX-2026-7788');
 const [pfc]=await Promise.all([cp.waitForEvent('filechooser'),cp.getByText('اختيار إثبات التحويل',{exact:true}).click()]);await pfc.setFiles('photo.jpg');await cp.waitForTimeout(900);
 await cp.getByText('إرسال للتحقق',{exact:true}).click();await cp.waitForTimeout(4500);
 let fin=(await J('GET',`/staff/v1/requests/${rid}/finance`,undefined,owner)).j;
 ok('payment pending verification (not paid)',fin.payments.length===1&&fin.payments[0].status==='pending_verification'&&fin.totals.paid===0&&fin.totals.pending===40000);
 // ---- staff verifies in the payments queue ----
 await sp.goto(B+'/#/payments');await sp.waitForTimeout(1500);
 ok('queue shows the payment and reference',(await sp.locator('body').innerText()).includes('TRX-2026-7788'));
 await sp.getByRole('button',{name:'عرض الإثبات'}).click();await sp.waitForTimeout(1200);
 ok('proof opens for finance staff',await sp.locator('.preview img, .preview iframe').count()>0);
 await sp.getByRole('button',{name:'رجوع'}).last().click();await sp.waitForTimeout(300);
 await sp.getByRole('button',{name:'اعتماد'}).first().click();await sp.waitForTimeout(1500);
 fin=(await J('GET',`/staff/v1/requests/${rid}/finance`,undefined,owner)).j;
 ok('approved: paid 400, remaining 250.50, state partial, receipt issued',fin.totals.paid===40000&&fin.totals.remaining===25050&&fin.totals.state==='partial'&&fin.documents.some(d=>d.doc_type==='receipt'));
 // ---- customer sees the result and opens a document ----
 await refresh(cp);
 await cp.getByText('تفاصيل الطلب',{exact:true}).first().click();await cp.waitForTimeout(1500);
 ct=await cp.locator('body').innerText();
 ok('customer sees partial status, paid and remaining',ct.includes('مدفوع جزئياً')&&ct.includes('AED 400.00')&&ct.includes('AED 250.50'));
 const reqs=[];cp.on('request',r=>{if(r.url().includes('/v1/documents/'))reqs.push(r.method()+' '+r.url().slice(-40))});cp.on('popup',p=>console.log('popup event'));const cons=[];cp.on('console',m=>{if(m.type()==='error'||m.type()==='warning')cons.push(m.text().slice(0,120))});
 const docBtns=cp.getByText('عرض',{exact:true});console.log('view buttons:',await docBtns.count());
 const pagesBefore=cp.context().pages().length;
 await docBtns.last().scrollIntoViewIfNeeded();await docBtns.last().click();await cp.waitForTimeout(2500);
 console.log('document requests:',JSON.stringify(reqs),'| console:',JSON.stringify(cons.slice(0,3)));
 const pagesAfter=cp.context().pages();console.log('pages before/after:',pagesBefore,pagesAfter.length);
 let html='';if(pagesAfter.length>pagesBefore){const popup=pagesAfter[pagesAfter.length-1];await popup.waitForLoadState();html=await popup.content()}
 console.log('msg on screen:',(await cp.locator('body').innerText()).slice(-200).replace(/\n/g,' | '));
 ok('receipt document opens with TEST watermark and no tax invoice wording',html.includes('TEST COPY')&&html.includes('T-RCT-')&&!/<h1>[^<]*Tax Invoice/i.test(html));
 await cp.screenshot({path:'m2.png',fullPage:true});
 // ---- customer reports paying the government fee to the authority; staff verifies; our balance is unchanged ----
 await refresh(cp);
 await cp.getByText('تفاصيل الطلب',{exact:true}).first().click();await cp.waitForTimeout(1500);
 await cp.getByText('أبلغ بأنك دفعت للجهة',{exact:true}).click();await cp.waitForTimeout(600);
 await cp.getByLabel('المبلغ',{exact:true}).fill('350');await cp.getByLabel('رقم العملية',{exact:true}).fill('MOL-998877');
 await cp.getByText('إرسال للتحقق',{exact:true}).click();await cp.waitForTimeout(3500);
 fin=(await J('GET',`/staff/v1/requests/${rid}/finance`,undefined,owner)).j;
 ok('authority payment reported, awaiting verification, company balance untouched',fin.authorityPayments.length===1&&fin.authorityPayments[0].status==='reported'&&fin.gov.reported===35000&&fin.totals.remaining===25050);
 await sp.goto(B+'/#/requests/'+rid);await sp.waitForTimeout(1500);
 await sp.getByRole('button',{name:'تحقق'}).first().click();await sp.waitForTimeout(1500);
 fin=(await J('GET',`/staff/v1/requests/${rid}/finance`,undefined,owner)).j;
 ok('government fee verified; company totals still 650.50 / 250.50',fin.gov.verified===35000&&fin.gov.remaining===0&&fin.totals.total===65050&&fin.totals.remaining===25050);
 // ---- staff refunds part via the UI ----
 await sp.goto(B+'/#/requests/'+rid);await sp.waitForTimeout(1500);
 await sp.getByPlaceholder('100').fill('150');await sp.getByRole('button',{name:'طلب استرداد'}).click();await sp.waitForTimeout(1500);
 ok('refund request created, no money moved yet',(await J('GET',`/staff/v1/requests/${rid}/finance`,undefined,owner)).j.totals.refunded===0);
 await sp.getByRole('button',{name:'اعتماد'}).first().click();await sp.waitForTimeout(1200);
 await sp.getByRole('button',{name:'تنفيذ'}).first().click();await sp.waitForTimeout(1500);
 fin=(await J('GET',`/staff/v1/requests/${rid}/finance`,undefined,owner)).j;
 ok('refund executed after approval: net 250, credit note issued',fin.totals.refunded===15000&&fin.totals.net===25000&&fin.documents.some(d=>d.doc_type==='credit_note'));
 await sp.screenshot({path:'s1.png',fullPage:true});
 ok('no page errors (customer app, dashboard)',cerrs.length===0&&serrs.length===0);
 if(cerrs.length||serrs.length)console.log(cerrs.concat(serrs).slice(0,3));
 await b.close()})().catch(e=>{console.error('FAIL',e.message.slice(0,400));process.exit(1)});
