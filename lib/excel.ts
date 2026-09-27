import {normalize,markOutOf20,pointMark,blankRecord,type Student,type Session} from './model.ts';
export {excelSafe} from './excel-safe.ts';

/** SheetJS and the workbook worker load only when a file is opened or saved. */
export async function loadExcel(){
 const file=await import('./excel-file.ts');
 return file.loadExcel();
}
export async function readExcel(file:File){
 const io=await import('./excel-file.ts');
 return io.readExcel(file);
}
export async function exportExcel(name:string,rows:(string|number|null)[][],sheetName='دفتر معلم'){
 const io=await import('./excel-file.ts');
 return io.exportExcel(name,rows,sheetName);
}
export type SidaColumn='name'|'last'|'code'|'father'|'major'|'grade';
function headerKey(value:string){return normalize(String(value)).replace(/[\s\u200c_\-./\\:：،,]+/g,'')}
function sidaMatch(key:string,kind:SidaColumn){
 if(!key)return false;
 if(kind==='code')return key==='کد'||key.startsWith('کددانش')||key.startsWith('شمارهدانش')||key.startsWith('کدملی');
 if(kind==='last')return key.startsWith('نامخانوادگی')||key.startsWith('فامیل');
 if(kind==='father')return key.startsWith('نامپدر')||key==='پدر';
 if(kind==='major')return key.startsWith('رشتهتحصیلی')||key==='رشته';
 if(kind==='grade')return key==='پایه'||key.startsWith('پایهتحصیلی');
 return key==='نام'||key.startsWith('نامونام')||key.startsWith('نامکامل')||key.startsWith('نامهنرجو');
}
export function headerGuess(headers:string[],kind:SidaColumn){
 return headers.findIndex(cell=>sidaMatch(headerKey(cell),kind));
}
export function detectSidaHeaders(headers:string[]):Record<SidaColumn,number>{
 const found={name:-1,last:-1,code:-1,father:-1,major:-1,grade:-1};
 (Object.keys(found) as SidaColumn[]).forEach(kind=>{found[kind]=headerGuess(headers,kind)});
 return found;
}
export function sidaContinuous(value:number|null){if(value===null||!Number.isFinite(value))return null;return Math.round(Math.max(0,Math.min(5,value))*2)/2}
export function sidaCompetency(value:number|null){return value===1||value===2||value===3?value:null}
export function sidaTotal(value:number|null){if(value===null||!Number.isFinite(value))return null;return Math.round(Math.max(0,Math.min(20,value))*100)/100}
export function sidaModuleSheet(students:{name:string;code:string}[],grades:{continuous:number|null;competency:number|null;total:number|null}[]){
 return [['کد دانش‌آموزی','نام و نام خانوادگی','نمره مستمر پودمان','نمره شایستگی','نمره نهایی پودمان'],...students.map((student,index)=>[student.code,student.name,sidaContinuous(grades[index]?.continuous??null),sidaCompetency(grades[index]?.competency??null),sidaTotal(grades[index]?.total??null)])];
}

export function sessionRows(students:Student[],session:Session){
 const labels:Record<string,string>={present:'حاضر',absent:'غایب',excused:'غیبت موجه',late:'تأخیر',unset:'ثبت نشده'};
 const rows:(string|number|null)[][]=[['نام','کد دانش‌آموزی','تاریخ','حضور','نوع ارزشیابی','نمره یا امتیاز','بارم','معادل از ۲۰','توضیح نمره','یادداشت جلسه']];
 for(const s of students){const r=session.records[s.id]||blankRecord();if(!r.marks.length)rows.push([s.name,s.code,session.date,labels[r.attendance],'',null,null,null,'',r.note]);else for(const m of r.marks)rows.push([s.name,s.code,session.date,labels[r.attendance],m.type,m.value,pointMark(m.type)?null:m.max??20,pointMark(m.type)?null:Math.round(markOutOf20(m)*100)/100,m.note,r.note]);}return rows;
}
