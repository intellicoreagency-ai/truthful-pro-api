const http=require('http');const fs=require('fs');
http.createServer((req,res)=>{let b='';req.on('data',d=>b+=d);req.on('end',()=>{fs.appendFileSync('meta.log',JSON.stringify({url:req.url,auth:req.headers.authorization,body:JSON.parse(b||'{}')})+'\n');res.writeHead(200,{'content-type':'application/json'});res.end('{"messages":[{"id":"wamid.X"}]}')})}).listen(8799);
