<?php
declare(strict_types=1);
/** Pattern SMS for parents. The API key stays in config.php or pdm_sms_settings and is never returned. */

function sms_ready(PDO $db): bool {return (bool)$db->query("SHOW TABLES LIKE 'pdm_sms_settings'")->fetchColumn();}

function sms_mobile(mixed $value): string {
 $digits=preg_replace('/\D+/','',(string)$value)??'';
 if(str_starts_with($digits,'98')&&strlen($digits)===12)$digits='0'.substr($digits,2);
 if(preg_match('/^09[0-9]{9}$/D',$digits)!==1)return '';
 return $digits;
}

function sms_mask(string $phone): string {return strlen($phone)<8?'***':substr($phone,0,4).'***'.substr($phone,-3);}
function sms_cut(string $value,int $max): string {return function_exists('mb_substr')?mb_substr($value,0,$max):substr($value,0,$max);}

function sms_jalali(string $iso): string {
 if(!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/',$iso,$m))return $iso;
 $gy=(int)$m[1];$gm=(int)$m[2];$gd=(int)$m[3];
 $gDays=[0,31,59,90,120,151,181,212,243,273,304,334];
 $gy2=$gm>2?$gy+1:$gy;
 $days=355666+(365*$gy)+intdiv($gy2+3,4)-intdiv($gy2+99,100)+intdiv($gy2+399,400)+$gd+$gDays[$gm-1];
 $jy=-1595+33*intdiv($days,12053);$days%=12053;
 $jy+=4*intdiv($days,1461);$days%=1461;
 if($days>365){$jy+=intdiv($days-1,365);$days=($days-1)%365;}
 if($days<186){$jm=1+intdiv($days,31);$jd=1+($days%31);}else{$jm=7+intdiv($days-186,30);$jd=1+(($days-186)%30);}
 return sprintf('%04d/%02d/%02d',$jy,$jm,$jd);
}

/** @return array{provider:string,api_key:string,sender:string,pattern_code:string,source:string} */
function sms_secret(): array {
 $db=db();
 school_require(sms_ready($db),'جدول پیامک هنوز ساخته نشده است. صفحهٔ به‌روزرسانی پایگاه را یک‌بار اجرا کنید.');
 $q=$db->query('SELECT provider,api_key,sender,pattern_code FROM pdm_sms_settings WHERE id=1');
 $row=$q->fetch()?:['provider'=>'','api_key'=>'','sender'=>'','pattern_code'=>''];
 $source='database';
 $file=__DIR__.'/config.php';
 if(is_file($file)){
  $config=include $file;
  $sms=is_array($config)&&isset($config['sms'])&&is_array($config['sms'])?$config['sms']:[];
  foreach(['provider','api_key','sender','pattern_code'] as $key){
   $value=trim((string)($sms[$key]??''));
   if($value!==''){$row[$key]=$value;$source='config';}
  }
 }
 return ['provider'=>sms_provider($row['provider']??''),'api_key'=>trim((string)($row['api_key']??'')),'sender'=>trim((string)($row['sender']??'')),'pattern_code'=>trim((string)($row['pattern_code']??'')),'source'=>$source];
}

function sms_provider(mixed $value): string {
 $value=strtolower(trim((string)$value));
 if($value==='faraz'||$value==='farazsms')$value='ippanel';
 return in_array($value,['kavenegar','ippanel'],true)?$value:'';
}

function sms_public(array $secret): array {
 return ['provider'=>$secret['provider'],'sender'=>$secret['sender'],'pattern_code'=>$secret['pattern_code'],'configured'=>$secret['api_key']!==''&&$secret['provider']!=='','source'=>$secret['source']];
}

function sms_can_read(array $user): bool {
 $actor=school_actor($user);
 if($actor==='admin')return true;
 $life=central_load()['state']['life']??[];
 return school_can($life,$actor,'office')||school_can($life,$actor,'sms');
}

function sms_settings_public(array $user): never {
 school_require(sms_can_read($user),'تنظیم پیامک برای این حساب مجاز نیست.');
 json_response(sms_public(sms_secret()));
}

function sms_settings_save(array $user,array $body): array {
 school_require(school_actor($user)==='admin','ذخیرهٔ کلید پیامک فقط برای مدیر مدرسه مجاز است.');
 $db=db();
 school_require(sms_ready($db),'جدول پیامک هنوز ساخته نشده است. صفحهٔ به‌روزرسانی پایگاه را یک‌بار اجرا کنید.');
 $provider=sms_provider($body['provider']??'');
 school_require($provider!=='','سرویس باید کاوه‌نگار یا فراز اس‌ام‌اس (IPPanel) باشد.');
 $sender=trim((string)($body['sender']??''));
 school_require($sender===''||preg_match('/^[0-9+]{4,20}$/D',$sender)===1,'سرشماره معتبر نیست.');
 $pattern=trim((string)($body['pattern_code']??''));
 school_require($pattern===''||preg_match('/^[A-Za-z0-9_-]{1,64}$/D',$pattern)===1,'کد پترن معتبر نیست.');
 $key=trim((string)($body['api_key']??''));
 school_require($key===''||(strlen($key)>=8&&strlen($key)<=200&&preg_match('/^[\x21-\x7E]+$/D',$key)===1),'کلید وب‌سرویس معتبر نیست.');
 $current=$db->query('SELECT api_key FROM pdm_sms_settings WHERE id=1')->fetchColumn();
 if($key==='')$key=is_string($current)?$current:'';
 $db->prepare('INSERT INTO pdm_sms_settings (id,provider,api_key,sender,pattern_code) VALUES (1,?,?,?,?) ON DUPLICATE KEY UPDATE provider=VALUES(provider),api_key=VALUES(api_key),sender=VALUES(sender),pattern_code=VALUES(pattern_code)')->execute([$provider,$key,$sender,$pattern]);
 return sms_public(sms_secret());
}

function sms_logs_public(array $user): never {
 school_require(sms_can_read($user),'مشاهدهٔ گزارش پیامک برای این حساب مجاز نیست.');
 $db=db();
 school_require(sms_ready($db),'جدول پیامک هنوز ساخته نشده است. صفحهٔ به‌روزرسانی پایگاه را یک‌بار اجرا کنید.');
 $rows=$db->query('SELECT created_at,actor_id,session_id,student_id,recipient,pattern_code,body,status,error FROM pdm_sms_logs ORDER BY id DESC LIMIT 40')->fetchAll();
 $state=central_load()['state'];
 $out=[];
 foreach($rows as $row)$out[]=['at'=>$row['created_at'],'actor'=>grade_actor_label($state,(string)$row['actor_id']),'session_id'=>$row['session_id'],'student_id'=>$row['student_id'],'recipient'=>sms_mask((string)$row['recipient']),'pattern_code'=>$row['pattern_code'],'body'=>$row['body'],'status'=>$row['status'],'error'=>$row['error']];
 json_response(['rows'=>$out]);
}

function sms_parent_phone(array $state,string $studentId,string $filePhone): array {
 $consented=[];$refused=false;
 foreach($state['life']['contacts']??[] as $contact){
  if(!is_array($contact)||($contact['group']??'')!=='family'||($contact['studentId']??'')!==$studentId)continue;
  $phone=sms_mobile($contact['phone']??'');
  if($phone==='')continue;
  if(empty($contact['consent'])){$refused=true;continue;}
  $consented[]=$phone;
 }
 if($consented)return ['phone'=>$consented[0],'error'=>''];
 if($refused)return ['phone'=>'','error'=>'رضایت دریافت پیامک ولی ثبت نشده است.'];
 $own=sms_mobile($filePhone);
 if($own!=='')return ['phone'=>$own,'error'=>''];
 return ['phone'=>'','error'=>'شماره همراه ولی در پروندهٔ دانش‌آموز ثبت نشده است.'];
}

function sms_http(string $url,array $headers,string $body): array {
 if(!function_exists('curl_init'))throw new RuntimeException('افزونه cURL برای ارسال پیامک لازم است.');
 $ch=curl_init($url);
 if($ch===false)throw new RuntimeException('ارتباط با پنل پیامک برقرار نشد.');
 curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>$body,CURLOPT_HTTPHEADER=>$headers,CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>12,CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS]);
 $raw=curl_exec($ch);
 $status=(int)curl_getinfo($ch,CURLINFO_RESPONSE_CODE);
 curl_close($ch);
 if(!is_string($raw))throw new RuntimeException('ارتباط با پنل پیامک برقرار نشد.');
 return ['status'=>$status,'body'=>substr($raw,0,2000)];
}

function sms_kavenegar(array $secret,string $phone,string $pattern,array $tokens): string {
 $url='https://api.kavenegar.com/v1/'.rawurlencode($secret['api_key']).'/verify/lookup.json';
 $payload=http_build_query(['receptor'=>$phone,'template'=>$pattern,'token'=>$tokens['date'],'token2'=>$tokens['status'],'token10'=>$tokens['course'],'token20'=>$tokens['student']]);
 $response=sms_http($url,['Content-Type: application/x-www-form-urlencoded','Accept: application/json'],$payload);
 $json=json_decode($response['body'],true);
 $code=(int)($json['return']['status']??0);
 if($response['status']<200||$response['status']>=300||$code!==200)throw new RuntimeException('پنل کاوه‌نگار پیام را نپذیرفت.');
 return (string)($json['entries'][0]['messageid']??'');
}

function sms_ippanel(array $secret,string $phone,string $pattern,array $tokens): string {
 school_require($secret['sender']!=='','سرشماره فراز اس‌ام‌اس تنظیم نشده است.');
 $payload=json_encode(['sending_type'=>'pattern','from_number'=>$secret['sender'],'code'=>$pattern,'recipients'=>['+98'.substr($phone,1)],'params'=>['student'=>$tokens['student'],'status'=>$tokens['status_label'],'date'=>$tokens['date_text'],'course'=>$tokens['course']]],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
 $response=sms_http('https://edge.ippanel.com/v1/api/send',['Content-Type: application/json','Accept: application/json','Authorization: AccessKey '.$secret['api_key']],$payload);
 $json=json_decode($response['body'],true);
 if($response['status']<200||$response['status']>=300)throw new RuntimeException('پنل فراز اس‌ام‌اس پیام را نپذیرفت.');
 $meta=is_array($json)?$json['meta']??$json['data']??$json:[];
 return (string)(is_array($meta)?($meta['message_id']??$meta['bulk_id']??''):'');
}

function sms_dispatch(array $secret,string $phone,string $pattern,array $tokens): string {
 if($secret['provider']==='kavenegar')return sms_kavenegar($secret,$phone,$pattern,$tokens);
 if($secret['provider']==='ippanel')return sms_ippanel($secret,$phone,$pattern,$tokens);
 throw new InvalidArgumentException('سرویس پیامک تنظیم نشده است.');
}

function sms_send_attendance(array $user,array $body): array {
 $db=db();
 $state=central_load()['state'];
 $actor=school_actor($user);
 school_require($actor==='admin'||school_can($state['life']??[],$actor,'office'),'ارسال پیامک حضور فقط برای دفتر یا مدیر مجاز است.');
 $sessionId=relational_id($body['session_id']??null,'جلسه');
 $ids=$body['student_ids']??null;
 school_require(is_array($ids)&&array_is_list($ids)&&$ids&&count($ids)<=80,'فهرست دانش‌آموزان پیامک معتبر نیست.');
 $session=relational_session($db,$sessionId);
 school_require($session!==null,'جلسه پیدا نشد.');
 $offering=relational_offering($db,$session['offering_id']);
 school_require($offering!==null,'درس جلسه پیدا نشد.');
 desk_assert_view($user,$offering,$state);
 $secret=sms_secret();
 school_require($secret['provider']!==''&&$secret['api_key']!=='','کلید پیامک هنوز در پیکربندی یا جدول تنظیمات ثبت نشده است.');
 $pattern=trim((string)($body['pattern_code']??''));
 if($pattern==='')$pattern=$secret['pattern_code'];
 school_require(preg_match('/^[A-Za-z0-9_-]{1,64}$/D',$pattern)===1,'کد پترن پیامک تنظیم نشده است.');
 $labels=['absent'=>'غایب','late'=>'تاخیر','excused'=>'موجه'];
 $texts=['absent'=>'غایب','late'=>'تأخیر','excused'=>'غیبت موجه'];
 $date=substr((string)$session['date'],0,10);
 $dateText=sms_jalali($date);
 $course=sms_cut((string)$offering['name'],80);
 $enrolled=relational_enrolled_set($db,$offering);
 $phoneOf=$db->prepare('SELECT phone FROM pdm_students WHERE id=?');
 $already=$db->prepare("SELECT id FROM pdm_sms_logs WHERE session_id=? AND student_id=? AND status='sent' AND created_at > (NOW() - INTERVAL 1 DAY) LIMIT 1");
 $log=$db->prepare('INSERT INTO pdm_sms_logs (actor_id,session_id,student_id,recipient,pattern_code,body,status,provider_ref,error) VALUES (?,?,?,?,?,?,?,?,?)');
 $results=[];$sent=0;$failed=0;
 foreach($ids as $raw){
  $studentId=relational_id($raw,'دانش‌آموز');
  school_require(isset($enrolled[$studentId]),'دانش‌آموز عضو این کلاس نیست.');
  $attendance=$db->prepare('SELECT attendance FROM pdm_session_records WHERE session_id=? AND student_id=?');
  $attendance->execute([$sessionId,$studentId]);
  $status=(string)($attendance->fetchColumn()?:'unset');
  $studentName='هنرجو';
  foreach($state['d']['students']??[] as $student)if(($student['id']??'')===$studentId){$studentName=(string)($student['name']??$studentName);break;}
  $studentName=sms_cut($studentName,80);
  if(!isset($labels[$status])){$results[]=['student_id'=>$studentId,'status'=>'skipped','error'=>'فقط غیبت، تأخیر و غیبت موجه پیامک می‌شوند.'];continue;}
  $phoneOf->execute([$studentId]);
  $target=sms_parent_phone($state,$studentId,(string)($phoneOf->fetchColumn()?:''));
  $bodyText='ولی گرامی، '.$studentName.' در جلسه '.$dateText.' درس '.$course.' وضعیت «'.$texts[$status].'» داشته است.';
  if($target['phone']===''){$failed++;$log->execute([substr($actor,0,64),$sessionId,$studentId,'',$pattern,$bodyText,'skipped',null,$target['error']]);$results[]=['student_id'=>$studentId,'status'=>'skipped','error'=>$target['error']];continue;}
  $already->execute([$sessionId,$studentId]);
  if($already->fetchColumn()){$results[]=['student_id'=>$studentId,'status'=>'sent','error'=>'برای این جلسه امروز پیامک ثبت شده است.'];$sent++;continue;}
  try{
   $ref=sms_dispatch($secret,$target['phone'],$pattern,['date'=>str_replace('/','',$dateText),'date_text'=>$dateText,'status'=>$labels[$status],'status_label'=>$texts[$status],'student'=>$studentName,'course'=>$course]);
   $log->execute([substr($actor,0,64),$sessionId,$studentId,$target['phone'],$pattern,$bodyText,'sent',$ref!==''?substr($ref,0,80):null,null]);
   $sent++;$results[]=['student_id'=>$studentId,'status'=>'sent','recipient'=>sms_mask($target['phone'])];
  }catch(Throwable $e){
   $failed++;
   $message=sms_cut($e->getMessage(),300);
   $log->execute([substr($actor,0,64),$sessionId,$studentId,$target['phone'],$pattern,$bodyText,'failed',null,$message]);
   $results[]=['student_id'=>$studentId,'status'=>'failed','error'=>$message];
  }
 }
 return ['ok'=>true,'sent'=>$sent,'failed'=>$failed,'results'=>$results];
}
