import {normalize,markOutOf20,pointMark,blankRecord} from './model';
declare global{interface Window{XLSX:any}}
let loading:Promise<any>|null=null;
export async function loadExcel(){
 if(window.XLSX)return window.XLSX;
 if(!loading)loading=new Promise((resolve,reject)=>{
  const s=document.createElement('script');s.src='./vendor/xlsx.full.min.js';
  s.onload=()=>{if(window.XLSX)resolve(window.XLSX);else{loading=null;reject(Error('ابزار اکسل آماده نشد'))}};
  s.onerror=()=>{loading=null;s.remove();reject(Error('ابزار اکسل بارگیری نشد؛ اتصال به سایت را بررسی کنید'))};document.head.appendChild(s);
 });
 return loading;
}
export async function readExcel(file:File):Promise<{name:string;rows:string[][]}[]>{
 if(file.size>5*1024*1024)throw Error('حداکثر حجم فایل ۵ مگابایت است');
 if(!/\.(xlsx|xls|csv)$/i.test(file.name))throw Error('فایل اکسل یا CSV انتخاب کنید');
 const bytes=await file.arrayBuffer();
 return new Promise((resolve,reject)=>{
  const worker=new Worker('./excel-worker.js');
  const timeout=window.setTimeout(()=>{worker.terminate();reject(Error('خواندن فایل بیش از حد طول کشید؛ فایل کوچک‌تر یا ساده‌تری انتخاب کنید'))},20000);
  const done=()=>{clearTimeout(timeout);worker.terminate()};
  worker.onmessage=e=>{done();e.data.error?reject(Error(e.data.error)):resolve(e.data.sheets)};
  worker.onerror=()=>{done();reject(Error('خواندن فایل انجام نشد؛ فایل و اتصال به سایت را بررسی کنید'))};
  worker.postMessage(bytes,[bytes]);
 });
}
/** Neutralize Excel/CSV formula injection (=, +, -, @, tab/CR). */
export function excelSafe(value:string|number|null|undefined):string|number|null{
 if(value===null||value===undefined)return value===undefined?null:null;
 if(typeof value==='number')return Number.isFinite(value)?value:null;
 const text=String(value);
 if(/^=|^[\+\-@\t\r]/.test(text))return "'"+text;
 return text;
}
export async function exportExcel(name:string,rows:(string|number|null)[][]){
 const safe=rows.map(row=>row.map(excelSafe));
 const x=await loadExcel(),book=x.utils.book_new(),sheet=x.utils.aoa_to_sheet(safe);
 sheet['!cols']=(safe[0]||[]).map(()=>({wch:24}));x.utils.book_append_sheet(book,sheet,'دفتر معلم');book.Workbook={Views:[{RTL:true}]};x.writeFile(book,name.replace(/[\\/:*?"<>|]/g,'-')+'.xlsx');
}
export function headerGuess(headers:string[],kind:'name'|'last'|'code'){
 return headers.findIndex(h=>{h=normalize(String(h)).replace(/[\s‌]/g,'');return kind==='code'?h==='کد'||/کددانش|شماره.*دانش|کدملی/.test(h):kind==='last'?h==='نامخانوادگی'||h==='فامیل':h==='نام'||/نامونامخانوادگی|نامکامل/.test(h)});
}

export function sessionRows(students:import('./model').Student[],session:import('./model').Session){
 const labels:Record<string,string>={present:'حاضر',absent:'غایب',excused:'غیبت موجه',late:'تأخیر',unset:'ثبت نشده'};
 const rows:(string|number|null)[][]=[['نام','کد دانش‌آموزی','تاریخ','حضور','نوع ارزشیابی','نمره یا امتیاز','بارم','معادل از ۲۰','توضیح نمره','یادداشت جلسه']];
 for(const s of students){const r=session.records[s.id]||blankRecord();if(!r.marks.length)rows.push([s.name,s.code,session.date,labels[r.attendance],'',null,null,null,'',r.note]);else for(const m of r.marks)rows.push([s.name,s.code,session.date,labels[r.attendance],m.type,m.value,pointMark(m.type)?null:m.max??20,pointMark(m.type)?null:Math.round(markOutOf20(m)*100)/100,m.note,r.note]);}return rows;
}
