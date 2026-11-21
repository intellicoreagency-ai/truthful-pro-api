// Shared helpers for the local browser acceptance scripts (scripts/e2e-*.cjs). LOCAL TEST DATA ONLY: they talk to `wrangler dev`
// on :8788 and the app's web preview on :8767, sign in through a signed fake WhatsApp webhook (WA_APP_SECRET=e2e-secret), and never
// contact Meta, a payment provider or any real service. Run them with scripts/e2e-run.sh, which prepares everything.
const crypto=require('crypto');const fs=require('fs');const path=require('path');
const B='http://localhost:8788',APP='http://localhost:8767';

// Browser: Playwright's own Chromium when installed, otherwise the system Chrome (CHROME_PATH or /usr/bin/google-chrome).
function pw(){try{return require('playwright')}catch{return require('playwright-core')}}
exports.launch=async()=>{const {chromium}=pw();const exe=process.env.CHROME_PATH||(fs.existsSync('/usr/bin/google-chrome')?'/usr/bin/google-chrome':undefined);
  try{return await chromium.launch(exe?{executablePath:exe,args:['--no-sandbox']}:{})}catch(e){if(!exe)throw e;return chromium.launch()}};

// Assertions: print PASS/FAIL and fail the process at the end (never stops early, so one run shows every problem).
exports.ok=(label,cond)=>{console.log((cond?'PASS ':'FAIL ')+label);if(!cond)process.exitCode=1};

// API helpers
exports.J=(m,p,b,t,extra={})=>fetch(B+p,{method:m,headers:{'content-type':'application/json',...(t?{authorization:'Bearer '+t}:{}),...extra},body:b===undefined?undefined:JSON.stringify(b)}).then(async r=>({s:r.status,j:await r.json().catch(()=>({}))}));
function unb32(s){const A='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits=0,v=0;const o=[];for(const c of s){v=(v<<5)|A.indexOf(c);bits+=5;if(bits>=8){o.push((v>>>(bits-8))&255);bits-=8}}return Buffer.from(o)}
exports.totp=(secret,off=0)=>{const c=Math.floor(Date.now()/30000)+off;const b=Buffer.alloc(8);b.writeBigUInt64BE(BigInt(c));const h=crypto.createHmac('sha1',unb32(secret)).update(b).digest();const o=h[19]&15;return String((((h[o]&0x7f)<<24)|(h[o+1]<<16)|(h[o+2]<<8)|h[o+3])%1e6).padStart(6,'0')};
/** Enrols the owner on the fresh database (each script gets its own; see e2e-run.sh) and returns {token, secret}.
 *  Use totp(secret, 1) for a later sign-in in the same 30 s window: a code is accepted only once. */
exports.owner=async()=>{
  const st=(await exports.J('POST','/staff/v1/auth/setup/start',{phone:'+971501234567',setupKey:'local-owner-setup-key-12345'})).j;
  const token=(await exports.J('POST','/staff/v1/auth/setup/confirm',{phone:'+971501234567',code:exports.totp(st.secret)})).j.accessToken;
  return{token,secret:st.secret}};
/** Delivers the verification code the way Meta would (signed webhook). */
exports.webhook=async(intl,code)=>{const raw=JSON.stringify({entry:[{changes:[{value:{messages:[{from:intl,type:'text',text:{body:'x '+code}}]}}]}]});
  await fetch(B+'/webhooks/whatsapp',{method:'POST',headers:{'x-hub-signature-256':'sha256='+crypto.createHmac('sha256','e2e-secret').update(raw).digest('hex'),'content-type':'application/json'},body:raw})};

// ---- customer app (web preview) ----
const watchStart=p=>{const box={v:null};p.on('response',async r=>{if(r.url().endsWith('/v1/auth/wa/start')&&r.ok()){try{box.v=await r.json()}catch{}}});return box};
/** Registers a NEW customer in the app UI: name, mobile, email, three consents, WhatsApp verification. */
exports.login=async(p,phone='0501234567',intl='971501234567',name='مستخدم تجريبي')=>{const start=watchStart(p);
  await p.goto(APP+'/');await p.waitForTimeout(2500);
  await p.getByText('إنشاء حساب',{exact:true}).first().click();await p.waitForTimeout(600);
  await p.getByPlaceholder('اسمك كما في الهوية').fill(name);await p.getByPlaceholder('05XXXXXXXX').fill(phone);
  await p.getByPlaceholder('name@example.com').fill('u'+intl+'@example.test'); // the email is required
  for(let i=0;i<3;i++)await p.getByRole('checkbox').nth(i).click();
  await p.getByRole('button',{name:'التحقق عبر واتساب'}).click();await p.waitForTimeout(2000);
  await exports.webhook(intl,start.v.code);await p.waitForTimeout(5000)};
/** Signs an EXISTING customer in from the login screen. */
exports.signIn=async(p,phone,intl)=>{const start=watchStart(p);
  await p.goto(APP+'/');await p.waitForTimeout(2500);
  await p.getByPlaceholder('05XXXXXXXX').fill(phone);await p.getByText('التحقق عبر واتساب',{exact:true}).first().click();await p.waitForTimeout(2000);
  await exports.webhook(intl,start.v.code);await p.waitForTimeout(5000)};
/** New Request (chooser): main service, transaction type, applicant; Continue opens the shared request flow at its first step. */
exports.newRequestUI=async(p,{main='الهوية الإماراتية',action='تجديد الهوية',name='منى العلي',phone='0529990011',notes=''}={})=>{
  await p.getByRole('button',{name:'بدء معاملة'}).first().click();await p.waitForTimeout(1200);
  await p.getByText('اختر الخدمة الرئيسية').first().click();await p.waitForTimeout(800);
  await p.getByText(main,{exact:true}).first().click();await p.waitForTimeout(900);
  if(await p.getByText('اختر نوع المعاملة',{exact:true}).count())await p.getByText(action,{exact:true}).last().click();
  await p.waitForTimeout(1800); // let the picker sheet finish closing before typing (it animates out over the form)
  // type like a person: on the web build, replacing a pre-filled value in one paste is cut by the field's length limit (react-native-web quirk)
  await exports.typeInto(p.getByPlaceholder('الاسم كما في الهوية'),name);await exports.typeInto(p.getByPlaceholder('05XXXXXXXX'),phone);
  if(notes)await p.getByPlaceholder('أي تفاصيل تساعدنا في إنجاز معاملتك').fill(notes);
  await p.getByRole('button',{name:'متابعة'}).first().click();await p.waitForTimeout(1500)};
exports.typeInto=async(loc,text)=>{await loc.fill('');await loc.pressSequentially(text,{delay:15})};
/** The shared request flow: details → documents (uploads) → review & consent → payment (info) → confirm. */
exports.wizardSubmit=async(p,files=['doc.pdf','photo.jpg'])=>{
  await p.getByRole('button',{name:'التالي'}).first().click();await p.waitForTimeout(900);
  for(const f of files){const [fc]=await Promise.all([p.waitForEvent('filechooser'),p.getByText('رفع الملف',{exact:true}).first().click()]);await fc.setFiles(f);await p.waitForTimeout(900)}
  await p.getByRole('button',{name:'التالي'}).first().click();await p.waitForTimeout(900);await p.getByRole('checkbox').last().click();
  await p.getByRole('button',{name:'التالي'}).first().click();await p.waitForTimeout(600);await p.getByRole('button',{name:'التالي'}).first().click();await p.waitForTimeout(600);
  await p.getByText('تأكيد الطلب',{exact:true}).click();await p.waitForTimeout(3500)};
/** Opens My Requests through the tab bar from anywhere (it re-syncs with the server). Never reloads the page: on the web preview the
 *  sign-in lives in memory only (by design), so a reload signs out. Closes open detail screens with their Back button first. */
exports.myRequests=async p=>{
  for(let i=0;i<5&&!(await p.getByText('طلباتي',{exact:true}).count());i++){
    const back=p.getByRole('button',{name:/^(رجوع|العودة)/});if(await back.count())await back.first().click();else await p.mouse.click(350,40);await p.waitForTimeout(700)}
  await p.getByText('الرئيسية',{exact:true}).last().click();await p.waitForTimeout(500); // leave and re-enter so the list refreshes
  await p.getByText('طلباتي',{exact:true}).last().click();await p.waitForTimeout(3500)};
// ---- staff dashboard (served by the API worker at :8788) ----
/** Signs the owner in with the authenticator code (offset 1: the enrolment already used this window's code). */
exports.dashLogin=async(p,secret)=>{await p.goto(B+'/');await p.waitForTimeout(1000);
  await p.getByRole('tab',{name:'تطبيق المصادقة'}).click();await p.getByLabel('رقم الجوال').fill('0501234567');await p.getByLabel('الرمز المكوّن من 6 أرقام').fill(exports.totp(secret,1));
  await p.getByRole('button',{name:'دخول',exact:true}).click();await p.waitForTimeout(1800);
  const later=p.getByRole('button',{name:'لاحقاً'});if(await later.count())await later.first().click()}; // the "enable fingerprint" banner
exports.B=B;exports.APP=APP;
