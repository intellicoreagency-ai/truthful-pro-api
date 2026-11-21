// Cycle acceptance: the customer submits in the app UI -> the team reviews and asks for a document (staff API) -> the customer answers in
// the app -> the team prices it, the customer APPROVES the quotation in the app (that issues the invoice) -> the team files with the authority,
// completes and publishes the delivery -> the customer sees each change and confirms receipt -> the server records the acknowledgement.
// LOCAL TEST DATA ONLY. Run through scripts/e2e-run.sh (fresh DB, wrangler dev :8788, app web preview :8767).
const fs=require('fs');const {launch,ok,J,owner,login,newRequestUI,wizardSubmit,myRequests,B}=require('./lib.cjs');
(async()=>{
 const own=(await owner()).token;
 const b=await launch();const p=await (await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:1})).newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await login(p,'0529990011','971529990011','منى العلي');
 await newRequestUI(p,{name:'منى العلي',phone:'0529990011',notes:'ملاحظة من شاشة الطلب الجديد'});
 ok('New Request hands over to the shared request flow with the typed notes',(await p.locator('textarea').first().inputValue().catch(()=>''))==='ملاحظة من شاشة الطلب الجديد');
 await wizardSubmit(p);
 const list=(await J('GET','/staff/v1/requests',undefined,own)).j.requests;const rid=list[0]?.id;
 ok('the team queue receives the submitted request',!!rid&&list[0].status==='submitted');
 const det0=(await J('GET',`/staff/v1/requests/${rid}`,undefined,own)).j;
 ok('the request carries the notes and both uploaded files',JSON.stringify(det0.request.data??'').includes('ملاحظة من شاشة الطلب الجديد')&&det0.files.length===2);
 // ---- the team reviews and asks for a document ----
 await J('POST',`/staff/v1/requests/${rid}/status`,{status:'review',expectedAt:'2026-12-10'},own);
 await J('POST',`/staff/v1/requests/${rid}/missing`,{items:[{labelAr:'صورة الإقامة الحالية',labelEn:'Current residence copy',noteAr:'الصورة غير واضحة',noteEn:'Unclear'}]},own);
 await myRequests(p);
 let t=await p.locator('body').innerText();ok('the customer sees that action is needed',t.includes('مطلوب منك')||t.includes('تحتاج إجراء')||t.includes('إرسال المستندات'));
 await p.getByText('إرسال المستندات',{exact:true}).first().click();await p.waitForTimeout(1500);
 t=await p.locator('body').innerText();ok('the missing-documents screen shows the team request and note',t.includes('صورة الإقامة الحالية')&&t.includes('الصورة غير واضحة'));
 const [fc]=await Promise.all([p.waitForEvent('filechooser'),p.getByText('اضغط لرفع الملف').first().click()]);await fc.setFiles('photo.jpg');await p.waitForTimeout(1200);
 await p.getByText('إرسال المستندات للاستكمال').first().click();await p.waitForTimeout(4500);
 const after=(await J('GET',`/staff/v1/requests/${rid}`,undefined,own)).j;
 ok('the customer reply returns the request to review and resolves the item',after.request.status==='review'&&after.missing.every(m=>m.resolved_at)&&after.files.length===3);
 // ---- the team prices it; the customer approves the quotation in the app ----
 const q=(await J('POST',`/staff/v1/requests/${rid}/quotes`,{items:[{kind:'service_fee',descriptionAr:'أتعاب الشركة',descriptionEn:'Company fee',amountFils:50000}]},own)).j;
 const sent=await J('POST',`/staff/v1/quotes/${q.id}/issue`,{},own);
 ok('the team sends a quotation (no invoice yet)',sent.s===201&&/^T-QUO-/.test(sent.j.number)&&!(await J('GET',`/staff/v1/requests/${rid}/finance`,undefined,own)).j.documents.some(d=>d.doc_type==='invoice'));
 await myRequests(p);await p.getByText('تفاصيل الطلب',{exact:true}).first().click();await p.waitForTimeout(2000);
 ok('the app asks the customer to approve the quotation',(await p.locator('body').innerText()).includes('عرض سعر بانتظار موافقتك'));
 await p.getByRole('button',{name:'أوافق على عرض السعر'}).first().click();await p.waitForTimeout(3500);
 const fin=(await J('GET',`/staff/v1/requests/${rid}/finance`,undefined,own)).j;
 ok('approving in the app issues the invoice from that quotation',fin.quotes[0].status==='accepted'&&fin.documents.some(d=>d.doc_type==='invoice'&&/^T-INV-/.test(d.number))&&fin.totals.total===50000);
 // ---- the team files with the authority, completes and delivers ----
 for(const s of ['ready_for_authority','authority','decision','completed'])await J('POST',`/staff/v1/requests/${rid}/status`,{status:s,reference:'AUTH-2026-0042',overrideReason:'test: fees settled offline'},own);
 await fetch(`${B}/staff/v1/requests/${rid}/files?kind=final`,{method:'PUT',headers:{authorization:'Bearer '+own,'x-file-name':encodeURIComponent('emirates-id.pdf'),'x-file-label':encodeURIComponent('الهوية الإماراتية الجديدة')},body:fs.readFileSync('doc.pdf')});
 await J('POST',`/staff/v1/requests/${rid}/deliveries/publish`,{},own);
 await myRequests(p);
 t=await p.locator('body').innerText();ok('the customer sees the request completed',t.includes('منجزة')||t.includes('مكتمل'));
 await p.getByText('تفاصيل الطلب',{exact:true}).first().click();await p.waitForTimeout(1800);
 ok('the delivery file is listed with its label',(await p.locator('body').innerText()).includes('الهوية الإماراتية الجديدة'));
 await p.getByText(/تأكيد استلام|تأكيد الاستلام/).last().click();await p.waitForTimeout(3500);
 const fin2=(await J('GET',`/staff/v1/requests/${rid}`,undefined,own)).j;
 ok('the server records the acknowledgement of delivery version 1',fin2.work?.delivery?.state==='received'&&fin2.work.delivery.version===1);
 ok('no page errors in the app',errs.length===0);if(errs.length)console.log(errs.slice(0,3));
 await b.close()})().catch(e=>{console.error('FAIL',e.message.slice(0,300));process.exit(1)});
