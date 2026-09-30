import fs from 'fs';
const p = 'M:/Project File/School Platform/app/central-demo.tsx';
let c = fs.readFileSync(p, 'utf8');
const old = "visibleNav.map(n=><button key={n.id} className={'nav-item '+(page===n.id?'active':'')} onClick={()=>go(n.id)}><n.icon size={19}/>{n.name}</button>)";
const neu = "visibleNav.map(n=><button key={n.id} type=\"button\" className={'nav-item '+(page===n.id?'active':'')} aria-current={page===n.id?'page':undefined} onClick={()=>go(n.id)}><n.icon size={19}/>{n.name}</button>)";
if (!c.includes(old)) {
  console.log('nav pattern missing');
  process.exit(1);
}
fs.writeFileSync(p, c.replace(old, neu));
console.log('nav aria-current ok');
