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

// New Request screen (Step 4): pick the service and type, fill the applicant, create on the server, then continue to the documents step.
exports.newRequestUI=async(p,name='منى العلي',phone='0529990011')=>{
 await p.getByText('بدء معاملة').first().click();await p.waitForTimeout(900);
 await p.getByRole('button',{name:/^الخدمة/}).click();await p.waitForTimeout(500);
 await p.getByRole('radio',{name:/الهوية الإماراتية/}).first().click();await p.waitForTimeout(600);
 await p.getByRole('radio',{name:/تجديد الهوية/}).first().click();await p.waitForTimeout(500);
 await p.getByPlaceholder('الاسم كما في الهوية').fill(name);await p.getByPlaceholder('05XXXXXXXX').fill(phone);
 await p.getByRole('button',{name:'إنشاء الطلب'}).click();await p.waitForTimeout(2500);
 await p.getByRole('button',{name:'رفع المستندات'}).click();await p.waitForTimeout(1500);
};
