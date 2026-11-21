// Browser smoke test for fingerprint sign-in using a Chromium virtual authenticator. Same prerequisites as e2e-dashboard.cjs (fresh DB, OWNER_PHONE=+971501234567, OWNER_SETUP_KEY=local-owner-setup-key-12345).
const {launch}=require('./lib.cjs');const crypto=require('crypto');
const B='http://localhost:8788';
function unb32(s){const A='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits=0,v=0;const o=[];for(const c of s){v=(v<<5)|A.indexOf(c);bits+=5;if(bits>=8){o.push((v>>>(bits-8))&255);bits-=8}}return Buffer.from(o)}
function code(secret,off=0){const c=Math.floor(Date.now()/30000)+off;const b=Buffer.alloc(8);b.writeBigUInt64BE(BigInt(c));const h=crypto.createHmac('sha1',unb32(secret)).update(b).digest();const o=h[19]&15;const n=((h[o]&0x7f)<<24)|(h[o+1]<<16)|(h[o+2]<<8)|h[o+3];return String(n%1000000).padStart(6,'0')}
(async()=>{
 const b=await launch();const ctx=await b.newContext({viewport:{width:1280,height:800}});const p=await ctx.newPage();
 const cdp=await ctx.newCDPSession(p);await cdp.send('WebAuthn.enable');
 const {authenticatorId}=await cdp.send('WebAuthn.addVirtualAuthenticator',{options:{protocol:'ctap2',transport:'internal',hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true}});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(B+'/');await p.waitForTimeout(1000);
 console.log('bio button visible:',await p.getByRole('button',{name:/الدخول بالبصمة/}).count());
 // 1) bio before registering: should fail politely
 await p.getByRole('button',{name:/الدخول بالبصمة/}).click();await p.waitForTimeout(1500);
 console.log('no passkey yet ->',(await p.getByRole('alert').innerText().catch(()=>'(none)')));
 // 2) enrol owner via TOTP
 await p.getByRole('tab',{name:'أول دخول'}).click();await p.getByLabel('رقم الجوال').fill('0501234567');await p.getByLabel('مفتاح الإعداد').fill('local-owner-setup-key-12345');await p.getByRole('button',{name:'متابعة'}).click();await p.waitForTimeout(1200);
 const secret=(await p.locator('.code').first().innerText()).trim();await p.getByLabel('أدخل أول رمز من التطبيق لإنهاء التفعيل').fill(code(secret));await p.getByRole('button',{name:'دخول',exact:true}).click();await p.waitForTimeout(1800);
 console.log('banner offered:',await p.getByText('فعّل الدخول بالبصمة على هذا الجهاز').count());
 await p.screenshot({path:'b1.png'});
 // 3) register passkey
 await p.getByRole('link',{name:'الأمان',exact:true}).click();await p.waitForTimeout(500);
 await p.getByRole('button',{name:'تفعيل البصمة على هذا الجهاز'}).click();await p.waitForTimeout(1800);
 console.log('enabled msg:',await p.getByRole('status').innerText().catch(()=>'(none)'));
 const creds=await cdp.send('WebAuthn.getCredentials',{authenticatorId});console.log('credentials on device:',creds.credentials.length);
 await p.screenshot({path:'b2.png'});
 // 4) sign out and sign in with the fingerprint
 await p.getByRole('button',{name:'تسجيل الخروج'}).click();await p.waitForTimeout(800);
 await p.getByRole('button',{name:/الدخول بالبصمة/}).click();await p.waitForTimeout(2000);
 console.log('signed in by biometric:',await p.getByText('نظرة عامة').count()>0);
 // 5) remove it, then bio must fail
 await p.getByRole('link',{name:'الأمان',exact:true}).click();await p.waitForTimeout(600);
 await p.getByRole('button',{name:'إزالة'}).click();await p.waitForTimeout(800);
 await p.getByRole('button',{name:'تسجيل الخروج'}).click();await p.waitForTimeout(600);
 await p.getByRole('button',{name:/الدخول بالبصمة/}).click();await p.waitForTimeout(1500);
 console.log('after removal ->',(await p.getByRole('alert').innerText().catch(()=>'(none)')));
 console.log('page errors:',JSON.stringify(errs));
 await b.close()})().catch(e=>{console.error('FAIL',e.message.slice(0,400));process.exit(1)});
