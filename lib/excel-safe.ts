/** Neutralize Excel/CSV formula injection (=, +, -, @, tab/CR). */
export function excelSafe(value:string|number|null|undefined):string|number|null{
 if(value===null||value===undefined)return null;
 if(typeof value==='number')return Number.isFinite(value)?value:null;
 const text=String(value);
 if(/^=|^[\+\-@\t\r]/.test(text))return "'"+text;
 return text;
}
