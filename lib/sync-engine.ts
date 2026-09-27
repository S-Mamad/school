import {deliverDeskMutation} from './production';
import {getMutationsByStatus,getPendingMutations,markMutationStatus,offlineActor,removeMutation,type OutboxEntry} from './offline-db';

let flushing=false;
let authBlocked=false;
const inflight=new Set<number>();
const AUTH_MESSAGE='نشست پایان یافته است. دوباره وارد شوید و سپس همگام‌سازی را تکرار کنید.';

export async function queueCounts(actor=offlineActor()):Promise<{pending:number;failed:number}>{
 const [pending,syncing,failed]=await Promise.all([getPendingMutations(),getMutationsByStatus('syncing'),getMutationsByStatus('failed')]);
 const mine=(row:OutboxEntry)=>!actor||!row.actor||row.actor===actor;
 return {pending:pending.filter(mine).length+syncing.filter(mine).length,failed:failed.filter(mine).length};
}

async function withOutboxLock(work:()=>Promise<void>):Promise<void>{
 if(typeof navigator!=='undefined'&&navigator.locks){
  await navigator.locks.request('pdm-outbox',{ifAvailable:true},async lock=>{if(lock)await work()});
  return;
 }
 if(flushing)return;
 await work();
}

/** Send pending desk writes in creation order. A dead session stops the queue instead of retrying forever. */
export async function flushOutbox(options?:{retryFailed?:boolean}):Promise<void>{
 if(typeof navigator==='undefined'||!navigator.onLine)return;
 if(authBlocked&&!options?.retryFailed)return;
 if(options?.retryFailed)authBlocked=false;
 const actor=offlineActor();
 if(!actor)return;
 await withOutboxLock(async()=>{
  if(flushing)return;
  flushing=true;
  let synced=0;
  try{
   for(const row of await getMutationsByStatus('syncing')){
    if(inflight.has(row.id))continue;
    if(!row.actor||row.actor===actor)await markMutationStatus(row.id,'pending');
   }
   if(options?.retryFailed)for(const row of await getMutationsByStatus('failed'))if(!row.actor||row.actor===actor)await markMutationStatus(row.id,'pending');
   const rows=(await getPendingMutations()).filter(row=>!row.actor||row.actor===actor);
   for(let index=0;index<rows.length;index++){
    const row=rows[index];
    if(inflight.has(row.id))continue;
    inflight.add(row.id);
    await markMutationStatus(row.id,'syncing');
    try{
     await deliverDeskMutation(row.action,row.payload);
     await removeMutation(row.id);
     synced++;
    }catch(e){
     const status=typeof e==='object'&&e&&'status' in e?Number((e as {status:number}).status):0;
     const message=e instanceof Error?e.message:'همگام‌سازی انجام نشد.';
     if(status===401||status===403){
      authBlocked=true;
      await markMutationStatus(row.id,'failed',AUTH_MESSAGE);
      for(const rest of rows.slice(index+1))if(!inflight.has(rest.id))await markMutationStatus(rest.id,'failed',AUTH_MESSAGE);
      window.dispatchEvent(new CustomEvent('pdm-auth-expired',{detail:{message:AUTH_MESSAGE}}));
      break;
     }
     if(status===422||status===409){
      await markMutationStatus(row.id,'failed',message);
      console.warn('همگام‌سازی دفتر رد شد',row.id,row.action,message);
      continue;
     }
     await markMutationStatus(row.id,'pending',message);
     break;
    }finally{
     inflight.delete(row.id);
    }
   }
  }finally{
   flushing=false;
   if(synced)window.dispatchEvent(new Event('pdm-synced'));
  }
 });
}

export function startSyncEngine(){
 const tick=()=>{if(navigator.onLine)void flushOutbox()};
 window.addEventListener('online',tick);
 const timer=window.setInterval(tick,60000);
 void tick();
 return()=>{window.removeEventListener('online',tick);window.clearInterval(timer)};
}
