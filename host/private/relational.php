<?php
declare(strict_types=1);

/** Relational desk storage (schema 5). The JSON document in pdm_school stays as the life/backup copy. */

function relational_ready(PDO $db): bool {
 static $ready=null;
 if($ready!==null)return $ready;
 $ready=(bool)$db->query("SHOW TABLES LIKE 'pdm_years'")->fetch();
 return $ready;
}

function relational_id(mixed $id,string $label='شناسه'): string {
 if(!is_string($id)||$id===''||relational_chars($id)>64)throw new InvalidArgumentException($label.' برای جدول رابطه‌ای معتبر نیست.');
 return $id;
}

function relational_install_v5(PDO $db): void {
 $has=(bool)$db->query("SHOW TABLES LIKE 'pdm_incidents'")->fetch();
 if($has){
  $legacy=(bool)$db->query("SHOW COLUMNS FROM pdm_incidents LIKE 'owner_id'")->fetch();
  if($legacy){
   if($db->query("SHOW TABLES LIKE 'pdm_workspace_incidents'")->fetch())throw new RuntimeException('جدول انضباط نسخهٔ ۱ و نسخهٔ جدید هر دو وجود دارند؛ مهاجرت متوقف شد تا داده‌ای پاک نشود.');
   $db->exec('RENAME TABLE pdm_incidents TO pdm_workspace_incidents');
  }
 }
 $engine='ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
 $db->exec("CREATE TABLE IF NOT EXISTS pdm_years (id VARCHAR(64) PRIMARY KEY,name VARCHAR(150) NOT NULL,archived TINYINT(1) NOT NULL DEFAULT 0,created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) $engine");
 $db->exec("CREATE TABLE IF NOT EXISTS pdm_majors (id VARCHAR(64) PRIMARY KEY,name VARCHAR(150) NOT NULL) $engine");
 $db->exec("CREATE TABLE IF NOT EXISTS pdm_grades (id VARCHAR(64) PRIMARY KEY,name VARCHAR(150) NOT NULL,sort_order INT NOT NULL) $engine");
 $db->exec("CREATE TABLE IF NOT EXISTS pdm_classes (id VARCHAR(64) PRIMARY KEY,year_id VARCHAR(64) NOT NULL,major_id VARCHAR(64) NOT NULL,grade_id VARCHAR(64) NOT NULL,section VARCHAR(50) NOT NULL,name VARCHAR(150) NOT NULL,CONSTRAINT pdm_classes_year FOREIGN KEY(year_id) REFERENCES pdm_years(id),CONSTRAINT pdm_classes_major FOREIGN KEY(major_id) REFERENCES pdm_majors(id),CONSTRAINT pdm_classes_grade FOREIGN KEY(grade_id) REFERENCES pdm_grades(id)) $engine");
 $db->exec("CREATE TABLE IF NOT EXISTS pdm_students (id VARCHAR(64) PRIMARY KEY,code VARCHAR(50) NOT NULL,name VARCHAR(150) NOT NULL,father_name VARCHAR(100) NOT NULL,phone VARCHAR(20) NULL,extra JSON NULL,UNIQUE KEY pdm_students_code (code)) $engine");
 $db->exec("CREATE TABLE IF NOT EXISTS pdm_enrollments (id VARCHAR(64) PRIMARY KEY,student_id VARCHAR(64) NOT NULL,class_id VARCHAR(64) NULL,year_id VARCHAR(64) NOT NULL,status ENUM('active','graduated') NOT NULL DEFAULT 'active',UNIQUE KEY pdm_enroll_year (student_id,year_id),CONSTRAINT pdm_enroll_student FOREIGN KEY(student_id) REFERENCES pdm_students(id),CONSTRAINT pdm_enroll_class FOREIGN KEY(class_id) REFERENCES pdm_classes(id),CONSTRAINT pdm_enroll_year_fk FOREIGN KEY(year_id) REFERENCES pdm_years(id)) $engine");
 $db->exec("CREATE TABLE IF NOT EXISTS pdm_teachers (id VARCHAR(64) PRIMARY KEY,name VARCHAR(150) NOT NULL,email VARCHAR(150) NOT NULL,phone VARCHAR(20) NOT NULL,active TINYINT(1) NOT NULL DEFAULT 1,UNIQUE KEY pdm_teachers_email (email)) $engine");
 $db->exec("CREATE TABLE IF NOT EXISTS pdm_subjects (id VARCHAR(64) PRIMARY KEY,name VARCHAR(150) NOT NULL,grade_id VARCHAR(64) NOT NULL,major_id VARCHAR(64) NULL,is_general TINYINT(1) NOT NULL DEFAULT 0,CONSTRAINT pdm_subjects_grade FOREIGN KEY(grade_id) REFERENCES pdm_grades(id),CONSTRAINT pdm_subjects_major FOREIGN KEY(major_id) REFERENCES pdm_majors(id)) $engine");
 $db->exec("CREATE TABLE IF NOT EXISTS pdm_offerings (id VARCHAR(64) PRIMARY KEY,class_id VARCHAR(64) NOT NULL,subject_id VARCHAR(64) NOT NULL,teacher_id VARCHAR(64) NULL,name VARCHAR(150) NOT NULL,modules_count TINYINT NOT NULL DEFAULT 5,modules JSON NOT NULL,formula JSON NOT NULL,grade_scales JSON NULL,CONSTRAINT pdm_offerings_class FOREIGN KEY(class_id) REFERENCES pdm_classes(id),CONSTRAINT pdm_offerings_subject FOREIGN KEY(subject_id) REFERENCES pdm_subjects(id),CONSTRAINT pdm_offerings_teacher FOREIGN KEY(teacher_id) REFERENCES pdm_teachers(id)) $engine");
 $db->exec("CREATE TABLE IF NOT EXISTS pdm_sessions (id VARCHAR(64) PRIMARY KEY,offering_id VARCHAR(64) NOT NULL,module_index TINYINT NOT NULL,date DATE NOT NULL,title VARCHAR(200) NOT NULL,note TEXT NULL,INDEX pdm_sessions_offering (offering_id,module_index),CONSTRAINT pdm_sessions_offering FOREIGN KEY(offering_id) REFERENCES pdm_offerings(id)) $engine");
 $db->exec("CREATE TABLE IF NOT EXISTS pdm_session_records (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,session_id VARCHAR(64) NOT NULL,student_id VARCHAR(64) NOT NULL,attendance ENUM('unset','present','absent','excused','late') NOT NULL DEFAULT 'unset',asked TINYINT(1) NOT NULL DEFAULT 0,note TEXT NULL,UNIQUE KEY pdm_record_once (session_id,student_id),INDEX pdm_record_student (student_id),CONSTRAINT pdm_record_session FOREIGN KEY(session_id) REFERENCES pdm_sessions(id),CONSTRAINT pdm_record_student_fk FOREIGN KEY(student_id) REFERENCES pdm_students(id)) $engine");
 $db->exec("CREATE TABLE IF NOT EXISTS pdm_session_marks (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,record_id BIGINT UNSIGNED NOT NULL,client_id VARCHAR(64) NOT NULL,type VARCHAR(100) NOT NULL,value DECIMAL(6,2) NOT NULL,max_val DECIMAL(6,2) NOT NULL DEFAULT 20.00,note TEXT NULL,competency TINYINT NULL,UNIQUE KEY pdm_mark_client (record_id,client_id),CONSTRAINT pdm_mark_record FOREIGN KEY(record_id) REFERENCES pdm_session_records(id) ON DELETE CASCADE) $engine");
 $db->exec("CREATE TABLE IF NOT EXISTS pdm_finals (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,offering_id VARCHAR(64) NOT NULL,module_index TINYINT NOT NULL,student_id VARCHAR(64) NOT NULL,continuous DECIMAL(4,2) NULL,competency1 TINYINT NULL,competency2 TINYINT NULL,final_competency TINYINT NULL,total DECIMAL(4,2) NULL,note TEXT NULL,UNIQUE KEY pdm_final_once (offering_id,module_index,student_id),CONSTRAINT pdm_final_offering FOREIGN KEY(offering_id) REFERENCES pdm_offerings(id),CONSTRAINT pdm_final_student FOREIGN KEY(student_id) REFERENCES pdm_students(id)) $engine");
 $db->exec("CREATE TABLE IF NOT EXISTS pdm_incidents (id VARCHAR(64) PRIMARY KEY,student_id VARCHAR(64) NOT NULL,class_id VARCHAR(64) NOT NULL,year_id VARCHAR(64) NULL,date DATE NOT NULL,title VARCHAR(200) NOT NULL,description TEXT NOT NULL,status ENUM('open','in_progress','resolved') NOT NULL,author VARCHAR(150) NOT NULL,followup TEXT NULL,CONSTRAINT pdm_incident_student FOREIGN KEY(student_id) REFERENCES pdm_students(id),CONSTRAINT pdm_incident_class FOREIGN KEY(class_id) REFERENCES pdm_classes(id),CONSTRAINT pdm_incident_year FOREIGN KEY(year_id) REFERENCES pdm_years(id)) $engine");
 $db->beginTransaction();
 try{
  relational_clear($db);
  $row=$db->query('SELECT payload FROM pdm_school WHERE id=1')->fetch();
  if($row){
   $state=json_decode((string)$row['payload'],true,128,JSON_THROW_ON_ERROR);
   if(is_array($state)&&isset($state['d'])&&is_array($state['d']))relational_insert_document($db,$state['d']);
  }
  $db->exec('UPDATE pdm_schema SET version=5 WHERE id=1');
  $db->commit();
 }catch(Throwable $e){
  if($db->inTransaction())$db->rollBack();
  throw $e;
 }
}

function relational_clear(PDO $db): void {
 $db->exec('SET FOREIGN_KEY_CHECKS=0');
 foreach(['pdm_session_marks','pdm_session_records','pdm_sessions','pdm_finals','pdm_incidents','pdm_offerings','pdm_enrollments','pdm_subjects','pdm_classes','pdm_students','pdm_teachers','pdm_grades','pdm_majors','pdm_years'] as $table)$db->exec('DELETE FROM '.$table);
 $db->exec('SET FOREIGN_KEY_CHECKS=1');
}

function relational_json(mixed $value): string {
 $json=json_encode($value,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
 if(!is_string($json))throw new InvalidArgumentException('دادهٔ ساخت‌یافته قابل ذخیره نیست.');
 return $json;
}

function relational_insert_document(PDO $db,array $d): void {
 foreach($d['years']??[] as $y){
  $id=relational_id($y['id']??null,'شناسه سال');
  $db->prepare('INSERT INTO pdm_years (id,name,archived) VALUES (?,?,?)')->execute([$id,relational_text($y['name']??'',150,'نام سال'),empty($y['archived'])?0:1]);
 }
 foreach($d['majors']??[] as $m)$db->prepare('INSERT INTO pdm_majors (id,name) VALUES (?,?)')->execute([relational_id($m['id']??null,'شناسه رشته'),relational_text($m['name']??'',150,'نام رشته')]);
 foreach($d['grades']??[] as $g)$db->prepare('INSERT INTO pdm_grades (id,name,sort_order) VALUES (?,?,?)')->execute([relational_id($g['id']??null,'شناسه پایه'),relational_text($g['name']??'',150,'نام پایه'),(int)($g['order']??0)]);
 foreach($d['classes']??[] as $c)$db->prepare('INSERT INTO pdm_classes (id,year_id,major_id,grade_id,section,name) VALUES (?,?,?,?,?,?)')->execute([relational_id($c['id']??null,'شناسه کلاس'),relational_id($c['yearId']??null,'سال کلاس'),relational_id($c['majorId']??null,'رشته کلاس'),relational_id($c['gradeId']??null,'پایه کلاس'),relational_text($c['section']??'',50,'شعبه'),relational_text($c['name']??'',150,'نام کلاس')]);
 foreach($d['students']??[] as $s){
  $phone=trim((string)($s['phone']??''));
  $extra=$s['extra']??null;
  $db->prepare('INSERT INTO pdm_students (id,code,name,father_name,phone,extra) VALUES (?,?,?,?,?,?)')->execute([relational_id($s['id']??null,'شناسه دانش‌آموز'),relational_text($s['code']??'',50,'کد دانش‌آموز'),relational_text($s['name']??'',150,'نام دانش‌آموز'),relational_text($s['father']??'',100,'نام پدر'),$phone===''?null:relational_text($phone,20,'تلفن'),(is_array($extra)&&$extra)?relational_json($extra):null]);
 }
 foreach($d['teachers']??[] as $t)$db->prepare('INSERT INTO pdm_teachers (id,name,email,phone,active) VALUES (?,?,?,?,?)')->execute([relational_id($t['id']??null,'شناسه معلم'),relational_text($t['name']??'',150,'نام معلم'),relational_text($t['email']??'',150,'ایمیل معلم'),relational_text($t['phone']??'',20,'تلفن معلم'),empty($t['active'])&&array_key_exists('active',$t)?0:1]);
 foreach($d['subjects']??[] as $s){
  $general=($s['kind']??'')==='general'||($s['majorId']??'')==='all';
  $db->prepare('INSERT INTO pdm_subjects (id,name,grade_id,major_id,is_general) VALUES (?,?,?,?,?)')->execute([relational_id($s['id']??null,'شناسه درس'),relational_text($s['name']??'',150,'نام درس'),relational_id($s['gradeId']??null,'پایه درس'),$general?null:relational_id($s['majorId']??null,'رشته درس'),$general?1:0]);
 }
 foreach($d['enrollments']??[] as $e){
  $status=($e['status']??'active')==='graduated'?'graduated':'active';
  $class=$e['classId']??null;
  $db->prepare('INSERT INTO pdm_enrollments (id,student_id,class_id,year_id,status) VALUES (?,?,?,?,?)')->execute([relational_id($e['id']??null,'شناسه ثبت‌نام'),relational_id($e['studentId']??null,'دانش‌آموز ثبت‌نام'),$status==='graduated'||$class===null||$class===''?null:relational_id((string)$class,'کلاس ثبت‌نام'),relational_id($e['yearId']??null,'سال ثبت‌نام'),$status]);
 }
 foreach($d['offerings']??[] as $o)relational_upsert_offering($db,$o,false);
 foreach($d['sessions']??[] as $s)relational_insert_session_tree($db,$s);
 foreach($d['finals']??[] as $key=>$f){if(is_array($f))relational_upsert_final_key($db,(string)$key,$f);}
 foreach($d['incidents']??[] as $i)relational_upsert_incident($db,$i,false);
}

function relational_sync_document(PDO $db,array $d): void {
 if(!relational_ready($db))return;
 foreach($d['years']??[] as $y)$db->prepare('INSERT INTO pdm_years (id,name,archived) VALUES (?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),archived=VALUES(archived)')->execute([relational_id($y['id']??null,'شناسه سال'),relational_text($y['name']??'',150,'نام سال'),empty($y['archived'])?0:1]);
 foreach($d['majors']??[] as $m)$db->prepare('INSERT INTO pdm_majors (id,name) VALUES (?,?) ON DUPLICATE KEY UPDATE name=VALUES(name)')->execute([relational_id($m['id']??null,'شناسه رشته'),relational_text($m['name']??'',150,'نام رشته')]);
 foreach($d['grades']??[] as $g)$db->prepare('INSERT INTO pdm_grades (id,name,sort_order) VALUES (?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),sort_order=VALUES(sort_order)')->execute([relational_id($g['id']??null,'شناسه پایه'),relational_text($g['name']??'',150,'نام پایه'),(int)($g['order']??0)]);
 foreach($d['classes']??[] as $c)$db->prepare('INSERT INTO pdm_classes (id,year_id,major_id,grade_id,section,name) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),section=VALUES(section)')->execute([relational_id($c['id']??null,'شناسه کلاس'),relational_id($c['yearId']??null,'سال کلاس'),relational_id($c['majorId']??null,'رشته کلاس'),relational_id($c['gradeId']??null,'پایه کلاس'),relational_text($c['section']??'',50,'شعبه'),relational_text($c['name']??'',150,'نام کلاس')]);
 foreach($d['students']??[] as $s){
  $phone=trim((string)($s['phone']??''));
  $extra=$s['extra']??null;
  $db->prepare('INSERT INTO pdm_students (id,code,name,father_name,phone,extra) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE code=VALUES(code),name=VALUES(name),father_name=VALUES(father_name),phone=VALUES(phone),extra=VALUES(extra)')->execute([relational_id($s['id']??null,'شناسه دانش‌آموز'),relational_text($s['code']??'',50,'کد دانش‌آموز'),relational_text($s['name']??'',150,'نام دانش‌آموز'),relational_text($s['father']??'',100,'نام پدر'),$phone===''?null:relational_text($phone,20,'تلفن'),(is_array($extra)&&$extra)?relational_json($extra):null]);
 }
 foreach($d['teachers']??[] as $t)$db->prepare('INSERT INTO pdm_teachers (id,name,email,phone,active) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),email=VALUES(email),phone=VALUES(phone),active=VALUES(active)')->execute([relational_id($t['id']??null,'شناسه معلم'),relational_text($t['name']??'',150,'نام معلم'),relational_text($t['email']??'',150,'ایمیل معلم'),relational_text($t['phone']??'',20,'تلفن معلم'),empty($t['active'])&&array_key_exists('active',$t)?0:1]);
 foreach($d['subjects']??[] as $s){
  $general=($s['kind']??'')==='general'||($s['majorId']??'')==='all';
  $db->prepare('INSERT INTO pdm_subjects (id,name,grade_id,major_id,is_general) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),grade_id=VALUES(grade_id),major_id=VALUES(major_id),is_general=VALUES(is_general)')->execute([relational_id($s['id']??null,'شناسه درس'),relational_text($s['name']??'',150,'نام درس'),relational_id($s['gradeId']??null,'پایه درس'),$general?null:relational_id($s['majorId']??null,'رشته درس'),$general?1:0]);
 }
 foreach($d['enrollments']??[] as $e){
  $status=($e['status']??'active')==='graduated'?'graduated':'active';
  $class=$e['classId']??null;
  $db->prepare('INSERT INTO pdm_enrollments (id,student_id,class_id,year_id,status) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE class_id=VALUES(class_id),status=VALUES(status)')->execute([relational_id($e['id']??null,'شناسه ثبت‌نام'),relational_id($e['studentId']??null,'دانش‌آموز ثبت‌نام'),$status==='graduated'||$class===null||$class===''?null:relational_id((string)$class,'کلاس ثبت‌نام'),relational_id($e['yearId']??null,'سال ثبت‌نام'),$status]);
 }
 foreach($d['offerings']??[] as $o)relational_upsert_offering($db,$o,true);
 $known=[];
 foreach($db->query('SELECT id FROM pdm_sessions')->fetchAll() as $row)$known[$row['id']]=true;
 foreach($d['sessions']??[] as $s){
  if(!is_array($s))continue;
  $id=relational_id($s['id']??null,'شناسه جلسه');
  if(!isset($known[$id]))relational_insert_session_tree($db,$s);
  else $db->prepare('UPDATE pdm_sessions SET date=?,title=? WHERE id=?')->execute([relational_date($s['date']??null),relational_text($s['title']??'',200,'عنوان جلسه'),$id]);
 }
 foreach($d['finals']??[] as $key=>$f){if(is_array($f))relational_upsert_final_key($db,(string)$key,$f,false);}
 foreach($d['incidents']??[] as $i)relational_upsert_incident($db,$i,true);
 $keep=[];
 foreach($d['enrollments']??[] as $e){if(!is_array($e))continue;$keep[relational_id($e['studentId']??null,'دانش‌آموز ثبت‌نام').'|'.relational_id($e['yearId']??null,'سال ثبت‌نام')]=true;}
 $drop=$db->prepare('DELETE FROM pdm_enrollments WHERE id=?');
 foreach($db->query('SELECT id,student_id,year_id FROM pdm_enrollments')->fetchAll() as $row)if(!isset($keep[$row['student_id'].'|'.$row['year_id']]))$drop->execute([$row['id']]);
}

function relational_upsert_offering(PDO $db,array $o,bool $update): void {
 $teacher=trim((string)($o['teacherId']??''));
 $modules=$o['modules']??[];
 if(!is_array($modules)||!array_is_list($modules)||count($modules)!==5)throw new InvalidArgumentException('هر درس باید پنج پودمان داشته باشد.');
 $scales=$o['gradeScales']??null;
 $sql=$update
  ?'INSERT INTO pdm_offerings (id,class_id,subject_id,teacher_id,name,modules_count,modules,formula,grade_scales) VALUES (?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE class_id=VALUES(class_id),subject_id=VALUES(subject_id),teacher_id=VALUES(teacher_id),name=VALUES(name),modules_count=VALUES(modules_count),modules=VALUES(modules),formula=VALUES(formula),grade_scales=VALUES(grade_scales)'
  :'INSERT INTO pdm_offerings (id,class_id,subject_id,teacher_id,name,modules_count,modules,formula,grade_scales) VALUES (?,?,?,?,?,?,?,?,?)';
 $db->prepare($sql)->execute([relational_id($o['id']??null,'شناسه درس کلاس'),relational_id($o['classId']??null,'کلاس درس'),relational_id($o['subjectId']??null,'برنامه درس'),$teacher===''?null:relational_id($teacher,'معلم درس'),relational_text($o['name']??'',150,'نام درس کلاس'),count($modules),relational_json($modules),relational_json($o['formula']??[]),is_array($scales)?relational_json($scales):null]);
}

function relational_insert_session_tree(PDO $db,array $s): void {
 $id=relational_id($s['id']??null,'شناسه جلسه');
 $db->prepare('INSERT INTO pdm_sessions (id,offering_id,module_index,date,title) VALUES (?,?,?,?,?)')->execute([$id,relational_id($s['courseId']??null,'درس جلسه'),relational_module($s['module']??null),relational_date($s['date']??null),relational_text($s['title']??'',200,'عنوان جلسه')]);
 foreach($s['records']??[] as $studentId=>$record){
  if(!is_array($record))continue;
  $student=relational_id((string)$studentId,'دانش‌آموز جلسه');
  $db->prepare('INSERT INTO pdm_session_records (session_id,student_id,attendance,asked,note) VALUES (?,?,?,?,?)')->execute([$id,$student,relational_attendance($record['attendance']??'unset'),!empty($record['asked'])?1:0,relational_note($record['note']??'')]);
  $recordId=(int)$db->lastInsertId();
  $seen=[];
  foreach($record['marks']??[] as $mark){
   if(!is_array($mark))continue;
   $client=relational_id($mark['id']??null,'شناسه نمره');
   if(isset($seen[$client]))throw new InvalidArgumentException('شناسه نمره در یک جلسه تکراری است.');
   $seen[$client]=true;
   relational_insert_mark($db,$recordId,$mark);
  }
 }
}

function relational_insert_mark(PDO $db,int $recordId,array $mark): void {
 $type=relational_text($mark['type']??'',100,'نوع نمره');
 $max=relational_numeric($mark['max']??20);
 $value=relational_numeric($mark['value']??0);
 if($max===null||$value===null)throw new InvalidArgumentException('نمره با بارم سازگار نیست.');
 $point=in_array($type,['مثبت','منفی'],true);
 if($max<=0||$max>1000||$value<0||$value>($point?1000:$max))throw new InvalidArgumentException('نمره با بارم سازگار نیست.');
 $db->prepare('INSERT INTO pdm_session_marks (record_id,client_id,type,value,max_val,note,competency) VALUES (?,?,?,?,?,?,?)')->execute([$recordId,relational_id($mark['id']??null,'شناسه نمره'),$type,$value,$max,relational_note($mark['note']??''),(int)($mark['competency']??1)]);
}

function relational_upsert_final_key(PDO $db,string $key,array $f,bool $overwrite=true): void {
 $parts=explode(':',$key);
 if(count($parts)<3)throw new InvalidArgumentException('شناسه نمره پودمانی معتبر نیست.');
 $offering=relational_id($parts[0],'درس نمره');
 $module=relational_module($parts[1]);
 $student=relational_id(implode(':',array_slice($parts,2)),'دانش‌آموز نمره');
 $competencies=$f['competencies']??[null,null];
 $c1=relational_tiny($competencies[0]??null,1,3);
 $c2=relational_tiny($competencies[1]??null,1,3);
 $sql=$overwrite
  ?'INSERT INTO pdm_finals (offering_id,module_index,student_id,continuous,competency1,competency2,final_competency,total,note) VALUES (?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE continuous=VALUES(continuous),competency1=VALUES(competency1),competency2=VALUES(competency2),final_competency=VALUES(final_competency),total=VALUES(total),note=VALUES(note)'
  :'INSERT INTO pdm_finals (offering_id,module_index,student_id,continuous,competency1,competency2,final_competency,total,note) VALUES (?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE id=id';
 $db->prepare($sql)->execute([$offering,$module,$student,relational_decimal($f['continuous']??null,0,5),$c1,$c2,relational_tiny($f['competency']??null,1,3),relational_decimal($f['total']??null,0,20),relational_note($f['note']??'')]);
}

function relational_upsert_incident(PDO $db,array $i,bool $update): void {
 $status=(string)($i['status']??'open');
 if(!in_array($status,['open','in_progress','resolved'],true))throw new InvalidArgumentException('وضعیت گزارش انضباطی معتبر نیست.');
 $sql=$update
  ?'INSERT INTO pdm_incidents (id,student_id,class_id,year_id,date,title,description,status,author,followup) VALUES (?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE title=VALUES(title),description=VALUES(description),status=VALUES(status),followup=VALUES(followup),date=VALUES(date)'
  :'INSERT INTO pdm_incidents (id,student_id,class_id,year_id,date,title,description,status,author,followup) VALUES (?,?,?,?,?,?,?,?,?,?)';
 $year=$i['yearId']??null;
 $db->prepare($sql)->execute([relational_id($i['id']??null,'شناسه گزارش'),relational_id($i['studentId']??null,'دانش‌آموز گزارش'),relational_id($i['classId']??null,'کلاس گزارش'),is_string($year)&&$year!==''?relational_id($year,'سال گزارش'):null,relational_date($i['date']??null),relational_text($i['title']??'',200,'موضوع گزارش'),relational_text($i['detail']??$i['description']??'',20000,'شرح گزارش'),$status,relational_text($i['author']??'',150,'ثبت‌کننده'),relational_note($i['followup']??'')]);
}

function relational_overlay(PDO $db,array $state): array {
 if(!relational_ready($db)||!isset($state['d'])||!is_array($state['d']))return $state;
 $offerings=(int)$db->query('SELECT COUNT(*) FROM pdm_offerings')->fetchColumn();
 $sessions=(int)$db->query('SELECT COUNT(*) FROM pdm_sessions')->fetchColumn();
 if($offerings===0&&$sessions===0)return $state;
 $byId=[];
 foreach($db->query('SELECT id,teacher_id,name,modules,formula,grade_scales FROM pdm_offerings')->fetchAll() as $row)$byId[$row['id']]=$row;
 if(isset($state['d']['offerings'])&&is_array($state['d']['offerings'])){
  foreach($state['d']['offerings'] as &$offering){
   $sql=$byId[$offering['id']??'']??null;
   if(!$sql)continue;
   $offering['teacherId']=$sql['teacher_id']??'';
   $offering['name']=$sql['name'];
   $modules=json_decode((string)$sql['modules'],true);
   $formula=json_decode((string)$sql['formula'],true);
   if(is_array($modules))$offering['modules']=$modules;
   if(is_array($formula))$offering['formula']=$formula;
   if($sql['grade_scales']!==null){$scales=json_decode((string)$sql['grade_scales'],true);if(is_array($scales))$offering['gradeScales']=$scales;}
   else unset($offering['gradeScales']);
  }
  unset($offering);
 }
 $state['d']['sessions']=relational_all_sessions($db);
 $state['d']['finals']=relational_all_finals($db);
 return $state;
}

function relational_all_sessions(PDO $db): array {
 $sessions=$db->query('SELECT id,offering_id,module_index,date,title FROM pdm_sessions ORDER BY date,id')->fetchAll();
 $records=$db->query('SELECT id,session_id,student_id,attendance,asked,note FROM pdm_session_records')->fetchAll();
 $marks=$db->query('SELECT record_id,client_id,type,value,max_val,note,competency FROM pdm_session_marks ORDER BY id')->fetchAll();
 $marksBy=[];
 foreach($marks as $mark)$marksBy[$mark['record_id']][]=['id'=>$mark['client_id'],'type'=>$mark['type'],'value'=>(float)$mark['value'],'max'=>(float)$mark['max_val'],'note'=>(string)($mark['note']??''),'competency'=>$mark['competency']===null?1:(int)$mark['competency']];
 $recordsBy=[];
 foreach($records as $record)$recordsBy[$record['session_id']][$record['student_id']]=['attendance'=>$record['attendance'],'asked'=>((int)$record['asked'])===1,'note'=>(string)($record['note']??''),'marks'=>$marksBy[$record['id']]??[]];
 $out=[];
 foreach($sessions as $session){
  $map=$recordsBy[$session['id']]??[];
  $out[]=['id'=>$session['id'],'courseId'=>$session['offering_id'],'module'=>(int)$session['module_index'],'date'=>substr((string)$session['date'],0,10),'title'=>$session['title'],'records'=>$map];
 }
 return $out;
}

function relational_all_finals(PDO $db): array {
 $out=[];
 foreach($db->query('SELECT offering_id,module_index,student_id,continuous,competency1,competency2,final_competency,total,note FROM pdm_finals')->fetchAll() as $row){
  $out[$row['offering_id'].':'.$row['module_index'].':'.$row['student_id']]=['continuous'=>$row['continuous']===null?null:(float)$row['continuous'],'competencies'=>[$row['competency1']===null?null:(int)$row['competency1'],$row['competency2']===null?null:(int)$row['competency2']],'competency'=>$row['final_competency']===null?null:(int)$row['final_competency'],'total'=>$row['total']===null?null:(float)$row['total'],'note'=>(string)($row['note']??'')];
 }
 return $out;
}

/** Keep attendance/marks/finals on desk endpoints. Allow title/date of existing sessions through for merge. */
function relational_freeze_client_desk(array $server,array $client): array {
 if(!isset($client['d'],$server['d'])||!is_array($client['d'])||!is_array($server['d']))return $client;
 $serverSessions=[];
 foreach($server['d']['sessions']??[] as $session)if(is_array($session)&&isset($session['id']))$serverSessions[$session['id']]=$session;
 $sessions=[];
 foreach($client['d']['sessions']??[] as $session){
  if(!is_array($session)||!isset($session['id']))continue;
  $known=$serverSessions[$session['id']]??null;
  if($known===null){$sessions[]=$session;continue;}
  $next=$known;
  if(isset($session['title'])&&is_string($session['title']))$next['title']=$session['title'];
  if(isset($session['date'])&&is_string($session['date']))$next['date']=$session['date'];
  $sessions[]=$next;
 }
 $client['d']['sessions']=$sessions;
 $client['d']['finals']=[];
 return $client;
}

function desk_get(array $user,string $offeringId): never {
 $db=db();
 school_require(relational_ready($db),'ابتدا ارتقای پایگاه را از صفحهٔ به‌روزرسانی اجرا کنید.');
 $offering=relational_offering($db,relational_id($offeringId,'درس'));
 school_require($offering!==null,'این درس در پایگاه رابطه‌ای پیدا نشد.');
 $state=central_load()['state'];
 desk_assert_view($user,$offering,$state);
 $sessions=array_values(array_filter(relational_all_sessions($db),fn($s)=>$s['courseId']===$offering['id']));
 foreach($sessions as &$session)if($session['records']===[])$session['records']=new stdClass();
 unset($session);
 $finals=[];
 foreach(relational_all_finals($db) as $key=>$final)if(str_starts_with($key,$offering['id'].':'))$finals[$key]=$final;
 $students=$db->prepare('SELECT s.id,s.name,s.code FROM pdm_students s JOIN pdm_enrollments e ON e.student_id=s.id AND e.status=\'active\' AND e.class_id=? AND e.year_id=? ORDER BY s.name');
 $students->execute([$offering['class_id'],$offering['year_id']]);
 json_response(['offeringId'=>$offering['id'],'class'=>['id'=>$offering['class_id'],'name'=>$offering['class_name'],'yearId'=>$offering['year_id']],'students'=>$students->fetchAll(),'sessions'=>$sessions,'finals'=>$finals?:new stdClass()]);
}

function desk_save_attendance(array $user,array $body): array {
 $db=db();
 school_require(relational_ready($db),'ابتدا ارتقای پایگاه را اجرا کنید.');
 $sessionId=relational_id($body['session_id']??null,'جلسه');
 $rows=$body['records']??null;
 school_require(is_array($rows)&&array_is_list($rows)&&$rows&&count($rows)<=500,'فهرست حضور معتبر نیست.');
 $session=relational_session($db,$sessionId);
 school_require($session!==null,'جلسه پیدا نشد.');
 $offering=relational_offering($db,$session['offering_id']);
 school_require($offering!==null,'درس جلسه پیدا نشد.');
 $state=central_load()['state'];
 desk_assert_attendance($user,$offering,$state);
 $actor=school_actor($user);
 $teacherOnly=$actor==='teacher:'.(string)($offering['teacher_id']??'');
 $enrolled=relational_enrolled_set($db,$offering);
 $db->beginTransaction();
 try{
  // Office/admin may only change attendance; asked/note stay with the teacher desk.
  $write=$teacherOnly
   ?$db->prepare('INSERT INTO pdm_session_records (session_id,student_id,attendance,asked,note) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE attendance=VALUES(attendance),asked=VALUES(asked),note=VALUES(note)')
   :$db->prepare('INSERT INTO pdm_session_records (session_id,student_id,attendance,asked,note) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE attendance=VALUES(attendance)');
  foreach($rows as $row){
   school_require(is_array($row),'ردیف حضور معتبر نیست.');
   $student=relational_id($row['student_id']??null,'دانش‌آموز');
   school_require(isset($enrolled[$student]),'دانش‌آموز عضو این کلاس نیست.');
   $write->execute([$sessionId,$student,relational_attendance($row['attendance']??''),$teacherOnly&&!empty($row['asked'])?1:0,$teacherOnly?relational_note($row['note']??''):'']);
  }
  $dispatch=relational_dispatch_if_complete($db,$sessionId,(int)$user['id']);
  $db->commit();
 }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
 $out=['ok'=>true,'dispatch'=>$dispatch['item']??null];
 if(isset($dispatch['revision']))$out['revision']=$dispatch['revision'];
 return $out;
}

function desk_save_marks(array $user,array $body): array {
 $db=db();
 school_require(relational_ready($db),'ابتدا ارتقای پایگاه را اجرا کنید.');
 $sessionId=relational_id($body['session_id']??null,'جلسه');
 $student=relational_id($body['student_id']??null,'دانش‌آموز');
 $marks=$body['marks']??null;
 school_require(is_array($marks)&&array_is_list($marks)&&count($marks)<=100,'فهرست نمره معتبر نیست.');
 $session=relational_session($db,$sessionId);
 school_require($session!==null,'جلسه پیدا نشد.');
 $offering=relational_offering($db,$session['offering_id']);
 school_require($offering!==null,'درس جلسه پیدا نشد.');
 desk_assert_teacher($user,$offering);
 school_require(isset(relational_enrolled_set($db,$offering)[$student]),'دانش‌آموز عضو این کلاس نیست.');
 $modules=json_decode((string)$offering['modules'],true);
 $cap=(int)($modules[(int)$session['module_index']]['competencies']??1);
 school_require(grade_audit_ready($db),'جدول سابقهٔ نمره هنوز ساخته نشده است. صفحهٔ به‌روزرسانی پایگاه را یک‌بار اجرا کنید.');
 $db->beginTransaction();
 try{
  $db->prepare('INSERT INTO pdm_session_records (session_id,student_id,attendance,asked,note) VALUES (?,?,\'unset\',0,\'\') ON DUPLICATE KEY UPDATE student_id=student_id')->execute([$sessionId,$student]);
  $find=$db->prepare('SELECT id FROM pdm_session_records WHERE session_id=? AND student_id=?');
  $find->execute([$sessionId,$student]);
  $recordId=(int)$find->fetchColumn();
  $previous=$db->prepare('SELECT client_id,type,value,max_val,note,competency FROM pdm_session_marks WHERE record_id=? ORDER BY id');
  $previous->execute([$recordId]);
  $oldMarks=[];
  foreach($previous->fetchAll() as $mark)$oldMarks[]=['id'=>$mark['client_id'],'type'=>$mark['type'],'value'=>(float)$mark['value'],'max'=>(float)$mark['max_val'],'note'=>(string)($mark['note']??''),'competency'=>(int)$mark['competency']];
  $db->prepare('DELETE FROM pdm_session_marks WHERE record_id=?')->execute([$recordId]);
  $seen=[];
  $stored=[];
  foreach($marks as $mark){
   school_require(is_array($mark),'نمره معتبر نیست.');
   $competency=(int)($mark['competency']??1);
   school_require($competency>=1&&$competency<=max(1,$cap),'شایستگی نمره خارج از پودمان است.');
   $client=relational_id($mark['id']??school_id(),'شناسه نمره');
   school_require(!isset($seen[$client]),'شناسه نمره تکراری است.');
   $seen[$client]=true;
   $mark['id']=$client;
   $mark['competency']=$competency;
   relational_insert_mark($db,$recordId,$mark);
   $stored[]=['id'=>$client,'type'=>relational_text($mark['type']??'',100,'نوع نمره'),'value'=>(float)relational_numeric($mark['value']??0),'max'=>(float)relational_numeric($mark['max']??20),'note'=>relational_note($mark['note']??''),'competency'=>$competency];
  }
  $oldValue=['session_id'=>$sessionId,'marks'=>$oldMarks];
  $newValue=['session_id'=>$sessionId,'marks'=>$stored];
  if(grade_json($oldValue)!==grade_json($newValue))grade_audit_write($db,$offering['id'],(int)$session['module_index'],$student,school_actor($user),'session_mark',$oldValue,$newValue);
  $db->commit();
 }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
 return ['ok'=>true];
}

function desk_save_final(array $user,array $body): array {
 $db=db();
 school_require(relational_ready($db),'ابتدا ارتقای پایگاه را اجرا کنید.');
 $offeringId=relational_id($body['offering_id']??null,'درس');
 $offering=relational_offering($db,$offeringId);
 school_require($offering!==null,'درس پیدا نشد.');
 desk_assert_teacher($user,$offering);
 $student=relational_id($body['student_id']??null,'دانش‌آموز');
 school_require(isset(relational_enrolled_set($db,$offering)[$student]),'دانش‌آموز عضو این کلاس نیست.');
 $module=relational_module($body['module_index']??null);
 $competencies=$body['competencies']??[null,null];
 school_require(is_array($competencies),'شایستگی‌ها معتبر نیستند.');
 $final=['continuous'=>$body['continuous']??null,'competencies'=>[$competencies[0]??null,$competencies[1]??null],'competency'=>$body['final_competency']??$body['competency']??null,'total'=>$body['total']??null,'note'=>$body['note']??''];
 $prior=$db->prepare('SELECT continuous,competency1,competency2,final_competency,total,note FROM pdm_finals WHERE offering_id=? AND module_index=? AND student_id=?');
 $prior->execute([$offeringId,$module,$student]);
 $row=$prior->fetch();
 $oldValue=$row?['continuous'=>$row['continuous']===null?null:(float)$row['continuous'],'competencies'=>[$row['competency1']===null?null:(int)$row['competency1'],$row['competency2']===null?null:(int)$row['competency2']],'competency'=>$row['final_competency']===null?null:(int)$row['final_competency'],'total'=>$row['total']===null?null:(float)$row['total'],'note'=>(string)($row['note']??'')]:null;
 school_require(grade_audit_ready($db),'جدول سابقهٔ نمره هنوز ساخته نشده است. صفحهٔ به‌روزرسانی پایگاه را یک‌بار اجرا کنید.');
 $db->beginTransaction();
 try{
  relational_upsert_final_key($db,$offeringId.':'.$module.':'.$student,$final);
  $newValue=['continuous'=>$final['continuous'],'competencies'=>$final['competencies'],'competency'=>$final['competency'],'total'=>$final['total'],'note'=>(string)$final['note']];
  if(grade_json($oldValue)!==grade_json($newValue))grade_audit_write($db,$offeringId,$module,$student,school_actor($user),'final_grade',$oldValue,$newValue);
  $db->commit();
 }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
 return ['ok'=>true];
}

/** @return null|array{item:array,revision:int} */
function relational_dispatch_if_complete(PDO $db,string $sessionId,int $actorId=0): ?array {
 $session=relational_session($db,$sessionId);
 $offering=$session?relational_offering($db,$session['offering_id']):null;
 if(!$session||!$offering)return null;
 $q=$db->prepare("SELECT s.id,s.name FROM pdm_students s JOIN pdm_enrollments e ON e.student_id=s.id AND e.status='active' AND e.class_id=? AND e.year_id=? ORDER BY e.id");
 $q->execute([$offering['class_id'],$offering['year_id']]);
 $students=$q->fetchAll();
 if(!$students)return null;
 $have=$db->prepare('SELECT student_id,attendance FROM pdm_session_records WHERE session_id=?');
 $have->execute([$sessionId]);
 $status=[];
 foreach($have->fetchAll() as $row)$status[$row['student_id']]=$row['attendance'];
 $rows=[];
 foreach($students as $student){
  $value=$status[$student['id']]??'unset';
  if($value==='unset')return null;
  $rows[]=['id'=>$student['id'],'name'=>$student['name'],'status'=>$value];
 }
 $signature=hash('sha256',json_encode($rows,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR));
 $loaded=central_load(true);
 $state=$loaded['state'];
 $life=&$state['life'];
 $index=null;
 foreach($life['dispatches']??[] as $i=>$item)if(($item['sessionId']??'')===$sessionId){$index=$i;break;}
 if($index!==null&&($life['dispatches'][$index]['signature']??'')===$signature)return null;
 $to=$life['routes'][$offering['class_id']]??$life['routes']['default']??'admin';
 if(!school_can($life,(string)$to,'office'))$to='admin';
 $old=$index===null?null:$life['dispatches'][$index];
 $followups=$old['followups']??[];
 foreach($rows as $row)if(isset($followups[$row['id']])&&(($old['rows']??[])?relational_row_status($old['rows'],$row['id']):null)!==$row['status'])$followups[$row['id']]['status']='open';
 $item=['id'=>$old['id']??school_id(),'sessionId'=>$sessionId,'yearId'=>$offering['year_id'],'to'=>$to,'revision'=>(int)($old['revision']??0)+1,'signature'=>$signature,'date'=>substr((string)$session['date'],0,10),'title'=>$offering['class_name'].' · '.$offering['name'],'rows'=>$rows,'followups'=>$followups?:new stdClass()];
 if($index===null)$life['dispatches'][]=$item;else $life['dispatches'][$index]=$item;
 school_notify($life,$to,'حضور‌وغیاب آماده پیگیری است',$item['title'],'hub-followup');
 $state['life']=$life;
 $prevRevision=(int)$loaded['revision'];
 // Mirror normal save: snapshot history before bumping so clients can rebase instead of hard-locking on 409.
 $db->prepare('INSERT INTO pdm_school_history(revision,actor_id,payload) VALUES(?,?,?)')->execute([$prevRevision,$actorId,json_encode(school_wire($loaded['state']),JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);
 $db->prepare('UPDATE pdm_school SET payload=?,revision=revision+1 WHERE id=1')->execute([json_encode(school_wire($state),JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);
 $db->exec('DELETE FROM pdm_school_history WHERE id < (SELECT cut FROM (SELECT COALESCE(MAX(id),0)-100 AS cut FROM pdm_school_history) AS keep_history)');
 return ['item'=>$item,'revision'=>$prevRevision+1];
}

function relational_row_status(array $rows,string $id): ?string {
 foreach($rows as $row)if(($row['id']??'')===$id)return $row['status']??null;
 return null;
}

function relational_offering(PDO $db,string $id): ?array {
 $q=$db->prepare('SELECT o.*,c.name AS class_name,c.year_id,y.archived FROM pdm_offerings o JOIN pdm_classes c ON c.id=o.class_id JOIN pdm_years y ON y.id=c.year_id WHERE o.id=?');
 $q->execute([$id]);
 $row=$q->fetch();
 return $row?:null;
}

function relational_session(PDO $db,string $id): ?array {
 $q=$db->prepare('SELECT * FROM pdm_sessions WHERE id=?');
 $q->execute([$id]);
 $row=$q->fetch();
 return $row?:null;
}

function relational_enrolled_set(PDO $db,array $offering): array {
 $q=$db->prepare("SELECT student_id FROM pdm_enrollments WHERE status='active' AND class_id=? AND year_id=?");
 $q->execute([$offering['class_id'],$offering['year_id']]);
 $set=[];
 foreach($q->fetchAll() as $row)$set[$row['student_id']]=true;
 return $set;
}

function desk_assert_view(array $user,array $offering,array $state): void {
 $actor=school_actor($user);
 if($actor==='admin'||$actor==='deputy'||$actor==='teacher:'.(string)($offering['teacher_id']??''))return;
 if(school_can($state['life']??[],$actor,'grades')||school_can($state['life']??[],$actor,'office'))return;
 throw new InvalidArgumentException('مشاهدهٔ این درس برای شما مجاز نیست.');
}

function desk_assert_teacher(array $user,array $offering): void {
 if(!empty($offering['archived']))throw new InvalidArgumentException('سال بایگانی‌شده قابل تغییر نیست.');
 if(school_actor($user)!=='teacher:'.(string)($offering['teacher_id']??''))throw new InvalidArgumentException('نمره را فقط معلم همین درس می‌تواند ثبت کند.');
}

function desk_assert_attendance(array $user,array $offering,array $state): void {
 if(!empty($offering['archived']))throw new InvalidArgumentException('سال بایگانی‌شده قابل تغییر نیست.');
 $actor=school_actor($user);
 if($actor==='teacher:'.(string)($offering['teacher_id']??''))return;
 if($actor==='admin'||$actor==='deputy'||school_can($state['life']??[],$actor,'office'))return;
 throw new InvalidArgumentException('ثبت حضور این درس برای شما مجاز نیست.');
}

function relational_chars(string $value): int {return function_exists('mb_strlen')?mb_strlen($value,'UTF-8'):strlen($value);}

function relational_text(mixed $value,int $max,string $label): string {
 if(!is_string($value))throw new InvalidArgumentException($label.' معتبر نیست.');
 if(trim($value)===''||relational_chars($value)>$max)throw new InvalidArgumentException($label.' خالی یا بیش از حد طولانی است.');
 return $value;
}

function relational_note(mixed $value): string {
 if($value===null)return '';
 if(!is_string($value)||relational_chars($value)>2000)throw new InvalidArgumentException('یادداشت معتبر نیست.');
 return $value;
}

function relational_date(mixed $value): string {
 if(is_string($value))$value=relational_digits($value);
 if(!is_string($value)||!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/',$value,$m)||!checkdate((int)$m[2],(int)$m[3],(int)$m[1]))throw new InvalidArgumentException('تاریخ معتبر نیست.');
 return $value;
}

function relational_module(mixed $value): int {
 if(is_string($value))$value=relational_digits($value);
 if(is_string($value)&&preg_match('/^\d+$/',$value))$value=(int)$value;
 if(!is_int($value)||$value<0||$value>4)throw new InvalidArgumentException('شماره پودمان معتبر نیست.');
 return $value;
}

function relational_attendance(mixed $value): string {
 if(!is_string($value)||!in_array($value,['unset','present','absent','excused','late'],true))throw new InvalidArgumentException('وضعیت حضور معتبر نیست.');
 return $value;
}

function relational_tiny(mixed $value,int $min,int $max): ?int {
 if($value===null||$value==='')return null;
 if(is_string($value))$value=relational_digits($value);
 if(is_string($value)&&preg_match('/^\d+$/',$value))$value=(int)$value;
 if(!is_int($value)||$value<$min||$value>$max)throw new InvalidArgumentException('مقدار شایستگی معتبر نیست.');
 return $value;
}

function grade_json(mixed $value): string {return json_encode($value,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);}
function grade_audit_ready(PDO $db): bool {return (bool)$db->query("SHOW TABLES LIKE 'pdm_grade_audit'")->fetchColumn();}
function grade_client_ip(): string {$ip=(string)($_SERVER['REMOTE_ADDR']??'');return filter_var($ip,FILTER_VALIDATE_IP)?$ip:'';}
function grade_audit_write(PDO $db,string $offeringId,int $module,string $studentId,string $actor,string $action,mixed $old,array $new): void {
 school_require(in_array($action,['session_mark','final_grade'],true));
 $actor=relational_text($actor,64,'شناسه کاربر');
 $db->prepare('INSERT INTO pdm_grade_audit (offering_id,module_index,student_id,actor_id,action_type,old_value,new_value,ip_address) VALUES (?,?,?,?,?,?,?,?)')->execute([$offeringId,$module,$studentId,$actor,$action,$old===null?null:grade_json($old),grade_json($new),grade_client_ip()]);
}
function grade_actor_label(array $state,string $actor): string {
 if($actor==='admin')return 'مدیر';
 if($actor==='deputy')return 'معاون';
 if(str_starts_with($actor,'teacher:')){ $teacher=school_find($state['d']['teachers']??[],substr($actor,8));return (string)($teacher['name']??'معلم'); }
 $person=school_find($state['life']['people']??[],$actor);
 return (string)($person['name']??$actor);
}
function grade_audit_list(array $user,array $query): never {
 $db=db();
 school_require(grade_audit_ready($db),'جدول سابقهٔ نمره هنوز ساخته نشده است. صفحهٔ به‌روزرسانی پایگاه را یک‌بار اجرا کنید.');
 $offeringId=relational_id($query['offering_id']??null,'درس');
 $studentId=relational_id($query['student_id']??null,'دانش‌آموز');
 $module=relational_module($query['module_index']??null);
 $offering=relational_offering($db,$offeringId);
 school_require($offering!==null,'درس پیدا نشد.');
 $state=central_load()['state'];
 desk_assert_view($user,$offering,$state);
 school_require(!str_starts_with(school_actor($user),'student:'),'سابقهٔ تغییر نمره برای دانش‌آموز نمایش داده نمی‌شود.');
 $q=$db->prepare('SELECT action_type,actor_id,old_value,new_value,ip_address,created_at FROM pdm_grade_audit WHERE offering_id=? AND student_id=? AND module_index=? ORDER BY id DESC LIMIT 40');
 $q->execute([$offeringId,$studentId,$module]);
 $rows=[];
 foreach($q->fetchAll() as $row)$rows[]=['action'=>$row['action_type'],'actor'=>grade_actor_label($state,(string)$row['actor_id']),'old'=>json_decode((string)($row['old_value']??'null'),true),'new'=>json_decode((string)$row['new_value'],true),'ip'=>$row['ip_address'],'at'=>$row['created_at']];
 json_response(['rows'=>$rows]);
}
function relational_digits(string $value): string {
 return trim(strtr($value,['۰'=>'0','۱'=>'1','۲'=>'2','۳'=>'3','۴'=>'4','۵'=>'5','۶'=>'6','۷'=>'7','۸'=>'8','۹'=>'9','٠'=>'0','١'=>'1','٢'=>'2','٣'=>'3','٤'=>'4','٥'=>'5','٦'=>'6','٧'=>'7','٨'=>'8','٩'=>'9']));
}
function relational_numeric(mixed $value): int|float|null {
 if($value===null||$value==='')return null;
 if(is_int($value)||is_float($value)){if(!is_finite($value))throw new InvalidArgumentException('نمرهٔ عددی معتبر نیست.');return $value;}
 if(!is_string($value))throw new InvalidArgumentException('نمرهٔ عددی معتبر نیست.');
 $text=str_replace(['٫','٬',','],['.','',''],relational_digits($value));
 if($text===''||!is_numeric($text))throw new InvalidArgumentException('نمرهٔ عددی معتبر نیست.');
 return $text+0;
}
function relational_decimal(mixed $value,float $min,float $max): ?float {
 $value=relational_numeric($value);
 if($value===null)return null;
 if($value<$min||$value>$max)throw new InvalidArgumentException('نمره خارج از محدوده است.');
 return (float)$value;
}
