// Backup/restore drill helper (LOCAL TEST DATA ONLY). Used by scripts/backup-restore-drill.sh.
//   node backup-drill.cjs seed   <port> <outJson>   fill the primary with a realistic case and record what must survive
//   node backup-drill.cjs verify <port> <inJson>    check the restored copy against that record
//   node backup-drill.cjs wrongkey <port> <inJson>  with the WRONG encryption key: files and encrypted fields must NOT open
const crypto=require('crypto');const fs=require('fs');
const [,,mode,port,file]=process.argv;const B=`http://localhost:${port}`;
const J=(m,p,b,t,h={})=>fetch(B+p,{method:m,headers:{'content-type':'application/json',...(t?{authorization:'Bearer '+t}:{}),...h},body:b===undefined?undefined:JSON.stringify(b)}).then(async r=>({s:r.status,j:await r.json().catch(()=>({}))}));
const sha=b=>crypto.createHash('sha256').update(Buffer.from(b)).digest('hex');
function unb32(s){const A='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits=0,v=0;const o=[];for(const c of s){v=(v<<5)|A.indexOf(c);bits+=5;if(bits>=8){o.push((v>>>(bits-8))&255);bits-=8}}return Buffer.from(o)}
const totp=(sec,off=0)=>{const c=Math.floor(Date.now()/30000)+off;const b=Buffer.alloc(8);b.writeBigUInt64BE(BigInt(c));const h=crypto.createHmac('sha1',unb32(sec)).update(b).digest();const o=h[19]&15;return String((((h[o]&0x7f)<<24)|(h[o+1]<<16)|(h[o+2]<<8)|h[o+3])%1e6).padStart(6,'0')};
const webhook=async(intl,code)=>{const raw=JSON.stringify({entry:[{changes:[{value:{messages:[{from:intl,type:'text',text:{body:'x '+code}}]}}]}]});
  await fetch(B+'/webhooks/whatsapp',{method:'POST',headers:{'x-hub-signature-256':'sha256='+crypto.createHmac('sha256','e2e-secret').update(raw).digest('hex'),'content-type':'application/json'},body:raw})};
const customer=async phone=>{const st=(await J('POST','/v1/auth/wa/start',{phone})).j;await webhook(phone.slice(1),st.code);return (await J('POST','/v1/auth/wa/poll',{phone,challengeId:st.challengeId,pollToken:st.pollToken})).j.accessToken};
const staffLogin=async(secret,off)=>(await J('POST','/staff/v1/auth/totp',{phone:'+971501234567',code:totp(secret,off)})).j.accessToken;
let failed=0;const ok=(l,c)=>{console.log((c?'PASS ':'FAIL ')+l);if(!c)failed++};
const pdf=n=>Buffer.from(`%PDF-1.4\n% drill document ${n} ${crypto.randomBytes(8).toString('hex')}\n%%EOF\n`);

(async()=>{
if(mode==='seed'){
  const st=(await J('POST','/staff/v1/auth/setup/start',{phone:'+971501234567',setupKey:'local-owner-setup-key-12345'})).j;
  const owner=(await J('POST','/staff/v1/auth/setup/confirm',{phone:'+971501234567',code:totp(st.secret)})).j.accessToken;
  const agent=(await J('POST','/staff/v1/team',{phone:'+971501112233',name:'Agent Drill',role:'agent'},owner)).j;
  const acct=(await J('POST','/staff/v1/team',{phone:'+971501112244',name:'Accountant Drill',role:'accountant'},owner)).j;
  await J('PATCH',`/staff/v1/team/${acct.id}`,{active:false},owner); // a deactivated member must stay deactivated after a restore
  const cust=await customer('+971529997001');
  await J('PATCH','/v1/me',{displayName:'Drill Customer',email:'drill.customer@example.test'},cust);
  const rid=(await J('POST','/v1/requests',{serviceId:'emirates-id',data:{name:'Drill Customer',title:{ar:'تجديد الهوية',en:'Renew Emirates ID'}}},cust)).j.id;
  const files={};
  for(const [i,name] of [[1,'passport.pdf'],[2,'photo.pdf']]){const bytes=pdf(i);const r=await fetch(`${B}/v1/requests/${rid}/files`,{method:'PUT',headers:{authorization:'Bearer '+cust,'x-file-name':name,'x-client-key':'drill-file-000'+i},body:bytes});files[(await r.json()).id]=sha(bytes)}
  await J('PATCH',`/v1/requests/${rid}`,{status:'submitted'},cust);
  await J('POST',`/staff/v1/requests/${rid}/assign`,{staffId:agent.id},owner);
  const q=(await J('POST',`/staff/v1/requests/${rid}/quotes`,{items:[{kind:'service_fee',descriptionAr:'أتعاب الشركة',descriptionEn:'Company fee',amountFils:65050}]},owner)).j;
  await J('POST',`/staff/v1/quotes/${q.id}/issue`,{},owner);
  await J('POST',`/v1/requests/${rid}/quotes/${q.id}/accept`,{version:q.version},cust);
  const proofBytes=pdf(9);const proof=(await (await fetch(`${B}/v1/requests/${rid}/files`,{method:'PUT',headers:{authorization:'Bearer '+cust,'x-file-name':'transfer.pdf','x-client-key':'drill-proof-001'},body:proofBytes})).json()).id;files[proof]=sha(proofBytes);
  const pay=(await J('POST',`/v1/requests/${rid}/payments`,{amountFils:40000,method:'bank_transfer',reference:'TRX-DRILL-1',proofFileId:proof,clientKey:'drill-pay-0001'},cust)).j;
  await J('POST',`/staff/v1/payments/${pay.id}/approve`,{},owner);
  for(const s of ['review','ready_for_authority','authority','decision','completed'])await J('POST',`/staff/v1/requests/${rid}/status`,{status:s,reference:'AUTH-DRILL-1',overrideReason:'drill: fees settled outside the drill'},owner);
  const finalBytes=pdf(7);const fin=(await (await fetch(`${B}/staff/v1/requests/${rid}/files?kind=final`,{method:'PUT',headers:{authorization:'Bearer '+owner,'x-file-name':'emirates-id.pdf'},body:finalBytes})).json()).id;files[fin]=sha(finalBytes);
  await J('POST',`/staff/v1/requests/${rid}/deliveries/publish`,{},owner);
  await J('POST',`/v1/requests/${rid}/acknowledgments`,{deliveryVersion:1},cust);
  const finance=(await J('GET',`/staff/v1/requests/${rid}/finance`,undefined,owner)).j;
  const team=(await J('GET','/staff/v1/team',undefined,owner)).j.team.map(m=>({id:m.id,role:m.role,active:m.active})).sort((a,b)=>a.id.localeCompare(b.id));
  const record={ownerSecret:st.secret,rid,files,team,totals:finance.totals,documents:finance.documents.map(d=>d.number).sort(),customerPhone:'+971529997001',email:'drill.customer@example.test',deliveryVersion:1};
  fs.writeFileSync(file,JSON.stringify(record,null,1));
  ok('primary seeded: request, 4 encrypted files, team with roles, quote → invoice, payment, delivery, receipt',Object.keys(files).length===4&&finance.totals.paid===40000&&team.length===3);
}
if(mode==='verify'){
  const rec=JSON.parse(fs.readFileSync(file,'utf8'));
  const owner=await staffLogin(rec.ownerSecret,1);
  ok('owner signs in on the restored copy with the SAME authenticator (encrypted TOTP secret restored with its key)',!!owner);
  const me=(await J('GET','/staff/v1/me',undefined,owner)).j.staff;ok('owner keeps the owner role',me?.role==='owner');
  const team=(await J('GET','/staff/v1/team',undefined,owner)).j.team.map(m=>({id:m.id,role:m.role,active:m.active})).sort((a,b)=>a.id.localeCompare(b.id));
  ok('team members, roles and the deactivated member are exactly as before',JSON.stringify(team)===JSON.stringify(rec.team));
  const d=(await J('GET',`/staff/v1/requests/${rec.rid}`,undefined,owner)).j;
  ok('request restored with status, assignee and delivery/receipt state',d.request?.status==='completed'&&!!d.request.assigneeId&&d.work?.delivery?.state==='received');
  ok('customer email (encrypted column) opens with the restored key',d.customer?.email===rec.email);
  let same=0;for(const [fid,h] of Object.entries(rec.files)){const r=await fetch(`${B}/staff/v1/files/${fid}`,{headers:{authorization:'Bearer '+owner}});if(r.ok&&sha(new Uint8Array(await r.arrayBuffer()))===h)same++}
  ok(`every file decrypts to the same bytes (${same}/${Object.keys(rec.files).length})`,same===Object.keys(rec.files).length);
  const f=(await J('GET',`/staff/v1/requests/${rec.rid}/finance`,undefined,owner)).j;
  ok('money is identical: totals, paid, remaining and the same document numbers',JSON.stringify(f.totals)===JSON.stringify(rec.totals)&&JSON.stringify(f.documents.map(x=>x.number).sort())===JSON.stringify(rec.documents));
  const inv=f.documents.find(x=>x.doc_type==='invoice');const html=await (await fetch(`${B}/staff/v1/documents/${inv.id}`,{headers:{authorization:'Bearer '+owner}})).text();
  ok('the invoice document renders from its frozen snapshot',html.includes(inv.number)&&html.includes('TEST COPY'));
  const cust=await customer(rec.customerPhone);const mine=(await J('GET','/v1/requests',undefined,cust)).j.requests??[];
  ok('the customer signs in with the same phone and sees the same request (phone hashes use the restored PEPPER)',mine.length===1&&mine[0].id===rec.rid);
  ok('the immutable-ledger rules are active again after the restore',(await J('POST',`/staff/v1/invoices/${inv.id}/cancel`,{reason:'drill: must refuse while money is held'},owner)).j.error==='refund_first');
}
if(mode==='wrongkey'){
  const rec=JSON.parse(fs.readFileSync(file,'utf8'));
  const owner=await staffLogin(rec.ownerSecret,2);
  ok('with the wrong DATA_KEY the staff authenticator cannot be verified (encrypted secret does not open)',!owner);
  // nothing else can be read without a staff session: that IS the result. The files are ciphertext in storage.
}
if(failed)process.exitCode=1;
})().catch(e=>{console.error('FAIL',e.message.slice(0,300));process.exit(1)});
