import {defaultFormula,blankRecord,today,uid,type Course,type Session,type FinalGrade,type Data} from './model';
export type Year={id:string;name:string;archived:boolean};
export type Major={id:string;name:string};
export type Grade={id:string;name:string;order:number};
export type SchoolClass={id:string;yearId:string;majorId:string;gradeId:string;section:string;name:string};
export type SchoolStudent={id:string;name:string;father:string;code:string;phone?:string;extra?:Record<string,string>};
export type Enrollment={id:string;yearId:string;studentId:string;classId:string|null;status:'active'|'graduated'};
export type Teacher={id:string;name:string;email:string;phone?:string;active:boolean};
export type Subject={id:string;name:string;kind:'general'|'technical';gradeId:string;majorId:string};
export type Offering=Omit<Course,'classId'>&{classId:string;subjectId:string;teacherId:string};
export type Incident={id:string;studentId:string;classId:string;yearId:string;date:string;title:string;detail:string;followup:string;status:'open'|'in_progress'|'resolved';author:string};
export type StudentField={id:string;name:string;type:'text'|'number'|'date';required:boolean};
export type School={schoolName?:string;customFields?:StudentField[];years:Year[];majors:Major[];grades:Grade[];classes:SchoolClass[];students:SchoolStudent[];enrollments:Enrollment[];teachers:Teacher[];subjects:Subject[];offerings:Offering[];sessions:Session[];finals:Record<string,FinalGrade>;incidents:Incident[];attendanceFollowup:Record<string,string>};
export const matches=(c:SchoolClass,s:Subject)=>c.gradeId===s.gradeId&&(s.majorId==='all'||s.majorId===c.majorId);
export function addOffering(d:School,c:SchoolClass,s:Subject){if(d.offerings.some(o=>o.classId===c.id&&o.subjectId===s.id))return;d.offerings.push({id:uid(),classId:c.id,subjectId:s.id,name:s.name,teacherId:'',modules:Array.from({length:5},(_,i)=>({name:`پودمان ${i+1}`,competencies:1 as const})),formula:{...defaultFormula},gradeScales:{'کارگاهی':20,'پرسش شفاهی':10,'تکلیف':5}})}
export function demoSchool():School {
 const d:School={schoolName:'هنرستان آذرمهر',years:[{id:'y1',name:'۱۴۰۵–۱۴۰۶',archived:false}],majors:[{id:'computer',name:'کامپیوتر'},{id:'accounting',name:'حسابداری'},{id:'electronics',name:'الکترونیک'}],grades:[{id:'g10',name:'دهم',order:10},{id:'g11',name:'یازدهم',order:11},{id:'g12',name:'دوازدهم',order:12}],classes:[],students:[],enrollments:[],teachers:[{id:'t1',name:'سعید آذرمهر',email:'azarmehr@example.test',active:true},{id:'t2',name:'مریم رضایی',email:'rezaei@example.test',active:true},{id:'t3',name:'علی کریمی',email:'karimi@example.test',active:true},{id:'t4',name:'زهرا موسوی',email:'mousavi@example.test',active:true}],subjects:[],offerings:[],sessions:[],finals:{},incidents:[],attendanceFollowup:{}};
 d.customFields=[];d.teachers.forEach(t=>t.phone='09000000000');
 const specific:Record<string,string[]>={computer:['نصب و راه‌اندازی سیستم‌های رایانه‌ای','توسعه برنامه‌سازی و پایگاه داده','تجارت الکترونیک و امنیت شبکه'],accounting:['دانش فنی حسابداری','حسابداری اموال و انبار','حسابداری بهای تمام‌شده'],electronics:['دانش فنی الکترونیک','ساخت مدارهای الکترونیکی','نصب و راه‌اندازی تجهیزات الکترونیکی']};
 for(const [gi,g] of d.grades.entries()){for(const name of ['فارسی','ریاضی'])d.subjects.push({id:`${name}-${g.id}`,name:`${name} ${gi+1}`,kind:'general',gradeId:g.id,majorId:'all'});for(const m of d.majors){d.classes.push({id:`${m.id}-${g.id}`,yearId:'y1',majorId:m.id,gradeId:g.id,section:'۱',name:`${g.name} ${m.name} / ۱`});d.subjects.push({id:`${m.id}-${g.id}-special`,name:specific[m.id][gi],kind:'technical',gradeId:g.id,majorId:m.id})}}
 const names=['امیرحسین محمدی','علی رضایی','پارسا احمدی','آرین نوری','محمد طاهری','رضا اکبری','سامیار مرادی','حسین رحیمی'];const fathers=['حسن','رضا','محمود','علی','احمد','حسین','محمد','مهدی'];
 for(const [ci,c] of d.classes.entries()){for(let i=0;i<6;i++){const id=`s${ci}-${i}`;d.students.push({id,name:names[(ci+i)%names.length],father:fathers[(ci*2+i)%fathers.length],code:'00'+String(1405000+ci*6+i)});d.enrollments.push({id:'e'+id,yearId:'y1',studentId:id,classId:c.id,status:'active'})}for(const s of d.subjects.filter(s=>matches(c,s))){addOffering(d,c,s);const o=d.offerings.at(-1)!;o.id=`o-${c.id}-${s.id}`;o.teacherId=s.kind==='general'?'t2':c.majorId==='computer'?'t1':c.majorId==='accounting'?'t3':'t4';if(c.majorId==='electronics'&&c.gradeId==='g12'&&s.kind==='technical')o.teacherId=''}}
 const course=d.offerings.find(o=>o.classId==='computer-g11'&&d.subjects.find(s=>s.id===o.subjectId)?.kind==='technical')!;
 course.modules=course.modules.map((m,i)=>({...m,name:['حل مسئله و برنامه‌سازی','پیاده‌سازی الگوریتم','کار با داده‌ها','پایگاه داده','توسعه پروژه'][i],competencies:2}));
 const roster=d.enrollments.filter(e=>e.classId===course.classId).map(e=>e.studentId);
 d.sessions.push({id:'session-demo',courseId:course.id,module:0,date:today(),title:'تمرین حل مسئله',records:Object.fromEntries(roster.map((id,i)=>[id,{...blankRecord(),attendance:i===1?'absent':i===3?'late':i===5?'unset':'present',marks:i%2===0?[{id:'mark'+i,type:'کارگاهی',value:8,max:10,competency:1,note:'تمرین کلاسی'}]:[]}]))});
 const yesterday=(()=>{const t=new Date();t.setDate(t.getDate()-1);const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(t);return ['year','month','day'].map(x=>p.find(z=>z.type===x)!.value).join('-')})();
 d.sessions.push({id:'session-demo-2',courseId:course.id,module:0,date:yesterday,title:'مرور الگوریتم',records:Object.fromEntries(roster.map((id,i)=>[id,{...blankRecord(),attendance:i===1||i===3?'absent':i===2?'late':'present',marks:[]}]))});
 d.incidents.push({id:'case-demo',studentId:roster[3],classId:course.classId,yearId:'y1',date:today(),title:'پیگیری تأخیر',detail:'تأخیر در آغاز جلسه؛ نیازمند گفت‌وگو و پیگیری.',followup:'',status:'open',author:'سعید آذرمهر'});return d;
}
export function schoolData(d:School,yearId:string,teacherId:string|null):Data {
 const classes=d.classes.filter(c=>c.yearId===yearId);const courses=d.offerings.filter(o=>classes.some(c=>c.id===o.classId)&&(teacherId===null||o.teacherId===teacherId));const ids=new Set(courses.map(o=>o.classId));const courseIds=new Set(courses.map(o=>o.id));
 const students=d.enrollments.filter(e=>e.yearId===yearId&&e.status==='active'&&e.classId&&(teacherId===null||ids.has(e.classId))).flatMap(e=>{const person=d.students.find(s=>s.id===e.studentId);return person?[{...person,classId:e.classId!}]:[]});
 const seen=new Set(students.map(s=>s.id));
 for(const session of d.sessions){if(!courseIds.has(session.courseId))continue;for(const studentId of Object.keys(session.records||{})){if(seen.has(studentId))continue;const person=d.students.find(s=>s.id===studentId);if(!person)continue;seen.add(studentId);const enrollment=d.enrollments.find(e=>e.studentId===studentId&&e.yearId===yearId&&e.classId);students.push({...person,classId:enrollment?.classId||''})}}
 return {schema:1,profile:{name:d.teachers.find(t=>t.id===teacherId)?.name||'مدیریت هنرستان',school:(d.schoolName||'هنرستان').trim()||'هنرستان',year:d.years.find(y=>y.id===yearId)?.name||''},classes:classes.filter(c=>teacherId===null||ids.has(c.id)).map(c=>({id:c.id,name:c.name,major:d.majors.find(m=>m.id===c.majorId)!.name,grade:d.grades.find(g=>g.id===c.gradeId)!.name,year:d.years.find(y=>y.id===yearId)!.name})),students,courses,sessions:d.sessions.filter(s=>courses.some(c=>c.id===s.courseId)),finals:d.finals};
}
export function mergeTeacherData(d:School,next:Data,yearId:string,teacherId:string){if(d.years.find(y=>y.id===yearId)?.archived)throw Error('سوابق این سال بایگانی شده‌اند');const permitted=d.offerings.filter(o=>d.classes.some(c=>c.id===o.classId&&c.yearId===yearId)&&o.teacherId===teacherId);const ids=new Set(permitted.map(o=>o.id));
 d.sessions=[...d.sessions.filter(s=>!ids.has(s.courseId)),...next.sessions.filter(s=>ids.has(s.courseId))];
 for(const c of next.courses){const o=d.offerings.find(o=>o.id===c.id);if(o&&ids.has(o.id)){o.formula=c.formula;o.modules=c.modules;o.gradeScales=c.gradeScales}}
 for(const [key,f] of Object.entries(next.finals))if(ids.has(key.split(':')[0]))d.finals[key]=f;
}
export function promote(d:School,source:string,name:string,choices:Record<string,string>){
 if(d.years.find(y=>y.id===source)?.archived)throw Error('انتقال این سال قبلاً انجام شده است');if(d.years.some(y=>y.name===name.trim()))throw Error('سال مقصد قبلاً وجود دارد');if(!name.trim())throw Error('نام سال مقصد را وارد کنید');
 const nextId=uid();d.years.push({id:nextId,name:name.trim(),archived:false});const map=new Map<string,string>();
 for(const c of d.classes.filter(c=>c.yearId===source)){const next={...c,id:uid(),yearId:nextId};d.classes.push(next);map.set(c.id,next.id);for(const subject of d.subjects.filter(s=>matches(next,s)))addOffering(d,next,subject)}
 const gs=[...d.grades].sort((a,b)=>a.order-b.order);for(const e of d.enrollments.filter(e=>e.yearId===source&&e.status==='active')){const mode=choices[e.id]||'advance';if(mode==='skip')continue;const c=d.classes.find(c=>c.id===e.classId)!;const gi=gs.findIndex(g=>g.id===c.gradeId);const nextGrade=mode==='repeat'?gs[gi]:gs[gi+1];
 if(!nextGrade){d.enrollments.push({id:uid(),studentId:e.studentId,yearId:nextId,classId:null,status:'graduated'});continue}
 let dest=d.classes.find(x=>x.yearId===nextId&&x.majorId===c.majorId&&x.gradeId===nextGrade.id&&x.section===c.section);if(!dest){dest={...c,id:uid(),yearId:nextId,gradeId:nextGrade.id,name:`${nextGrade.name} ${d.majors.find(m=>m.id===c.majorId)!.name} / ${c.section}`};d.classes.push(dest);for(const s of d.subjects.filter(s=>matches(dest!,s)))addOffering(d,dest,s)}
 d.enrollments.push({id:uid(),studentId:e.studentId,yearId:nextId,classId:dest.id,status:'active'});
 }d.years.find(y=>y.id===source)!.archived=true;return nextId;
}
