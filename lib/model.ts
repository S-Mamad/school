export type Classroom={id:string;name:string;grade:string;major:string;year:string};
export type Student={id:string;code:string;name:string;classId:string};
export type Module={name:string;competencies:1|2};
export type Formula={expression:string;minimum:number;high:number;round:number;pass:number};
export type Course={id:string;name:string;classId:string;modules:Module[];formula:Formula;gradeScales?:Record<string,number>};
export type Mark={id:string;type:string;value:number;max?:number;note:string;competency:number};
export type RecordEntry={attendance:string;asked:boolean;note:string;marks:Mark[]};
export type Session={id:string;courseId:string;module:number;date:string;title:string;records:Record<string,RecordEntry>};
export type FinalGrade={continuous:number|null;competencies:(number|null)[];competency:number|null;total:number|null;note:string};
export type Data={schema:1;profile:{name:string;school:string;year:string};classes:Classroom[];students:Student[];courses:Course[];sessions:Session[];finals:Record<string,FinalGrade>};
export const markTypes=['سرکلاسی','کارگاهی','پرسش کتبی','پرسش شفاهی','انضباط','ارائه','تکلیف','مثبت','منفی'];
export const pointMark=(type:string)=>['مثبت','منفی'].includes(type);
export const markOutOf20=(m:Mark)=>m.value/(m.max??20)*20;
export const markLabel=(m:Mark)=>pointMark(m.type)?fa(m.value)+' امتیاز':fa(m.value)+' از '+fa(m.max??20);
export const today=()=>{const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(t=>p.find(x=>x.type===t)!.value).join('-')};
export const defaultFormula:Formula={expression:'avg / 4',minimum:12,high:18,round:0.5,pass:12};
export const uid=()=>crypto.randomUUID();
export const fa=(v:number|string)=>typeof v==='number'?new Intl.NumberFormat('fa-IR',{maximumFractionDigits:2}).format(v):v;
export const normalize=(s:string)=>s.replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/ي/g,'ی').replace(/ك/g,'ک').trim();
export const blankRecord=():RecordEntry=>({attendance:'unset',asked:false,note:'',marks:[]});
export const blankFinal=():FinalGrade=>({continuous:null,competencies:[null,null],competency:null,total:null,note:''});
export const finalKey=(course:string,module:number,student:string)=>`${course}:${module}:${student}`;
export const totalOf=(f:FinalGrade)=>f.total!==null?f.total:f.continuous!==null&&f.competency!==null?f.continuous+5*f.competency:null;
export function moduleVerdict(f:FinalGrade,pass=12):'ثبت نشده'|'قبولی'|'نیاز به ارزشیابی مجدد'{const total=totalOf(f);if(total===null)return 'ثبت نشده';if(total>=pass&&(f.total!==null||(f.competency??0)>=2))return 'قبولی';return 'نیاز به ارزشیابی مجدد'}
export function emptyData(name=''):Data{return {schema:1,profile:{name,school:'',year:'۱۴۰۵–۱۴۰۶'},classes:[],students:[],courses:[],sessions:[],finals:{}}}
export function sampleData():Data{const d=emptyData('سعید آذرمهر');d.profile.school='هنرستان نمونه';d.classes=[{id:'c1',name:'یازدهم کامپیوتر — ۱۱/۱',grade:'یازدهم',major:'شبکه و نرم‌افزار رایانه',year:d.profile.year}];d.courses=[{id:'l1',name:'توسعه برنامه‌سازی و پایگاه داده',classId:'c1',modules:['حل مسئله و برنامه‌سازی','پیاده‌سازی الگوریتم','کار با داده‌ها','پایگاه داده','توسعه پروژه'].map(name=>({name,competencies:2})),formula:{...defaultFormula}}];d.students=['امیرحسین محمدی','علی رضایی','محمدمهدی کریمی','پارسا احمدی','آراد حسینی','ابوالفضل موسوی','امیرعلی کاظمی','سامیار مرادی','حسین رحیمی','محمد طاهری','آرین نوری','رضا اکبری'].map((name,i)=>({id:'s'+i,name,code:'140500'+String(i+1).padStart(2,'0'),classId:'c1'}));d.sessions=[{id:'j1',courseId:'l1',module:0,date:today(),title:'آشنایی با حل مسئله',records:Object.fromEntries(d.students.map((s,i)=>[s.id,{attendance:i===3?'absent':i===7?'late':'present',asked:i%3===0,note:i===0?'مشارکت خوب در حل تمرین':'',marks:i===3||i===10?[]:[{id:'m'+i,type:'کارگاهی',value:20-i%7,note:'تمرین الگوریتم',competency:1}]}]))}];return d}
// Small, allowlisted expression parser. Never evaluates JavaScript or property access.
export function evaluate(expression:string,values:Record<string,number>):number{
 const tokens=expression.match(/\d+(?:\.\d+)?|[a-zA-Z_]+|>=|<=|==|!=|[()+*/%,<>-]/g)||[];
 if(tokens.join('')!==expression.replace(/\s/g,''))throw Error('فرمول دارای نویسه غیرمجاز است');
 if(tokens.length>120)throw Error('فرمول بیش از حد طولانی است');let pos=0;
 const read=()=>tokens[pos++];const peek=()=>tokens[pos];const known=(name:string)=>Object.prototype.hasOwnProperty.call(values,name);
 function atom():number{const t=read();if(t==='-')return -atom();if(t==='+')return atom();if(t==='('){const v=compare();if(read()!==')')throw Error('پرانتز بسته نشده');return v}if(/^\d/.test(t||''))return Number(t);if(t==='if')return conditional();if(t==='min'||t==='max'||t==='round')return fn(t);if(known(t||''))return values[t as string];throw Error('متغیر ناشناخته: '+(t||''))}
 function fn(name:string):number{if(read()!=='(')throw Error('پرانتز تابع لازم است');const a=[compare()];while(peek()===','){read();a.push(compare())}if(read()!==')')throw Error('پرانتز تابع بسته نشده');if(name==='round'&&a.length===1)return Math.round(a[0]);if(name==='min'&&a.length===2)return Math.min(a[0],a[1]);if(name==='max'&&a.length===2)return Math.max(a[0],a[1]);throw Error('تعداد ورودی تابع نادرست است')}
 function conditional():number{if(read()!=='(')throw Error('پرانتز تابع لازم است');const cond=compare();if(read()!==',')throw Error('تعداد ورودی تابع نادرست است');if(cond){const yes=compare();if(read()!==',')throw Error('تعداد ورودی تابع نادرست است');skipExpr();if(read()!==')')throw Error('پرانتز تابع بسته نشده');return yes}skipExpr();if(read()!==',')throw Error('تعداد ورودی تابع نادرست است');const no=compare();if(read()!==')')throw Error('پرانتز تابع بسته نشده');return no}
 function skipExpr(){skipSum();if(['>','<','>=','<=','==','!='].includes(peek())){read();skipSum()}}
 function skipSum(){skipProduct();while(['+','-'].includes(peek())){read();skipProduct()}}
 function skipProduct(){skipAtom();while(['*','/','%'].includes(peek())){read();skipAtom()}}
 function skipAtom(){const t=read();if(t==='+'||t==='-'){skipAtom();return}if(t==='('){skipExpr();if(read()!==')')throw Error('پرانتز بسته نشده');return}if(/^\d/.test(t||''))return;if(t==='min'||t==='max'||t==='if'||t==='round'){if(read()!=='(')throw Error('پرانتز تابع لازم است');if(peek()!==')'){skipExpr();while(peek()===','){read();skipExpr()}}if(read()!==')')throw Error('پرانتز تابع بسته نشده');return}if(known(t||''))return;throw Error('متغیر ناشناخته: '+(t||''))}
 function product():number{let v=atom();while(['*','/','%'].includes(peek())){const op=read(),r=atom();if((op==='/'||op==='%')&&r===0)throw Error('تقسیم بر صفر');v=op==='*'?v*r:op==='/'?v/r:v%r}return v}
 function sum():number{let v=product();while(['+','-'].includes(peek())){const op=read(),r=product();v=op==='+'?v+r:v-r}return v}
 function compare():number{let v=sum();if(['>','<','>=','<=','==','!='].includes(peek())){const op=read(),r=sum();v=Number(op==='>'?v>r:op==='<'?v<r:op==='>='?v>=r:op==='<='?v<=r:op==='=='?v===r:v!==r)}return v}
 const result=compare();if(pos!==tokens.length||!Number.isFinite(result))throw Error('فرمول معتبر نیست');return result;
}
export function performance(d:Data,course:string,module:number,student:string){const sessions=d.sessions.filter(s=>s.courseId===course&&s.module===module),records=sessions.map(s=>s.records[student]).filter(Boolean),marks=records.flatMap(r=>r.marks),scored=marks.filter(m=>!['مثبت','منفی'].includes(m.type));const avg=(ms:Mark[])=>ms.length?ms.reduce((a,m)=>a+markOutOf20(m),0)/ms.length:0;const values:Record<string,number>={avg:avg(scored),count:scored.length,positive:marks.filter(m=>m.type==='مثبت').reduce((s,m)=>s+m.value,0),negative:marks.filter(m=>m.type==='منفی').reduce((s,m)=>s+m.value,0),attendance:records.filter(r=>r.attendance!=='unset').length?100*records.filter(r=>['present','late'].includes(r.attendance)).length/records.filter(r=>r.attendance!=='unset').length:0};['classwork','workshop','written','oral','discipline','presentation','homework'].forEach((key,i)=>values[key]=avg(marks.filter(m=>m.type===markTypes[i])));return {values,marks,records,sessions,average:scored.length?values.avg:null,asked:records.some(r=>r.asked),scored}}
export function suggest(d:Data,c:Course,module:number,student:string){const p=performance(d,c.id,module,student);if(!p.scored.length)return null;const raw=evaluate(c.formula.expression,p.values);if(!(c.formula.round>0))throw Error('گام گرد کردن فرمول معتبر نیست');const continuous=Math.max(0,Math.min(5,Math.round(raw/c.formula.round)*c.formula.round));const competencies=Array.from({length:c.modules[module].competencies},(_,i)=>{const a=p.scored.filter(m=>m.competency===i+1&&m.type==='کارگاهی');if(!a.length)return null;const avg=a.reduce((s,m)=>s+markOutOf20(m),0)/a.length;return avg>=c.formula.high?3:avg>=c.formula.minimum?2:1});return {continuous,competencies,competency:competencies.every(v=>v!==null)?Math.min(...competencies as number[]):null,count:p.scored.length,average:p.average}}
