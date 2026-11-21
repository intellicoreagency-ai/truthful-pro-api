const crypto=require('crypto');
exports.login=async(p,phone='0501234567',intl='971501234567')=>{
 let start=null;p.on('response',async r=>{if(r.url().endsWith('/v1/auth/wa/start')&&r.ok()){try{start=await r.json()}catch{}}});
 await p.goto('http://localhost:8767/');await p.waitForTimeout(3000);
 // Register screen: name, mobile, three consents, then WhatsApp verification
 await p.getByRole('link',{name:'إنشاء حساب'}).click();await p.waitForTimeout(500);
 await p.getByPlaceholder('اسمك كما في الهوية').fill('مستخدم تجريبي');
 await p.getByPlaceholder('05XXXXXXXX').fill(phone);
 await p.getByPlaceholder('name@example.com').fill('u'+intl+'@example.test'); // the email is required
 for(let i=0;i<3;i++)await p.getByRole('checkbox').nth(i).click();
 await p.getByRole('button',{name:'التحقق عبر واتساب'}).click();await p.waitForTimeout(2000);
 const raw=JSON.stringify({entry:[{changes:[{value:{messages:[{from:intl,type:'text',text:{body:'x '+start.code}}]}}]}]});
 const sig='sha256='+crypto.createHmac('sha256','e2e-secret').update(raw).digest('hex');
 await fetch('http://localhost:8788/webhooks/whatsapp',{method:'POST',headers:{'x-hub-signature-256':sig,'content-type':'application/json'},body:raw});
 await p.waitForTimeout(4500);
};
