// Turns a `wrangler d1 export` file into one that restores cleanly into an EMPTY D1 database.
//   node scripts/d1-restore-order.cjs <export.sql> <restore.sql>
// Why (found by scripts/backup-restore-drill.sh): the export writes each table with its rows in creation order. Tables that a
// migration rebuilt (e.g. "requests") come AFTER tables that reference them, so the first child row fails with
// "no such table: main.requests"; and the protection triggers (immutable ledger, frozen quotes) would refuse rows of documents
// that are already final. The restore file therefore runs: PRAGMA → every CREATE TABLE → every row (in export order, with foreign-key
// checks deferred to the end of the transaction) → indexes → triggers. Nothing is changed or dropped; every statement is kept once.
const fs=require('fs');
const [,,src,dst]=process.argv;
if(!src||!dst){console.error('usage: node d1-restore-order.cjs <export.sql> <restore.sql>');process.exit(2)}
const sql=fs.readFileSync(src,'utf8');

// Split into statements, skipping -- and /* */ comments and respecting '…' and "…" literals (customer text may contain ';' or newlines) and trigger bodies (BEGIN … END;).
const out=[];let cur='',q=null,depth=0,word='';
for(let i=0;i<sql.length;i++){
  const c=sql[i];
  if(!q&&c==='-'&&sql[i+1]==='-'){const e=sql.indexOf('\n',i);const j=e<0?sql.length:e;cur+=sql.slice(i,j);i=j-1;continue} // -- comment (may contain quotes)
  if(!q&&c==='/'&&sql[i+1]==='*'){const e=sql.indexOf('*/',i+2);const j=e<0?sql.length:e+2;cur+=sql.slice(i,j);i=j-1;continue}
  cur+=c;
  if(q){if(c===q){if(sql[i+1]===q){cur+=sql[++i];}else q=null}continue}
  if(c==="'"||c==='"'){q=c;word='';continue}
  if(/[A-Za-z_]/.test(c)){word+=c;continue}
  if(word){const w=word.toUpperCase();if(w==='BEGIN'&&/^\s*CREATE\s+TRIGGER/i.test(cur))depth++;else if(w==='END'&&depth>0)depth--;word=''}
  if(c===';'&&depth===0){const s=cur.trim();if(s&&s!==';')out.push(s);cur=''}
}
if(cur.trim())out.push(cur.trim().replace(/;?$/,';'));

const kind=s=>{const u=s.replace(/^\s+/,'').toUpperCase();
  if(u.startsWith('PRAGMA'))return 0;
  if(u.startsWith('CREATE TABLE'))return 1;
  if(u.startsWith('INSERT')||u.startsWith('DELETE FROM SQLITE_SEQUENCE'))return 2; // rows (and the sequence reset) keep their export order
  if(u.startsWith('CREATE INDEX')||u.startsWith('CREATE UNIQUE INDEX'))return 3;
  if(u.startsWith('CREATE TRIGGER'))return 4;
  if(u.startsWith('CREATE VIEW'))return 5;
  return 6;
};
const unknown=out.filter(s=>kind(s)===6);
if(unknown.length){console.error('unexpected statements, not reordering:\n'+unknown.slice(0,3).map(s=>s.slice(0,120)).join('\n'));process.exit(1)}
if(!out.some(s=>/^PRAGMA\s+defer_foreign_keys/i.test(s)))out.unshift('PRAGMA defer_foreign_keys=TRUE;');
const ordered=out.map((s,i)=>({s,i,k:kind(s)})).sort((a,b)=>a.k-b.k||a.i-b.i).map(x=>x.s);
fs.writeFileSync(dst,ordered.join('\n')+'\n');
const count=k=>out.filter(s=>kind(s)===k).length;
console.log(`restore file: ${count(1)} tables, ${count(2)} row statements, ${count(3)} indexes, ${count(4)} triggers -> ${dst}`);
