import {useState} from 'react';
import {JalaliDate} from './jalali-date';import {jalali} from '@/lib/jalali';
import {Tabs,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {Choice,Field,Empty,attendance} from './widgets';
import {today,fa,normalize} from '@/lib/model';
import type {School} from '@/lib/central-demo';
import {exportExcel} from '@/lib/excel';
import {toast} from 'sonner';
import {saveSessionAttendance} from '@/lib/production';
import type {Dispatch} from '@/lib/school-life';

export function CentralOffice({d,yearId,readonly,change,patchLocal,onIncident,persist,onDispatch,onRevision}:{d:School;yearId:string;readonly:boolean;change:(fn:(d:School)=>void)=>void;patchLocal?:(fn:(d:School)=>void)=>void;onIncident:(r:any)=>void;persist?:boolean;onDispatch?:(item:Dispatch)=>void;onRevision?:(revision:number)=>void}){
 const [tab,setTab]=useState('day'),[from,setFrom]=useState(today()),[to,setTo]=useState(today()),[classId,setClassId]=useState('all'),[query,setQuery]=useState(''),[status,setStatus]=useState('all'),[studentId,setStudentId]=useState(''),[busyKey,setBusyKey]=useState('');
 const classes=d.classes.filter(c=>c.yearId===yearId),offers=d.offerings.filter(o=>classes.some(c=>c.id===o.classId));
 const student=(id:string)=>d.students.find(s=>s.id===id)!;
 const rows=d.sessions.filter(s=>offers.some(o=>o.id===s.courseId)).flatMap(s=>Object.entries(s.records).map(([id,r])=>({s,id,r,o:offers.find(o=>o.id===s.courseId)!}))).filter(x=>(classId==='all'||x.o.classId===classId)&&normalize(student(x.id).name+' '+student(x.id).code).includes(normalize(query))&&(tab==='day'?x.s.date===from:(!from||x.s.date>=from)&&(!to||x.s.date<=to))&&(status==='all'?['absent','late','excused'].includes(x.r.attendance):x.r.attendance===status));
 const cases=d.incidents.filter(i=>i.yearId===yearId&&(classId==='all'||i.classId===classId)&&normalize(student(i.studentId).name+' '+student(i.studentId).code+' '+i.title).includes(normalize(query))&&(!from||i.date>=from)&&(!to||i.date<=to)&&(status==='all'||i.status===status));
 const statusOptions=tab==='discipline'?[{value:'open',label:'باز'},{value:'in_progress',label:'در حال پیگیری'},{value:'resolved',label:'رسیدگی‌شده'}]:attendance.filter(a=>a.value!=='unset');
 const roster=d.enrollments.filter(e=>e.yearId===yearId&&e.status==='active'&&(classId==='all'||e.classId===classId));
 const exportReport=async()=>{try{await exportExcel(tab==='discipline'?'گزارش انضباطی':'گزارش غیبت',tab==='discipline'?[['نام','کد','تاریخ','موضوع','شرح','وضعیت','پیگیری'],...cases.map(i=>[student(i.studentId).name,student(i.studentId).code,jalali(i.date),i.title,i.detail,statusOptions.find(s=>s.value===i.status)?.label||'',i.followup])]:[['نام','کد','نام پدر','کلاس','درس','تاریخ','وضعیت','پیگیری'],...rows.map(x=>[student(x.id).name,student(x.id).code,student(x.id).father,classes.find(c=>c.id===x.o.classId)!.name,x.o.name,jalali(x.s.date),attendance.find(a=>a.value===x.r.attendance)?.label||'',d.attendanceFollowup[x.s.id+':'+x.id]||''])])}catch(e){toast.error((e as Error).message)}};
 async function setAttendance(sessionId:string,studentId:string,value:string,prev:typeof rows[0]['r']){
  if(readonly||prev.attendance===value)return;
  const key=sessionId+':'+studentId;
  if(busyKey===key)return;
  const previous=prev.attendance;
  const write=persist&&patchLocal?patchLocal:change;
  write(n=>{const record=n.sessions.find(s=>s.id===sessionId)?.records[studentId];if(record)record.attendance=value as typeof previous});
  if(!persist){toast.success('وضعیت حضور اصلاح شد');return}
  setBusyKey(key);
  try{
   const res=await saveSessionAttendance({session_id:sessionId,records:[{student_id:studentId,attendance:value,asked:!!prev.asked,note:prev.note||''}]});
   if(res.queued)toast.info('اصلاح ذخیره شد و پس از اتصال همگام می‌شود.');
   else toast.success('وضعیت حضور اصلاح شد');
   if(res.revision!=null)onRevision?.(res.revision);
   if(res.dispatch)onDispatch?.(res.dispatch);
  }catch(e){
   write(n=>{const record=n.sessions.find(s=>s.id===sessionId)?.records[studentId];if(record)record.attendance=previous});
   toast.error((e as Error).message||'ذخیره حضور انجام نشد');
  }finally{setBusyKey('')}
 }
 return <div className="stack school-office"><Tabs value={tab} onValueChange={v=>{setTab(v);setStatus('all');if(v!=='day'){setFrom('');setTo('')}else{setFrom(today());setTo(today())}}} dir="rtl"><TabsList variant="line" className="school-tabs"><TabsTrigger value="day">غیبت‌های روز</TabsTrigger><TabsTrigger value="history">سابقه حضور‌وغیاب</TabsTrigger><TabsTrigger value="discipline">گزارش‌های انضباطی</TabsTrigger></TabsList></Tabs><div className="school-filters"><Field label={tab==='day'?'روز':'از تاریخ'}><JalaliDate value={from} onChange={setFrom} clearable={tab!=='day'} label="شروع بازه"/></Field>{tab!=='day'&&<Field label="تا تاریخ"><JalaliDate value={to} onChange={setTo} clearable label="پایان بازه"/></Field>}<Field label="کلاس"><Choice label="کلاس گزارش" value={classId} onChange={v=>{setClassId(v);setStudentId('')}} options={[{value:'all',label:'همه کلاس‌ها'},...classes.map(c=>({value:c.id,label:c.name}))]}/></Field><Field label="وضعیت"><Choice label="وضعیت گزارش" value={status} onChange={setStatus} options={[{value:'all',label:tab==='discipline'?'همه وضعیت‌ها':'غیبت، تأخیر و موجه'},...statusOptions]}/></Field><Field label="جست‌وجو"><input placeholder="نام یا کد دانش‌آموز…" value={query} onChange={e=>setQuery(e.target.value)}/></Field></div>
 <div className="cd-row office-actions"><b>{fa(tab==='discipline'?cases.length:rows.length)} مورد در فیلتر فعلی</b><span className="cd-grow"/><button className="btn" onClick={()=>window.print()}>چاپ گزارش</button><button className="btn" onClick={()=>void exportReport()}>خروجی اکسل</button></div><p className="hint">غیبت‌ها به تفکیک جلسه‌اند؛ چند غیبت در یک روز ممکن است برای یک دانش‌آموز باشد. پیگیری و اصلاح حضور‌وغیاب، نمرات ثبت‌شده توسط معلم را تغییر نمی‌دهد.{persist?' اصلاح حضور از مسیر امن دفتر ثبت می‌شود.':''}</p>
 {tab==='discipline'?<><div className="cd-row office-actions"><Choice label="دانش‌آموز گزارش جدید" value={studentId} onChange={setStudentId} options={roster.map(e=>({value:e.studentId,label:student(e.studentId).name+' · '+student(e.studentId).code}))}/><button disabled={readonly||!studentId} className="btn primary" onClick={()=>onIncident({studentId,classId:roster.find(e=>e.studentId===studentId)?.classId,date:today(),title:'',detail:'',followup:'',status:'open'})}>گزارش جدید</button></div><div className="office-cards">{cases.map(i=><article className="panel cd-track" key={i.id}><div className="cd-row"><h3>{student(i.studentId).name}</h3><span className="pill">{statusOptions.find(s=>s.value===i.status)?.label}</span></div><small>{jalali(i.date)} · {classes.find(c=>c.id===i.classId)?.name}</small><h3>{i.title}</h3><p>{i.detail}</p><p>ثبت‌کننده: {i.author}</p><p>پیگیری: {i.followup||'هنوز پیگیری ثبت نشده'}</p><button disabled={readonly} className="btn" onClick={()=>onIncident(i)}>رسیدگی به گزارش</button></article>)}</div>{!cases.length&&<Empty text="گزارشی با این فیلتر وجود ندارد"/>}</>:<><div className="office-cards">{rows.map(x=>{const key=x.s.id+':'+x.id;return <article className="panel cd-track" key={key}><div className="cd-row"><h3>{student(x.id).name}</h3><span className={'pill '+x.r.attendance}>{attendance.find(a=>a.value===x.r.attendance)?.label}</span></div><small>{student(x.id).code} · نام پدر: {student(x.id).father}</small><p>{classes.find(c=>c.id===x.o.classId)?.name} · {x.o.name}</p><p>{jalali(x.s.date)} · {x.s.title}</p><div className="cd-attendance">{attendance.filter(a=>a.value!=='unset').map(a=><button key={a.value} disabled={readonly||busyKey===key} aria-pressed={x.r.attendance===a.value} className={'cd-attendance-button '+a.value} onClick={()=>void setAttendance(x.s.id,x.id,a.value,x.r)}>{a.value==='excused'?'موجه':a.label}</button>)}</div><Field label="یادداشت پیگیری"><textarea disabled={readonly} value={d.attendanceFollowup[x.s.id+':'+x.id]||''} onChange={e=>change(n=>{n.attendanceFollowup[x.s.id+':'+x.id]=e.target.value})} placeholder="نتیجه تماس یا علت غیبت…"/></Field><button disabled={readonly} className="btn" onClick={()=>onIncident({studentId:x.id,classId:x.o.classId,date:x.s.date,title:'',detail:'',followup:'',status:'open'})}>ثبت گزارش انضباطی</button></article>})}</div>{!rows.length&&<Empty text="موردی با این فیلتر وجود ندارد"/>}</>}
 </div>
}
