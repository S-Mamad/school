import assert from 'node:assert/strict';
import test from 'node:test';
import {freezeDesk,mergeSchool,emptySchool,validateSchool} from '../server/rules.mjs';

test('freezeDesk keeps client title/date on known sessions but server records',()=>{
 const server={d:{sessions:[{id:'s1',courseId:'c1',module:0,date:'2026-01-01',title:'قدیمی',records:{a:{attendance:'present',asked:false,note:'',marks:[]}}}],finals:{'c1:0:a':{continuous:1}}},life:{}};
 const client={d:{sessions:[{id:'s1',courseId:'c1',module:0,date:'2026-02-02',title:'جدید',records:{a:{attendance:'absent',asked:true,note:'x',marks:[{id:'m1'}]}}},{id:'s2',courseId:'c1',module:0,date:'2026-03-03',title:'تازه',records:{}}],finals:{keep:1}},life:{}};
 const out=freezeDesk(server,structuredClone(client));
 assert.equal(out.d.sessions[0].title,'جدید');
 assert.equal(out.d.sessions[0].date,'2026-02-02');
 assert.equal(out.d.sessions[0].records.a.attendance,'present');
 assert.equal(out.d.sessions[1].id,'s2');
 assert.deepEqual(out.d.finals,{});
});

test('admin can rename school; teacher cannot',()=>{
 const base=emptySchool();
 base.d.schoolName='هنرستان الف';
 base.d.teachers=[{id:'t1',name:'معلم',email:'t@example.test',phone:'09123456789',active:true}];
 base.d.subjects=[{id:'sub1',name:'درس',kind:'general',gradeId:'g10',majorId:'all'}];
 base.d.majors=[{id:'m1',name:'کامپیوتر'}];
 base.d.classes=[{id:'c1',yearId:base.d.years[0].id,majorId:'m1',gradeId:'g10',section:'1',name:'کلاس'}];
 base.d.offerings=[{id:'o1',classId:'c1',subjectId:'sub1',name:'درس',teacherId:'t1',modules:Array.from({length:5},(_,i)=>({name:'پ'+i,competencies:1})),formula:{expression:'avg/4',minimum:10,high:14,round:0.5,pass:12}}];
 validateSchool(base);
 const asAdmin=mergeSchool(base,{d:{...structuredClone(base.d),schoolName:'هنرستان ب'},life:structuredClone(base.life)},'admin');
 assert.equal(asAdmin.d.schoolName,'هنرستان ب');
 assert.throws(()=>mergeSchool(base,{d:{...structuredClone(base.d),schoolName:'هنرستان ج'},life:structuredClone(base.life)},'teacher:t1'),/مدیر/);
});

test('id longer than 64 characters is rejected by mergeRows path',()=>{
 const base=emptySchool();
 base.d.majors=[{id:'m1',name:'کامپیوتر'}];
 const long='x'.repeat(65);
 assert.throws(()=>mergeSchool(base,{d:{...structuredClone(base.d),majors:[{id:long,name:'رشته'}]},life:structuredClone(base.life)},'admin'),/شناسه/);
});
