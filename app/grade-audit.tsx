import {useEffect,useState} from 'react';
import {loadGradeAudit} from '@/lib/production';
import {fa} from '@/lib/model';

function brief(action:string,value:any){
 if(!value)return '—';
 if(action==='final_grade')return `مستمر ${value.continuous??'—'} · شایستگی ${value.competency??'—'} · نهایی ${value.total??'—'}`;
 const marks=Array.isArray(value.marks)?value.marks:[];
 return marks.length?marks.map((mark:any)=>`${mark.type}: ${mark.value}`).join('، '):'بدون نمره جلسه';
}
function when(value:string){const date=new Date(String(value).replace(' ','T'));return Number.isNaN(date.getTime())?value:date.toLocaleString('fa-IR')}

export function GradeAudit({offeringId,studentId,moduleIndex,name}:{offeringId:string;studentId:string;moduleIndex:number;name?:string}){
 const [rows,setRows]=useState<any[]|null>(null),[error,setError]=useState('');
 useEffect(()=>{let cancel=false;setRows(null);setError('');void loadGradeAudit(offeringId,studentId,moduleIndex).then(result=>{if(!cancel)setRows(result.rows||[])}).catch(e=>{if(!cancel)setError((e as Error).message)});return()=>{cancel=true}},[offeringId,studentId,moduleIndex]);
 return <section className="stack grade-audit"><h3>سابقه تغییر نمره{name?' · '+name:''}</h3><p>پودمان {fa(moduleIndex+1)}. این فهرست می‌گوید چه کسی، در چه زمانی، نمره جلسه یا نمره پودمان را عوض کرده است.</p>{error&&<div className="error">{error}</div>}{rows===null&&!error&&<p>در حال خواندن سابقه…</p>}{rows&&!rows.length&&<p>برای این پودمان هنوز تغییری در سابقه ثبت نشده است.</p>}{rows?.map((row,index)=><article className="history-row" key={index}><b>{when(row.at)} · {row.actor}</b><p>{row.action==='final_grade'?'نمره پودمان':'نمره جلسه'}</p><p>قبل: {brief(row.action,row.old)}</p><p>بعد: {brief(row.action,row.new)}</p><small>نشانی اتصال: {row.ip||'—'}</small></article>)}</section>;
}
