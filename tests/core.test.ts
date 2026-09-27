import assert from 'node:assert/strict';
import test from 'node:test';
import {blankFinal,evaluate,moduleVerdict,totalOf,type FinalGrade} from '../lib/model.ts';
import {detectSidaHeaders,sidaCompetency,sidaContinuous,sidaModuleSheet,sidaTotal} from '../lib/excel.ts';

function grade(patch:Partial<FinalGrade>):FinalGrade{return {...blankFinal(),...patch}}

test('totalOf builds the module score from continuous and competency',()=>{
 assert.equal(totalOf(grade({continuous:4,competency:3})),19);
 assert.equal(totalOf(grade({continuous:0,competency:1})),5);
 assert.equal(totalOf(grade({continuous:5,competency:2})),15);
 assert.equal(totalOf(grade({continuous:2.5,competency:2,total:18})),18);
 assert.equal(totalOf(grade({continuous:4,competency:null})),null);
 assert.equal(totalOf(grade({})),null);
});

test('each of the five modules passes or needs another evaluation on its own',()=>{
 const pass=12;
 const modules=[
  grade({continuous:4,competency:2}),
  grade({continuous:5,competency:3}),
  grade({continuous:1,competency:2}),
  grade({continuous:4,competency:1}),
  grade({total:12,competency:1}),
 ];
 assert.deepEqual(modules.map(item=>moduleVerdict(item,pass)),['قبولی','قبولی','نیاز به ارزشیابی مجدد','نیاز به ارزشیابی مجدد','قبولی']);
 assert.equal(moduleVerdict(grade({}),pass),'ثبت نشده');
 assert.equal(modules.length,5);
});

test('formula parser allows only its own tokens and stops division by zero',()=>{
 assert.equal(evaluate('avg / 4',{avg:16}),4);
 assert.equal(evaluate('min(workshop, 20) + attendance / 10',{workshop:18,attendance:100}),28);
 assert.equal(evaluate('if(count > 0, avg, 0)',{count:0,avg:10}),0);
 assert.throws(()=>evaluate('avg / 0',{avg:10}),/تقسیم بر صفر/);
 assert.throws(()=>evaluate('10 % 0',{}),/تقسیم بر صفر/);
 assert.throws(()=>evaluate('eval(avg)',{avg:1}),/غیرمجاز|ناشناخته/);
 assert.throws(()=>evaluate('avg.workshop',{avg:1}),/غیرمجاز/);
 assert.throws(()=>evaluate('window',{}),/ناشناخته/);
});

test('SIDA headers are found in any order and blank columns are ignored',()=>{
 const headers=['','رشته تحصیلی','نام خانوادگی','  ','کد دانش‌آموزی','نام پدر','پایه','نام'];
 const found=detectSidaHeaders(headers);
 assert.deepEqual(found,{name:7,last:2,code:4,father:5,major:1,grade:6});
 const swapped=detectSidaHeaders(['پایه','نام','کد دانش آموزی','نام‌خانوادگی']);
 assert.equal(swapped.grade,0);
 assert.equal(swapped.name,1);
 assert.equal(swapped.code,2);
 assert.equal(swapped.last,3);
 assert.ok(swapped.father<0);
});

test('SIDA grade sheet snaps continuous, competency and the final score',()=>{
 assert.equal(sidaContinuous(3.7),3.5);
 assert.equal(sidaContinuous(5.4),5);
 assert.equal(sidaContinuous(null),null);
 assert.equal(sidaCompetency(2),2);
 assert.equal(sidaCompetency(4),null);
 assert.equal(sidaTotal(21),20);
 const sheet=sidaModuleSheet([{name:'علی رضایی',code:'14050001'}],[{continuous:3.7,competency:2,total:14}]);
 assert.deepEqual(sheet[0],['کد دانش‌آموزی','نام و نام خانوادگی','نمره مستمر پودمان','نمره شایستگی','نمره نهایی پودمان']);
 assert.deepEqual(sheet[1],['14050001','علی رضایی',3.5,2,14]);
});
