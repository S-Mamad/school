<?php
declare(strict_types=1);
function invalid(string $message): never { throw new InvalidArgumentException($message); }
function txt(mixed $value, int $max=150, bool $required=false): void {
    if (!is_string($value) || strlen($value)>$max*4 || ($required && trim($value)==='')) invalid('متن واردشده معتبر نیست.');
}
function num(mixed $v, float $min, float $max, bool $nullable=false, ?float $step=null): void {
    if ($nullable && $v===null) return;
    if ((!is_int($v)&&!is_float($v)) || !is_finite((float)$v) || $v<$min || $v>$max || ($step!==null && abs($v/$step-round($v/$step))>0.00001)) invalid('نمره یا عدد خارج از محدوده مجاز است.');
}
function list_limit(mixed $v,int $max): void {if(!is_array($v)||!array_is_list($v)||count($v)>$max)invalid('تعداد یا ساختار رکوردها معتبر نیست.');}
function unique_ids(array $items): array {$out=[];foreach($items as $x){$id=$x['id']??null;if(!is_string($id)||!preg_match('/^[a-zA-Z0-9_-]{1,64}$/D',$id)||isset($out[$id]))invalid('شناسه نامعتبر یا تکراری است.');$out[$id]=$x;}return $out;}
function validate_data(mixed $d): void {
    if(!is_array($d)||($d['schema']??null)!==1)invalid('نسخه پشتیبان پشتیبانی نمی‌شود.');
    foreach(['name'=>100,'school'=>150,'year'=>30] as $k=>$max)txt($d['profile'][$k]??null,$max);
    list_limit($d['classes']??null,100); list_limit($d['students']??null,10000); list_limit($d['courses']??null,200); list_limit($d['sessions']??null,4000);
    $classes=unique_ids($d['classes']);$students=unique_ids($d['students']);$courses=unique_ids($d['courses']);unique_ids($d['sessions']);
    foreach($classes as $c){txt($c['name']??null,100,true);txt($c['grade']??null,30,true);txt($c['major']??null);txt($c['year']??null,30);}
    $codes=[];foreach($students as $s){txt($s['name']??null,150,true);txt($s['code']??null,40,true);if(isset($codes[$s['code']])||!isset($classes[$s['classId']??'']))invalid('کد تکراری یا کلاس نامعتبر است.');$codes[$s['code']]=true;}
    foreach($courses as $c){txt($c['name']??null,150,true);if(!isset($classes[$c['classId']??'']))invalid('کلاس درس وجود ندارد.');list_limit($c['modules']??null,5);if(count($c['modules'])!==5)invalid('درس باید پنج پودمان داشته باشد.');foreach($c['modules'] as $m){txt($m['name']??null,150,true);if(!in_array($m['competencies']??null,[1,2],true))invalid('تعداد شایستگی نامعتبر است.');}
        $scales=$c['gradeScales']??[];if(!is_array($scales)||count($scales)>7)invalid('بارم بخش‌ها معتبر نیست.');foreach($scales as $kind=>$max){if(!in_array($kind,['سرکلاسی','کارگاهی','پرسش کتبی','پرسش شفاهی','انضباط','ارائه','تکلیف'],true))invalid('بخش نمره‌دهی نامعتبر است.');num($max,0.01,1000);}
        $f=$c['formula']??[];txt($f['expression']??null,300,true);if(strlen($f['expression'])>300||!preg_match('/^[a-zA-Z_0-9\s.()+*\/,<>!=%\-]+$/D',$f['expression']))invalid('نویسه غیرمجاز در فرمول.');
        num($f['minimum']??null,0,20);num($f['high']??null,$f['minimum'],20);num($f['pass']??null,0,20);if(!in_array($f['round']??null,[0.5,1],true))invalid('گام گرد کردن معتبر نیست.');
    }
    $types=['سرکلاسی','کارگاهی','پرسش کتبی','پرسش شفاهی','انضباط','ارائه','تکلیف','مثبت','منفی'];
    foreach($d['sessions'] as $s){$c=$courses[$s['courseId']??'']??null;if(!$c)invalid('درس جلسه وجود ندارد.');num($s['module']??null,0,4,false,1);txt($s['title']??null,150,true);$date=$s['date']??'';if(!is_string($date)||!preg_match('/^\d{4}-\d{2}-\d{2}$/D',$date)||!checkdate((int)substr($date,5,2),(int)substr($date,8,2),(int)substr($date,0,4)))invalid('تاریخ معتبر نیست.');
        if(!is_array($s['records']??null)||count($s['records'])>10000)invalid('ساختار حضور معتبر نیست.');foreach($s['records'] as $sid=>$r){if(!isset($students[$sid]))invalid('دانش‌آموز جلسه وجود ندارد.');if(!in_array($r['attendance']??null,['unset','present','absent','excused','late'],true)||!is_bool($r['asked']??null))invalid('وضعیت حضور یا پرسش معتبر نیست.');txt($r['note']??null,2000);list_limit($r['marks']??null,100);unique_ids($r['marks']);foreach($r['marks'] as $m){if(!in_array($m['type']??null,$types,true))invalid('نوع ارزشیابی معتبر نیست.');$max=$m['max']??20;num($max,0.01,1000);num($m['value']??null,0,in_array($m['type'],['مثبت','منفی'],true)?1000:$max);num($m['competency']??null,1,$c['modules'][$s['module']]['competencies'],false,1);txt($m['note']??null,2000);}}
    }
    if(!is_array($d['finals']??null)||count($d['finals'])>50000)invalid('ساختار نمرات نهایی معتبر نیست.');foreach($d['finals'] as $key=>$f){$parts=explode(':',(string)$key);if(count($parts)!==3||!isset($courses[$parts[0]],$students[$parts[2]])||!preg_match('/^[0-4]$/D',$parts[1]))invalid('شناسه نمره نهایی معتبر نیست.');num($f['continuous']??null,0,5,true,.5);list_limit($f['competencies']??null,2);if(count($f['competencies'])!==2)invalid('ساختار شایستگی معتبر نیست.');foreach($f['competencies'] as $v)num($v,1,3,true,1);num($f['competency']??null,1,3,true,1);num($f['total']??null,0,20,true,.25);txt($f['note']??null,2000);}
}
