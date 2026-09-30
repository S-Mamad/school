import fs from 'fs';

const hubPath = 'M:/Project File/School Platform/app/school-hub.tsx';
let h = fs.readFileSync(hubPath, 'utf8');

// Wrap followup queue button with permission check
{
  const marker = "onClick={()=>go('hub-followup')}";
  const mi = h.indexOf(marker);
  if (mi < 0) throw new Error('followup onclick missing');
  const startBtn = h.lastIndexOf('<button', mi);
  const endBtn = h.indexOf('</button>', mi) + '</button>'.length;
  const before = h.slice(Math.max(0, startBtn - 40), startBtn);
  if (before.includes("canHub(l,actor,'hub-followup')")) {
    console.log('followup already gated');
  } else {
    const btn = h.slice(startBtn, endBtn);
    h = h.slice(0, startBtn) + "{canHub(l,actor,'hub-followup')&&" + btn + '}' + h.slice(endBtn);
    console.log('followup gated');
  }
}

// Gate deep-dive overview/students
{
  const marker = "go(actor==='admin'?'overview':'students')";
  const mi = h.indexOf(marker);
  if (mi < 0) {
    console.log('deep-dive already changed or missing');
  } else {
    const startBtn = h.lastIndexOf('<button', mi);
    const endBtn = h.indexOf('</button>', mi) + '</button>'.length;
    const replacement =
      "{actor==='admin'?<button type=\"button\" className=\"hub-queue-row\" onClick={()=>go('overview')}><span className=\"status-dot low\" aria-hidden/><div className=\"cd-grow\"><b>نمای کامل مدرسه</b><small>مرور وضعیت و سوابق</small></div></button>" +
      ":allowed(l,actor,'structure')||allowed(l,actor,'office')?<button type=\"button\" className=\"hub-queue-row\" onClick={()=>go('students')}><span className=\"status-dot low\" aria-hidden/><div className=\"cd-grow\"><b>پرونده دانش‌آموزان</b><small>مرور وضعیت و سوابق</small></div></button>:null}";
    h = h.slice(0, startBtn) + replacement + h.slice(endBtn);
    console.log('deep-dive gated');
  }
}

// Alert card status dots
{
  const old = "className={'panel hub-alert-card severity-'+a.severity} onClick={()=>go(a.go)}><div className=\"cd-row\"><span className={'pill severity-'+a.severity}>";
  const neu = "className={'panel hub-alert-card severity-'+a.severity} onClick={()=>go(a.go)}><div className=\"cd-row\"><span className={'status-dot '+a.severity} aria-hidden/><span className={'pill severity-'+a.severity}>";
  if (h.includes(old)) {
    h = h.replace(old, neu);
    console.log('alert dots ok');
  } else if (h.includes("status-dot '+a.severity")) {
    console.log('alert dots already');
  } else {
    console.log('alert pattern miss');
  }
}

fs.writeFileSync(hubPath, h);
const a = (h.match(/\{/g) || []).length;
const b = (h.match(/\}/g) || []).length;
console.log('braces', a, b, a === b);

const demoPath = 'M:/Project File/School Platform/app/central-demo.tsx';
let d = fs.readFileSync(demoPath, 'utf8');
if (!d.includes('aria-label="ناوبری اصلی"')) {
  d = d.replace('<Sidebar side="right">', '<Sidebar side="right" aria-label="ناوبری اصلی">');
  fs.writeFileSync(demoPath, d);
  console.log('sidebar aria ok');
} else console.log('sidebar aria exists');
