<?php
declare(strict_types=1);
require __DIR__.'/private/bootstrap.php';require __DIR__.'/private/migrations.php';
$error='';$success=false;$installed=is_file(__DIR__.'/private/config.php');
if($_SERVER['REQUEST_METHOD']==='POST'&&!$installed){
 $lock=null;
 try {
  csrf_check($_POST['csrf']??'');
  $keyFile=__DIR__.'/private/install-key.php';$expected=is_file($keyFile)?require $keyFile:'';
  if(!$expected||!hash_equals($expected,trim($_POST['install_key']??'')))throw new RuntimeException('کلید نصب نادرست است. کلید همراه بسته نصب را وارد کنید.');
  if(version_compare(PHP_VERSION,'8.2.0','<')||!extension_loaded('pdo_mysql')||!extension_loaded('fileinfo'))throw new RuntimeException('PHP 8.2 یا جدیدتر و افزونه‌های PDO MySQL و Fileinfo لازم است.');
  $lock=fopen(__DIR__.'/private/install.lock','x');if(!$lock)throw new RuntimeException('نصب دیگری در حال اجراست یا قفل نصب باقی مانده است.');
  $host=trim($_POST['db_host']??'localhost');$port=(int)($_POST['db_port']??3306);$database=trim($_POST['db_name']??'');$user=trim($_POST['db_user']??'');$pass=$_POST['db_pass']??'';
  if(!preg_match('/^[a-zA-Z0-9._-]+$/D',$host)||!preg_match('/^[a-zA-Z0-9_-]+$/D',$database)||$port<1||$port>65535||strlen($user)>190)throw new RuntimeException('نام میزبان یا پایگاه داده معتبر نیست.');
  $email=strtolower(trim($_POST['email']??''));$name=trim($_POST['name']??'');$password=password_check($_POST['password']??'');
  if(!filter_var($email,FILTER_VALIDATE_EMAIL)||strlen($email)>190||$name===''||strlen($name)>400)throw new RuntimeException('نام و ایمیل مدیر را درست وارد کنید.');
  $db=new PDO("mysql:host=$host;port=$port;dbname=$database;charset=utf8mb4",$user,$pass,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
  $exists=$db->query("SHOW TABLES LIKE 'pdm_users'")->fetchColumn();if($exists&&(int)$db->query('SELECT COUNT(*) FROM pdm_users')->fetchColumn()>0)throw new RuntimeException('این پایگاه داده قبلاً نصب شده است. فایل پیکربندی قبلی را بازیابی کنید.');
  migrate($db);$db->beginTransaction();$q=$db->prepare("INSERT INTO pdm_users (email,password_hash,role) VALUES (?,?,'admin')");$q->execute([$email,password_hash($password,PASSWORD_DEFAULT)]);$id=$db->lastInsertId();$q=$db->prepare('INSERT INTO pdm_workspaces (user_id,payload) VALUES (?,?)');$q->execute([$id,empty_payload($name)]);
  $config=['host'=>$host,'port'=>$port,'database'=>$database,'user'=>$user,'password'=>$pass];$temp=__DIR__.'/private/config.pending.php';$configFile=__DIR__.'/private/config.php';
  if(file_put_contents($temp,"<?php\nreturn ".var_export($config,true).";\n",LOCK_EX)===false)throw new RuntimeException('امکان نوشتن تنظیمات نیست؛ دسترسی پوشه private را بررسی کنید.');
  @chmod($temp,0600);
  if(!rename($temp,$configFile))throw new RuntimeException('ذخیره پیکربندی انجام نشد.');
  try{$db->commit();}catch(Throwable $e){@unlink($configFile);throw $e;}
  $success=true;$installed=true;fclose($lock);$lock=null;@unlink(__DIR__.'/private/install.lock');@unlink($keyFile);
 }catch(Throwable $e){if(isset($db)&&$db->inTransaction())$db->rollBack();if(is_resource($lock)){fclose($lock);@unlink(__DIR__.'/private/install.lock');}$error=$e instanceof PDOException?'اتصال یا ایجاد جداول انجام نشد. نام پایگاه داده، کاربر، رمز و دسترسی کاربر را بررسی کنید.':$e->getMessage();}
}
function h(string $s):string{return htmlspecialchars($s,ENT_QUOTES,'UTF-8');}
?><!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>نصب دفتر کلاسی آنلاین آذرمهر</title><link rel="icon" href="./favicon.svg"><link rel="stylesheet" href="./installer.css"></head><body><main><h1>نصب دفتر کلاسی آنلاین آذرمهر</h1><p>دفتر هوشمند معلم · طراحی سعید آذرمهر</p><?php if($installed):?><div class="success"><?= $success?'نصب با موفقیت انجام شد. با ایمیل و رمز مدیر وارد شوید.':'سامانه قبلاً نصب شده است. نصب مجدد قفل شده است.'?></div><a href="./">ورود به دفتر</a><?php else:?><p>ابتدا در کنترل‌پنل هاست یک پایگاه داده MySQL و کاربر دارای دسترسی بسازید. سپس اطلاعات زیر را وارد کنید.</p><?php if($error):?><div class="error"><?=h($error)?></div><?php endif;?><form method="post" autocomplete="off"><input type="hidden" name="csrf" value="<?=h($_SESSION['csrf'])?>"><label>کلید یک‌بارمصرف نصب (در فایل راهنمای بسته)<input name="install_key" required type="password"></label><h2>پایگاه داده</h2><div class="grid"><label>میزبان<input name="db_host" value="localhost" required dir="ltr"></label><label>درگاه<input name="db_port" type="number" value="3306" required></label><label>نام پایگاه داده<input name="db_name" required dir="ltr"></label><label>نام کاربر پایگاه داده<input name="db_user" required dir="ltr"></label></div><label>رمز پایگاه داده<input name="db_pass" type="password" required></label><h2>حساب مدیر مدرسه</h2><label>نام و نام خانوادگی<input name="name" required maxlength="100"></label><label>ایمیل ورود<input name="email" required type="email" dir="ltr"></label><label>رمز ورود (حداقل ۱۲ نویسه)<input name="password" required type="password" minlength="12" maxlength="72" autocomplete="new-password"></label><button>نصب و ایجاد حساب</button></form><small>PHP <?=h(PHP_VERSION)?> · PDO MySQL: <?=extension_loaded('pdo_mysql')?'فعال':'نیازمند فعال‌سازی'?></small><?php endif;?></main></body></html>
