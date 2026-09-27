self.onmessage=event=>{
 try{
  importScripts('./vendor/xlsx.full.min.js');
  const book=XLSX.read(event.data,{type:'array',sheetRows:2052,cellFormula:false,cellHTML:false,cellStyles:false});
  if(book.SheetNames.length>20)throw Error('فایل حداکثر می‌تواند ۲۰ برگه داشته باشد.');
  const sheets=book.SheetNames.map(name=>{
   const sheet=book.Sheets[name],range=XLSX.utils.decode_range(sheet['!fullref']||sheet['!ref']||'A1');
   if(range.e.r>2050||range.e.c>100)throw Error('فایل بیش از حد بزرگ است؛ آن را به فایل‌های حداکثر ۲۰۰۰ دانش‌آموز تقسیم کنید.');
   return {name,rows:XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false})};
  });
  self.postMessage({sheets});
 }catch(error){self.postMessage({error:error.message||'ساختار فایل خوانده نشد.'})}
};
