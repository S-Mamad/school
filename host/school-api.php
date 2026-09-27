<?php
declare(strict_types=1);
require __DIR__.'/private/bootstrap.php';require __DIR__.'/private/central.php';require __DIR__.'/private/concurrent.php';
date_default_timezone_set('Asia/Tehran');
function central_load(bool $lock=false): array{$q=db()->query('SELECT payload,revision FROM pdm_school WHERE id=1'.($lock?' FOR UPDATE':''));$r=$q->fetch();if(!$r){$s=school_empty();$q=db()->prepare('INSERT IGNORE INTO pdm_school(id,payload) VALUES(1,?)');$q->execute([json_encode(school_wire($s),JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);return central_load($lock);}return ['state'=>json_decode($r['payload'],true,128,JSON_THROW_ON_ERROR),'revision'=>(int)$r['revision']];}
function central_response(array $u): never{$r=central_load();$actor=school_actor($u);school_require($actor!=='','این حساب هنوز به پرونده مدرسه متصل نشده است؛ مدیر باید حساب را تخصیص دهد.');json_response(['user'=>['id'=>(int)$u['id'],'actor'=>$actor,'email'=>$u['email'],'role'=>$u['role']],'revision'=>$r['revision'],'state'=>school_wire(school_visible($r['state'],$actor)),'csrf'=>$_SESSION['csrf']]);}
function captcha_valid(string $answer): bool{$challenge=$_SESSION['school_captcha']??null;unset($_SESSION['school_captcha']);return is_array($challenge)&&time()-$challenge['time']<=180&&hash_equals($challenge['hash'],hash('sha256',strtoupper(trim($answer))));}
function central_tree(mixed $v,int $depth=0,int &$nodes=0): void{school_require(++$nodes<=80000&&$depth<=20,'اطلاعات بیش از ظرفیت است.');if(is_string($v))school_require(strlen($v)<=20000,'متن بیش از حد طولانی است.');elseif(is_array($v))foreach($v as $k=>$x){school_require(!in_array((string)$k,['__proto__','constructor','prototype'],true),'کلید داده معتبر نیست.');central_tree($x,$depth+1,$nodes);}elseif(is_float($v))school_require(is_finite($v));}
/** Render captcha as PNG (preferred) or path-only SVG — never emit plaintext code glyphs. */
function captcha_emit(string $code): never{
 $w=240;$h=76;
 if(function_exists('imagecreatetruecolor')){
  $im=imagecreatetruecolor($w,$h);
  $bg=imagecolorallocate($im,237,243,251);$fg=imagecolorallocate($im,22,59,99);$noise=imagecolorallocate($im,141,167,196);
  imagefilledrectangle($im,0,0,$w,$h,$bg);
  for($i=0;$i<18;$i++)imageline($im,random_int(0,$w),random_int(0,$h),random_int(0,$w),random_int(0,$h),$noise);
  for($i=0;$i<6;$i++){
   $x=18+$i*36+random_int(-2,2);$y=random_int(18,28);
   imagestring($im,5,$x,$y,$code[$i],$fg);
  }
  for($i=0;$i<120;$i++)imagesetpixel($im,random_int(0,$w-1),random_int(0,$h-1),$noise);
  header('Content-Type: image/png');header('Cache-Control: no-store');imagepng($im);imagedestroy($im);exit;
 }
 // Fallback: 5x7 bitmap glyphs as SVG rectangles (no <text> with the secret).
 $glyphs=[
  'A'=>[0,1,1,1,0,1,0,0,0,1,1,0,0,0,1,1,1,1,1,1,1,0,0,0,1,1,0,0,0,1,1,0,0,0,1],
  'B'=>[1,1,1,1,0,1,0,0,0,1,1,0,0,0,1,1,1,1,1,0,1,0,0,0,1,1,0,0,0,1,1,1,1,1,0],
  'C'=>[0,1,1,1,0,1,0,0,0,1,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,1,0,1,1,1,0],
  'D'=>[1,1,1,1,0,1,0,0,0,1,1,0,0,0,1,1,0,0,0,1,1,0,0,0,1,1,0,0,0,1,1,1,1,1,0],
  'E'=>[1,1,1,1,1,1,0,0,0,0,1,0,0,0,0,1,1,1,1,0,1,0,0,0,0,1,0,0,0,0,1,1,1,1,1],
  'F'=>[1,1,1,1,1,1,0,0,0,0,1,0,0,0,0,1,1,1,1,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0],
  'G'=>[0,1,1,1,0,1,0,0,0,1,1,0,0,0,0,1,0,1,1,1,1,0,0,0,1,1,0,0,0,1,0,1,1,1,0],
  'H'=>[1,0,0,0,1,1,0,0,0,1,1,0,0,0,1,1,1,1,1,1,1,0,0,0,1,1,0,0,0,1,1,0,0,0,1],
  'J'=>[0,0,1,1,1,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,1,0,0,1,0,0,1,1,0,0],
  'K'=>[1,0,0,0,1,1,0,0,1,0,1,0,1,0,0,1,1,0,0,0,1,0,1,0,0,1,0,0,1,0,1,0,0,0,1],
  'L'=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,1,1,1,1],
  'M'=>[1,0,0,0,1,1,1,0,1,1,1,0,1,0,1,1,0,1,0,1,1,0,0,0,1,1,0,0,0,1,1,0,0,0,1],
  'N'=>[1,0,0,0,1,1,1,0,0,1,1,0,1,0,1,1,0,0,1,1,1,0,0,0,1,1,0,0,0,1,1,0,0,0,1],
  'P'=>[1,1,1,1,0,1,0,0,0,1,1,0,0,0,1,1,1,1,1,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0],
  'Q'=>[0,1,1,1,0,1,0,0,0,1,1,0,0,0,1,1,0,0,0,1,1,0,1,0,1,1,0,0,1,0,0,1,1,0,1],
  'R'=>[1,1,1,1,0,1,0,0,0,1,1,0,0,0,1,1,1,1,1,0,1,0,1,0,0,1,0,0,1,0,1,0,0,0,1],
  'S'=>[0,1,1,1,0,1,0,0,0,1,1,0,0,0,0,0,1,1,1,0,0,0,0,0,1,1,0,0,0,1,0,1,1,1,0],
  'T'=>[1,1,1,1,1,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0],
  'U'=>[1,0,0,0,1,1,0,0,0,1,1,0,0,0,1,1,0,0,0,1,1,0,0,0,1,1,0,0,0,1,0,1,1,1,0],
  'V'=>[1,0,0,0,1,1,0,0,0,1,1,0,0,0,1,1,0,0,0,1,0,1,0,1,0,0,1,0,1,0,0,0,1,0,0],
  'W'=>[1,0,0,0,1,1,0,0,0,1,1,0,0,0,1,1,0,1,0,1,1,0,1,0,1,1,1,0,1,1,1,0,0,0,1],
  'X'=>[1,0,0,0,1,0,1,0,1,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,1,0,1,0,1,0,0,0,1],
  'Y'=>[1,0,0,0,1,0,1,0,1,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0],
  'Z'=>[1,1,1,1,1,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,1,1,1,1,1],
  '2'=>[0,1,1,1,0,1,0,0,0,1,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,1,1,1,1],
  '3'=>[0,1,1,1,0,1,0,0,0,1,0,0,0,0,1,0,0,1,1,0,0,0,0,0,1,1,0,0,0,1,0,1,1,1,0],
  '4'=>[0,0,0,1,0,0,0,1,1,0,0,1,0,1,0,1,0,0,1,0,1,1,1,1,1,0,0,0,1,0,0,0,0,1,0],
  '5'=>[1,1,1,1,1,1,0,0,0,0,1,1,1,1,0,0,0,0,0,1,0,0,0,0,1,1,0,0,0,1,0,1,1,1,0],
  '6'=>[0,1,1,1,0,1,0,0,0,0,1,0,0,0,0,1,1,1,1,0,1,0,0,0,1,1,0,0,0,1,0,1,1,1,0],
  '7'=>[1,1,1,1,1,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0],
  '8'=>[0,1,1,1,0,1,0,0,0,1,1,0,0,0,1,0,1,1,1,0,1,0,0,0,1,1,0,0,0,1,0,1,1,1,0],
  '9'=>[0,1,1,1,0,1,0,0,0,1,1,0,0,0,1,0,1,1,1,1,0,0,0,0,1,0,0,0,0,1,0,1,1,1,0],
 ];
 header('Content-Type: image/svg+xml');header('Cache-Control: no-store');
 echo '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="76" viewBox="0 0 240 76"><rect width="240" height="76" fill="#edf3fb"/>';
 for($i=0;$i<14;$i++)echo '<path d="M '.random_int(0,240).' '.random_int(0,76).' L '.random_int(0,240).' '.random_int(0,76).'" stroke="#8da7c4" fill="none"/>';
 for($i=0;$i<6;$i++){
  $g=$glyphs[$code[$i]]??$glyphs['A'];$ox=16+$i*36;$oy=18+$i%2;
  for($r=0;$r<7;$r++)for($c=0;$c<5;$c++)if($g[$r*5+$c])echo '<rect x="'.($ox+$c*4).'" y="'.($oy+$r*5).'" width="3.2" height="4.2" fill="#163b63"/>';
 }
 echo '</svg>';exit;
}
try{
 $action=(string)($_GET['action']??'session');$method=$_SERVER['REQUEST_METHOD'];
 if($method==='GET'&&$action==='session'){if(!is_file(__DIR__.'/private/config.php'))json_response(['installed'=>false,'user'=>null,'csrf'=>$_SESSION['csrf']]);$u=user();if(!$u)json_response(['installed'=>true,'user'=>null,'csrf'=>$_SESSION['csrf']]);central_response($u);}
 if($method==='GET'&&$action==='captcha'){
  $chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';$code='';for($i=0;$i<6;$i++)$code.=$chars[random_int(0,strlen($chars)-1)];$_SESSION['school_captcha']=['hash'=>hash('sha256',$code),'time'=>time()];captcha_emit($code);
 }
 if($method==='GET'&&$action==='attachment'){
  $u=require_user();$id=(string)($_GET['id']??'');school_require(preg_match('/^[a-f0-9]{32}$/D',$id)===1);$q=db()->prepare('SELECT * FROM pdm_files WHERE id=?');$q->execute([$id]);$f=$q->fetch();school_require((bool)$f);$s=central_load()['state'];$task=school_find($s['life']['tasks'],$f['task_id']);$o=$task?school_find($s['d']['offerings'],$task['courseId']):null;$actor=school_actor($u);school_require((int)$f['user_id']===(int)$u['id']||($o&&$actor==='teacher:'.$o['teacherId'])||$actor==='admin'||$actor==='deputy'||school_can($s['life'],$actor,'office'));$path=__DIR__.'/private/uploads/'.$id.'.bin';school_require(is_file($path));header('Content-Type: application/octet-stream');header("Content-Disposition: attachment; filename=download; filename*=UTF-8''".rawurlencode($f['name']));header('Content-Length: '.$f['size']);readfile($path);exit;
 }
 school_require($method==='POST','روش درخواست مجاز نیست.');csrf_check();
 if($action==='upload'){
  $u=require_user();throttle('upload:'.$u['id'],30,3600);$taskId=(string)($_POST['taskId']??'');$s=central_load()['state'];$task=school_find($s['life']['tasks'],$taskId);$actor=school_actor($u);school_require($task&&$task['published']&&school_course_active($s['d'],$task['courseId'])&&str_starts_with($actor,'student:')&&school_student_course($s['d'],substr($actor,8),$task['courseId'])&&$task['due']>=date('Y-m-d'));
  $f=$_FILES['file']??null;school_require($f&&$f['error']===UPLOAD_ERR_OK&&$f['size']>0&&$f['size']<=5*1024*1024,'فایل باید حداکثر ۵ مگابایت باشد.');$name=basename(str_replace('\\','/',$f['name']));school_require(strlen($name)<=190&&preg_match('/\.(pdf|png|jpe?g|txt|docx|xlsx)$/iD',$name)===1,'نوع فایل مجاز نیست.');$mime=(new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);school_require(in_array($mime,['application/pdf','image/png','image/jpeg','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],true),'محتوای فایل با انواع مجاز سازگار نیست.');$q=db()->prepare('SELECT COALESCE(SUM(size),0) FROM pdm_files WHERE user_id=?');$q->execute([$u['id']]);school_require((int)$q->fetchColumn()+$f['size']<=100*1024*1024,'سهمیه فایل این حساب پر شده است.');$dir=__DIR__.'/private/uploads';if(!is_dir($dir))school_require(mkdir($dir,0700,true));$id=school_id();school_require(move_uploaded_file($f['tmp_name'],$dir.'/'.$id.'.bin'));chmod($dir.'/'.$id.'.bin',0600);$q=db()->prepare('INSERT INTO pdm_files(id,user_id,task_id,name,size) VALUES(?,?,?,?,?)');$q->execute([$id,$u['id'],$taskId,$name,$f['size']]);json_response(['file'=>['name'=>$name,'url'=>'./school-api.php?action=attachment&id='.$id,'size'=>(int)$f['size']]]);
 }
 school_require(str_starts_with($_SERVER['CONTENT_TYPE']??'','application/json'));$raw=file_get_contents('php://input',false,null,0,8388609);school_require(strlen($raw)<=8388608,'درخواست بیش از حد بزرگ است.');$body=json_decode($raw,true,128,JSON_THROW_ON_ERROR);school_require(is_array($body));central_tree($body);
 if($action==='login'){
  $login=strtolower(trim((string)($body['email']??'')));throttle('central-ip:'.($_SERVER['REMOTE_ADDR']??''),30);throttle('central-login:'.$login,8);if(!captcha_valid((string)($body['captcha']??'')))json_response(['error'=>'کد امنیتی نادرست یا منقضی شده است. تصویر تازه بگیرید.'],400);$password=$body['password']??'';school_require(is_string($password)&&strlen($password)<=72&&strlen($login)<=190);$q=db()->prepare('SELECT * FROM pdm_users WHERE email=?');$q->execute([$login]);$u=$q->fetch();$hash=$u['password_hash']??'$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';if(!password_verify($password,$hash)||!$u||!(bool)$u['active'])json_response(['error'=>'نام کاربری یا رمز عبور نادرست است.'],401);session_regenerate_id(true);$_SESSION['uid']=(int)$u['id'];$_SESSION['auth_version']=(int)$u['auth_version'];$_SESSION['csrf']=bin2hex(random_bytes(32));central_response($u);
 }
 $u=require_user();$actor=school_actor($u);school_require($actor!=='');
 if($action==='logout'){$_SESSION=[];session_regenerate_id(true);$_SESSION['csrf']=bin2hex(random_bytes(32));json_response(['ok'=>true,'csrf'=>$_SESSION['csrf']]);}
 if($action==='save'){
  throttle('central-save:'.$u['id'],90,3600);
  school_require(is_int($body['revision']??null));$db=db();$db->beginTransaction();$r=central_load(true);if($r['revision']!==$body['revision']){$q=$db->prepare('SELECT payload FROM pdm_school_history WHERE revision=? ORDER BY id DESC LIMIT 1');$q->execute([$body['revision']]);$base=$q->fetchColumn();if(!$base){$db->rollBack();json_response(['error'=>'نسخه شما قدیمی است؛ تغییرات را دریافت و نسخه تازه را باز کنید.'],409);}try{$body['state']=school_rebase(school_visible(json_decode($base,true,128,JSON_THROW_ON_ERROR),$actor),$body['state'],school_visible($r['state'],$actor));}catch(InvalidArgumentException $e){$db->rollBack();json_response(['error'=>$e->getMessage()],409);}}
  $state=school_merge($r['state'],$body['state']??[],$actor);
  foreach($state['life']['submissions'] as $submission){$file=$submission['file']??null;if(!$file)continue;preg_match('/id=([a-f0-9]{32})$/D',$file['url'],$m);$q=$db->prepare('SELECT f.*,u.actor_id FROM pdm_files f JOIN pdm_users u ON u.id=f.user_id WHERE f.id=?');$q->execute([$m[1]??'']);$f=$q->fetch();school_require($f&&$f['actor_id']==='student:'.$submission['studentId']&&$f['task_id']===$submission['taskId']&&$f['name']===$file['name'],'پیوست متعلق به این پاسخ نیست.');}
  // Drop orphan uploads older than 48h that were never attached to a submission.
  $used=[];foreach($state['life']['submissions'] as $submission){if(!empty($submission['file']['url'])&&preg_match('/id=([a-f0-9]{32})$/D',$submission['file']['url'],$m))$used[$m[1]]=true;}
  $q=$db->query("SELECT id FROM pdm_files WHERE created_at < (NOW() - INTERVAL 2 DAY)");
  while($row=$q->fetch()){if(isset($used[$row['id']]))continue;$db->prepare('DELETE FROM pdm_files WHERE id=?')->execute([$row['id']]);@unlink(__DIR__.'/private/uploads/'.$row['id'].'.bin');}
  $q=$db->prepare('INSERT INTO pdm_school_history(revision,actor_id,payload) VALUES(?,?,?)');$q->execute([$r['revision'],$u['id'],json_encode(school_wire($r['state']),JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);$q=$db->prepare('UPDATE pdm_school SET payload=?,revision=revision+1 WHERE id=1');$q->execute([json_encode(school_wire($state),JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);$db->exec('DELETE FROM pdm_school_history WHERE id < (SELECT cut FROM (SELECT COALESCE(MAX(id),0)-100 AS cut FROM pdm_school_history) AS keep_history)');$db->commit();central_response($u);
 }
 if($action==='accounts'){school_require($actor==='admin');$q=db()->query('SELECT id,email,role,actor_id,phone,active FROM pdm_users ORDER BY id');json_response(['accounts'=>$q->fetchAll()]);}
 if($action==='account_save'){
  school_require($actor==='admin');$target=(string)($body['actor']??'');$login=strtolower(trim((string)($body['email']??'')));
  $loginOk=filter_var($login,FILTER_VALIDATE_EMAIL)!==false||(preg_match('/^[a-z0-9._+-]{3,190}$/D',$login)===1&&!str_contains($login,'@'));
  school_require($loginOk,'نام کاربری باید ایمیل معتبر یا شناسه لاتین بدون فاصله باشد.');
  $s=central_load()['state'];$phone='';$role='custom';if(str_starts_with($target,'teacher:')){$profile=school_find($s['d']['teachers'],substr($target,8));school_require($profile!==null);$phone=$profile['phone'];$role='teacher';}elseif(str_starts_with($target,'student:')){school_require(school_find($s['d']['students'],substr($target,8))!==null);$role='student';}else school_require($target==='deputy'||school_find($s['life']['people'],$target));school_require($target!=='admin');$q=db()->prepare('SELECT id FROM pdm_users WHERE actor_id=?');$q->execute([$target]);$id=$q->fetchColumn();$active=(bool)($body['active']??true);$password=$body['password']??'';if(!$id||$password!=='')$password=password_check($password);if($id){$q=db()->prepare('UPDATE pdm_users SET email=?,phone=?,active=?,auth_version=auth_version+1'.($password!==''?',password_hash=?':'').' WHERE id=?');$args=[$login,$phone,(int)$active];if($password!=='')$args[]=password_hash($password,PASSWORD_DEFAULT);$args[]=$id;$q->execute($args);}else{$q=db()->prepare('INSERT INTO pdm_users(email,password_hash,role,actor_id,phone,active) VALUES(?,?,?,?,?,?)');$q->execute([$login,password_hash($password,PASSWORD_DEFAULT),$role,$target,$phone,(int)$active]);}json_response(['ok'=>true]);
 }
 if($action==='password'){throttle('central-password:'.$u['id'],8);school_require(is_string($body['current']??null)&&password_verify($body['current'],$u['password_hash']),'رمز فعلی نادرست است.');$password=password_check($body['password']??null);$q=db()->prepare('UPDATE pdm_users SET password_hash=?,auth_version=auth_version+1 WHERE id=?');$q->execute([password_hash($password,PASSWORD_DEFAULT),$u['id']]);$_SESSION['auth_version']++;session_regenerate_id(true);json_response(['ok'=>true]);}
 if($action==='backup'){school_require($actor==='admin');$r=central_load();json_response(['format'=>'azarmehr-school-2','created'=>date(DATE_ATOM),'revision'=>$r['revision'],'state'=>school_wire($r['state'])]);}
 json_response(['error'=>'عملیات شناخته نشد.'],404);
}catch(InvalidArgumentException|JsonException $e){if(isset($db)&&$db->inTransaction())$db->rollBack();json_response(['error'=>$e->getMessage()],422);}catch(Throwable $e){if(isset($db)&&$db->inTransaction())$db->rollBack();error_log('Central school error: '.$e->getMessage());json_response(['error'=>'عملیات انجام نشد. اتصال و نصب پایگاه داده را بررسی کنید.'],500);}
