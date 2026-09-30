import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { emptySchool, hashPassword, schoolId, todayISO, validateSchool, verifyPassword } from './rules.mjs';

const root = process.env.SCHOOL_DATA_DIR || path.join(process.cwd(), '.local');
const file = path.join(root, 'school.json');

export const accountsFile = path.join(root, 'ACCOUNTS.txt');

export function demoAccounts() {
  return [
    { email: 'admin', password: 'Admin#Azarmehr1', role: 'admin', actorId: '', name: 'مدیر مدرسه' },
    { email: 'teacher', password: 'Teacher#Azarmehr1', role: 'teacher', actorId: 'teacher:t1', name: 'مریم رضایی' },
    { email: 'student1', password: 'Student#Azarmehr1', role: 'student', actorId: 'student:s1', name: 'علی رضایی' },
    { email: 'student2', password: 'Student#Azarmehr2', role: 'student', actorId: 'student:s2', name: 'سارا محمدی' },
  ];
}

function localPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = randomBytes(16);
  let out = 'Az';
  for (const byte of bytes) out += alphabet[byte % alphabet.length];
  return out + '9';
}

function openingAccounts() {
  if (process.env.SCHOOL_TEST === '1') return demoAccounts();
  return demoAccounts().map((account) => ({ ...account, password: localPassword() }));
}

function modules() {
  return ['حل مسئله و برنامه‌سازی', 'پیاده‌سازی الگوریتم', 'کار با داده‌ها', 'پایگاه داده', 'توسعه پروژه'].map((name) => ({ name, competencies: 2 }));
}

export function seedDocument() {
  const today = todayISO();
  const formula = { expression: 'avg / 4', minimum: 12, high: 18, round: 0.5, pass: 12 };
  const state = emptySchool();
  state.d.years = [{ id: 'y1', name: '۱۴۰۵–۱۴۰۶', archived: false }];
  state.d.majors = [{ id: 'computer', name: 'کامپیوتر' }];
  state.d.classes = [{ id: 'c1', yearId: 'y1', majorId: 'computer', gradeId: 'g11', section: '۱', name: 'یازدهم کامپیوتر / ۱' }];
  state.d.teachers = [{ id: 't1', name: 'مریم رضایی', email: 'teacher@azarmehr.test', phone: '09120000001', active: true }];
  state.d.students = [
    { id: 's1', name: 'علی رضایی', father: 'حسن', code: '1405001', phone: '09130000001' },
    { id: 's2', name: 'سارا محمدی', father: 'رضا', code: '1405002', phone: '09130000002' },
  ];
  state.d.enrollments = [
    { id: 'e1', yearId: 'y1', studentId: 's1', classId: 'c1', status: 'active' },
    { id: 'e2', yearId: 'y1', studentId: 's2', classId: 'c1', status: 'active' },
  ];
  state.d.subjects = [{ id: 'sub1', name: 'توسعه برنامه‌سازی و پایگاه داده', kind: 'technical', gradeId: 'g11', majorId: 'computer' }];
  state.d.offerings = [{
    id: 'o1', classId: 'c1', subjectId: 'sub1', teacherId: 't1', name: 'توسعه برنامه‌سازی و پایگاه داده',
    modules: modules(), formula, gradeScales: { 'کارگاهی': 20, 'پرسش شفاهی': 10, 'تکلیف': 5 },
  }];
  state.d.sessions = [{
    id: 'session1', courseId: 'o1', module: 0, date: today, title: 'آشنایی با حل مسئله',
    records: {
      s1: { attendance: 'unset', asked: false, note: '', marks: [] },
      s2: { attendance: 'unset', asked: false, note: '', marks: [] },
    },
  }];
  state.life.notices = [{ id: 'welcome', to: 'admin', title: 'مدرسه آماده است', body: 'یک معلم و دو دانش‌آموز آزمایشی به کلاس یازدهم کامپیوتر وصل شده‌اند.', page: 'hub-dashboard', date: today, read: false }];
  state.life.routes = { default: 'admin' };
  validateSchool(state);
  return state;
}

function fresh() {
  const accounts = openingAccounts();
  const users = accounts.map((account, index) => ({
    id: index + 1,
    email: account.email,
    passwordHash: hashPassword(account.password),
    role: account.role,
    actorId: account.actorId,
    phone: account.role === 'teacher' ? '09120000001' : '',
    active: true,
    authVersion: 1,
  }));
  mkdirSync(root, { recursive: true });
  const text = 'این فایل فقط روی همین رایانه است و نباید منتشر شود.\n' + accounts.map((account) => `${account.name}\t${account.email}\t${account.password}`).join('\n') + '\n';
  writeFileSync(accountsFile, text, { encoding: 'utf8', mode: 0o600 });
  return {
    revision: 1,
    state: seedDocument(),
    users,
    history: [],
    audit: [],
    sms: { provider: 'kavenegar', apiKey: '', sender: '', patternCode: '' },
    smsLogs: [],
    files: [],
  };
}

export function load() {
  if (!existsSync(file)) {
    const data = fresh();
    save(data);
    return data;
  }
  const data = JSON.parse(readFileSync(file, 'utf8'));
  if (process.env.SCHOOL_TEST !== '1') {
    for (const account of demoAccounts()) {
      const user = data.users?.find((row) => row.email === account.email);
      if (user && verifyPassword(account.password, user.passwordHash)) {
        console.warn('حساب محلی هنوز رمز آزمایشی شناخته‌شده دارد. از داخل برنامه رمز را عوض کنید. این سرور برای انتشار روی اینترنت نیست.');
        break;
      }
    }
  }
  return data;
}

export function save(data) {
  mkdirSync(root, { recursive: true });
  const temp = file + '.' + schoolId() + '.tmp';
  writeFileSync(temp, JSON.stringify(data));
  renameSync(temp, file);
}

let chain = Promise.resolve();
export function update(fn) {
  const run = chain.then(() => fn(load()));
  // Keep the write chain alive even if save fails, so later mutations still run.
  chain = run.then((data) => { if (data) save(data); }).catch(() => {});
  return run;
}
