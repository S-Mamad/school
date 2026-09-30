import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { load, update } from './store.mjs';
import { captchaSvg, normalizeCaptcha, randomCode } from './captcha.mjs';
import {
  SchoolError, actorOf, assertTree, can, fail, findRow, freezeDesk, hashPassword, mergeSchool,
  passwordCheck, rebase, same, schoolId, sha256, todayISO, verifyPassword, visibleSchool, asMap,
} from './rules.mjs';

if (process.env.NODE_ENV === 'production') {
  console.error('این سرور فایل‌محور فقط برای توسعه روی همین رایانه است. نصب مدرسه با install.php و MySQL انجام می‌شود.');
  process.exit(1);
}

const port = Number(process.env.SCHOOL_PORT || 8787);
const sessions = new Map();
const uploadDir = path.join(process.env.SCHOOL_DATA_DIR || path.join(process.cwd(), '.local'), 'uploads');

function userPublic(user) {
  return { id: user.id, actor: actorOf(user), email: user.email, role: user.role };
}

function responseState(data, user) {
  const actor = actorOf(user);
  fail(actor !== '', 'این حساب هنوز به پرونده مدرسه متصل نشده است؛ مدیر باید حساب را تخصیص دهد.');
  return { user: userPublic(user), revision: data.revision, state: visibleSchool(data.state, actor) };
}

function readCookie(req) {
  const header = req.headers.cookie || '';
  const match = header.match(/(?:^|;\s*)poodman_session=([a-f0-9]+)/);
  return match?.[1] || '';
}

function sessionFor(req, res) {
  let id = readCookie(req);
  let session = id && sessions.get(id);
  if (!session) {
    id = randomBytes(24).toString('hex');
    session = { id, csrf: randomBytes(32).toString('hex'), uid: 0, authVersion: 0, seen: Date.now(), captcha: null };
    sessions.set(id, session);
    res.setHeader('Set-Cookie', `poodman_session=${id}; Path=/; HttpOnly; SameSite=Strict`);
  }
  if (Date.now() - session.seen > 8 * 3600 * 1000) {
    session.uid = 0;
    session.csrf = randomBytes(32).toString('hex');
  }
  session.seen = Date.now();
  return session;
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  const payload = type.startsWith('application/json') ? JSON.stringify(body) : body;
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(payload);
}

function currentUser(data, session) {
  if (!session.uid) return null;
  const user = data.users.find((row) => row.id === session.uid);
  if (!user || !user.active || user.authVersion !== session.authVersion) {
    session.uid = 0;
    return null;
  }
  return user;
}

function csrfOk(req, session) {
  const token = req.headers['x-csrf-token'] || '';
  return typeof token === 'string' && token.length > 0 && token === session.csrf;
}

const rates = new Map();
function throttle(key, limit, seconds = 900) {
  const now = Date.now();
  const row = rates.get(key);
  if (!row || now - row.started > seconds * 1000) {
    rates.set(key, { started: now, attempts: 1 });
    return;
  }
  row.attempts += 1;
  fail(row.attempts <= limit, 'تعداد تلاش‌ها زیاد است؛ ۱۵ دقیقه دیگر تلاش کنید.', 429);
}

function offeringOf(state, id) {
  const offering = findRow(state.d.offerings, id);
  if (!offering) return null;
  const classroom = findRow(state.d.classes, offering.classId);
  const year = classroom ? findRow(state.d.years, classroom.yearId) : null;
  return { offering, classroom, year, archived: !!year?.archived };
}

function enrolledIds(state, classroom) {
  return state.d.enrollments.filter((row) => row.status === 'active' && row.classId === classroom.id && row.yearId === classroom.yearId).map((row) => row.studentId);
}

function assertView(user, pack, state) {
  const actor = actorOf(user);
  if (actor === 'admin' || actor === 'deputy' || actor === 'teacher:' + (pack.offering.teacherId || '')) return;
  fail(can(state.life, actor, 'grades') || can(state.life, actor, 'office'), 'مشاهدهٔ این درس برای شما مجاز نیست.');
}

function assertTeacher(user, pack) {
  fail(!pack.archived, 'سال بایگانی‌شده قابل تغییر نیست.');
  fail(actorOf(user) === 'teacher:' + (pack.offering.teacherId || ''), 'نمره را فقط معلم همین درس می‌تواند ثبت کند.');
}

function deskSlice(data, offeringId) {
  const pack = offeringOf(data.state, offeringId);
  fail(pack?.classroom, 'این درس در پایگاه رابطه‌ای پیدا نشد.');
  const students = enrolledIds(data.state, pack.classroom).map((id) => {
    const student = findRow(data.state.d.students, id);
    return { id, name: student.name, code: student.code };
  });
  const sessions = data.state.d.sessions.filter((session) => session.courseId === offeringId).map((session) => ({ ...session, records: asMap(session.records) }));
  const finals = {};
  for (const [key, grade] of Object.entries(asMap(data.state.d.finals))) if (key.startsWith(offeringId + ':')) finals[key] = grade;
  return {
    offeringId,
    class: { id: pack.classroom.id, name: pack.classroom.name, yearId: pack.classroom.yearId },
    students, sessions, finals,
  };
}

function actorLabel(state, actor) {
  if (actor === 'admin') return 'مدیر';
  if (actor === 'deputy') return 'معاون';
  if (actor.startsWith('teacher:')) return findRow(state.d.teachers, actor.slice(8))?.name || 'معلم';
  return findRow(state.life.people, actor)?.name || actor;
}

function rememberHistory(data) {
  data.history.push({ revision: data.revision, state: structuredClone(data.state) });
  if (data.history.length > 40) data.history.splice(0, data.history.length - 40);
}

function audit(data, offeringId, module, studentId, actor, action, oldValue, newValue, ip) {
  data.audit.push({ offeringId, module, studentId, actor, action, old: oldValue, new: newValue, ip, at: new Date().toISOString() });
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    fail(size <= 8 * 1024 * 1024, 'درخواست بیش از حد بزرگ است.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function parseMultipart(buffer, contentType) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  fail(match, 'بارگذاری انجام نشد');
  const boundary = Buffer.from('--' + (match[1] || match[2]));
  const parts = [];
  let start = buffer.indexOf(boundary);
  while (start >= 0) {
    start += boundary.length;
    if (buffer.subarray(start, start + 2).toString() === '--') break;
    if (buffer.subarray(start, start + 2).toString() === '\r\n') start += 2;
    const next = buffer.indexOf(boundary, start);
    if (next < 0) break;
    const raw = buffer.subarray(start, next - 2);
    const split = raw.indexOf('\r\n\r\n');
    if (split > 0) {
      const headers = raw.subarray(0, split).toString('utf8');
      const body = raw.subarray(split + 4);
      const name = /name="([^"]+)"/.exec(headers)?.[1] || '';
      const filename = /filename="([^"]*)"/.exec(headers)?.[1] || '';
      parts.push({ name, filename, body, headers });
    }
    start = next;
  }
  return parts;
}

function dispatchIfComplete(data, sessionId, actor) {
  const session = findRow(data.state.d.sessions, sessionId);
  const pack = session ? offeringOf(data.state, session.courseId) : null;
  if (!session || !pack?.classroom) return null;
  const ids = enrolledIds(data.state, pack.classroom);
  if (!ids.length) return null;
  const rows = [];
  for (const id of ids) {
    const status = asMap(session.records)[id]?.attendance || 'unset';
    if (status === 'unset') return null;
    rows.push({ id, name: findRow(data.state.d.students, id)?.name || '', status });
  }
  const signature = sha256(JSON.stringify(rows));
  const life = data.state.life;
  let index = life.dispatches.findIndex((item) => item.sessionId === sessionId);
  if (index >= 0 && life.dispatches[index].signature === signature) return null;
  let to = life.routes?.[pack.classroom.id] || life.routes?.default || 'admin';
  if (!can(life, to, 'office')) to = 'admin';
  const old = index < 0 ? null : life.dispatches[index];
  const followups = { ...(old?.followups || {}) };
  for (const row of rows) {
    const previous = (old?.rows || []).find((item) => item.id === row.id);
    if (followups[row.id] && previous && previous.status !== row.status) followups[row.id] = { ...followups[row.id], status: 'open' };
  }
  const item = {
    id: old?.id || schoolId(), sessionId, yearId: pack.classroom.yearId, to,
    revision: (old?.revision || 0) + 1, signature, date: session.date,
    title: pack.classroom.name + ' · ' + pack.offering.name, rows, followups,
  };
  if (index < 0) life.dispatches.push(item);
  else life.dispatches[index] = item;
  life.notices.push({ id: schoolId(), to, title: 'حضور‌وغیاب آماده پیگیری است', body: item.title, page: 'hub-followup', date: todayISO(), read: false });
  rememberHistory(data);
  data.revision += 1;
  return item;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (!url.pathname.endsWith('school-api.php')) { send(res, 404, { error: 'عملیات شناخته نشد.' }); return; }
    const session = sessionFor(req, res);
    const action = url.searchParams.get('action') || 'session';
    const data = load();
    if (req.method === 'GET' && action === 'session') {
      const user = currentUser(data, session);
      send(res, 200, user ? { ...responseState(data, user), csrf: session.csrf, installed: true } : { installed: true, user: null, csrf: session.csrf });
      return;
    }
    if (req.method === 'GET' && action === 'captcha') {
      const code = randomCode();
      session.captcha = { hash: sha256(code), time: Date.now() };
      if (process.env.SCHOOL_TEST === '1') session.captcha.code = code;
      send(res, 200, captchaSvg(code), 'image/svg+xml');
      return;
    }
    if (req.method === 'GET' && action === 'get_desk_data') {
      const user = currentUser(data, session);
      fail(user, 'نشست پایان یافته؛ دوباره وارد شوید.', 401);
      const pack = offeringOf(data.state, url.searchParams.get('offering_id') || '');
      fail(pack, 'این درس در پایگاه رابطه‌ای پیدا نشد.');
      assertView(user, pack, data.state);
      send(res, 200, deskSlice(data, pack.offering.id));
      return;
    }
    if (req.method === 'GET' && action === 'grade_audit') {
      const user = currentUser(data, session);
      fail(user, 'نشست پایان یافته؛ دوباره وارد شوید.', 401);
      fail(!actorOf(user).startsWith('student:'), 'سابقهٔ تغییر نمره برای دانش‌آموز نمایش داده نمی‌شود.');
      const offeringId = url.searchParams.get('offering_id') || '';
      const studentId = url.searchParams.get('student_id') || '';
      const module = Number(url.searchParams.get('module_index'));
      const pack = offeringOf(data.state, offeringId);
      fail(pack, 'درس پیدا نشد.');
      assertView(user, pack, data.state);
      const rows = data.audit.filter((row) => row.offeringId === offeringId && row.studentId === studentId && row.module === module).slice(-40).reverse()
        .map((row) => ({ action: row.action, actor: actorLabel(data.state, row.actor), old: row.old, new: row.new, ip: row.ip, at: row.at }));
      send(res, 200, { rows });
      return;
    }
    if (req.method === 'GET' && action === 'sms_settings') {
      const user = currentUser(data, session);
      fail(user, 'نشست پایان یافته؛ دوباره وارد شوید.', 401);
      const actor = actorOf(user);
      fail(actor === 'admin' || can(data.state.life, actor, 'office') || can(data.state.life, actor, 'sms'), 'تنظیم پیامک برای این حساب مجاز نیست.');
      send(res, 200, { provider: data.sms.provider, sender: data.sms.sender, pattern_code: data.sms.patternCode, configured: !!(data.sms.apiKey && data.sms.provider), source: 'database' });
      return;
    }
    if (req.method === 'GET' && action === 'sms_logs') {
      const user = currentUser(data, session);
      fail(user, 'نشست پایان یافته؛ دوباره وارد شوید.', 401);
      const actor = actorOf(user);
      fail(actor === 'admin' || can(data.state.life, actor, 'office') || can(data.state.life, actor, 'sms'), 'مشاهدهٔ گزارش پیامک برای این حساب مجاز نیست.');
      send(res, 200, { rows: data.smsLogs.slice(-40).reverse() });
      return;
    }
    if (req.method === 'GET' && action === 'attachment') {
      const user = currentUser(data, session);
      fail(user, 'نشست پایان یافته؛ دوباره وارد شوید.', 401);
      const id = url.searchParams.get('id') || '';
      fail(/^[a-f0-9]{32}$/.test(id), 'فایل پیدا نشد.');
      const file = data.files.find((row) => row.id === id);
      fail(file, 'فایل پیدا نشد.');
      const task = findRow(data.state.life.tasks, file.taskId);
      const offering = task ? findRow(data.state.d.offerings, task.courseId) : null;
      const actor = actorOf(user);
      const allowed = file.userId === user.id || (offering && actor === 'teacher:' + offering.teacherId) || actor === 'admin' || actor === 'deputy' || can(data.state.life, actor, 'office');
      fail(allowed, 'این تغییر در دسترسی شما نیست.');
      const disk = path.join(uploadDir, id + '.bin');
      fail(existsSync(disk), 'فایل پیدا نشد.');
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`, 'Cache-Control': 'no-store' });
      res.end(readFileSync(disk));
      return;
    }
    fail(req.method === 'POST', 'روش درخواست مجاز نیست.');
    fail(csrfOk(req, session), 'نشست معتبر نیست؛ صفحه را تازه کنید.', 403);
    if (action === 'upload') {
      const user = currentUser(data, session);
      fail(user, 'نشست پایان یافته؛ دوباره وارد شوید.', 401);
      throttle('upload:' + user.id, 30, 3600);
      const parts = parseMultipart(await readBody(req), req.headers['content-type']);
      const taskId = parts.find((part) => part.name === 'taskId')?.body.toString('utf8') || '';
      const file = parts.find((part) => part.name === 'file');
      const task = findRow(data.state.life.tasks, taskId);
      const actor = actorOf(user);
      fail(task && task.published && actor.startsWith('student:') && task.due >= todayISO(), 'دسترسی به تکلیف ندارید');
      fail(file && file.body.length > 0 && file.body.length <= 5 * 1024 * 1024, 'فایل باید حداکثر ۵ مگابایت باشد.');
      const name = path.basename(String(file.filename || '').replaceAll('\\', '/'));
      fail(name.length <= 190 && /\.(pdf|png|jpe?g|txt|docx|xlsx)$/i.test(name), 'نوع فایل مجاز نیست.');
      const id = schoolId();
      mkdirSync(uploadDir, { recursive: true });
      writeFileSync(path.join(uploadDir, id + '.bin'), file.body);
      const stored = await update((next) => {
        next.files.push({ id, userId: user.id, taskId, name, size: file.body.length });
        return next;
      });
      send(res, 200, { file: { name, url: './school-api.php?action=attachment&id=' + id, size: file.body.length }, csrf: session.csrf, files: stored.files.length });
      return;
    }
    const type = req.headers['content-type'] || '';
    fail(type.startsWith('application/json'), 'درخواست نامعتبر است.');
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
    assertTree(body);
    if (action === 'login') {
      const login = String(body.email || '').trim().toLowerCase();
      throttle('login:' + login, 8);
      const challenge = session.captcha;
      session.captcha = null;
      const answer = normalizeCaptcha(body.captcha);
      if (!challenge || Date.now() - challenge.time > 180000 || challenge.hash !== sha256(answer)) {
        send(res, 400, { error: 'کد امنیتی نادرست یا منقضی شده است. تصویر تازه بگیرید.' });
        return;
      }
      const password = body.password;
      fail(typeof password === 'string' && password.length <= 72 && login.length <= 190, 'نام کاربری یا رمز عبور نادرست است.', 401);
      const user = data.users.find((row) => row.email === login);
      if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
        send(res, 401, { error: 'نام کاربری یا رمز عبور نادرست است.' });
        return;
      }
      session.uid = user.id;
      session.authVersion = user.authVersion;
      session.csrf = randomBytes(32).toString('hex');
      send(res, 200, { ...responseState(data, user), csrf: session.csrf });
      return;
    }
    const user = currentUser(data, session);
    fail(user, 'نشست پایان یافته؛ دوباره وارد شوید.', 401);
    const actor = actorOf(user);
    fail(actor !== '', 'این حساب هنوز به پرونده مدرسه متصل نشده است؛ مدیر باید حساب را تخصیص دهد.');
    if (action === 'logout') {
      session.uid = 0;
      session.csrf = randomBytes(32).toString('hex');
      send(res, 200, { ok: true, csrf: session.csrf });
      return;
    }
    if (action === 'save') {
      throttle('save:' + user.id, 90, 3600);
      fail(Number.isInteger(body.revision), 'نسخه شما قدیمی است؛ تغییرات را دریافت و نسخه تازه را باز کنید.', 409);
      const saved = await update((next) => {
        let incoming = body.state;
        if (next.revision !== body.revision) {
          const base = next.history.find((row) => row.revision === body.revision);
          fail(base, 'نسخه شما قدیمی است؛ تغییرات را دریافت و نسخه تازه را باز کنید.', 409);
          incoming = rebase(visibleSchool(base.state, actor), incoming, visibleSchool(next.state, actor));
        }
        incoming = freezeDesk(next.state, incoming);
        rememberHistory(next);
        next.state = mergeSchool(next.state, incoming, actor);
        next.revision += 1;
        return next;
      });
      send(res, 200, { ...responseState(saved, user), csrf: session.csrf });
      return;
    }
    if (action === 'accounts') {
      fail(actor === 'admin', 'این کار فقط برای مدیر مجاز است.', 403);
      send(res, 200, { accounts: data.users.map((row) => ({ id: row.id, email: row.email, role: row.role, actor_id: row.actorId, phone: row.phone, active: row.active ? 1 : 0 })) });
      return;
    }
    if (action === 'account_save') {
      fail(actor === 'admin', 'این کار فقط برای مدیر مجاز است.', 403);
      const target = String(body.actor || '');
      const login = String(body.email || '').trim().toLowerCase();
      const loginOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(login) || (/^[a-z0-9._+-]{3,190}$/.test(login) && !login.includes('@'));
      fail(loginOk, 'نام کاربری باید ایمیل معتبر یا شناسه لاتین بدون فاصله باشد.');
      fail(target !== 'admin', 'این تغییر در دسترسی شما نیست.');
      let role = 'custom';
      let phone = '';
      if (target.startsWith('teacher:')) {
        const profile = findRow(data.state.d.teachers, target.slice(8));
        fail(profile, 'این تغییر در دسترسی شما نیست.');
        phone = profile.phone;
        role = 'teacher';
      } else if (target.startsWith('student:')) {
        fail(findRow(data.state.d.students, target.slice(8)), 'این تغییر در دسترسی شما نیست.');
        role = 'student';
      } else fail(target === 'deputy' || findRow(data.state.life.people, target), 'این تغییر در دسترسی شما نیست.');
      const saved = await update((next) => {
        const existing = next.users.find((row) => row.actorId === target);
        const active = body.active !== false;
        let password = body.password || '';
        if (!existing || password !== '') password = passwordCheck(password);
        if (existing) {
          existing.email = login;
          existing.phone = phone;
          existing.active = active;
          existing.authVersion += 1;
          if (password) existing.passwordHash = hashPassword(password);
        } else {
          next.users.push({ id: Math.max(0, ...next.users.map((row) => row.id)) + 1, email: login, passwordHash: hashPassword(password), role, actorId: target, phone, active, authVersion: 1 });
        }
        return next;
      });
      send(res, 200, { ok: true, accounts: saved.users.length });
      return;
    }
    if (action === 'password') {
      throttle('password:' + user.id, 8);
      fail(typeof body.current === 'string' && verifyPassword(body.current, user.passwordHash), 'رمز فعلی نادرست است.');
      const password = passwordCheck(body.password);
      await update((next) => {
        const row = next.users.find((item) => item.id === user.id);
        row.passwordHash = hashPassword(password);
        row.authVersion += 1;
        return next;
      });
      session.authVersion += 1;
      send(res, 200, { ok: true });
      return;
    }
    if (action === 'save_session_attendance') {
      throttle('desk:' + user.id, 400, 900);
      const sessionId = String(body.session_id || '');
      const rows = body.records;
      fail(Array.isArray(rows) && rows.length && rows.length <= 500, 'فهرست حضور معتبر نیست.');
      let dispatch = null;
      const saved = await update((next) => {
        const lesson = findRow(next.state.d.sessions, sessionId);
        fail(lesson, 'جلسه پیدا نشد.');
        const pack = offeringOf(next.state, lesson.courseId);
        fail(pack, 'درس جلسه پیدا نشد.');
        fail(!pack.archived, 'سال بایگانی‌شده قابل تغییر نیست.');
        const who = actorOf(user);
        const teacherOnly = who === 'teacher:' + pack.offering.teacherId;
        fail(teacherOnly || who === 'admin' || who === 'deputy' || can(next.state.life, who, 'office'), 'ثبت حضور این درس برای شما مجاز نیست.');
        const allowed = new Set(enrolledIds(next.state, pack.classroom));
        lesson.records = asMap(lesson.records);
        for (const row of rows) {
          fail(allowed.has(row.student_id), 'دانش‌آموز عضو این کلاس نیست.');
          fail(['unset', 'present', 'absent', 'excused', 'late'].includes(row.attendance), 'وضعیت حضور معتبر نیست.');
          const prev = lesson.records[row.student_id] || { attendance: 'unset', asked: false, note: '', marks: [] };
          lesson.records[row.student_id] = teacherOnly
            ? { ...prev, attendance: row.attendance, asked: !!row.asked, note: String(row.note || '').slice(0, 2000) }
            : { ...prev, attendance: row.attendance };
        }
        dispatch = dispatchIfComplete(next, sessionId, who);
        return next;
      });
      send(res, 200, { ok: true, dispatch, revision: saved?.revision });
      return;
    }
    if (action === 'save_session_marks') {
      throttle('desk:' + user.id, 400, 900);
      const sessionId = String(body.session_id || '');
      const studentId = String(body.student_id || '');
      const marks = body.marks;
      fail(Array.isArray(marks) && marks.length <= 100, 'فهرست نمره معتبر نیست.');
      await update((next) => {
        const lesson = findRow(next.state.d.sessions, sessionId);
        fail(lesson, 'جلسه پیدا نشد.');
        const pack = offeringOf(next.state, lesson.courseId);
        fail(pack, 'درس جلسه پیدا نشد.');
        assertTeacher(user, pack);
        fail(enrolledIds(next.state, pack.classroom).includes(studentId), 'دانش‌آموز عضو این کلاس نیست.');
        const cap = pack.offering.modules[lesson.module]?.competencies || 1;
        lesson.records = asMap(lesson.records);
        const prev = lesson.records[studentId] || { attendance: 'unset', asked: false, note: '', marks: [] };
        const oldMarks = prev.marks || [];
        const stored = [];
        const seen = new Set();
        for (const mark of marks) {
          const competency = Number(mark.competency ?? 1);
          fail(Number.isInteger(competency) && competency >= 1 && competency <= Math.max(1, cap), 'شایستگی نمره خارج از پودمان است.');
          const id = String(mark.id || schoolId());
          fail(!seen.has(id), 'شناسه نمره تکراری است.');
          seen.add(id);
          const max = Number(mark.max ?? 20);
          const value = Number(mark.value);
          const ceiling = ['مثبت', 'منفی'].includes(mark.type) ? 1000 : max;
          fail(typeof mark.type === 'string' && mark.type.trim() && max > 0 && max <= 1000 && value >= 0 && value <= ceiling, 'نمره با بارم سازگار نیست.');
          stored.push({ id, type: mark.type, value, max, note: String(mark.note || ''), competency });
        }
        lesson.records[studentId] = { ...prev, marks: stored };
        if (JSON.stringify(oldMarks) !== JSON.stringify(stored)) audit(next, pack.offering.id, lesson.module, studentId, actor, 'session_mark', { session_id: sessionId, marks: oldMarks }, { session_id: sessionId, marks: stored }, req.socket.remoteAddress || '');
        return next;
      });
      send(res, 200, { ok: true });
      return;
    }
    if (action === 'save_final_grade') {
      throttle('desk:' + user.id, 400, 900);
      const offeringId = String(body.offering_id || '');
      const studentId = String(body.student_id || '');
      const module = Number(body.module_index);
      await update((next) => {
        const pack = offeringOf(next.state, offeringId);
        fail(pack, 'درس پیدا نشد.');
        assertTeacher(user, pack);
        fail(enrolledIds(next.state, pack.classroom).includes(studentId), 'دانش‌آموز عضو این کلاس نیست.');
        fail(Number.isInteger(module) && module >= 0 && module <= 4, 'شماره پودمان معتبر نیست.');
        const competencies = Array.isArray(body.competencies) ? body.competencies : [null, null];
        const grade = {
          continuous: body.continuous ?? null,
          competencies: [competencies[0] ?? null, competencies[1] ?? null],
          competency: body.final_competency ?? body.competency ?? null,
          total: body.total ?? null,
          note: String(body.note || ''),
        };
        for (const [field, max] of Object.entries({ continuous: 5, competency: 3, total: 20 })) {
          const value = grade[field];
          fail(value === null || (typeof value === 'number' && value >= 0 && value <= max), 'نمره پودمانی نامعتبر است.');
        }
        const key = offeringId + ':' + module + ':' + studentId;
        const old = asMap(next.state.d.finals)[key] || null;
        next.state.d.finals = asMap(next.state.d.finals);
        next.state.d.finals[key] = grade;
        if (!same(old, grade)) audit(next, offeringId, module, studentId, actor, 'final_grade', old, grade, req.socket.remoteAddress || '');
        return next;
      });
      send(res, 200, { ok: true });
      return;
    }
    if (action === 'sms_settings') {
      fail(actor === 'admin', 'ذخیرهٔ کلید پیامک فقط برای مدیر مدرسه مجاز است.');
      const provider = String(body.provider || '');
      fail(provider === 'kavenegar' || provider === 'ippanel', 'سرویس باید کاوه‌نگار یا فراز اس‌ام‌اس (IPPanel) باشد.');
      const sender = String(body.sender || '').trim();
      fail(sender === '' || /^[0-9+]{4,20}$/.test(sender), 'سرشماره معتبر نیست.');
      const pattern = String(body.pattern_code || '').trim();
      fail(pattern === '' || /^[A-Za-z0-9_-]{1,64}$/.test(pattern), 'کد پترن معتبر نیست.');
      const key = String(body.api_key || '').trim();
      fail(key === '' || (key.length >= 8 && key.length <= 200 && /^[\x21-\x7E]+$/.test(key)), 'کلید وب‌سرویس معتبر نیست.');
      const saved = await update((next) => {
        next.sms.provider = provider;
        next.sms.sender = sender;
        next.sms.patternCode = pattern;
        if (key) next.sms.apiKey = key;
        return next;
      });
      send(res, 200, { provider: saved.sms.provider, sender: saved.sms.sender, pattern_code: saved.sms.patternCode, configured: !!saved.sms.apiKey, source: 'database' });
      return;
    }
    if (action === 'send_attendance_sms') {
      fail(actor === 'admin' || can(data.state.life, actor, 'office'), 'ارسال پیامک حضور فقط برای دفتر یا مدیر مجاز است.');
      fail(data.sms.apiKey && data.sms.provider, 'کلید پیامک هنوز در پیکربندی یا جدول تنظیمات ثبت نشده است.');
      const ids = Array.isArray(body.student_ids) ? body.student_ids : [];
      fail(ids.length > 0 && ids.length <= 80, 'فهرست دانش‌آموزان پیامک معتبر نیست.');
      send(res, 200, { ok: true, sent: 0, failed: ids.length, results: ids.map((student_id) => ({ student_id, status: 'skipped', error: 'ارسال واقعی پیامک با پنل کاوه‌نگار یا فراز، روی سرور PHP هاست انجام می‌شود.' })) });
      return;
    }
    if (action === 'backup') {
      fail(actor === 'admin', 'این کار فقط برای مدیر مجاز است.', 403);
      send(res, 200, { format: 'azarmehr-school-2', created: new Date().toISOString(), revision: data.revision, state: data.state });
      return;
    }
    send(res, 404, { error: 'عملیات شناخته نشد.' });
  } catch (error) {
    const status = error instanceof SchoolError ? error.status : (error instanceof SyntaxError ? 422 : 500);
    const message = status === 500 ? 'عملیات انجام نشد. اتصال و نصب پایگاه داده را بررسی کنید.' : error.message;
    if (status === 500) console.error(error);
    send(res, status, { error: message });
  }
});

const entry = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === entry) {
  server.on('error', (error) => {
    console.error(error.code === 'EADDRINUSE' ? `پورت ${port} اشغال است. برنامهٔ قبلی را ببندید و دوباره اجرا کنید.` : error.message);
    process.exit(1);
  });
  server.listen(port, '127.0.0.1', () => {
    const data = load();
    console.log(`school-api listening on http://127.0.0.1:${port}/school-api.php`);
    console.log(`revision ${data.revision} · users ${data.users.map((user) => user.email).join(', ')}`);
  });
}

export { server, sessions };
