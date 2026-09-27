import {useEffect,useState} from 'react';
import {fa} from '@/lib/model';
import {subscribeOutbox} from '@/lib/offline-db';
import {flushOutbox,queueCounts} from '@/lib/sync-engine';

export function SyncStatus(){
 const [online,setOnline]=useState(()=>navigator.onLine);
 const [pending,setPending]=useState(0);
 const [failed,setFailed]=useState(0);
 const [notice,setNotice]=useState('');
 useEffect(()=>{
  const up=()=>setOnline(true),down=()=>setOnline(false);
  const expired=()=>setNotice('نشست پایان یافته است. دوباره وارد شوید و سپس همگام‌سازی را تکرار کنید.');
  window.addEventListener('online',up);window.addEventListener('offline',down);window.addEventListener('pdm-auth-expired',expired);
  let cancel=false;
  const refresh=()=>{void queueCounts().then(counts=>{if(!cancel){setPending(counts.pending);setFailed(counts.failed)}}).catch(()=>{})};
  refresh();
  const stop=subscribeOutbox(refresh);
  return()=>{cancel=true;stop();window.removeEventListener('online',up);window.removeEventListener('offline',down);window.removeEventListener('pdm-auth-expired',expired)};
 },[]);
 const waiting=pending+failed;
 return <div className="sync-status"><span className={'sync-pill '+(online?'online':'offline')}>{online?'آنلاین':'آفلاین'}</span>{waiting>0&&<span className="sync-queue">⚠ {fa(waiting)} تغییر در صف همگام‌سازی</span>}{notice&&<span className="sync-queue" role="alert">{notice}</span>}{waiting>0&&<button type="button" className="btn compact" onClick={()=>void flushOutbox({retryFailed:true})}>تلاش مجدد / همگام‌سازی دستی</button>}</div>;
}
