import type {School} from './central-demo';import {fa,uid,today} from './model';import {jalali} from './jalali';
export const permissions={structure:'تعریف رشته، پایه و کلاس',students:'مدیریت دانش‌آموزان',subjects:'برنامه درسی',teachers:'مدیریت معلمان',assign:'تخصیص تدریس',grades:'مشاهده نمرات و گزارش',office:'پیگیری غیبت و انضباط',routing:'تعیین مسئول حضور‌وغیاب',sms:'پیامک و مخاطبان',announce:'انتشار اطلاعیه',promotion:'انتقال سال تحصیلی'};
export type Permission=keyof typeof permissions;
export type LifeRole={id:string;name:string;permissions:Permission[]};
export type Person={id:string;name:string;roleId:string};
export type Notice={id:string;to:string;title:string;body:string;page:string;date:string;read:boolean};
export type Message={id:string;from:string;to:string;text:string;date:string;read:boolean};
export type FileAttachment={name:string;url:string;size:number};
export type Task={id:string;courseId:string;title:string;body:string;due:string;max:number;kind:'assignment'|'quiz';questions:{id:string;text:string;options:string[];correct:number}[];published:boolean};
export type Submission={id:string;taskId:string;studentId:string;text:string;file:FileAttachment|null;answers:Record<string,number>;date:string;score:number|null;feedback:string;released:boolean};
export type Dispatch={id:string;sessionId:string;yearId:string;to:string;revision:number;signature:string;date:string;title:string;rows:{id:string;name:string;status:string}[];followups:Record<string,{status:string;note:string;calls:string[]}>};
export type Contact={name:string;phone:string;group:'family'|'student'|'teacher';studentId?:string;consent:boolean};
export type Life={roles:LifeRole[];people:Person[];notices:Notice[];messages:Message[];routes:Record<string,string>;dispatches:Dispatch[];tasks:Task[];submissions:Submission[];announcements:{id:string;title:string;body:string;audience:string;date:string;by:string}[];contacts:Record<string,Contact>;sms:{id:string;date:string;text:string;targets:string[];status:'simulated';source:string}[];smsConfig:{provider:string;sender:string};notificationPrefs:Record<string,{messages:boolean;learning:boolean}>};
export function initialLife():Life{return {roles:[{id:'attendance',name:'مسئول پیگیری',permissions:['office']},{id:'counselor',name:'مشاور',permissions:['office','grades']}],people:[{id:'deputy2',name:'معاون دوم',roleId:'deputy'},{id:'staff:attendance',name:'مسئول حضور‌وغیاب',roleId:'attendance'}],notices:[{id:'welcome',to:'admin',title:'به دموی مدرسه خوش آمدید',body:'نقش‌ها، مسئول پیگیری و ارتباط با دانش‌آموز را از اینجا بررسی کنید.',page:'hub-dashboard',date:today(),read:false}],messages:[],routes:{default:'deputy'},dispatches:[],tasks:[{id:'task-demo',courseId:'o-computer-g11-computer-g11-special',title:'تمرین الگوریتم جمع دو عدد',body:'مراحل حل مسئله را بنویسید و در صورت نیاز فایل پاسخ را پیوست کنید.',due:today(),max:10,kind:'assignment',questions:[],published:true},{id:'quiz-demo',courseId:'o-computer-g11-computer-g11-special',title:'آزمون کوتاه الگوریتم',body:'به پرسش پاسخ دهید؛ نتیجه پس از ثبت نهایی نمایش داده می‌شود.',due:today(),max:5,kind:'quiz',published:true,questions:[{id:'q1',text:'اولین گام حل یک مسئله چیست؟',options:['شناخت مسئله','نوشتن کد بدون بررسی','چاپ خروجی','بستن برنامه'],correct:0}]}],submissions:[],announcements:[{id:'a1',title:'آغاز سال تحصیلی',body:'به هنرستان آذرمهر خوش آمدید. تکلیف‌ها و اطلاعیه‌های کلاس را از داشبورد خود دنبال کنید.',audience:'all',date:today(),by:'admin'}],contacts:{},sms:[],smsConfig:{provider:'سرویس انتخاب نشده',sender:''},notificationPrefs:{}}}
export function accounts(d:School,l:Life){return [{id:'admin',name:'مدیر مدرسه',roleId:'admin'},{id:'deputy',name:'معاون / ناظم',roleId:'deputy'},...l.people,...d.teachers.filter(t=>t.active).map(t=>({id:'teacher:'+t.id,name:t.name,roleId:'teacher'})),...d.students.map(s=>({id:'student:'+s.id,name:s.name+' · '+s.code,roleId:'student'}))]}
export function allowed(l:Life,actor:string,p:Permission){if(actor==='admin')return true;if(actor==='deputy'||l.people.find(x=>x.id===actor)?.roleId==='deputy')return true;const role=l.people.find(x=>x.id===actor)?.roleId;return !!l.roles.find(r=>r.id===role)?.permissions.includes(p)}
export function enrolledCourses(d:School,yearId:string,studentId:string){const e=d.enrollments.find(e=>e.yearId===yearId&&e.studentId===studentId&&e.status==='active');return d.offerings.filter(o=>o.classId===e?.classId)}
export function recipients(d:School,l:Life,actor:string,yearId:string){const all=accounts(d,l);if(actor.startsWith('student:')){const ids=new Set(enrolledCourses(d,yearId,actor.slice(8)).map(o=>'teacher:'+o.teacherId));const office=all.filter(p=>p.id==='admin'||p.id==='deputy'||allowed(l,p.id,'office'));return [...all.filter(p=>ids.has(p.id)),...office.filter(p=>p.id!==actor&&!ids.has(p.id))]}if(actor.startsWith('teacher:')){const cls=new Set(d.offerings.filter(o=>o.teacherId===actor.slice(8)&&d.classes.some(c=>c.id===o.classId&&c.yearId===yearId)).map(o=>o.classId));const ids=new Set(d.enrollments.filter(e=>e.yearId===yearId&&cls.has(e.classId||'')).map(e=>'student:'+e.studentId));return all.filter(p=>p.id!==actor&&(!p.id.startsWith('student:')||ids.has(p.id)))}if(actor==='admin'||actor==='deputy'||allowed(l,actor,'office'))return all.filter(p=>p.id!==actor);return all.filter(p=>p.id!==actor&&!p.id.startsWith('student:'))}
export function notify(l:Life,to:string,title:string,body:string,page:string,kind:'messages'|'learning'|'required'='required'){if(kind!=='required'&&l.notificationPrefs[to]?.[kind]===false)return;l.notices.unshift({id:uid(),to,title,body,page,date:today(),read:false})}
/** Match PHP hash('sha256', json_encode($rows, JSON_UNESCAPED_UNICODE)). */
function attendanceSignature(rows:{id:string;name:string;status:string}[]){
 const json=JSON.stringify(rows);
 // SubtleCrypto is async; use a compact sync SHA-256 for parity with PHP.
 const te=new TextEncoder().encode(json);
 // Fallback simple hash via Subtle unavailable sync — use WebCrypto sync polyfill below.
 return sha256Hex(te);
}
function sha256Hex(data:Uint8Array):string{
 // Minimal pure JS SHA-256 (sync) for attendance signatures.
 const K=new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
 const rr=(x:number,n:number)=>((x>>>n)|(x<<(32-n)))>>>0;
 const len=data.length,bit=len*8,pad=(((len+8)>>6)+1)*64,buf=new Uint8Array(pad);buf.set(data);buf[len]=0x80;new DataView(buf.buffer).setUint32(pad-4,bit);
 let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
 const w=new Uint32Array(64),dv=new DataView(buf.buffer);
 for(let i=0;i<pad;i+=64){
  for(let j=0;j<16;j++)w[j]=dv.getUint32(i+j*4);
  for(let j=16;j<64;j++){const s0=rr(w[j-15],7)^rr(w[j-15],18)^(w[j-15]>>>3),s1=rr(w[j-2],17)^rr(w[j-2],19)^(w[j-2]>>>10);w[j]=(w[j-16]+s0+w[j-7]+s1)>>>0}
  let a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,h=h7;
  for(let j=0;j<64;j++){const S1=rr(e,6)^rr(e,11)^rr(e,25),ch=(e&f)^((~e)&g),t1=(h+S1+ch+K[j]+w[j])>>>0,S0=rr(a,2)^rr(a,13)^rr(a,22),maj=(a&b)^(a&c)^(b&c),t2=(S0+maj)>>>0;h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0}
  h0=(h0+a)>>>0;h1=(h1+b)>>>0;h2=(h2+c)>>>0;h3=(h3+d)>>>0;h4=(h4+e)>>>0;h5=(h5+f)>>>0;h6=(h6+g)>>>0;h7=(h7+h)>>>0;
 }
 return [h0,h1,h2,h3,h4,h5,h6,h7].map(x=>x.toString(16).padStart(8,'0')).join('');
}
export function syncAttendance(l:Life,d:School,yearId:string,teacherId:string){for(const s of d.sessions){const o=d.offerings.find(o=>o.id===s.courseId&&o.teacherId===teacherId);if(!o||!d.classes.some(c=>c.id===o.classId&&c.yearId===yearId))continue;const es=d.enrollments.filter(e=>e.classId===o.classId&&e.yearId===yearId&&e.status==='active');if(!es.length||es.some(e=>!s.records[e.studentId]||s.records[e.studentId].attendance==='unset'))continue;const rows=[];for(const e of es){const student=d.students.find(x=>x.id===e.studentId);if(!student)continue;rows.push({id:e.studentId,name:student.name,status:s.records[e.studentId].attendance})}if(rows.length!==es.length)continue;const signature=attendanceSignature(rows);let item=l.dispatches.find(x=>x.sessionId===s.id);const chosen=l.routes[o.classId]||l.routes.default;const to=chosen&&allowed(l,chosen,'office')?chosen:allowed(l,l.routes.default,'office')?l.routes.default:'admin';if(item?.signature===signature)continue;if(item){for(const r of rows)if(item.rows.find(old=>old.id===r.id)?.status!==r.status&&item.followups[r.id])item.followups[r.id].status='open';Object.assign(item,{rows,signature,revision:item.revision+1,to});}else{item={id:uid(),sessionId:s.id,yearId,to,revision:1,signature,date:s.date,title:d.classes.find(c=>c.id===o.classId)!.name+' · '+o.name,rows,followups:{}};l.dispatches.unshift(item)}notify(l,to,'حضور‌وغیاب آماده پیگیری است',item.title+' · ویرایش '+item.revision,'hub-followup')}}
export function sendMessage(l:Life,d:School,yearId:string,from:string,to:string,text:string){if(!text.trim()||!recipients(d,l,from,yearId).some(p=>p.id===to))throw Error('گیرنده معتبر و متن پیام لازم است');l.messages.push({id:uid(),from,to,text:text.trim(),date:today(),read:false});notify(l,to,'پیام جدید',accounts(d,l).find(p=>p.id===from)!.name,'hub-messages','messages')}
export function simulateSMS(l:Life,ids:string[],text:string,source:string){const targets=[...new Set(ids)].filter(id=>l.contacts[id]?.consent&&/^09\d{9}$/.test(l.contacts[id].phone));if(!text.trim()||!targets.length)throw Error('متن و حداقل یک مخاطب با شماره معتبر و رضایت دریافت لازم است');l.sms.unshift({id:uid(),date:today(),text:text.trim(),targets,status:'simulated',source})}

export type RiskSeverity='high'|'medium'|'low';
export type RiskKind='attendance'|'followup'|'incident'|'grade'|'learning';
export type RiskAlert={id:string;severity:RiskSeverity;kind:RiskKind;studentId:string;studentName:string;classId?:string;className?:string;title:string;detail:string;go:string};
const severityRank:Record<RiskSeverity,number>={high:0,medium:1,low:2};
const kindLabel:Record<RiskKind,string>={attendance:'حضور',followup:'پیگیری',incident:'انضباط',grade:'نمره',learning:'تکلیف'};
export const riskKindLabel=kindLabel;
function dayOffset(iso:string,todayIso:string){const a=Date.parse(iso+'T12:00:00'),b=Date.parse(todayIso+'T12:00:00');if(!Number.isFinite(a)||!Number.isFinite(b))return 999;return Math.round((b-a)/86400000)}
/** Early-warning board derived from existing school data (no schema change). */
export function buildRiskAlerts(d:School,l:Life,yearId:string,actor:string):RiskAlert[]{
 if(actor.startsWith('student:'))return [];
 const canOffice=allowed(l,actor,'office'),canGrades=allowed(l,actor,'grades'),isTeacher=actor.startsWith('teacher:'),teacherId=isTeacher?actor.slice(8):'';
 if(!canOffice&&!canGrades&&!isTeacher)return [];
 const classes=d.classes.filter(c=>c.yearId===yearId);
 const classIds=new Set(classes.map(c=>c.id));
 const teacherClassIds=isTeacher?new Set(d.offerings.filter(o=>o.teacherId===teacherId&&classIds.has(o.classId)).map(o=>o.classId)):null;
 const teacherCourseIds=isTeacher?new Set(d.offerings.filter(o=>o.teacherId===teacherId&&classIds.has(o.classId)).map(o=>o.id)):null;
 const enrollments=d.enrollments.filter(e=>e.yearId===yearId&&e.status==='active'&&e.classId&&classIds.has(e.classId)&&(!teacherClassIds||teacherClassIds.has(e.classId)));
 const className=(id?:string|null)=>classes.find(c=>c.id===id)?.name||'';
 const now=today();
 const alerts:RiskAlert[]=[];
 const push=(a:RiskAlert)=>{if(!alerts.some(x=>x.id===a.id))alerts.push(a)};

 if(canOffice||isTeacher){
  const windowDays=14;
  const tallies=new Map<string,{absent:number;late:number;sessions:number}>();
  for(const s of d.sessions){
   if(dayOffset(s.date,now)>windowDays)continue;
   if(teacherCourseIds&&!teacherCourseIds.has(s.courseId))continue;
   const offering=d.offerings.find(o=>o.id===s.courseId);if(!offering||!classIds.has(offering.classId))continue;
   for(const e of enrollments.filter(en=>en.classId===offering.classId)){
    const status=s.records[e.studentId]?.attendance;if(!status||status==='unset')continue;
    const row=tallies.get(e.studentId)||{absent:0,late:0,sessions:0};row.sessions++;
    if(status==='absent')row.absent++;else if(status==='late')row.late++;
    tallies.set(e.studentId,row);
   }
  }
  for(const e of enrollments){
   const t=tallies.get(e.studentId);if(!t||!t.sessions)continue;
   const student=d.students.find(s=>s.id===e.studentId);if(!student)continue;
   const misses=t.absent+t.late;
   let severity:RiskSeverity|null=null;
   if(t.absent>=3||misses>=5)severity='high';
   else if(t.absent>=2||(t.absent>=1&&t.late>=1)||t.late>=3)severity='medium';
   else if(t.absent>=1||t.late>=2)severity='low';
   if(!severity)continue;
   push({id:'abs:'+e.studentId,severity,kind:'attendance',studentId:e.studentId,studentName:student.name,classId:e.classId||undefined,className:className(e.classId),title:t.absent?`${fa(t.absent)} غیبت در ${fa(windowDays)} روز اخیر`:`${fa(t.late)} تأخیر در ${fa(windowDays)} روز اخیر`,detail:`بر پایه ${fa(t.sessions)} جلسه ثبت‌شده · ${fa(t.absent)} غایب · ${fa(t.late)} تأخیر`,go:canOffice?'hub-followup':'journal'});
  }
 }

 if(canOffice){
  for(const x of l.dispatches.filter(x=>x.yearId===yearId&&(actor==='admin'||x.to===actor))){
   for(const r of x.rows){
    if(!['absent','late','excused'].includes(r.status))continue;
    if((x.followups[r.id]?.status||'open')==='resolved')continue;
    const student=d.students.find(s=>s.id===r.id);if(!student)continue;
    const en=enrollments.find(e=>e.studentId===r.id);
    push({id:`fu:${x.id}:${r.id}`,severity:r.status==='absent'?'high':'medium',kind:'followup',studentId:r.id,studentName:student.name,classId:en?.classId||undefined,className:className(en?.classId),title:'پیگیری حضور باز است',detail:`${x.title} · ${r.status==='absent'?'غایب':r.status==='late'?'تأخیر':'موجه'} · ${jalaliSafe(x.date)}`,go:'hub-followup'});
   }
  }
  for(const inc of d.incidents.filter(i=>i.yearId===yearId&&(i.status==='open'||i.status==='in_progress'))){
   if(teacherClassIds&&inc.classId&&!teacherClassIds.has(inc.classId))continue;
   const student=d.students.find(s=>s.id===inc.studentId);if(!student)continue;
   push({id:'inc:'+inc.id,severity:inc.status==='open'?'high':'medium',kind:'incident',studentId:inc.studentId,studentName:student.name,classId:inc.classId,className:className(inc.classId),title:inc.title,detail:inc.detail.slice(0,160),go:'office'});
  }
 }

 if(canGrades||isTeacher){
  const offerings=d.offerings.filter(o=>classIds.has(o.classId)&&(!teacherCourseIds||teacherCourseIds.has(o.id)));
  for(const e of enrollments){
   const student=d.students.find(s=>s.id===e.studentId);if(!student||!e.classId)continue;
   for(const o of offerings.filter(o=>o.classId===e.classId)){
    let weak=0,filled=0;
    for(let m=0;m<5;m++){
     const f=d.finals[`${o.id}:${m}:${e.studentId}`];
     const total=f?totalOfSafe(f):null;
     if(total===null)continue;filled++;
     if(total<10)weak++;
    }
    if(weak>=1){
     push({id:`gr:${o.id}:${e.studentId}`,severity:weak>=2||(filled&&weak===filled)?'high':'medium',kind:'grade',studentId:e.studentId,studentName:student.name,classId:e.classId,className:className(e.classId),title:`نمره ضعیف در ${o.name}`,detail:`${fa(weak)} پودمان زیر ۱۰ از ۲۰ ثبت شده است`,go:isTeacher?'finals':'reports'});
    }
   }
  }
  const courseSet=new Set(offerings.map(o=>o.id));
  for(const t of l.tasks.filter(t=>t.published&&courseSet.has(t.courseId)&&t.due<now)){
   const o=d.offerings.find(o=>o.id===t.courseId);if(!o)continue;
   for(const e of enrollments.filter(en=>en.classId===o.classId)){
    if(l.submissions.some(s=>s.taskId===t.id&&s.studentId===e.studentId))continue;
    const student=d.students.find(s=>s.id===e.studentId);if(!student)continue;
    push({id:`lr:${t.id}:${e.studentId}`,severity:'low',kind:'learning',studentId:e.studentId,studentName:student.name,classId:e.classId||undefined,className:className(e.classId),title:'تکلیف یا آزمون بدون پاسخ',detail:`«${t.title}» · مهلت گذشته`,go:'hub-learning'});
   }
  }
 }

 return alerts.sort((a,b)=>severityRank[a.severity]-severityRank[b.severity]||a.studentName.localeCompare(b.studentName,'fa'));
}
function jalaliSafe(iso:string){try{return jalali(iso)}catch{return iso}}
function totalOfSafe(f:{continuous:number|null;competency:number|null;total:number|null}){return f.total!==null?f.total:f.continuous!==null&&f.competency!==null?f.continuous+5*f.competency:null}