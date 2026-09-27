import {excelSafe} from './excel-safe.ts';
declare global{interface Window{XLSX:any}}
let loading:Promise<any>|null=null;

/** SheetJS stays out of the first bundle: the vendor script loads on the first import or export. */
export async function loadExcel(){
 if(typeof window==='undefined')throw Error('ابزار اکسل فقط در مرورگر در دسترس است');
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

export async function exportExcel(name:string,rows:(string|number|null)[][],sheetName='دفتر معلم'){
 const safe=rows.map(row=>row.map(excelSafe));
 const x=await loadExcel(),book=x.utils.book_new(),sheet=x.utils.aoa_to_sheet(safe);
 sheet['!cols']=(safe[0]||[]).map(()=>({wch:24}));x.utils.book_append_sheet(book,sheet,sheetName.slice(0,31));book.Workbook={Views:[{RTL:true}]};x.writeFile(book,name.replace(/[\\/:*?"<>|]/g,'-')+'.xlsx');
}
