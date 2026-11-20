// Smoke test for the staff WhatsApp login code against a mock Meta server (mockmeta on :8799; set WA_TOKEN=test-token WA_PHONE_NUMBER_ID=111222333 WA_OTP_TEMPLATE=truthful_login_code WA_GRAPH_BASE=http://localhost:8799 in .dev.vars; fresh DB).
const {chromium}=require('playwright');const crypto=require('crypto');const fs=require('fs');
const B='http://localhost:8788';
function unb32(s){const A='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits=0,v=0;const o=[];for(const c of s){v=(v<<5)|A.indexOf(c);bits+=5;if(bits>=8){o.push((v>>>(bits-8))&255);bits-=8}}return Buffer.from(o)}
function code(secret){const c=Math.floor(Date.now()/30000);const b=Buffer.alloc(8);b.writeBigUInt64BE(BigInt(c));const h=crypto.createHmac('sha1',unb32(secret)).update(b).digest();const o=h[19]&15;const n=((h[o]&0x7f)<<24)|(h[o+1]<<16)|(h[o+2]<<8)|h[o+3];return String(n%1000000).padStart(6,'0')}
(async()=>{
 const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1100,height:800}})).newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(B+'/');await p.waitForTimeout(1200);
 // owner enrols (authenticator) and invites a member
 await p.getByRole('tab',{name:'أول دخول'}).click();await p.getByLabel('رقم الجوال').fill('0501234567');await p.getByLabel('مفتاح الإعداد').fill('local-owner-setup-key-12345');await p.getByRole('button',{name:'متابعة'}).click();await p.waitForTimeout(1200);
 const secret=(await p.locator('.code').first().innerText()).trim();await p.getByLabel('أدخل أول رمز من التطبيق لإنهاء التفعيل').fill(code(secret));await p.getByRole('button',{name:'دخول',exact:true}).click();await p.waitForTimeout(1500);
 await p.getByRole('link',{name:'الفريق',exact:true}).click();await p.waitForTimeout(700);
 await p.getByLabel('الاسم').fill('نورة');await p.getByLabel('رقم الجوال').fill('0521234567');await p.getByRole('button',{name:'إضافة عضو'}).last().click();await p.waitForTimeout(1000);
 await p.getByRole('button',{name:'تسجيل الخروج'}).click();await p.waitForTimeout(800);
 // the member signs in with a WhatsApp code
 await p.getByRole('tab',{name:'واتساب'}).click();await p.waitForTimeout(300);
 console.log('code flow shown:',await p.getByRole('button',{name:'إرسال الرمز إلى واتساب'}).count(),'| switch link:',await p.getByRole('button',{name:'أو تحقق بإرسال رسالة (مجاني)'}).count());
 await p.getByLabel('رقم الجوال').fill('0521234567');await p.getByRole('button',{name:'إرسال الرمز إلى واتساب'}).click();await p.waitForTimeout(1500);
 const log=fs.readFileSync('meta.log','utf8').trim().split('\n').map(JSON.parse).pop();
 const sent=log.body.template.components[0].parameters[0].text;
 console.log('meta call:',log.url,'| auth ok:',log.auth==='Bearer test-token','| to:',log.body.to,'| template:',log.body.template.name,'| lang:',log.body.template.language.code,'| code digits:',/^\d{6}$/.test(sent));
 await p.screenshot({path:'w1.png'});
 await p.getByLabel('الرمز المكوّن من 6 أرقام').fill(sent);await p.getByRole('button',{name:'دخول',exact:true}).click();await p.waitForTimeout(1500);
 const body=await p.locator('body').innerText();
 console.log('member in:',body.includes('نظرة عامة'),'| no Team tab:',(await p.getByRole('link',{name:'الفريق',exact:true}).count())===0);
 // a stranger gets the same screen and no message
 await p.getByRole('button',{name:'تسجيل الخروج'}).click();await p.waitForTimeout(600);
 const n0=fs.readFileSync('meta.log','utf8').trim().split('\n').length;
 await p.getByRole('tab',{name:'واتساب'}).click();await p.getByLabel('رقم الجوال').fill('0529999999');await p.getByRole('button',{name:'إرسال الرمز إلى واتساب'}).click();await p.waitForTimeout(1200);
 console.log('stranger sees code box:',await p.getByLabel('الرمز المكوّن من 6 أرقام').count(),'| messages sent:',fs.readFileSync('meta.log','utf8').trim().split('\n').length-n0);
 console.log('errors:',JSON.stringify(errs));await b.close()})().catch(e=>{console.error('FAIL',e.message.slice(0,300));process.exit(1)});
