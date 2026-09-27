<?php
declare(strict_types=1);
// Three-way merge independent edits; never silently overwrite the same field.
function school_rebase(mixed $base,mixed $mine,mixed $current): mixed {
 if($mine===$base)return $current;if($current===$base||$mine===$current)return $mine;
 if(!is_array($base)||!is_array($mine)||!is_array($current))throw new InvalidArgumentException('این بخش هم‌زمان ویرایش شده است؛ نسخه تازه را دریافت کنید.');
 $lists=array_is_list($base)&&array_is_list($mine)&&array_is_list($current);
 if($lists){foreach([...$base,...$mine,...$current] as $row)if(!is_array($row)||!isset($row['id']))throw new InvalidArgumentException('فهرست هم‌زمان تغییر کرده است.');
  $map=fn($rows)=>array_column($rows,null,'id');return array_values(school_rebase_maps($map($base),$map($mine),$map($current)));
 }
 return school_rebase_maps($base,$mine,$current);
}
function school_rebase_maps(array $base,array $mine,array $current): array {
 $out=$current;foreach(array_unique([...array_keys($base),...array_keys($mine)]) as $key){
  if(!array_key_exists($key,$mine)){if(array_key_exists($key,$base)&&($current[$key]??null)!==$base[$key])throw new InvalidArgumentException('حذف با تغییر هم‌زمان تداخل دارد.');unset($out[$key]);continue;}
  if(!array_key_exists($key,$base)){if(array_key_exists($key,$current)&&$mine[$key]!==$current[$key])throw new InvalidArgumentException('شناسه جدید هم‌زمان استفاده شده است.');$out[$key]=$mine[$key];continue;}
  $out[$key]=school_rebase($base[$key],$mine[$key],$current[$key]??null);
 }return $out;
}
