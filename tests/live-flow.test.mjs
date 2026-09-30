import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.SCHOOL_DATA_DIR = mkdtempSync(path.join(tmpdir(), 'school-'));
process.env.SCHOOL_TEST = '1';
process.env.SCHOOL_PORT = '0';

const { server, sessions } = await import('../server/index.mjs');

function start() {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}
const port = await start();
after(() => new Promise((resolve) => server.close(resolve)));

async function call(action, { method = 'GET', cookie = '', csrf = '', body, raw } = {}) {
  const headers = {};
  if (cookie) headers.cookie = cookie;
  if (csrf) headers['x-csrf-token'] = csrf;
  if (body) headers['content-type'] = 'application/json';
  const response = await fetch(`http://127.0.0.1:${port}/school-api.php?action=${action}`, { method, headers, body: body ? JSON.stringify(body) : raw });
  const setCookie = response.headers.get('set-cookie') || '';
  const token = /poodman_session=([a-f0-9]+)/.exec(setCookie)?.[1];
  const value = response.headers.get('content-type')?.includes('json') ? await response.json() : await response.text();
  return { status: response.status, value, cookie: token ? `poodman_session=${token}` : cookie, csrf: value?.csrf || csrf };
}

async function login(email, password) {
  let session = await call('session');
  await call('captcha', { cookie: session.cookie });
  const id = session.cookie.split('=')[1];
  const code = sessions.get(id).captcha.code;
  session = await call('login', { method: 'POST', cookie: session.cookie, csrf: session.csrf, body: { email, password, captcha: code } });
  assert.equal(session.status, 200, JSON.stringify(session.value));
  return session;
}

test('seeded admin, teacher and two students can sign in', async () => {
  const admin = await login('admin', 'Admin#Azarmehr1');
  assert.equal(admin.value.user.actor, 'admin');
  assert.equal(admin.value.state.d.students.length, 2);
  assert.equal(admin.value.state.d.teachers.length, 1);
  const teacher = await login('teacher', 'Teacher#Azarmehr1');
  assert.equal(teacher.value.user.actor, 'teacher:t1');
  const deskRes = await fetch(`http://127.0.0.1:${port}/school-api.php?action=get_desk_data&offering_id=o1`, { headers: { cookie: teacher.cookie } });
  const deskJson = await deskRes.json();
  assert.equal(deskRes.status, 200);
  assert.equal(deskJson.students.length, 2);
  assert.equal(deskJson.sessions[0].id, 'session1');
  assert.equal(teacher.value.state.d.students.length, 2);
  assert.equal(teacher.value.state.d.students[0].phone, undefined);
  const one = await login('student1', 'Student#Azarmehr1');
  const two = await login('student2', 'Student#Azarmehr2');
  assert.equal(one.value.user.actor, 'student:s1');
  assert.equal(two.value.user.actor, 'student:s2');
  assert.equal(one.value.state.d.students.length, 1);
  assert.equal(one.value.state.d.students[0].id, 's1');
  assert.equal(one.value.state.life.tasks.length, 0);
});

test('teacher records attendance and a student cannot change the roster', async () => {
  const teacher = await login('teacher', 'Teacher#Azarmehr1');
  const saved = await call('save_session_attendance', {
    method: 'POST', cookie: teacher.cookie, csrf: teacher.csrf,
    body: { session_id: 'session1', records: [{ student_id: 's1', attendance: 'present', asked: false, note: '' }, { student_id: 's2', attendance: 'absent', asked: false, note: '' }] },
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.value));
  assert.equal(saved.value.dispatch.to, 'admin');
  const student = await login('student1', 'Student#Azarmehr1');
  const attack = structuredClone(student.value.state);
  attack.d.students[0].name = 'تغییر غیرمجاز';
  const rejected = await call('save', { method: 'POST', cookie: student.cookie, csrf: student.csrf, body: { revision: student.value.revision, state: attack } });
  assert.equal(rejected.status, 422);
  const again = await login('student1', 'Student#Azarmehr1');
  assert.equal(again.value.state.d.students[0].name, 'علی رضایی');
  assert.equal(again.value.state.d.sessions[0].records.s1.attendance, 'present');
  assert.equal(again.value.state.d.sessions[0].records.s2, undefined);
});

test('wrong captcha and wrong password stay out', async () => {
  const session = await call('session');
  await call('captcha', { cookie: session.cookie });
  const bad = await call('login', { method: 'POST', cookie: session.cookie, csrf: session.csrf, body: { email: 'admin', password: 'Admin#Azarmehr1', captcha: 'WRONG1' } });
  assert.equal(bad.status, 400);
});
