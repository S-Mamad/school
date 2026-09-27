import {useEffect,useState} from 'react';
import {toast} from 'sonner';
import {loadSmsGateway,loadSmsLogs,saveSmsGateway} from '@/lib/production';
import {Field,Choice} from './widgets';

export function SmsGateway({admin}:{admin:boolean}){
 const [form,setForm]=useState({provider:'kavenegar',sender:'',pattern_code:'',api_key:''}),[source,setSource]=useState(''),[configured,setConfigured]=useState(false),[logs,setLogs]=useState<any[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const refresh=()=>Promise.all([loadSmsGateway(),loadSmsLogs()]).then(([settings,history])=>{setForm(current=>({...current,provider:settings.provider||'kavenegar',sender:settings.sender||'',pattern_code:settings.pattern_code||'',api_key:''}));setSource(settings.source||'');setConfigured(!!settings.configured);setLogs(history.rows||[])});
 useEffect(()=>{void refresh().catch(e=>setError((e as Error).message))},[]);
 return <section className="panel cd-setup"><h2>اتصال پیامک خدماتی</h2><p>کلید وب‌سرویس فقط در پایگاه یا فایل پیکربندی سرور می‌ماند و در دفتر مدرسه یا خروجی‌ها قرار نمی‌گیرد. {configured?'پنل آماده ارسال پترن است.':'هنوز کلیدی ثبت نشده است.'} {source==='config'&&'مقادیر مؤثر از فایل private/config.php خوانده می‌شوند.'}</p>{error&&<div className="error">{error}</div>}{admin?<form className="stack" onSubmit={e=>{e.preventDefault();setBusy(true);setError('');void saveSmsGateway(form).then(saved=>{setConfigured(!!saved.configured);setSource(saved.source||'');setForm(current=>({...current,api_key:''}));toast.success('تنظیم پیامک ذخیره شد');return loadSmsLogs()}).then(history=>setLogs(history.rows||[])).catch(e=>setError((e as Error).message)).finally(()=>setBusy(false))}}>
 <Field label="سرویس"><Choice label="سرویس پیامک" value={form.provider} onChange={v=>setForm({...form,provider:v})} options={[{value:'kavenegar',label:'کاوه‌نگار'},{value:'ippanel',label:'فراز اس‌ام‌اس / IPPanel'}]}/></Field>
 <Field label="سرشماره خط خدماتی"><input dir="ltr" value={form.sender} onChange={e=>setForm({...form,sender:e.target.value})} placeholder="3000..."/></Field>
 <Field label="کد پترن غیبت و تأخیر"><input dir="ltr" value={form.pattern_code} onChange={e=>setForm({...form,pattern_code:e.target.value})}/></Field>
 <Field label="کلید وب‌سرویس"><input dir="ltr" type="password" autoComplete="new-password" value={form.api_key} onChange={e=>setForm({...form,api_key:e.target.value})} placeholder="برای حفظ کلید فعلی خالی بگذارید"/></Field>
 <p className="hint">در پترن کاوه‌نگار از token برای تاریخ، token2 برای وضعیت، token10 برای درس و token20 برای نام هنرجو استفاده کنید. در پترن فراز، متغیرها student، status، date و course هستند.</p>
 <p className="hint">اگر کلید را داخل private/config.php می‌گذارید، آرایه sms را کنار تنظیم پایگاه بنویسید: provider، api_key، sender و pattern_code. آن فایل به مرورگر فرستاده نمی‌شود.</p>
 <button className="btn primary" disabled={busy}>{busy?'در حال ذخیره…':'ذخیره تنظیم پیامک'}</button>
 </form>:<p>ثبت و دیدن کلید فقط با حساب مدیر انجام می‌شود. ارسال غیبت از کارتابل حضور، پس از آماده شدن پنل، برای دفتر مدرسه فعال است.</p>}
 <h3>آخرین ارسال‌های واقعی</h3>{logs.length?logs.map((row,index)=><article className="history-row" key={index}><b>{row.at} · {row.status==='sent'?'ارسال‌شده':row.status==='failed'?'ناموفق':'ارسال نشد'}</b><p>{row.body}</p><small>گیرنده {row.recipient||'—'} · پترن {row.pattern_code||'—'}{row.error?' · '+row.error:''}</small></article>):<p>هنوز پیامک واقعی ثبت نشده است.</p>}</section>;
}
