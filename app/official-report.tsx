import {useState} from 'react';
import {Printer} from 'lucide-react';
import type {Data} from '@/lib/model';
import {fa,finalKey,moduleVerdict,totalOf} from '@/lib/model';
import {Choice,Empty} from './widgets';

export default function OfficialReport({data}:{data:Data}){
 const [studentId,setStudentId]=useState(data.students[0]?.id||''),[paper,setPaper]=useState('landscape');
 const student=data.students.find(item=>item.id===studentId)||data.students[0];
 if(!student)return <Empty text="هنرجویی برای کارنامه ثبت نشده است"/>;
 const classroom=data.classes.find(item=>item.id===student.classId);
 const courses=data.courses.filter(course=>course.classId===student.classId);
 const father='father' in student?String((student as {father?:string}).father||''):'';
 const modules=[0,1,2,3,4];
 return <section className={'official-report '+paper}><div className="official-tools no-print"><Choice label="هنرجو" value={student.id} onChange={setStudentId} options={data.students.map(item=>({value:item.id,label:item.name+' · '+item.code}))}/><Choice label="جهت برگه" value={paper} onChange={setPaper} options={[{value:'landscape',label:'A4 افقی'},{value:'portrait',label:'A4 عمودی'}]}/><button className="btn" onClick={()=>window.print()}><Printer size={16}/> چاپ کارنامه</button></div>
 <header className="official-head"><p>وزارت آموزش و پرورش</p><h2>کارنامه تجمیعی پودمانی</h2><p>{data.profile.school||'هنرستان'}</p><p>سال تحصیلی {data.profile.year||'—'}</p></header>
 <dl className="official-id"><div><dt>هنرجو</dt><dd>{student.name}</dd></div><div><dt>نام پدر</dt><dd>{father||'—'}</dd></div><div><dt>کد دانش‌آموزی</dt><dd>{student.code}</dd></div><div><dt>کلاس</dt><dd>{classroom?.name||'—'}</dd></div><div><dt>پایه</dt><dd>{classroom?.grade||'—'}</dd></div><div><dt>رشته</dt><dd>{classroom?.major||'—'}</dd></div></dl>
 <table className="official-table"><thead><tr><th rowSpan={2}>درس</th>{modules.map(index=><th key={index} colSpan={3}>پودمان {fa(index+1)}</th>)}</tr><tr>{modules.flatMap(index=>['نمره','شایستگی','نتیجه'].map(label=><th key={index+label}>{label}</th>))}</tr></thead><tbody>{courses.map(course=>{const cells=modules.map(index=>{const grade=data.finals[finalKey(course.id,index,student.id)]||{continuous:null,competencies:[null,null],competency:null,total:null,note:''};const total=totalOf(grade);return {total,competency:grade.competency,result:moduleVerdict(grade,course.formula?.pass??12)}});return <tr key={course.id}><th>{course.name}</th>{cells.flatMap((cell,index)=>[<td key={index+'t'}>{cell.total===null?'—':fa(cell.total)}</td>,<td key={index+'c'}>{cell.competency===null?'—':fa(cell.competency)}</td>,<td key={index+'r'}>{cell.result}</td>])}</tr>})}{!courses.length&&<tr><td colSpan={16}>درسی برای این هنرجو در نمای جاری نیست.</td></tr>}</tbody></table>
 <p className="official-note">قبولی وقتی است که نمره پودمان به حد مقرر درس برسد و شایستگی نهایی دست‌کم ۲ باشد، یا نمره کلی به‌صورت دستی ثبت شده باشد. خانه خالی به معنی صفر نیست.</p>
 <footer className="official-sign"><div><b>دبیر مربوطه</b><span>امضا</span></div><div><b>معاون آموزشی</b><span>امضا</span></div><div><b>مدیر هنرستان</b><span>امضا</span></div></footer></section>;
}
