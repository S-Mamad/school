import {useEffect,useState} from 'react';
import {toast} from 'sonner';
import {fa} from '@/lib/model';
import {subscribeOutbox} from '@/lib/offline-db';
import {clearAuthBlock,flushOutbox,queueCounts} from '@/lib/sync-engine';

export function SyncStatus(){
 const [online,setOnline]=useState(()=>navigator.onLine);
 const [pending,setPending]=useState(0);
 const [failed,setFailed]=useState(0);
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
  const up=()=>setOnline(true),down=()=>setOnline(false);
  const expired=()=>setNotice('نشست پایان یافته است. دوباره وارد شوید و سپس همگام‌سازی را تکرار کنید.');
  const cleared=()=>{setNotice('');clearAuthBlock()};
  window.addEventListener('online',up);window.addEventListener('offline',down);
  window.addEventListener('pdm-auth-expired',expired);
  window.addEventListener('pdm-auth-cleared',cleared);
  let cancel=false;
  const refresh=()=>{void queueCounts().then(counts=>{if(!cancel){setPending(counts.pending);setFailed(counts.failed)}}).catch(()=>{})};
  refresh();
  const stop=subscribeOutbox(refresh);
  return()=>{cancel=true;stop();window.removeEventListener('online',up);window.removeEventListener('offline',down);window.removeEventListener('pdm-auth-expired',expired);window.removeEventListener('pdm-auth-cleared',cleared)};
 },[]);
 const waiting=pending+failed;
 async function retry(){
  if(busy)return;
  if(!navigator.onLine){toast.info('الان آفلاین هستید؛ همگام‌سازی پس از اتصال انجام می‌شود.');return}
  setBusy(true);
  try{
   const result=await flushOutbox({retryFailed:true});
   if(result.reason==='busy')toast.info('همگام‌سازی دیگری در حال اجراست؛ چند لحظه بعد دوباره تلاش کنید.');
   else if(result.reason==='auth')toast.error('نشست پایان یافته است. دوباره وارد شوید.');
   else if(result.reason==='empty'&&!waiting)toast.success('صف همگام‌سازی خالی است.');
   else if(result.synced)toast.success(`${fa(result.synced)} تغییر همگام شد.`);
   else if(result.reason==='partial')toast.error('برخی تغییرات همگام نشد؛ پیام خطا را بررسی کنید.');
  }finally{setBusy(false)}
 }
 return <div className="sync-status"><span className={'sync-pill '+(online?'online':'offline')}>{online?'آنلاین':'آفلاین'}</span>{waiting>0&&<span className="sync-queue">⚠ {fa(waiting)} تغییر در صف همگام‌سازی</span>}{notice&&<span className="sync-queue" role="alert">{notice}</span>}{waiting>0&&<button type="button" className="btn compact" disabled={busy} onClick={()=>void retry()}>{busy?'در حال همگام‌سازی…':'تلاش مجدد / همگام‌سازی دستی'}</button>}</div>;
}
