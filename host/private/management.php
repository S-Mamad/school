<?php
declare(strict_types=1);
function require_staff(array $u): void {
 if(!in_array($u['role'],['admin','deputy'],true))json_response(['error'=>'این بخش برای مدیر و معاون مجاز است.'],403);
 if((int)db()->query('SELECT version FROM pdm_schema WHERE id=1')->fetchColumn()<2)json_response(['error'=>'ابتدا مدیر باید صفحه ارتقای نصب را اجرا کند.'],503);
}
function target_user(array $actor,mixed $id): array {
 if($id===null||(string)$id===(string)$actor['id'])return $actor;
 require_staff($actor);
 if(!is_int($id)||$id<1)throw new InvalidArgumentException('شناسه حساب معتبر نیست.');
 $q=db()->prepare('SELECT * FROM pdm_users WHERE id=?');$q->execute([$id]);$target=$q->fetch();
 if(!$target)json_response(['error'=>'حساب پیدا نشد.'],404);
 return $target;
}
function audit(PDO $db,int $actor,int $target,string $action): void {
 $q=$db->prepare('INSERT INTO pdm_audit (actor_id,target_id,action) VALUES (?,?,?)');$q->execute([$actor,$target,$action]);
}
function management_action(string $action,object $body,array $u): void {
 require_staff($u);$db=db();
 if($action==='staff_list'){
  $rows=$db->query('SELECT u.id,u.email,u.role,u.active,w.payload,w.revision FROM pdm_users u JOIN pdm_workspaces w ON w.user_id=u.id ORDER BY u.id')->fetchAll();$out=[];
  foreach($rows as $r){$d=json_decode($r['payload'],true,64,JSON_THROW_ON_ERROR);$out[]=['id'=>(int)$r['id'],'name'=>$d['profile']['name'],'email'=>$r['email'],'role'=>$r['role'],'active'=>(bool)$r['active'],'revision'=>(int)$r['revision'],'classes'=>count($d['classes']),'students'=>count($d['students']),'courses'=>count($d['courses']),'sessions'=>count($d['sessions'])];}
  json_response(['accounts'=>$out]);
 }
 if($action==='staff_audit'){
  $q=$db->query('SELECT a.id,a.action,a.created_at,u.email AS actor,t.email AS target FROM pdm_audit a JOIN pdm_users u ON u.id=a.actor_id JOIN pdm_users t ON t.id=a.target_id ORDER BY a.id DESC LIMIT 100');json_response(['events'=>$q->fetchAll()]);
 }
 if($action==='workspace_open'){json_response(workspace($u,(int)target_user($u,$body->userId??null)['id']));}
 if(!in_array($action,['create_teacher','staff_update'],true))return;
 $name=trim($body->name??'');txt($name,100,true);$email=strtolower(trim((string)($body->email??'')));
 if(!filter_var($email,FILTER_VALIDATE_EMAIL)||strlen($email)>190)throw new InvalidArgumentException('ایمیل معتبر نیست.');
 $role=$body->role??'teacher';$active=$body->active??true;
 if(!in_array($role,['admin','deputy','teacher'],true)||!is_bool($active))throw new InvalidArgumentException('نقش یا وضعیت حساب معتبر نیست.');
 if($u['role']==='deputy'&&$role!=='teacher')json_response(['error'=>'تعیین مدیر و معاون فقط با مدیر است.'],403);
 if($action==='create_teacher'){
  $password=password_check($body->password??null);$db->beginTransaction();
  $q=$db->prepare('INSERT INTO pdm_users (email,password_hash,role,active) VALUES (?,?,?,?)');$q->execute([$email,password_hash($password,PASSWORD_DEFAULT),$role,(int)$active]);$id=(int)$db->lastInsertId();
  $q=$db->prepare('INSERT INTO pdm_workspaces (user_id,payload) VALUES (?,?)');$q->execute([$id,empty_payload($name)]);audit($db,(int)$u['id'],$id,'account_create');$db->commit();json_response(['ok'=>true]);
 }
 $target=target_user($u,$body->userId??null);$id=(int)$target['id'];
 if($id===(int)$u['id'])json_response(['error'=>'مشخصات شخصی را از تنظیمات ویرایش کنید؛ تغییر نقش یا غیرفعال‌کردن خود مجاز نیست.'],403);
 $db->beginTransaction();
 // Serialize role edits so concurrent requests cannot remove the last active administrator.
 $users=$db->query('SELECT id,role,active FROM pdm_users ORDER BY id FOR UPDATE')->fetchAll();
 foreach($users as $row)if((int)$row['id']===$id)$target=array_merge($target,$row);
 if($u['role']==='deputy'&&$target['role']!=='teacher')json_response(['error'=>'معاون فقط می‌تواند حساب معلم را ویرایش کند.'],403);
 $admins=array_filter($users,fn($r)=>$r['role']==='admin'&&(bool)$r['active']);
 if($target['role']==='admin'&&(bool)$target['active']&&($role!=='admin'||!$active)&&count($admins)<=1)throw new InvalidArgumentException('حداقل یک مدیر فعال لازم است.');
 $q=$db->prepare('SELECT payload,revision FROM pdm_workspaces WHERE user_id=? FOR UPDATE');$q->execute([$id]);$old=$q->fetch();
 if(!is_int($body->revision??null)||(int)$old['revision']!==$body->revision){$db->rollBack();json_response(['error'=>'اطلاعات این حساب تغییر کرده؛ فهرست را تازه کنید.'],409);}
 $payload=json_decode($old['payload'],true,64,JSON_THROW_ON_ERROR);$payload['profile']['name']=$name;
 // Preserve object-shaped maps, including empty finals and records.
 $object=json_decode($old['payload'],false,64,JSON_THROW_ON_ERROR);$object->profile->name=$name;
 $q=$db->prepare('INSERT INTO pdm_history (user_id,revision,payload) VALUES (?,?,?)');$q->execute([$id,$old['revision'],$old['payload']]);
 $q=$db->prepare('UPDATE pdm_workspaces SET payload=?,revision=revision+1 WHERE user_id=?');$q->execute([json_encode($object,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),$id]);
 $q=$db->prepare('UPDATE pdm_users SET email=?,role=?,active=?,auth_version=auth_version+1 WHERE id=?');$q->execute([$email,$role,(int)$active,$id]);
 audit($db,(int)$u['id'],$id,'account_update');$db->commit();json_response(['ok'=>true]);
}
function check_managed_changes(array $old,array $next,bool $own=false): void {
 foreach($own?['schema','sessions','finals']:['schema','profile','sessions','finals'] as $key)if(($old[$key]??null)!==($next[$key]??null))json_response(['error'=>'مدیر و معاون اجازه تغییر نمرات یا جلسات را ندارند. برای اصلاح حضور از بخش غیبت و انضباط استفاده کنید.'],403);
 $courses=[];foreach($next['courses'] as $c)$courses[$c['id']]=$c;
 foreach($old['courses'] as $c)if(isset($courses[$c['id']])&&($courses[$c['id']]['formula']!==$c['formula']||($courses[$c['id']]['gradeScales']??[])!==($c['gradeScales']??[])))json_response(['error'=>'فرمول نمره‌دهی را معلم همان دفتر تعیین می‌کند.'],403);
}
