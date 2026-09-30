/** Permission checks aligned with host/private/central.php. Writes are judged against the server copy. */

export class SchoolError extends Error {
  constructor(message, status = 422) {
    super(message);
    this.status = status;
  }
}

const PERMISSIONS = ['structure', 'students', 'subjects', 'teachers', 'assign', 'grades', 'office', 'routing', 'sms', 'announce', 'promotion'];

import { randomBytes, createHash, scryptSync, timingSafeEqual } from 'node:crypto';

export function schoolId() {
  return randomBytes(16).toString('hex');
}

export function todayISO() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return ['year', 'month', 'day'].map((type) => parts.find((part) => part.type === type).value).join('-');
}

export function fail(condition, message = 'این تغییر در دسترسی شما نیست.', status = 422) {
  if (!condition) throw new SchoolError(message, status);
}

export function findRow(rows, id) {
  if (!Array.isArray(rows)) return null;
  return rows.find((row) => row && row.id === id) ?? null;
}

export function isList(value) {
  return Array.isArray(value);
}

function isPlain(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function same(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => same(item, b[index]));
  }
  if (isPlain(a) || isPlain(b)) {
    if (!isPlain(a) || !isPlain(b)) return false;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) if (!same(a[key] ?? null, b[key] ?? null)) return false;
    return true;
  }
  if (a === null || b === null || typeof a === 'boolean' || typeof b === 'boolean') return a === b;
  if (typeof a === 'number' && typeof b === 'number') return a === b;
  return a === b;
}

export function asMap(value) {
  if (isPlain(value)) return value;
  return {};
}

export function can(life, actor, permission) {
  if (actor === 'admin' || actor === 'deputy') return true;
  const person = findRow(life.people, actor);
  if (person?.roleId === 'deputy') return true;
  const role = findRow(life.roles, person?.roleId || '');
  return Array.isArray(role?.permissions) && role.permissions.includes(permission);
}

export function emptySchool() {
  return {
    d: {
      schoolName: 'هنرستان',
      years: [{ id: schoolId(), name: '۱۴۰۵–۱۴۰۶', archived: false }],
      majors: [], grades: [
        { id: 'g10', name: 'دهم', order: 10 },
        { id: 'g11', name: 'یازدهم', order: 11 },
        { id: 'g12', name: 'دوازدهم', order: 12 },
      ],
      classes: [], students: [], enrollments: [], teachers: [], subjects: [], offerings: [],
      sessions: [], finals: {}, incidents: [], attendanceFollowup: {}, customFields: [],
    },
    life: {
      roles: [], people: [], notices: [], messages: [], routes: { default: 'admin' }, dispatches: [],
      tasks: [], submissions: [], announcements: [], contacts: {}, sms: [],
      smsConfig: { provider: 'سرویس انتخاب نشده', sender: '' }, notificationPrefs: {},
    },
  };
}

export function actorOf(user) {
  return user?.role === 'admin' ? 'admin' : String(user?.actorId || '');
}

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  const actual = scryptSync(String(password), salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function passwordCheck(password) {
  fail(typeof password === 'string' && Buffer.byteLength(password) >= 12 && Buffer.byteLength(password) <= 72, 'رمز باید بین ۱۲ و ۷۲ بایت باشد.');
  return password;
}

function notify(life, to, title, body, page) {
  life.notices.push({ id: schoolId(), to, title, body, page, date: todayISO(), read: false });
}

function courseActive(d, id) {
  const offering = findRow(d.offerings, id);
  const classroom = offering ? findRow(d.classes, offering.classId) : null;
  const year = classroom ? findRow(d.years, classroom.yearId) : null;
  return !!(year && !year.archived);
}

function courseEdit(d, actor, courseId) {
  const offering = findRow(d.offerings, courseId);
  const classroom = offering ? findRow(d.classes, offering.classId) : null;
  const year = classroom ? findRow(d.years, classroom.yearId) : null;
  return !!(offering && year && !year.archived && actor === 'teacher:' + offering.teacherId);
}

function studentCourse(d, studentId, courseId) {
  const offering = findRow(d.offerings, courseId);
  const classroom = offering ? findRow(d.classes, offering.classId) : null;
  if (!classroom) return false;
  return d.enrollments.some((row) => row.studentId === studentId && row.classId === classroom.id && row.yearId === classroom.yearId && row.status === 'active');
}

function existsActor(d, life, id) {
  if (id === 'admin' || id === 'deputy') return true;
  if (findRow(life.people, id)) return true;
  if (id.startsWith('teacher:') && findRow(d.teachers, id.slice(8))) return true;
  if (id.startsWith('student:') && findRow(d.students, id.slice(8))) return true;
  return false;
}

function messageAllowed(d, life, from, to) {
  if (from === to || !existsActor(d, life, from) || !existsActor(d, life, to)) return false;
  const student = from.startsWith('student:') ? from : (to.startsWith('student:') ? to : '');
  const teacher = from.startsWith('teacher:') ? from : (to.startsWith('teacher:') ? to : '');
  if (!student) return true;
  const other = from === student ? to : from;
  if (other === 'admin' || other === 'deputy' || can(life, other, 'office')) return true;
  if (teacher) return d.offerings.some((offering) => 'teacher:' + offering.teacherId === teacher && studentCourse(d, student.slice(8), offering.id));
  return false;
}

function validDate(value) {
  if (typeof value !== 'string' || !/^(\d{4})-(\d{2})-(\d{2})$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function formulaOk(formula) {
  const expression = formula?.expression ?? '';
  fail(typeof expression === 'string' && expression.length <= 512 && /^[0-9a-zA-Z_+*\/%(),.<>!=\s-]+$/.test(expression), 'فرمول نمره معتبر نیست.');
  const names = expression.match(/[a-zA-Z_]+/g) || [];
  const allowed = ['avg', 'count', 'positive', 'negative', 'attendance', 'classwork', 'workshop', 'written', 'oral', 'discipline', 'presentation', 'homework', 'min', 'max', 'if', 'round'];
  fail(names.every((name) => allowed.includes(name)), 'متغیر فرمول شناخته‌شده نیست.');
  for (const key of ['minimum', 'high', 'pass']) fail(typeof formula?.[key] === 'number' && formula[key] >= 0 && formula[key] <= 20, 'حد فرمول معتبر نیست.');
  fail(formula.minimum <= formula.high && (formula.round === 0.5 || formula.round === 1), 'گردکردن فرمول معتبر نیست.');
}

export function validateSchool(state) {
  const d = state.d;
  const life = state.life;
  const schoolName = String(d.schoolName || 'هنرستان').trim();
  fail(schoolName && schoolName.length <= 150, 'نام مدرسه معتبر نیست.');
  const seen = new Set();
  for (const key of ['years', 'majors', 'grades', 'classes', 'students', 'teachers', 'subjects', 'offerings', 'enrollments', 'sessions', 'incidents', 'customFields']) {
    fail(Array.isArray(d[key]), 'ساختار داده معتبر نیست: ' + key);
    const ids = d[key].map((row) => row?.id);
    fail(new Set(ids).size === ids.length, 'شناسه تکراری است.');
  }
  for (const classroom of d.classes) fail(findRow(d.years, classroom.yearId) && findRow(d.majors, classroom.majorId) && findRow(d.grades, classroom.gradeId), 'رشته، پایه یا سال کلاس معتبر نیست.');
  for (const student of d.students) {
    const extra = asMap(student.extra);
    for (const [key, value] of Object.entries(extra)) {
      const field = findRow(d.customFields, key);
      fail(field && typeof value === 'string' && value.length <= 6000, 'مشخصه دانش‌آموز معتبر نیست.');
      if (value !== '') {
        if (field.type === 'number') fail(!Number.isNaN(Number(value)), 'مشخصه عددی معتبر نیست.');
        if (field.type === 'date') fail(validDate(value), 'تاریخ مشخصه معتبر نیست.');
      }
    }
    fail(student.name && student.father && student.code, 'نام، نام پدر و کد دانش‌آموز لازم است.');
    fail(!seen.has('code:' + student.code), 'کد دانش‌آموز تکراری است.');
    seen.add('code:' + student.code);
    fail(!student.phone || /^09[0-9]{9}$/.test(student.phone), 'شماره دانش‌آموز معتبر نیست.');
  }
  for (const field of d.customFields) fail(field.name && ['text', 'number', 'date'].includes(field.type) && typeof field.required === 'boolean', 'مشخصه دلخواه معتبر نیست.');
  for (const teacher of d.teachers) fail(teacher.name && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(teacher.email) && /^09[0-9]{9}$/.test(teacher.phone || ''), 'نام، ایمیل و شماره همراه معتبر معلم الزامی است.');
  for (const enrollment of d.enrollments) {
    fail(findRow(d.students, enrollment.studentId) && findRow(d.years, enrollment.yearId), 'پرونده ثبت‌نام نامعتبر است.');
    const key = enrollment.yearId + ':' + enrollment.studentId;
    fail(!seen.has(key), 'هر دانش‌آموز فقط یک ثبت‌نام در هر سال دارد.');
    seen.add(key);
    if (enrollment.status === 'active') {
      const classroom = findRow(d.classes, enrollment.classId);
      fail(classroom && classroom.yearId === enrollment.yearId, 'سال و کلاس ثبت‌نام سازگار نیستند.');
    } else fail(enrollment.status === 'graduated' && enrollment.classId === null, 'وضعیت فارغ‌التحصیلی معتبر نیست.');
  }
  for (const offering of d.offerings) {
    const classroom = findRow(d.classes, offering.classId);
    const subject = findRow(d.subjects, offering.subjectId);
    fail(classroom && subject && subject.gradeId === classroom.gradeId && (subject.majorId === 'all' || subject.majorId === classroom.majorId), 'درس با پایه و رشته کلاس سازگار نیست.');
    fail(!offering.teacherId || findRow(d.teachers, offering.teacherId), 'معلم درس معتبر نیست.');
    fail(Array.isArray(offering.modules) && offering.modules.length === 5, 'هر درس باید پنج پودمان داشته باشد.');
    for (const module of offering.modules) fail(module.competencies === 1 || module.competencies === 2, 'شایستگی پودمان معتبر نیست.');
    formulaOk(offering.formula || {});
  }
  for (const session of d.sessions) {
    const offering = findRow(d.offerings, session.courseId);
    fail(offering && Number.isInteger(session.module) && session.module >= 0 && session.module < 5 && validDate(session.date), 'جلسه معتبر نیست.');
    for (const [id, record] of Object.entries(asMap(session.records))) {
      fail(findRow(d.students, id) && ['unset', 'present', 'absent', 'late', 'excused'].includes(record.attendance), 'حضور جلسه معتبر نیست.');
      for (const mark of record.marks || []) {
        const max = mark.max ?? 20;
        const cap = offering.modules[session.module].competencies;
        fail(typeof mark.type === 'string' && mark.type.trim() && mark.type.length <= 100 && Number.isInteger(mark.competency) && mark.competency >= 1 && mark.competency <= cap, 'نوع یا شایستگی نمره معتبر نیست.');
        const ceiling = ['مثبت', 'منفی'].includes(mark.type) ? 1000 : max;
        fail(typeof max === 'number' && max > 0 && max <= 1000 && typeof mark.value === 'number' && mark.value >= 0 && mark.value <= ceiling, 'نمره با بارم سازگار نیست.');
      }
    }
  }
  for (const role of life.roles || []) fail(role.name && (role.permissions || []).every((item) => PERMISSIONS.includes(item)), 'دسترسی سمت نامعتبر است.');
}

function clone(value) {
  return structuredClone(value);
}

export function visibleSchool(state, actor) {
  const d = clone(state.d);
  const life = clone(state.life);
  const teacher = actor.startsWith('teacher:') ? actor.slice(8) : '';
  const student = actor.startsWith('student:') ? actor.slice(8) : '';
  const admin = actor === 'admin';
  const roster = admin || can(life, actor, 'students') || can(life, actor, 'office') || can(life, actor, 'grades');
  const classIds = [];
  if (teacher) for (const offering of d.offerings) if (offering.teacherId === teacher) classIds.push(offering.classId);
  if (student) for (const enrollment of d.enrollments) if (enrollment.studentId === student && enrollment.status === 'active') classIds.push(enrollment.classId);
  const courseIds = [];
  for (const offering of d.offerings) {
    const staffWide = !teacher && !student && (roster || can(life, actor, 'assign') || can(life, actor, 'subjects') || can(life, actor, 'structure'));
    if ((teacher && offering.teacherId === teacher) || (student && classIds.includes(offering.classId)) || staffWide) courseIds.push(offering.id);
  }
  const allClasses = !teacher && !student && (roster || can(life, actor, 'structure') || can(life, actor, 'assign') || can(life, actor, 'subjects'));
  d.classes = d.classes.filter((row) => allClasses || classIds.includes(row.id));
  d.offerings = d.offerings.filter((row) => courseIds.includes(row.id));
  d.enrollments = d.enrollments.filter((row) => student ? row.studentId === student : (roster || classIds.includes(row.classId)));
  const studentIds = d.enrollments.map((row) => row.studentId);
  d.students = d.students.filter((row) => roster || studentIds.includes(row.id));
  if (teacher || student) for (const row of d.students) { delete row.phone; delete row.extra; }
  const gradeRead = !!(teacher || student || can(life, actor, 'grades'));
  const office = can(life, actor, 'office');
  d.sessions = d.sessions.filter((row) => courseIds.includes(row.courseId) && (gradeRead || office));
  for (const session of d.sessions) {
    const records = asMap(session.records);
    for (const id of Object.keys(records)) {
      if (student && id !== student) delete records[id];
      else if (!gradeRead) { records[id].marks = []; records[id].note = ''; records[id].asked = false; }
    }
    session.records = records;
  }
  const finals = {};
  for (const [key, grade] of Object.entries(asMap(d.finals))) {
    const parts = key.split(':');
    if (gradeRead && parts.length === 3 && courseIds.includes(parts[0]) && (!student || parts[2] === student)) finals[key] = grade;
  }
  d.finals = finals;
  d.incidents = office ? d.incidents : [];
  d.attendanceFollowup = office ? asMap(d.attendanceFollowup) : {};
  if (!can(life, actor, 'teachers')) for (const teacherRow of d.teachers) delete teacherRow.phone;
  life.messages = (life.messages || []).filter((row) => row.from === actor || row.to === actor);
  life.notices = (life.notices || []).filter((row) => row.to === actor);
  life.dispatches = (life.dispatches || []).filter((row) => office && (admin || row.to === actor));
  life.tasks = (life.tasks || []).filter((row) => courseIds.includes(row.courseId) && (teacher || (student && row.published)));
  if (student) for (const task of life.tasks) for (const question of task.questions || []) delete question.correct;
  const taskIds = life.tasks.map((row) => row.id);
  life.submissions = (life.submissions || []).filter((row) => taskIds.includes(row.taskId) && (teacher || row.studentId === student));
  if (student) for (const submission of life.submissions) if (!submission.released) { submission.score = null; submission.feedback = ''; }
  life.contacts = can(life, actor, 'sms') || office ? asMap(life.contacts) : {};
  life.sms = can(life, actor, 'sms') ? (life.sms || []) : [];
  life.announcements = (life.announcements || []).filter((row) => row.audience === 'all' || (student ? row.audience === 'students' : row.audience === 'staff'));
  life.notificationPrefs = life.notificationPrefs?.[actor] ? { [actor]: life.notificationPrefs[actor] } : {};
  if (student) {
    life.roles = [];
    life.people = [];
    life.routes = { default: 'admin' };
    life.smsConfig = { provider: '', sender: '' };
    for (const teacherRow of d.teachers) { delete teacherRow.phone; delete teacherRow.email; }
  } else {
    if (!admin && !can(life, actor, 'teachers')) for (const teacherRow of d.teachers) { delete teacherRow.phone; delete teacherRow.email; }
    if (!admin && !can(life, actor, 'sms')) life.smsConfig = { provider: '', sender: '' };
    if (teacher) { life.roles = []; life.people = []; life.routes = { default: 'admin' }; }
  }
  return { d, life };
}

function idOk(id) {
  return typeof id === 'string' && /^[\p{L}\p{N}_:-]{1,64}$/u.test(id);
}

function only(oldRow, newRow, fields) {
  const keys = new Set([...Object.keys(oldRow || {}), ...Object.keys(newRow || {})]);
  for (const key of keys) if (!fields.includes(key)) fail(same(oldRow?.[key] ?? null, newRow?.[key] ?? null), 'تغییر فیلد محافظت‌شده مجاز نیست.');
}

function mergeRows(original, visible, incoming, check) {
  fail(Array.isArray(incoming) && incoming.length <= 20000, 'فهرست نامعتبر یا بیش از ظرفیت است.');
  const seen = new Set();
  for (const row of incoming) {
    fail(isPlain(row) && idOk(row.id), 'شناسه معتبر نیست.');
    fail(!seen.has(row.id), 'شناسه تکراری است.');
    seen.add(row.id);
    const old = findRow(original, row.id);
    const shown = findRow(visible, row.id);
    fail(!old || shown, 'این تغییر در دسترسی شما نیست.');
    if (shown && same(row, shown)) continue;
    const next = check(old, row);
    if (old) {
      const index = original.findIndex((item) => item.id === row.id);
      original[index] = next;
    } else original.push(next);
  }
  for (const row of visible || []) fail(seen.has(row.id), 'حذف مستقیم سوابق مجاز نیست.');
  return original;
}

function treeLimit(value, depth = 0, counter = { n: 0 }) {
  fail(++counter.n <= 80000 && depth <= 20, 'اطلاعات بیش از ظرفیت است.');
  if (typeof value === 'string') fail(value.length <= 20000, 'متن بیش از حد طولانی است.');
  else if (Array.isArray(value)) for (const item of value) treeLimit(item, depth + 1, counter);
  else if (isPlain(value)) {
    for (const [key, item] of Object.entries(value)) {
      fail(!['__proto__', 'constructor', 'prototype'].includes(key), 'کلید داده معتبر نیست.');
      treeLimit(item, depth + 1, counter);
    }
  } else if (typeof value === 'number') fail(Number.isFinite(value), 'عدد نامعتبر است.');
}

export function assertTree(value) {
  treeLimit(value);
}

function dispatchComplete(d, life, actor) {
  for (const session of d.sessions) {
    if (!courseEdit(d, actor, session.courseId)) continue;
    const offering = findRow(d.offerings, session.courseId);
    const classroom = findRow(d.classes, offering.classId);
    const rows = [];
    let complete = true;
    for (const enrollment of d.enrollments) {
      if (enrollment.classId !== classroom.id || enrollment.status !== 'active') continue;
      const status = asMap(session.records)[enrollment.studentId]?.attendance || 'unset';
      if (status === 'unset') complete = false;
      const student = findRow(d.students, enrollment.studentId);
      rows.push({ id: enrollment.studentId, name: student?.name || '', status });
    }
    if (!complete || !rows.length) continue;
    const signature = createHash('sha256').update(JSON.stringify(rows)).digest('hex');
    let index = life.dispatches.findIndex((item) => item.sessionId === session.id);
    if (index >= 0 && life.dispatches[index].signature === signature) continue;
    let to = life.routes?.[classroom.id] || life.routes?.default || 'admin';
    if (!can(life, to, 'office')) to = 'admin';
    const old = index < 0 ? null : life.dispatches[index];
    const followups = { ...(old?.followups || {}) };
    for (const row of rows) {
      const previous = (old?.rows || []).find((item) => item.id === row.id);
      if (followups[row.id] && previous && previous.status !== row.status) followups[row.id] = { ...followups[row.id], status: 'open' };
    }
    const item = {
      id: old?.id || schoolId(), sessionId: session.id, yearId: classroom.yearId, to,
      revision: (old?.revision || 0) + 1, signature, date: session.date,
      title: classroom.name + ' · ' + offering.name, rows, followups,
    };
    if (index < 0) life.dispatches.push(item);
    else life.dispatches[index] = item;
    notify(life, to, 'حضور‌وغیاب آماده پیگیری است', item.title, 'hub-followup');
  }
}

export function mergeSchool(state, input, actor) {
  fail(isPlain(input?.d) && isPlain(input?.life), 'ساختار درخواست معتبر نیست.');
  const visible = visibleSchool(state, actor);
  const d = clone(state.d);
  const life = clone(state.life);
  d.finals = asMap(d.finals);
  d.attendanceFollowup = asMap(d.attendanceFollowup);
  life.routes = asMap(life.routes);
  life.contacts = asMap(life.contacts);
  life.notificationPrefs = asMap(life.notificationPrefs);
  const nd = input.d;
  const nl = input.life;
  if (!d.schoolName || typeof d.schoolName !== 'string' || !String(d.schoolName).trim()) d.schoolName = 'هنرستان';
  const incomingName = String(nd.schoolName ?? d.schoolName).trim();
  if (incomingName !== String(d.schoolName).trim()) {
    fail(actor === 'admin', 'فقط مدیر می‌تواند نام مدرسه را تغییر دهد.');
    fail(incomingName && incomingName.length <= 150, 'نام مدرسه معتبر نیست.');
    d.schoolName = incomingName;
  }
  const permissions = { years: 'promotion', majors: 'structure', grades: 'structure', classes: 'structure', students: 'students', enrollments: 'students', teachers: 'teachers', subjects: 'subjects', customFields: 'students' };
  for (const [key, permission] of Object.entries(permissions)) {
    fail(Array.isArray(nd[key]), 'ساختار داده معتبر نیست: ' + key);
    d[key] = mergeRows(d[key], visible.d[key], nd[key], (old, row) => {
      if (key === 'classes' || key === 'enrollments') {
        const year = findRow(state.d.years, row.yearId);
        fail(!year || !year.archived, 'سال بایگانی‌شده قابل تغییر نیست.');
      }
      if (key === 'students') for (const field of state.d.customFields) if (field.required) fail(String(row.extra?.[field.id] || '').trim() !== '', 'مشخصه الزامی دانش‌آموز تکمیل نشده است.');
      fail(can(life, actor, permission) || ((key === 'classes' || key === 'enrollments') && can(life, actor, 'promotion')), 'این تغییر در دسترسی شما نیست.');
      if (key === 'enrollments' && old) only(old, row, ['classId', 'status']);
      if (key === 'classes' && old) only(old, row, ['name']);
      if (key === 'years' && old) fail(!old.archived || row.archived, 'بازکردن سال بایگانی‌شده مجاز نیست.');
      return row;
    });
  }
  const changed = new Set();
  d.offerings = mergeRows(d.offerings, visible.d.offerings, nd.offerings || [], (old, row) => {
    if (old && courseEdit(state.d, actor, old.id)) { only(old, row, ['modules', 'formula', 'gradeScales']); return row; }
    fail(can(life, actor, 'assign') || can(life, actor, 'subjects') || can(life, actor, 'structure') || can(life, actor, 'promotion'));
    if (old) only(old, row, ['teacherId', 'name']);
    else { fail(Array.isArray(row.modules) && row.modules.length === 5, 'هر درس باید پنج پودمان داشته باشد.'); fail(!findRow(state.d.offerings, row.id), 'شناسه درس تکراری است.'); }
    return row;
  });
  d.sessions = mergeRows(d.sessions, visible.d.sessions, nd.sessions || [], (old, row) => {
    const course = row.courseId || '';
    fail(courseActive(d, course), 'سال بایگانی‌شده قابل تغییر نیست.');
    const teacher = courseEdit(d, actor, course);
    fail(teacher || (can(life, actor, 'office') && old), 'این تغییر در دسترسی شما نیست.');
    row.records = asMap(row.records);
    if (old) {
      if (teacher) {
        only(old, row, ['records', 'title', 'date']);
        fail(typeof row.title === 'string' && row.title.trim() && validDate(row.date), 'عنوان و تاریخ جلسه معتبر نیست.');
        row.title = row.title.trim();
      } else only(old, row, ['records']);
    }
    if (!teacher) {
      fail(JSON.stringify(Object.keys(asMap(old.records))) === JSON.stringify(Object.keys(row.records)), 'حذف سابقه جلسه مجاز نیست.');
      const next = {};
      for (const [id, record] of Object.entries(row.records)) {
        const original = asMap(old.records)[id];
        const shown = can(life, actor, 'grades') ? original : { ...original, marks: [], note: '', asked: false };
        only(shown, record, ['attendance']);
        next[id] = { ...original, attendance: record.attendance };
      }
      row.records = next;
      return row;
    }
    for (const [id, record] of Object.entries(row.records)) {
      const before = asMap(old?.records)[id];
      if (same(before ?? null, record)) continue;
      fail(studentCourse(d, id, course), 'دانش‌آموز عضو این کلاس نیست.');
      if (!same(before?.marks || [], record.marks || [])) changed.add(id);
    }
    if (old) for (const id of Object.keys(asMap(old.records))) fail(id in row.records, 'حذف سابقه جلسه مجاز نیست.');
    return row;
  });
  for (const [key, grade] of Object.entries(asMap(nd.finals))) {
    if (same(asMap(visible.d.finals)[key] ?? null, grade)) continue;
    const parts = key.split(':');
    fail(parts.length === 3 && courseEdit(state.d, actor, parts[0]) && studentCourse(state.d, parts[2], parts[0]) && /^\d+$/.test(parts[1]) && Number(parts[1]) < 5, 'نمره پودمانی نامعتبر است.');
    for (const [field, max] of Object.entries({ continuous: 5, competency: 3, total: 20 })) {
      const value = grade[field] ?? null;
      fail(value === null || (typeof value === 'number' && value >= 0 && value <= max), 'نمره پودمانی نامعتبر است.');
    }
    for (const value of grade.competencies || []) fail(value === null || [1, 2, 3].includes(value), 'شایستگی پودمان معتبر نیست.');
    d.finals[key] = grade;
    changed.add(parts[2]);
  }
  d.incidents = mergeRows(d.incidents, visible.d.incidents, nd.incidents || [], (old, row) => {
    const teaches = actor.startsWith('teacher:') && d.offerings.some((offering) => offering.classId === row.classId && actor === 'teacher:' + offering.teacherId);
    fail(can(life, actor, 'office') || (!old && teaches));
    if (old) only(old, row, ['title', 'detail', 'followup', 'status', 'date']);
    else { row.author = actor; if (!can(life, actor, 'office')) { row.followup = ''; row.status = 'open'; } }
    fail(['open', 'in_progress', 'resolved'].includes(row.status) && validDate(row.date), 'گزارش انضباطی معتبر نیست.');
    return row;
  });
  if (!same(asMap(nd.attendanceFollowup), asMap(visible.d.attendanceFollowup))) {
    fail(can(life, actor, 'office'));
    d.attendanceFollowup = { ...d.attendanceFollowup, ...asMap(nd.attendanceFollowup) };
  }
  for (const key of ['roles', 'people']) {
    life[key] = mergeRows(life[key], visible.life[key], nl[key] || [], (old, row) => {
      fail(actor === 'admin', 'فقط مدیر');
      if (key === 'roles') fail(row.id !== 'deputy', 'شناسه سمت deputy رزرو شده است.');
      if (key === 'people') fail(String(row.id).startsWith('staff:') || old, 'شناسه کاربر اداری معتبر نیست.');
      return row;
    });
  }
  if (!same(asMap(nl.routes), asMap(visible.life.routes))) {
    fail(can(life, actor, 'routing'));
    for (const to of Object.values(asMap(nl.routes))) fail(can(life, to, 'office'), 'مسئول انتخاب‌شده مجوز پیگیری ندارد.');
    life.routes = asMap(nl.routes);
  }
  life.messages = mergeRows(life.messages, visible.life.messages, nl.messages || [], (old, row) => {
    if (old) { fail(old.to === actor); only(old, row, ['read']); old.read = true; return old; }
    fail(row.from === actor && messageAllowed(d, life, actor, row.to) && String(row.text || '').trim(), 'ارسال این پیام مجاز نیست.');
    const message = { id: row.id, from: actor, to: row.to, text: String(row.text).trim(), date: todayISO(), read: false };
    notify(life, message.to, 'پیام جدید', 'پیام تازه‌ای دریافت کرده‌اید.', 'hub-messages');
    return message;
  });
  for (const notice of nl.notices || []) {
    for (const stored of life.notices) if (stored.id === notice.id && stored.to === actor && notice.read) stored.read = true;
  }
  for (const [id, pref] of Object.entries(asMap(nl.notificationPrefs))) {
    fail(id === actor, 'تنظیم اعلان دیگران مجاز نیست.');
    life.notificationPrefs[id] = { messages: pref?.messages !== false, learning: pref?.learning !== false };
  }
  life.tasks = mergeRows(life.tasks, visible.life.tasks, nl.tasks || [], (old, row) => {
    if (old) {
      fail(courseEdit(d, actor, old.courseId || ''), 'ویرایش این فعالیت مجاز نیست.');
      only(old, row, ['title', 'body', 'due']);
      fail(validDate(row.due) && String(row.title || '').trim() && String(row.body || '').trim(), 'درس، عنوان، شرح و مهلت را کامل کنید');
      old.title = String(row.title).trim();
      old.body = String(row.body).trim();
      old.due = row.due;
      return old;
    }
    fail(courseEdit(d, actor, row.courseId || ''), 'ویرایش فعالیت منتشرشده مجاز نیست.');
    fail(['assignment', 'quiz'].includes(row.kind) && validDate(row.due) && typeof row.max === 'number' && row.max > 0 && row.max <= 1000 && String(row.title || '').trim() && String(row.body || '').trim(), 'درس، عنوان، شرح و مهلت را کامل کنید');
    if (row.kind === 'quiz') {
      fail(Array.isArray(row.questions) && row.questions.length > 0 && row.questions.length <= 100, 'برای هر پرسش، متن، چهار گزینه و پاسخ صحیح لازم است');
      for (const question of row.questions) fail(Array.isArray(question.options) && question.options.length === 4 && Number.isInteger(question.correct) && question.correct >= 0 && question.correct < 4 && String(question.text || '').trim() && question.options.every((option) => String(option).trim()), 'برای هر پرسش، متن، چهار گزینه و پاسخ صحیح لازم است');
    }
    row.published = true;
    for (const student of d.students) if (studentCourse(d, student.id, row.courseId)) notify(life, 'student:' + student.id, 'فعالیت آموزشی جدید', row.title, 'hub-learning');
    return row;
  });
  life.submissions = mergeRows(life.submissions, visible.life.submissions, nl.submissions || [], (old, row) => {
    const task = findRow(life.tasks, row.taskId || '');
    fail(task, 'دسترسی به تکلیف ندارید');
    const student = actor.startsWith('student:') ? actor.slice(8) : '';
    if (student) {
      fail(row.studentId === student && courseActive(d, task.courseId) && studentCourse(d, student, task.courseId) && task.published && task.due >= todayISO(), 'دسترسی به تکلیف ندارید');
      fail(!old || (!old.released && task.kind === 'assignment'), 'پاسخ نهایی شده است');
      if (old) only(old, row, ['text', 'file', 'answers', 'date', 'score', 'feedback', 'released']);
      for (const submission of life.submissions) fail(submission.id === row.id || submission.taskId !== task.id || submission.studentId !== student, 'پاسخ قبلاً ثبت شده است.');
      row.date = todayISO();
      row.score = null;
      row.feedback = '';
      row.released = false;
      row.answers = asMap(row.answers);
      if (task.kind === 'quiz') {
        let correct = 0;
        for (const question of task.questions) {
          const answer = row.answers[question.id];
          fail(Number.isInteger(answer) && answer >= 0 && answer < 4, 'پاسخ همه پرسش‌ها لازم است.');
          if (answer === question.correct) correct += 1;
        }
        row.score = Math.round(correct / task.questions.length * task.max * 100) / 100;
        row.released = true;
      } else fail(String(row.text || '').trim() || row.file, 'پاسخ یا فایل پیوست لازم است');
      if (row.file) fail(/^\.\/school-api\.php\?action=attachment&id=[a-f0-9]{32}$/.test(row.file.url || ''), 'فایل باید از مسیر امن بارگذاری شود.');
      const offering = findRow(d.offerings, task.courseId);
      notify(life, 'teacher:' + offering.teacherId, 'پاسخ جدید دانش‌آموز', task.title, 'hub-learning');
      if (row.released) notify(life, actor, 'نتیجه آزمون آماده است', task.title, 'hub-grades');
      return row;
    }
    fail(old && courseEdit(d, actor, task.courseId), 'فقط معلم این درس می‌تواند ارزیابی کند');
    only(old, row, ['score', 'feedback', 'released']);
    fail(typeof row.score === 'number' && row.score >= 0 && row.score <= task.max, 'نمره باید بین صفر و بارم باشد');
    row.released = true;
    notify(life, 'student:' + row.studentId, 'نمره و بازخورد جدید', task.title, 'hub-grades');
    return row;
  });
  for (const [id, contact] of Object.entries(asMap(nl.contacts))) {
    if (same(asMap(visible.life.contacts)[id] ?? null, contact)) continue;
    fail(can(life, actor, 'sms') || can(life, actor, 'office'));
    fail(['family', 'teacher', 'student'].includes(contact.group) && /^09[0-9]{9}$/.test(contact.phone || '') && String(contact.name || '').trim(), 'نام و شماره همراه ۱۱ رقمی معتبر لازم است');
    life.contacts[id] = contact;
  }
  life.announcements = mergeRows(life.announcements, visible.life.announcements, nl.announcements || [], (old, row) => {
    fail(!old && can(life, actor, 'announce') && String(row.title || '').trim() && String(row.body || '').trim() && ['all', 'students', 'staff'].includes(row.audience), 'عنوان، متن و دسترسی انتشار لازم است');
    row.by = actor;
    row.date = todayISO();
    const targets = ['admin', 'deputy', ...life.people.map((person) => person.id), ...d.teachers.map((teacher) => 'teacher:' + teacher.id), ...d.students.map((student) => 'student:' + student.id)];
    for (const to of targets) if (to !== actor && (row.audience === 'all' || (row.audience === 'students') === to.startsWith('student:'))) notify(life, to, 'اطلاعیه مدرسه', row.title, 'hub-news');
    return row;
  });
  if (!same(nl.smsConfig ?? {}, visible.life.smsConfig ?? {})) {
    fail(can(life, actor, 'sms'));
    life.smsConfig = { provider: String(nl.smsConfig?.provider || ''), sender: String(nl.smsConfig?.sender || '') };
  }
  for (const row of nl.dispatches || []) {
    const old = findRow(life.dispatches, row.id);
    if (!old || same(old, row)) continue;
    fail(can(life, actor, 'office') && (actor === 'admin' || old.to === actor));
    only(old, row, ['followups']);
    old.followups = asMap(row.followups);
  }
  for (const id of changed) notify(life, 'student:' + id, 'نمره دفتر به‌روزرسانی شد', 'ارزشیابی تازه‌ای در دفتر کلاس ثبت شده است.', 'hub-grades');
  dispatchComplete(d, life, actor);
  const result = { d, life };
  validateSchool(result);
  return result;
}

export function freezeDesk(server, client) {
  if (!isPlain(client?.d) || !isPlain(server?.d)) return client;
  const known = new Map((server.d.sessions || []).filter((session) => session?.id).map((session) => [session.id, session]));
  client.d.sessions = (client.d.sessions || []).filter((session) => session?.id).map((session) => {
    const serverSession = known.get(session.id);
    if (!serverSession) return session;
    return {
      ...serverSession,
      title: typeof session.title === 'string' ? session.title : serverSession.title,
      date: typeof session.date === 'string' ? session.date : serverSession.date,
    };
  });
  client.d.finals = {};
  return client;
}

function rebaseMaps(base, mine, current) {
  const out = { ...current };
  const keys = new Set([...Object.keys(base || {}), ...Object.keys(mine || {})]);
  for (const key of keys) {
    if (!(key in (mine || {}))) {
      if (key in (base || {}) && !same(current?.[key] ?? null, base[key])) throw new SchoolError('حذف با تغییر هم‌زمان تداخل دارد.', 409);
      delete out[key];
      continue;
    }
    if (!(key in (base || {}))) {
      if (key in (current || {}) && !same(mine[key], current[key])) throw new SchoolError('شناسه جدید هم‌زمان استفاده شده است.', 409);
      out[key] = mine[key];
      continue;
    }
    out[key] = rebase(base[key], mine[key], current?.[key] ?? null);
  }
  return out;
}

export function rebase(base, mine, current) {
  if (same(mine, base)) return current;
  if (same(current, base) || same(mine, current)) return mine;
  if (!isPlain(base) && !Array.isArray(base)) throw new SchoolError('این بخش هم‌زمان ویرایش شده است؛ نسخه تازه را دریافت کنید.', 409);
  if (Array.isArray(base) && Array.isArray(mine) && Array.isArray(current)) {
    for (const row of [...base, ...mine, ...current]) if (!isPlain(row) || !('id' in row)) throw new SchoolError('فهرست هم‌زمان تغییر کرده است.', 409);
    const map = (rows) => Object.fromEntries(rows.map((row) => [row.id, row]));
    return Object.values(rebaseMaps(map(base), map(mine), map(current)));
  }
  if (!isPlain(base) || !isPlain(mine) || !isPlain(current)) throw new SchoolError('این بخش هم‌زمان ویرایش شده است؛ نسخه تازه را دریافت کنید.', 409);
  return rebaseMaps(base, mine, current);
}

export function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}
