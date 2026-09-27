/** Local desk cache and outbound queue. API responses are never stored by the service worker. */
const DB_NAME='pdm_offline_store';
const DB_VERSION=1;
export const SHELL_CACHE_KEY='__shell__';
export type OutboxStatus='pending'|'syncing'|'failed';
export type OutboxEntry={id:number;action:string;payload:any;createdAt:number;attempts:number;status:OutboxStatus;lastError?:string;actor?:string};
let dbPromise:Promise<IDBDatabase>|null=null;
let actor='';
const listeners=new Set<()=>void>();

export function setOfflineActor(id:string){actor=id}
export function offlineActor(){return actor}
export function subscribeOutbox(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn)}}
function emit(){for(const fn of listeners)fn()}

function openDb():Promise<IDBDatabase>{
 if(typeof indexedDB==='undefined')return Promise.reject(Error('IndexedDB در این مرورگر در دسترس نیست.'));
 if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
  const req=indexedDB.open(DB_NAME,DB_VERSION);
  req.onupgradeneeded=()=>{
   const db=req.result;
   if(!db.objectStoreNames.contains('desk_cache'))db.createObjectStore('desk_cache',{keyPath:'offering_id'});
   if(!db.objectStoreNames.contains('sync_outbox')){
    const store=db.createObjectStore('sync_outbox',{keyPath:'id',autoIncrement:true});
    store.createIndex('status','status',{unique:false});
   }
  };
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>{dbPromise=null;reject(req.error||Error('پایگاه محلی باز نشد.'))};
 });
 return dbPromise;
}

function request<T>(req:IDBRequest<T>):Promise<T>{return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||Error('عملیات پایگاه محلی ناموفق بود.'))})}
async function store(name:'desk_cache'|'sync_outbox',mode:IDBTransactionMode){const db=await openDb();return db.transaction(name,mode).objectStore(name)}

export async function cacheDeskData(offeringId:string,data:any):Promise<void>{
 const saved={...data,offering_id:offeringId};
 await request((await store('desk_cache','readwrite')).put(saved));
}
export async function getCachedDeskData(offeringId:string):Promise<any|null>{
 const value=await request((await store('desk_cache','readonly')).get(offeringId));
 return value??null;
}
export async function removeCachedDesk(offeringId:string):Promise<void>{await request((await store('desk_cache','readwrite')).delete(offeringId))}
export async function listCachedDesks():Promise<any[]>{
 const rows=await request<any[]>((await store('desk_cache','readonly')).getAll());
 return rows.filter(row=>row?.offering_id!==SHELL_CACHE_KEY);
}

export async function enqueueMutation(action:string,payload:any):Promise<number>{
 const entry={action,payload,createdAt:Date.now(),attempts:0,status:'pending' as const,actor:actor||undefined};
 const id=await request((await store('sync_outbox','readwrite')).add(entry));
 emit();
 return Number(id);
}
async function byStatus(status:OutboxStatus):Promise<OutboxEntry[]>{
 const index=(await store('sync_outbox','readonly')).index('status');
 const rows=await request<OutboxEntry[]>(index.getAll(status));
 return rows.sort((a,b)=>a.createdAt-b.createdAt||a.id-b.id);
}
export function getPendingMutations():Promise<OutboxEntry[]>{return byStatus('pending')}
export function getMutationsByStatus(status:OutboxStatus):Promise<OutboxEntry[]>{return byStatus(status)}
export async function markMutationStatus(id:number,status:string,error?:string):Promise<void>{
 const current=await request<OutboxEntry|undefined>((await store('sync_outbox','readonly')).get(id));
 if(!current)return;
 const next:OutboxEntry={...current,status:status as OutboxStatus,attempts:status==='syncing'?current.attempts+1:current.attempts};
 if(error!==undefined)next.lastError=error;
 await request((await store('sync_outbox','readwrite')).put(next));
 emit();
}
export async function removeMutation(id:number):Promise<void>{await request((await store('sync_outbox','readwrite')).delete(id));emit()}
