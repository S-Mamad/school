<?php
declare(strict_types=1);
function school_ready(): void {
 if((int)db()->query('SELECT version FROM pdm_schema WHERE id=1')->fetchColumn()<3)json_response(['error'=>'مدیر ابتدا باید ارتقای نسخه ۱٫۲ را از تنظیمات اجرا کند.'],503);
}
function school_date(mixed $v): string {
 if(!is_string($v)||!preg_match('/^\d{4}-\d{2}-\d{2}$/D',$v)||!checkdate((int)substr($v,5,2),(int)substr($v,8,2),(int)substr($v,0,4)))throw new InvalidArgumentException('تاریخ معتبر نیست.');return $v;
}
function school_range(object $body): array {
 $from=school_date($body->from??null);$to=school_date($body->to??null);
 if($from>$to||(strtotime($to)-strtotime($from))>366*86400)throw new InvalidArgumentException('بازه گزارش حداکثر یک سال و تاریخ پایان بعد از شروع باشد.');return [$from,$to];
}
function school_history(PDO $db,string $kind,string $key,int $actor,mixed $before,mixed $after): void {
 $q=$db->prepare('INSERT INTO pdm_case_history (kind,reference_key,actor_id,before_payload,after_payload) VALUES (?,?,?,?,?)');$q->execute([$kind,$key,$actor,json_encode($before,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),json_encode($after,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);
}
function school_action(string $action,object $body,array $u): void {
 school_ready();if($action!=='incident_create')require_staff($u);$db=db();
 if($action==='school_roster'){
  $q=$db->query('SELECT u.id,u.email,w.payload FROM pdm_users u JOIN pdm_workspaces w ON w.user_id=u.id ORDER BY u.id');$owners=[];
  while($r=$q->fetch()){$d=json_decode($r['payload'],true,64,JSON_THROW_ON_ERROR);$owners[]=['id'=>(int)$r['id'],'name'=>$d['profile']['name'],'email'=>$r['email'],'classes'=>$d['classes'],'students'=>$d['students']];}
  json_response(['owners'=>$owners]);
 }
 if($action==='attendance_list'){
  [$from,$to]=school_range($body);$ownerId=$body->ownerId??0;num($ownerId,0,PHP_INT_MAX,false,1);$status=$body->status??'issues';
  if(!in_array($status,['issues','all','absent','excused','late','present','unset'],true))throw new InvalidArgumentException('وضعیت حضور معتبر نیست.');
  $q=$db->prepare('SELECT user_id,payload,revision FROM pdm_workspaces WHERE (?=0 OR user_id=?) ORDER BY user_id');$q->execute([$ownerId,$ownerId]);$rows=[];$total=0;
  $n=$db->prepare('SELECT session_id,student_id,note FROM pdm_attendance_notes WHERE owner_id=?');
  while($r=$q->fetch()){
   $d=json_decode($r['payload'],true,64,JSON_THROW_ON_ERROR);$students=array_column($d['students'],null,'id');$courses=array_column($d['courses'],null,'id');$classes=array_column($d['classes'],null,'id');
   $n->execute([$r['user_id']]);$notes=[];foreach($n->fetchAll() as $note)$notes[$note['session_id'].':'.$note['student_id']]=$note['note'];
   foreach($d['sessions'] as $s){if($s['date']<$from||$s['date']>$to)continue;$c=$courses[$s['courseId']]??null;if(!$c)continue;
    foreach($s['records'] as $id=>$record){$student=$students[$id]??null;if(!$student)continue;$v=$record['attendance'];if($status==='issues'&&!in_array($v,['absent','excused','late'],true))continue;if(!in_array($status,['all','issues'],true)&&$v!==$status)continue;
     if(($body->classId??'')!==''&&$c['classId']!==$body->classId)continue;
     $search=trim((string)($body->query??''));if($search!==''&&!str_contains($student['name'].' '.$student['code'],$search))continue;
     $total++;if(count($rows)>=5000)continue;
     $rows[]=['ownerId'=>(int)$r['user_id'],'ownerName'=>$d['profile']['name'],'revision'=>(int)$r['revision'],'sessionId'=>$s['id'],'sessionTitle'=>$s['title'],'date'=>$s['date'],'course'=>$c['name'],'classId'=>$c['classId'],'className'=>$classes[$c['classId']]['name']??'','studentId'=>$id,'studentName'=>$student['name'],'studentCode'=>$student['code'],'attendance'=>$v,'teacherNote'=>$record['note'],'followup'=>$notes[$s['id'].':'.$id]??''];
    }
   }
  }
  usort($rows,fn($a,$b)=>strcmp($b['date'],$a['date']));json_response(['rows'=>$rows,'total'=>$total,'truncated'=>$total>5000]);
 }
 if($action==='attendance_update'){
  $owner=target_user($u,$body->ownerId??null);$sid=$body->sessionId??'';$student=$body->studentId??'';txt($sid,64,true);txt($student,64,true);$note=$body->followup??'';txt($note,2000);
  $value=$body->attendance??'';if(!in_array($value,['unset','present','absent','excused','late'],true))throw new InvalidArgumentException('وضعیت حضور معتبر نیست.');
  $db->beginTransaction();$q=$db->prepare('SELECT payload,revision FROM pdm_workspaces WHERE user_id=? FOR UPDATE');$q->execute([$owner['id']]);$old=$q->fetch();
  if(!is_int($body->revision??null)||(int)$old['revision']!==$body->revision){$db->rollBack();json_response(['error'=>'دفتر تغییر کرده است؛ گزارش را تازه کنید و دوباره بررسی کنید.'],409);}
  $data=json_decode($old['payload'],false,64,JSON_THROW_ON_ERROR);$found=null;
  foreach($data->sessions as $session)if($session->id===$sid){$found=$session;break;}
  if(!$found||!isset($found->records->{$student}))throw new InvalidArgumentException('رکورد حضور پیدا نشد؛ ابتدا معلم باید حضور جلسه را ثبت کند.');
  $q=$db->prepare('SELECT note FROM pdm_attendance_notes WHERE owner_id=? AND session_id=? AND student_id=?');$q->execute([$owner['id'],$sid,$student]);$previousNote=$q->fetchColumn();
  $before=['attendance'=>$found->records->{$student}->attendance,'followup'=>$previousNote===false?'':$previousNote];
  $found->records->{$student}->attendance=$value;
  $q=$db->prepare('INSERT INTO pdm_history (user_id,revision,payload) VALUES (?,?,?)');$q->execute([$owner['id'],$old['revision'],$old['payload']]);
  $q=$db->prepare('UPDATE pdm_workspaces SET payload=?,revision=revision+1 WHERE user_id=?');$q->execute([json_encode($data,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),$owner['id']]);
  $q=$db->prepare('INSERT INTO pdm_attendance_notes (owner_id,session_id,student_id,note,updated_by) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE note=VALUES(note),updated_by=VALUES(updated_by)');$q->execute([$owner['id'],$sid,$student,$note,$u['id']]);
  school_history($db,'attendance',$owner['id'].':'.$sid.':'.$student,(int)$u['id'],$before,['attendance'=>$value,'followup'=>$note]);audit($db,(int)$u['id'],(int)$owner['id'],'attendance_update');
  $db->commit();json_response(['ok'=>true,'revision'=>$body->revision+1]);
 }
 if($action==='incident_list'){
  [$from,$to]=school_range($body);$ownerId=$body->ownerId??0;num($ownerId,0,PHP_INT_MAX,false,1);$status=$body->status??'all';if(!in_array($status,['all','open','in_progress','resolved'],true))throw new InvalidArgumentException('وضعیت گزارش معتبر نیست.');
  $q=$db->prepare('SELECT i.*,u.email AS creator,v.email AS updater,o.email AS ownerEmail FROM pdm_incidents i JOIN pdm_users u ON u.id=i.created_by JOIN pdm_users v ON v.id=i.updated_by JOIN pdm_users o ON o.id=i.owner_id WHERE event_date BETWEEN ? AND ? AND (?=0 OR owner_id=?) AND (?=\'all\' OR status=?) ORDER BY event_date DESC,i.id DESC LIMIT 5001');$q->execute([$from,$to,$ownerId,$ownerId,$status,$status]);$rows=$q->fetchAll();$truncated=count($rows)>5000;json_response(['rows'=>array_slice($rows,0,5000),'truncated'=>$truncated]);
 }
 if($action==='incident_create'||$action==='incident_update'){
  $date=school_date($body->date??null);$title=$body->title??'';txt($title,150,true);$detail=$body->detail??'';txt($detail,2000,true);$followup=$body->followup??'';txt($followup,2000);$status=$body->status??'open';if(!in_array($status,['open','in_progress','resolved'],true))throw new InvalidArgumentException('وضعیت گزارش معتبر نیست.');
  if($u['role']==='teacher'&&($status!=='open'||$followup!==''))json_response(['error'=>'پیگیری و بستن گزارش با مدیر یا معاون است.'],403);
  if($action==='incident_create'){
   $owner=target_user($u,$body->ownerId??null);$q=$db->prepare('SELECT payload FROM pdm_workspaces WHERE user_id=?');$q->execute([$owner['id']]);$d=json_decode($q->fetchColumn(),true,64,JSON_THROW_ON_ERROR);$students=array_column($d['students'],null,'id');$student=$students[$body->studentId??'']??null;if(!$student)throw new InvalidArgumentException('دانش‌آموز در این دفتر وجود ندارد.');$classes=array_column($d['classes'],null,'id');
   $db->beginTransaction();$q=$db->prepare('INSERT INTO pdm_incidents (owner_id,student_id,student_name,student_code,class_id,class_name,event_date,title,detail,followup,status,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');$q->execute([$owner['id'],$student['id'],$student['name'],$student['code'],$student['classId'],$classes[$student['classId']]['name'],$date,$title,$detail,$followup,$status,$u['id'],$u['id']]);$id=(int)$db->lastInsertId();$before=null;
  }else{
   $id=$body->id??null;num($id,1,PHP_INT_MAX,false,1);$db->beginTransaction();$q=$db->prepare('SELECT * FROM pdm_incidents WHERE id=? FOR UPDATE');$q->execute([$id]);$before=$q->fetch();if(!$before)throw new InvalidArgumentException('گزارش پیدا نشد.');
   if(!is_int($body->revision??null)||(int)$before['revision']!==$body->revision){$db->rollBack();json_response(['error'=>'این گزارش تغییر کرده است؛ فهرست را تازه کنید.'],409);}
   $owner=['id'=>$before['owner_id']];$q=$db->prepare('UPDATE pdm_incidents SET event_date=?,title=?,detail=?,followup=?,status=?,revision=revision+1,updated_by=? WHERE id=?');$q->execute([$date,$title,$detail,$followup,$status,$u['id'],$id]);
  }
  school_history($db,'incident',(string)$id,(int)$u['id'],$before,['date'=>$date,'title'=>$title,'detail'=>$detail,'followup'=>$followup,'status'=>$status]);audit($db,(int)$u['id'],(int)$owner['id'],$action);$db->commit();json_response(['ok'=>true,'id'=>$id]);
 }
}
