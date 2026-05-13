import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';

const VAULT_KEY = 'onyu_relationship_crm_secure_v1';
const AUTO_LOCK_MS = 5 * 60 * 1000;
const ITERATIONS = 120000;

const pad = (n) => String(n).padStart(2, '0');
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const nowTime = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const addDays = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const formatRrn = (value) => {
  const digits = String(value || '').replace(/[^0-9]/g, '');
  if (digits.length > 6) return `${digits.slice(0, 6)}-${digits.slice(6, 13)}`;
  return digits;
};
const formatPhone = (value) => {
  const digits = String(value || '').replace(/[^0-9]/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.startsWith('02')) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length <= 10) return `${digits.slice(0, 2)}-${digits.slice(2, digits.length - 4)}-${digits.slice(-4)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  }
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
};
const cleanPhone = (value) => String(value || '').replace(/[^0-9]/g, '');
const cleanRrn = (value) => String(value || '').replace(/[^0-9]/g, '');
const maskRrn = (value) => {
  const digits = cleanRrn(value);
  if (digits.length >= 7) return `${digits.slice(0, 6)}-${digits.slice(6, 7)}******`;
  return '미입력';
};
const birthFromRrn = (value) => {
  const digits = cleanRrn(value);
  if (digits.length < 7) return '';
  const year = ['3', '4', '7', '8'].includes(digits[6]) ? '20' : '19';
  return `${year}${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 6)}`;
};
const ageFromRrn = (value) => {
  const birth = birthFromRrn(value);
  if (!birth) return '';
  const [y, m, d] = birth.split('-').map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age -= 1;
  return age >= 0 ? age : '';
};
const ageTextFromRrn = (value) => {
  const age = ageFromRrn(value);
  return age === '' ? '나이 자동 계산 대기' : `${age}세`;
};
const textToTags = (text) => String(text || '').split(',').map((v) => v.trim()).filter(Boolean);
const tagsToText = (tags) => Array.isArray(tags) ? tags.join(', ') : '';
const asText = (value) => (value === undefined || value === null ? '' : String(value).trim());

const emptyFamily = () => ({ id: Date.now(), rel: '배우자', name: '', rrn: '', phone: '', memo: '' });
const emptyLog = () => ({ id: Date.now(), date: today(), time: nowTime(), kind: '문자', title: '', content: '' });
const emptyCustomer = () => ({
  id: Date.now(),
  registeredAt: today(),
  name: '',
  phone: '',
  rrn: '',
  grade: '잠재',
  temp: '보통',
  status: '안부 필요',
  next: addDays(7),
  topic: '',
  memo: '',
  review: '',
  tags: [],
  score: 30,
  count: 0,
  lastAction: '신규 등록',
  family: [],
  logs: []
});

const sampleCustomers = () => [
  {
    id: 1,
    registeredAt: today(),
    name: '김민규',
    phone: '010-1234-5678',
    rrn: '840219-1234567',
    grade: 'VIP',
    temp: '따뜻함',
    status: '안부 필요',
    next: today(),
    topic: '보험금 청구 사례 공유',
    memo: '소개 가능성 높음. 가족 보험도 관심 있음.',
    review: '',
    tags: ['소개 가능', '가족 확장'],
    score: 74,
    count: 8,
    lastAction: '기존 상담',
    family: [
      { id: 11, rel: '배우자', name: '배우자', rrn: '860521-2234567', phone: '010-0000-0000', memo: '실비 점검 필요' },
      { id: 12, rel: '자녀', name: '첫째', rrn: '180914-3234567', phone: '', memo: '어린이보험 확인 가능' }
    ],
    logs: []
  },
  {
    id: 2,
    registeredAt: today(),
    name: '박지은',
    phone: '010-2345-6789',
    rrn: '901103-2234567',
    grade: '잠재',
    temp: '보통',
    status: '정보 전달',
    next: addDays(3),
    topic: '갱신 보험료 점검',
    memo: '보험료 부담 언급. 무리한 권유 느낌 주면 안 됨.',
    review: '',
    tags: ['보험료 부담'],
    score: 46,
    count: 3,
    lastAction: '정보 전달',
    family: [],
    logs: []
  },
  {
    id: 3,
    registeredAt: today(),
    name: '이상훈',
    phone: '010-3456-7890',
    rrn: '790219-1234567',
    grade: '유지',
    temp: '차가움',
    status: '관계 회복',
    next: addDays(7),
    topic: '오랜만의 안부',
    memo: '오래 연락 안 됨. 솔직 담백형 메시지 추천.',
    review: '',
    tags: ['휴면'],
    score: 18,
    count: 0,
    lastAction: '장기 미접촉',
    family: [{ id: 31, rel: '배우자', name: '배우자', rrn: '', phone: '', memo: '가족 보장 확인 가능성 있음' }],
    logs: []
  }
];

const normalizeCustomers = (list) => (Array.isArray(list) ? list : []).map((c) => ({
  ...emptyCustomer(),
  ...c,
  phone: formatPhone(c.phone),
  family: (c.family || []).map((f) => ({ ...emptyFamily(), ...f, phone: formatPhone(f.phone) })),
  logs: c.logs || []
}));

const toB64 = (bytes) => {
  let s = '';
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s);
};
const fromB64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
const deriveKey = async (password, salt) => {
  const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};
const encryptObject = async (payload, password) => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const plain = new TextEncoder().encode(JSON.stringify(payload));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
  return { version: 1, salt: toB64(salt), iv: toB64(iv), data: toB64(cipher), savedAt: new Date().toISOString() };
};
const decryptObject = async (vault, password) => {
  const key = await deriveKey(password, fromB64(vault.salt));
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(vault.iv) }, key, fromB64(vault.data));
  return JSON.parse(new TextDecoder().decode(plain));
};

const depth = (score) => {
  if (score >= 90) return ['🏆', '팬 고객', '실제 소개와 재상담이 자연스러운 매우 깊은 관계'];
  if (score >= 80) return ['🤝', '신뢰 관계', '꾸준한 소통이 쌓여 상담 대화가 자연스러운 관계'];
  if (score >= 60) return ['😊', '익숙한 관계', '안부와 정보 제공이 자연스럽게 받아들여지는 단계'];
  if (score >= 35) return ['🌱', '관계 회복 중', '판매보다 안부와 도움 되는 정보로 천천히 쌓아야 하는 단계'];
  return ['🧊', '차가운 관계', '짧고 부담 없는 연락부터 필요한 단계'];
};
const relationCelsius = (score) => {
  const n = Number(score || 0);
  return Math.max(0, Math.min(100, Math.round(n)));
};
const relationTempLabel = (score) => {
  const c = relationCelsius(score);
  if (c >= 80) return '뜨거운 신뢰';
  if (c >= 60) return '따뜻함';
  if (c >= 35) return '미지근함';
  return '차가움';
};
const relationTempText = (score) => `${relationCelsius(score)}℃`;

const gain = (action) => ({ '상담 예약': 5, '소개 요청': 4, '통화 완료': 3, '메시지 발송': 1 }[action] || 1);
const nextDate = (action) => {
  if (action === '상담 예약') return addDays(14);
  if (action === '소개 요청') return addDays(30);
  if (action === '메시지 발송') return addDays(30);
  if (action === '통화 완료') return addDays(21);
  return addDays(45);
};
const nextTemp = (score) => (score >= 80 ? '따뜻함' : score >= 40 ? '보통' : '차가움');
const actionFromLogKind = (kind) => ({ 문자: '메시지 발송', 통화: '통화 완료', 상담: '상담 예약', 소개요청: '소개 요청' }[kind] || '기타');

function Button({ children, onClick, light = false, className = '', disabled = false }) {
  const base = 'rounded-2xl px-4 py-2.5 text-sm font-bold disabled:opacity-50 ';
  const style = light ? 'border bg-white text-slate-700 ' : 'bg-slate-900 text-white ';
  return <button type="button" disabled={disabled} onClick={onClick} className={style + base + className}>{children}</button>;
}

function SmallButton({ children, onClick, light = false, className = "", disabled = false }) {
  const base = "rounded-xl px-2.5 py-1.5 text-xs font-bold disabled:opacity-50 ";
  const style = light ? "border bg-white text-slate-700 " : "bg-slate-900 text-white ";
  return <button type="button" disabled={disabled} onClick={onClick} className={style + base + className}>{children}</button>;
}

function Card({ children, className = '' }) {
  return <div className={'rounded-3xl bg-white p-4 shadow-sm ' + className}>{children}</div>;
}
function Badge({ children, color = 'slate' }) {
  const map = { slate: 'bg-slate-100 text-slate-700', amber: 'bg-amber-100 text-amber-800', blue: 'bg-blue-100 text-blue-800', green: 'bg-emerald-100 text-emerald-800', rose: 'bg-rose-100 text-rose-800', purple: 'bg-purple-100 text-purple-800' };
  return <span className={(map[color] || map.slate) + ' rounded-full px-2.5 py-1 text-xs font-bold'}>{children}</span>;
}
function Info({ title, value, sub }) {
  return <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs text-slate-400">{title}</p><b>{value}</b>{sub ? <p className="text-sm text-slate-500">{sub}</p> : null}</div>;
}
function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-3xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-black">{title}</h2>
          <Button light onClick={onClose}>닫기</Button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}

function LockScreen({ onLogin }) {
  const setup = !localStorage.getItem(VAULT_KEY);
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError('');
    if (password.length < 4) { setError('암호는 4자리 이상 입력해 주세요.'); return; }
    if (setup && password !== confirmPw) { setError('암호가 서로 다릅니다.'); return; }
    try {
      setBusy(true);
      if (setup) {
        const list = sampleCustomers();
        localStorage.setItem(VAULT_KEY, JSON.stringify(await encryptObject({ customers: list }, password)));
        onLogin(list, password);
      } else {
        const vault = JSON.parse(localStorage.getItem(VAULT_KEY));
        const payload = await decryptObject(vault, password);
        onLogin(payload.customers || [], password);
      }
    } catch {
      setError(setup ? '암호화 저장 중 오류가 났습니다.' : '암호가 틀렸거나 저장 데이터가 손상되었습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-5">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
        <p className="text-sm font-bold text-slate-500">고객 데이터 암호화</p>
        <h1 className="mt-1 text-2xl font-black">고객관리 앱 잠금</h1>
        <p className="mt-2 text-sm text-slate-500">암호를 입력해야 고객정보가 보입니다.</p>
        <div className="mt-5 space-y-3">
          <input type="password" className="w-full rounded-2xl border p-3" placeholder={setup ? '새 암호' : '암호'} value={password} onChange={(e) => setPassword(e.target.value)} />
          {setup ? <input type="password" className="w-full rounded-2xl border p-3" placeholder="새 암호 확인" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} /> : null}
          {error ? <p className="text-sm font-bold text-rose-600">{error}</p> : null}
          <Button onClick={submit} disabled={busy} className="w-full">{busy ? '처리 중...' : setup ? '암호 설정 후 시작' : '잠금 해제'}</Button>
        </div>
      </div>
    </div>
  );
}

function CustomerEditor({ mode, form, setForm, familyDraft, setFamilyDraft, onSave, onClose }) {
  const [editingFamilyId, setEditingFamilyId] = useState(null);
  const addFamily = () => {
    if (!familyDraft.name && !familyDraft.rrn && !familyDraft.phone && !familyDraft.memo) return;
    const saved = { ...familyDraft, id: editingFamilyId || Date.now(), rrn: formatRrn(familyDraft.rrn), phone: formatPhone(familyDraft.phone) };
    const nextFamily = editingFamilyId ? form.family.map((f) => f.id === editingFamilyId ? saved : f) : [...form.family, saved];
    setForm({ ...form, family: nextFamily });
    setFamilyDraft(emptyFamily());
    setEditingFamilyId(null);
  };

  return (
    <Modal title={mode === 'add' ? '고객 추가' : '고객 수정'} onClose={onClose}>
      <div className="grid gap-3 md:grid-cols-2">
        <input className="rounded-2xl border p-3" placeholder="고객명" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="rounded-2xl border p-3" placeholder="전화번호" value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })} />
        <div>
          <input className="w-full rounded-2xl border p-3" placeholder="주민등록번호 예: 840219-1234567" value={form.rrn || ''} onChange={(e) => setForm({ ...form, rrn: formatRrn(e.target.value) })} />
          <p className="mt-1 px-2 text-xs text-slate-500">자동 나이: {ageTextFromRrn(form.rrn)}</p>
        </div>
        <div><input type="date" className="w-full rounded-2xl border p-3" value={form.registeredAt || today()} onChange={(e) => setForm({ ...form, registeredAt: e.target.value })} /><p className="mt-1 px-2 text-xs text-slate-500">최초 등록일</p></div>
        <select className="rounded-2xl border p-3" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}><option>VIP</option><option>잠재</option><option>유지</option></select>
        <select className="rounded-2xl border p-3" value={form.temp} onChange={(e) => setForm({ ...form, temp: e.target.value })}><option>따뜻함</option><option>보통</option><option>차가움</option></select>
        <select className="rounded-2xl border p-3" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option>안부 필요</option><option>정보 전달</option><option>관계 회복</option><option>메시지 발송</option><option>통화 완료</option><option>상담 예약</option><option>소개 요청</option></select>
        <input className="rounded-2xl border p-3" placeholder="다음 연락일 YYYY-MM-DD" value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} />
        <input className="rounded-2xl border p-3 md:col-span-2" placeholder="태그 쉼표 구분" value={form.tagText || ''} onChange={(e) => setForm({ ...form, tagText: e.target.value })} />
        <textarea className="min-h-[80px] rounded-2xl border p-3 md:col-span-2" placeholder="고객 메모" value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
        <textarea className="min-h-[80px] rounded-2xl border p-3 md:col-span-2" placeholder="상담후기" value={form.review || ''} onChange={(e) => setForm({ ...form, review: e.target.value })} />
      </div>

      <div className="mt-5 rounded-3xl bg-slate-50 p-4">
        <div className="mb-3 flex items-center justify-between"><h3 className="font-black">가족 구성원</h3><Badge color="purple">{form.family.length}명</Badge></div>
        <div className="grid gap-2 md:grid-cols-5">
          <select className="rounded-2xl border bg-white p-3" value={familyDraft.rel} onChange={(e) => setFamilyDraft({ ...familyDraft, rel: e.target.value })}><option>배우자</option><option>자녀</option><option>부모님</option><option>형제자매</option><option>기타</option></select>
          <input className="rounded-2xl border bg-white p-3" placeholder="이름/호칭" value={familyDraft.name} onChange={(e) => setFamilyDraft({ ...familyDraft, name: e.target.value })} />
          <input className="rounded-2xl border bg-white p-3" placeholder="주민등록번호" value={familyDraft.rrn} onChange={(e) => setFamilyDraft({ ...familyDraft, rrn: formatRrn(e.target.value) })} />
          <input className="rounded-2xl border bg-white p-3" placeholder="가족 전화번호" value={familyDraft.phone} onChange={(e) => setFamilyDraft({ ...familyDraft, phone: formatPhone(e.target.value) })} />
          <div className="rounded-2xl border bg-white p-3 text-sm"><p className="text-xs text-slate-400">자동 나이</p><p className="font-bold">{ageTextFromRrn(familyDraft.rrn)}</p></div>
          <textarea className="min-h-[60px] rounded-2xl border bg-white p-3 md:col-span-5" placeholder="가족 메모" value={familyDraft.memo} onChange={(e) => setFamilyDraft({ ...familyDraft, memo: e.target.value })} />
          <Button className="md:col-span-5" onClick={addFamily}>{editingFamilyId ? '가족 수정 저장' : '가족 추가'}</Button>
        </div>

        {form.family.map((f) => (
          <div key={f.id} className="mt-2 flex justify-between rounded-2xl bg-white p-3 text-sm">
            <div>
              <b>{f.rel} · {f.name || '이름 미입력'} · {ageTextFromRrn(f.rrn)}</b>
              <p className="text-slate-500">생년월일 {birthFromRrn(f.rrn) || '미입력'}</p>
              <p className="text-slate-500">주민등록번호 {maskRrn(f.rrn)}</p>
              <p className="text-slate-500">전화번호 {f.phone || '미입력'}</p>
              <p>{f.memo || '메모 없음'}</p>
            </div>
            <div className="flex flex-col gap-2">
              <button type="button" className="text-xs font-bold text-blue-600" onClick={() => { setFamilyDraft({ ...emptyFamily(), ...f }); setEditingFamilyId(f.id); }}>수정</button>
              <button type="button" className="text-xs font-bold text-slate-500" onClick={() => setForm({ ...form, family: form.family.filter((x) => x.id !== f.id) })}>삭제</button>
            </div>
          </div>
        ))}
      </div>
      <Button onClick={onSave} className="mt-4 w-full">저장하기</Button>
    </Modal>
  );
}

function LogManager({ customer, logDraft, setLogDraft, onAdd, onDelete, onEdit, editingLogId, onCancelEdit }) {
  const [page, setPage] = useState(1);
  const [logSearch, setLogSearch] = useState("");
  const logs = customer.logs || [];
  const keyword = logSearch.trim().toLowerCase();

  const filteredLogs = keyword
    ? logs.filter((log) => {
        const haystack = [
          log.date || "",
          log.time || "",
          log.kind || "",
          log.content || ""
        ].join(" ").toLowerCase();
        return haystack.includes(keyword);
      })
    : logs;

  const perPage = 5;
  const total = Math.max(1, Math.ceil(filteredLogs.length / perPage));
  const safe = Math.min(page, total);
  const pageLogs = filteredLogs.slice((safe - 1) * perPage, safe * perPage);

  useEffect(() => {
    setPage(1);
    setLogSearch("");
  }, [customer.id]);

  useEffect(() => {
    setPage(1);
  }, [logSearch]);

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-black">문자/연락 기록</h2>
        <Badge color="purple">{keyword ? `${filteredLogs.length}/${logs.length}건` : `${logs.length}건`}</Badge>
      </div>

      <input
        className="mb-3 w-full rounded-2xl border p-3 text-sm"
        placeholder="날짜, 시간, 구분, 내용으로 검색 예: 2026-05, 14:30, 통화, 소개"
        value={logSearch}
        onChange={(e) => setLogSearch(e.target.value)}
      />

      <div className="grid gap-2 md:grid-cols-5">
        <input className="rounded-2xl border p-3" value={logDraft.date} onChange={(e) => setLogDraft({ ...logDraft, date: e.target.value })} />
        <div className="rounded-2xl border bg-slate-50 p-3 text-sm">
          <p className="text-xs text-slate-400">자동 시간</p>
          <p className="font-bold">{nowTime()}</p>
        </div>
        <select className="rounded-2xl border p-3 md:col-span-3" value={logDraft.kind} onChange={(e) => setLogDraft({ ...logDraft, kind: e.target.value })}>
          <option>문자</option>
          <option>통화</option>
          <option>상담</option>
          <option>소개요청</option>
          <option>기타</option>
        </select>
        <textarea className="min-h-[80px] rounded-2xl border p-3 md:col-span-5" placeholder="내용" value={logDraft.content} onChange={(e) => setLogDraft({ ...logDraft, content: e.target.value })} />
      </div>

      <div className="mt-3 flex gap-2">
        <Button onClick={onAdd} className="flex-1">{editingLogId ? "기록 수정 저장" : "기록 추가"}</Button>
        {editingLogId ? <Button light onClick={onCancelEdit}>수정 취소</Button> : null}
      </div>

      <div className="mt-4 space-y-2">
        {logs.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">아직 저장된 기록이 없습니다.</p>
        ) : filteredLogs.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">검색 결과가 없습니다.</p>
        ) : (
          pageLogs.map((log) => (
            <div key={log.id} className="rounded-2xl bg-slate-50 p-3 text-sm">
              <div className="flex justify-between gap-3">
                <div>
                  <b>{log.date} {log.time || ""} · {log.kind}</b>
                  <p className="mt-1 whitespace-pre-wrap text-slate-600">{log.content}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <button type="button" className="text-xs font-bold text-blue-600" onClick={() => onEdit(log)}>수정</button>
                  <button type="button" className="text-xs font-bold text-slate-500" onClick={() => onDelete(log.id)}>삭제</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {filteredLogs.length > perPage ? (
        <div className="mt-4 flex items-center justify-between rounded-2xl bg-white p-2 text-sm">
          <Button light onClick={() => setPage(Math.max(1, safe - 1))}>이전</Button>
          <b>{safe} / {total} 페이지</b>
          <Button light onClick={() => setPage(Math.min(total, safe + 1))}>다음</Button>
        </div>
      ) : null}
    </Card>
  );
}

export default function App() {
  const [unlocked, setUnlocked] = useState(false);
  const [sessionPassword, setSessionPassword] = useState('');
  const [customers, setCustomers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState('');
  const [quickFilter, setQuickFilter] = useState('전체');
  const [gradeFilter, setGradeFilter] = useState('전체');
  const [customerPage, setCustomerPage] = useState(1);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState([]);
  const [familyOpen, setFamilyOpen] = useState(false);
  const [template, setTemplate] = useState('관계회복');
  const [counselorName, setCounselorName] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyCustomer());
  const [familyDraft, setFamilyDraft] = useState(emptyFamily());
  const [logDraft, setLogDraft] = useState(emptyLog());
  const [editingLogId, setEditingLogId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [appointmentDate, setAppointmentDate] = useState(today());
  const [appointmentTime, setAppointmentTime] = useState('10:00');
  const activityRef = useRef(Date.now());

  const selected = customers.find((c) => c.id === selectedId) || customers[0] || emptyCustomer();
  const due = customers.filter((c) => c.next <= today());

  const persist = async (list = customers, password = sessionPassword) => {
    if (!password) return;
    localStorage.setItem(VAULT_KEY, JSON.stringify(await encryptObject({ customers: list }, password)));
  };
  const setAndSave = async (list) => {
    const normalized = normalizeCustomers(list);
    setCustomers(normalized);
    if (!normalized.some((c) => c.id === selectedId)) setSelectedId(normalized[0]?.id || null);
    await persist(normalized);
  };
  const handleLogin = (list, password) => {
    const normalized = normalizeCustomers(list);
    setCustomers(normalized);
    setSelectedId(normalized[0]?.id || null);
    setSessionPassword(password);
    setUnlocked(true);
    activityRef.current = Date.now();
  };
  const lockApp = async () => {
    await persist();
    setUnlocked(false);
    setSessionPassword('');
    setCustomers([]);
    setSelectedId(null);
  };

  useEffect(() => {
    if (!unlocked || !sessionPassword) return undefined;
    const t = setTimeout(() => persist(), 700);
    return () => clearTimeout(t);
  }, [customers, unlocked, sessionPassword]);

  useEffect(() => {
    if (!unlocked) return undefined;
    const touch = () => { activityRef.current = Date.now(); };
    ['click', 'keydown', 'touchstart'].forEach((e) => window.addEventListener(e, touch));
    const t = setInterval(() => { if (Date.now() - activityRef.current > AUTO_LOCK_MS) lockApp(); }, 30000);
    return () => {
      ['click', 'keydown', 'touchstart'].forEach((e) => window.removeEventListener(e, touch));
      clearInterval(t);
    };
  }, [unlocked, customers, sessionPassword]);

  const filtered = useMemo(() => customers.filter((c) => {
    const passQuick = quickFilter === '전체' || (quickFilter === '오늘연락' && c.next <= today()) || (quickFilter === 'VIP' && c.grade === 'VIP') || (quickFilter === '가족정보' && c.family.length > 0);
    const passGrade = gradeFilter === '전체' || c.grade === gradeFilter;
    const passQuery = JSON.stringify(c).toLowerCase().includes(query.toLowerCase());
    return passQuick && passGrade && passQuery;
  }), [customers, quickFilter, gradeFilter, query]);

  useEffect(() => {
    setCustomerPage(1);
  }, [query, quickFilter, gradeFilter]);

  useEffect(() => {
    setFamilyOpen(false);
  }, [selectedId]);

  if (!unlocked) return <LockScreen onLogin={handleLogin} />;

  const counselor = counselorName.trim() || '담당 상담사';
  const messages = {
    관계회복: ['안녕하세요, ' + selected.name + '님! ' + counselor + '입니다.', '그동안 제가 더 세심하게 챙겨드렸어야 했는데 인사가 늦었습니다. 오늘 문득 생각나서 안부 여쭤봅니다.', '혹시 보험 관련해서 궁금하시거나 불편한 점은 없으셨나요? 부담 없이 말씀 주세요.'],
    정보공유: ['안녕하세요, ' + selected.name + '님! ' + counselor + '입니다.', '최근 보험금 청구 상담 중 놓치기 쉬운 부분이 있어 연락드렸습니다.', selected.topic || '도움 될 만한 내용을 정리해드릴 수 있습니다.'],
    생일: [selected.name + '님, 생일 진심으로 축하드립니다!', '오늘 하루 기분 좋은 시간 보내시고 건강하고 좋은 일 많으시길 응원하겠습니다.'],
    갱신점검: ['안녕하세요, ' + selected.name + '님! ' + counselor + '입니다.', '보험은 시간이 지나면서 갱신, 보장 변화, 가족 상황 변화 때문에 한 번씩 점검이 필요합니다.', '필요하실 때 편하게 말씀 주세요.'],
    소개요청: ['안녕하세요, ' + selected.name + '님! ' + counselor + '입니다.', '주변에 보험은 있는데 제대로 되어 있는지 모르겠거나 보험료가 부담되는 분이 계시면 편하게 소개해 주세요.', '무리한 권유 없이 필요한 부분만 정리해드리겠습니다.']
  };
  const message = messages[template].join(String.fromCharCode(10, 10));
  const d = depth(selected.score || 0);
  const customerPerPage = 5;
  const totalCustomerPages = Math.max(1, Math.ceil(filtered.length / customerPerPage));
  const safeCustomerPage = Math.min(customerPage, totalCustomerPages);
  const pagedCustomers = filtered.slice((safeCustomerPage - 1) * customerPerPage, safeCustomerPage * customerPerPage);
  const pagedCustomerIds = pagedCustomers.map((customer) => customer.id);
  const allPagedSelected = pagedCustomerIds.length > 0 && pagedCustomerIds.every((id) => selectedCustomerIds.includes(id));

  const toggleCustomerSelection = (id) => {
    setSelectedCustomerIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  };

  const toggleSelectPagedCustomers = () => {
    setSelectedCustomerIds((prev) => {
      if (allPagedSelected) {
        return prev.filter((id) => !pagedCustomerIds.includes(id));
      }
      return Array.from(new Set([...prev, ...pagedCustomerIds]));
    });
  };

  const clearCustomerSelection = () => {
    setSelectedCustomerIds([]);
  };


  const openAdd = () => { setForm({ ...emptyCustomer(), id: Date.now(), tagText: '' }); setFamilyDraft(emptyFamily()); setModal('customer-add'); };
  const openEdit = () => { setForm({ ...selected, tagText: tagsToText(selected.tags) }); setFamilyDraft(emptyFamily()); setModal('customer-edit'); };

  const saveCustomer = async () => {
    if (!form.name.trim()) { setStatus('고객명을 입력해 주세요.'); return; }
    const saved = { ...form, phone: formatPhone(form.phone), rrn: formatRrn(form.rrn), tags: textToTags(form.tagText), family: (form.family || []).map((family) => ({ ...family, phone: formatPhone(family.phone), rrn: formatRrn(family.rrn) })), logs: form.logs || [] };
    delete saved.tagText;
    if (modal === 'customer-add') {
      const start = saved.temp === '따뜻함' ? 55 : saved.temp === '차가움' ? 10 : 30;
      const newCustomer = { ...saved, score: start, count: 0, lastAction: '신규 등록' };
      await setAndSave([newCustomer, ...customers]);
      setSelectedId(newCustomer.id);
    } else {
      await setAndSave(customers.map((c) => c.id === selected.id ? saved : c));
    }
    setModal(null);
    setStatus('');
  };

  const recordAction = async (action) => {
    await setAndSave(customers.map((c) => {
      if (c.id !== selected.id) return c;
      const score = Math.min(100, (c.score || 0) + gain(action));
      const autoLog = action === '통화 완료'
        ? { id: Date.now(), date: today(), time: nowTime(), kind: '통화', title: '통화 완료', content: '고객 상세에서 통화 완료로 자동 기록됨' }
        : null;
      return {
        ...c,
        logs: autoLog ? [autoLog, ...(c.logs || [])] : (c.logs || []),
        status: action,
        next: nextDate(action),
        score,
        temp: nextTemp(score),
        count: (c.count || 0) + 1,
        lastAction: action
      };
    }));
  };

  const openAppointment = () => {
    setAppointmentDate(selected.next || today());
    setAppointmentTime('10:00');
    setModal('appointment');
  };

  const saveAppointment = async () => {
    if (!appointmentDate || !appointmentTime) { setStatus('상담 날짜와 시간을 선택해 주세요.'); return; }
    await setAndSave(customers.map((c) => {
      if (c.id !== selected.id) return c;
      const action = '상담 예약';
      const score = Math.min(100, (c.score || 0) + gain(action));
      const log = { id: Date.now(), date: today(), time: nowTime(), kind: '상담', title: '상담 예약', content: `상담 예약일: ${appointmentDate} ${appointmentTime}` };
      return {
        ...c,
        logs: [log, ...(c.logs || [])],
        status: action,
        next: appointmentDate,
        score,
        temp: nextTemp(score),
        count: (c.count || 0) + 1,
        lastAction: `${action} ${appointmentDate} ${appointmentTime}`
      };
    }));
    setModal(null);
    setStatus(`상담이 ${appointmentDate} ${appointmentTime}으로 예약되었습니다.`);
  };

  const addLog = async () => {
    if (!logDraft.content.trim()) return;
    const action = actionFromLogKind(logDraft.kind);
    if (editingLogId) {
      await setAndSave(customers.map((c) => {
        if (c.id !== selected.id) return c;
        return {
          ...c,
          logs: (c.logs || []).map((log) => log.id === editingLogId
            ? { ...logDraft, id: editingLogId, time: logDraft.time || nowTime(), title: '' }
            : log)
        };
      }));
      setEditingLogId(null);
      setLogDraft(emptyLog());
      setStatus('문자/연락 기록이 수정되었습니다.');
      return;
    }
    await setAndSave(customers.map((c) => {
      if (c.id !== selected.id) return c;
      const score = Math.min(100, (c.score || 0) + gain(action));
      const log = { ...logDraft, id: Date.now(), time: nowTime(), title: '' };
      return { ...c, logs: [log, ...(c.logs || [])], status: action, next: nextDate(action), score, temp: nextTemp(score), count: (c.count || 0) + 1, lastAction: action };
    }));
    setLogDraft(emptyLog());
  };

  const editLog = (log) => { setEditingLogId(log.id); setLogDraft({ ...emptyLog(), ...log, title: '' }); setStatus('수정할 기록을 불러왔습니다.'); };
  const cancelEditLog = () => { setEditingLogId(null); setLogDraft(emptyLog()); setStatus(''); };
  const deleteLog = async (id) => {
    await setAndSave(customers.map((c) => c.id === selected.id ? { ...c, logs: (c.logs || []).filter((l) => l.id !== id) } : c));
    if (editingLogId === id) cancelEditLog();
  };

  const exportExcel = () => {
    const rows = [];
    customers.forEach((customer) => {
      const familyList = customer.family && customer.family.length ? customer.family : [{}];
      const latestLog = (customer.logs || [])[0] || {};
      familyList.forEach((family) => {
        rows.push({
          고객명: customer.name || '',
          전화번호: customer.phone || '',
          주민등록번호: customer.rrn || '',
          고객나이: ageTextFromRrn(customer.rrn),
          등급: customer.grade || '',
          관계온도: relationTempText(customer.score),
          관계점수: relationTempText(customer.score),
          상태: customer.status || '',
          최초등록일: customer.registeredAt || '',
          다음연락일: customer.next || '',
          태그: (customer.tags || []).join(', '),
          가족관계: family.rel || '',
          가족명: family.name || '',
          가족주민번호: family.rrn || '',
          가족나이: ageTextFromRrn(family.rrn),
          가족전화번호: family.phone || '',
          가족메모: family.memo || '',
          최근연락일시: `${latestLog.date || ''} ${latestLog.time || ''}`.trim(),
          최근연락구분: latestLog.kind || '',
          최근연락내용: latestLog.content || '',
          상담후기: customer.review || '',
          메모: customer.memo || ''
        });
      });
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '고객정보');
    XLSX.writeFile(wb, '고객정보_전체주민번호_가족분리_' + today() + '.xlsx');
    setStatus('고객정보 엑셀 파일을 만들었습니다.');
  };

  const importExcel = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (!rows.length) { setStatus('가져올 데이터가 없습니다.'); event.target.value = ''; return; }

      const grouped = new Map();
      rows.forEach((row, index) => {
        const name = asText(row.고객명);
        const phone = formatPhone(row.전화번호);
        const rrn = formatRrn(row.주민등록번호 || row['주민등록번호(마스킹)'] || '');
        if (!name && !phone && !rrn) return;
        const key = cleanRrn(rrn) || `${name}|${cleanPhone(phone)}` || String(index);

        if (!grouped.has(key)) {
          grouped.set(key, {
            ...emptyCustomer(),
            id: Date.now() + index,
            registeredAt: asText(row.최초등록일) || today(),
            name,
            phone,
            rrn,
            grade: asText(row.등급) || '잠재',
            temp: asText(row.관계온도) || '보통',
            score: Number(String(row.관계점수 || '').replace(/[^0-9.]/g, '')) || 30,
            status: asText(row.상태) || '안부 필요',
            next: asText(row.다음연락일) || addDays(7),
            topic: '',
            tags: textToTags(row.태그),
            review: asText(row.상담후기),
            memo: asText(row.메모),
            lastAction: '엑셀 가져오기',
            family: [],
            logs: []
          });
        }

        const current = grouped.get(key);
        const latestAt = asText(row.최근연락일시);
        const latestKind = asText(row.최근연락구분);
        const latestContent = asText(row.최근연락내용);
        if ((latestAt || latestKind || latestContent) && current.logs.length === 0) {
          const [datePart, timePart] = latestAt.split(' ');
          current.logs.push({
            id: Date.now() + index + 500,
            date: datePart || today(),
            time: timePart || '',
            kind: latestKind || '기타',
            title: latestKind || '엑셀 가져오기',
            content: latestContent
          });
        }

        const family = {
          id: Date.now() + index + 1000 + current.family.length,
          rel: asText(row.가족관계) || '기타',
          name: asText(row.가족명),
          rrn: formatRrn(row.가족주민번호 || ''),
          phone: formatPhone(row.가족전화번호),
          memo: asText(row.가족메모)
        };
        if (family.rel !== '기타' || family.name || family.rrn || family.phone || family.memo) {
          const familyKey = `${family.rel}|${family.name}|${cleanRrn(family.rrn)}|${cleanPhone(family.phone)}`;
          const exists = current.family.some((f) => `${f.rel}|${f.name}|${cleanRrn(f.rrn)}|${cleanPhone(f.phone)}` === familyKey);
          if (!exists) current.family.push(family);
        }
      });

      const imported = Array.from(grouped.values());
      const existing = new Map(customers.map((c) => [(cleanRrn(c.rrn) || `${c.name}|${cleanPhone(c.phone)}`), c]));

      imported.forEach((incoming) => {
        const key = cleanRrn(incoming.rrn) || `${incoming.name}|${cleanPhone(incoming.phone)}`;
        const old = existing.get(key);
        if (old) {
          existing.set(key, {
            ...old,
            ...incoming,
            id: old.id,
            registeredAt: old.registeredAt || incoming.registeredAt,
            family: incoming.family.length ? incoming.family : old.family,
            logs: incoming.logs.length ? incoming.logs : old.logs
          });
        } else {
          existing.set(key, incoming);
        }
      });

      const merged = Array.from(existing.values());
      await setAndSave(merged);
      setSelectedId(imported[0]?.id || merged[0]?.id || null);
      setStatus(`엑셀에서 ${imported.length}명의 고객정보를 가져왔습니다.`);
    } catch (error) {
      console.error(error);
      setStatus('엑셀 가져오기 실패: 파일 형식이나 열 이름을 확인해 주세요.');
    }
    event.target.value = '';
  };

  const savePassword = async () => {
    if (newPw.length < 4) { setStatus('암호는 4자리 이상이어야 합니다.'); return; }
    if (newPw !== newPw2) { setStatus('암호가 서로 다릅니다.'); return; }
    localStorage.setItem(VAULT_KEY, JSON.stringify(await encryptObject({ customers }, newPw)));
    setSessionPassword(newPw);
    setModal(null);
    setStatus('암호가 변경되었습니다.');
  };

  const deleteCustomer = async () => {
    const remain = customers.filter((c) => c.id !== selected.id);
    await setAndSave(remain);
    setSelectedId(remain[0]?.id || null);
    setModal(null);
    setStatus('고객이 삭제되었습니다.');
  };

  const deleteSelectedCustomers = async () => {
    if (selectedCustomerIds.length === 0) return;
    const removeSet = new Set(selectedCustomerIds);
    const remain = customers.filter((customer) => !removeSet.has(customer.id));
    await setAndSave(remain);
    setSelectedCustomerIds([]);
    setSelectedId((current) => removeSet.has(current) ? (remain[0]?.id || null) : current);
    setModal(null);
    setStatus(`${removeSet.size}명의 고객이 삭제되었습니다.`);
  };

  const copyMessage = () => {
    navigator.clipboard?.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const renderModal = () => {
    if (modal === 'customer-add' || modal === 'customer-edit') {
      return <CustomerEditor mode={modal === 'customer-add' ? 'add' : 'edit'} form={form} setForm={setForm} familyDraft={familyDraft} setFamilyDraft={setFamilyDraft} onSave={saveCustomer} onClose={() => setModal(null)} />;
    }
    if (modal === "password") {
      return <Modal title="암호 변경" onClose={() => setModal(null)}><div className="space-y-2"><input type="password" className="w-full rounded-2xl border p-3" placeholder="새 암호" value={newPw} onChange={(e) => setNewPw(e.target.value)} /><input type="password" className="w-full rounded-2xl border p-3" placeholder="새 암호 확인" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} /></div><Button className="mt-4 w-full" onClick={savePassword}>변경 저장</Button></Modal>;
    }
    if (modal === 'delete') {
      return <Modal title="고객 삭제" onClose={() => setModal(null)}><p className="text-sm text-slate-600"><b>{selected.name || '선택한 고객'}</b> 고객을 삭제합니다. 삭제 후에는 백업 파일이 없으면 복구하기 어렵습니다.</p><div className="mt-5 flex gap-2"><Button light className="flex-1" onClick={() => setModal(null)}>취소</Button><Button className="flex-1" onClick={deleteCustomer}>삭제 실행</Button></div></Modal>;
    }
    if (modal === 'bulk-delete') {
      return <Modal title="선택 고객 삭제" onClose={() => setModal(null)}><p className="text-sm text-slate-600"><b>{selectedCustomerIds.length}명</b>의 고객을 삭제합니다. 삭제 후에는 복구하기 어렵습니다.</p><div className="mt-5 flex gap-2"><Button light className="flex-1" onClick={() => setModal(null)}>취소</Button><Button className="flex-1" onClick={deleteSelectedCustomers}>선택 고객 삭제</Button></div></Modal>;
    }
    if (modal === 'appointment') {
      return <Modal title="상담 예약" onClose={() => setModal(null)}><div className="space-y-3"><div><p className="mb-1 text-sm font-bold text-slate-600">상담 날짜</p><input type="date" className="w-full rounded-2xl border p-3" value={appointmentDate} onChange={(e) => setAppointmentDate(e.target.value)} /></div><div><p className="mb-1 text-sm font-bold text-slate-600">상담 시간</p><input type="time" className="w-full rounded-2xl border p-3" value={appointmentTime} onChange={(e) => setAppointmentTime(e.target.value)} /></div><div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">선택한 일정: <b>{appointmentDate || '날짜 미선택'} {appointmentTime || '시간 미선택'}</b></div></div><Button className="mt-4 w-full" onClick={saveAppointment}>상담 예약 저장</Button></Modal>;
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-bold text-slate-500">🔐 암호화 고객관리 CRM</p>
            <h1 className="text-3xl font-black">관계가 다시 살아나는 고객관리</h1>
            {status ? <p className="mt-1 text-sm font-bold text-emerald-700">{status}</p> : null}
          </div>
          <div className="flex flex-col gap-2 md:items-end">
            <input className="w-full rounded-2xl border bg-white p-3 text-sm md:w-64" placeholder="상담사 이름 예: 홍길동" value={counselorName} onChange={(e) => setCounselorName(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              
              
              <Button light onClick={exportExcel}>엑셀 내보내기</Button>
              <label className="cursor-pointer rounded-2xl border bg-white px-4 py-2.5 text-sm font-bold text-slate-700">엑셀 가져오기<input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={importExcel} /></label>
              
              <Button light onClick={lockApp}>잠금</Button>
              <Button light onClick={() => { setNewPw(''); setNewPw2(''); setModal('password'); }}>암호 변경</Button>
              
            </div>
          </div>
        </header>

        {due.length > 0 ? <div className="mb-5 rounded-3xl border border-rose-100 bg-rose-50 p-4 text-rose-800"><b>🔔 오늘 연락 대상 {due.length}명</b><p className="text-sm">{due.map((c) => c.name).join(', ')}</p></div> : null}

        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ['전체', customers.length, '전체 고객'],
            ['오늘연락', due.length, '오늘 연락'],
            ['VIP', customers.filter((c) => c.grade === 'VIP').length, 'VIP'],
            ['가족정보', customers.filter((c) => c.family.length > 0).length, '가족 정보 보유']
          ].map(([key, value, label]) => (
            <button key={key} type="button" onClick={() => { setQuickFilter(key); setQuery(''); setGradeFilter('전체'); }} className={(quickFilter === key ? 'ring-2 ring-slate-900 ' : '') + 'rounded-3xl bg-white p-4 text-left shadow-sm'}>
              <b className="text-2xl">{value}</b>
              <p className="text-sm text-slate-500">{label}</p>
            </button>
          ))}
        </div>

        <main className="grid gap-5 lg:grid-cols-[1fr_1.15fr]">
          <section>
            <Card>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="font-black">고객 목록</h2>
                <Badge color="purple">{quickFilter}</Badge>
              </div>

              <div className="mb-3 flex flex-wrap gap-2">
                <Button onClick={openAdd} className="text-xs px-3 py-2">＋ 고객 추가</Button>
                <Button
                  light
                  onClick={() => selectedCustomerIds.length > 0 && setModal('bulk-delete')}
                  disabled={selectedCustomerIds.length === 0}
                  className="text-xs px-3 py-2"
                >
                  선택 삭제 {selectedCustomerIds.length > 0 ? `${selectedCustomerIds.length}명` : ''}
                </Button>
                {selectedCustomerIds.length > 0 ? (
                  <Button light onClick={clearCustomerSelection} className="text-xs px-3 py-2">선택 해제</Button>
                ) : null}
              </div>

              <div className="mb-3 flex gap-2">
                <input className="flex-1 rounded-2xl border p-3" placeholder="검색" value={query} onChange={(e) => setQuery(e.target.value)} />
                <select className="rounded-2xl border p-3" value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}>
                  <option>전체</option>
                  <option>VIP</option>
                  <option>잠재</option>
                  <option>유지</option>
                </select>
              </div>

              {pagedCustomers.length > 0 ? (
                <label className="mb-2 flex items-center gap-2 rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-600">
                  <input type="checkbox" checked={allPagedSelected} onChange={toggleSelectPagedCustomers} />
                  현재 페이지 전체 선택
                </label>
              ) : null}

              {pagedCustomers.map((c) => {
                const info = depth(c.score || 0);
                const checked = selectedCustomerIds.includes(c.id);
                return (
                  <div
                    key={c.id}
                    className={(c.id === selected.id ? 'bg-slate-900 text-white ' : 'bg-white ') + 'mb-2 flex w-full items-center gap-3 rounded-2xl border p-3'}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCustomerSelection(c.id)}
                      className="h-4 w-4 shrink-0"
                    />
                    <button type="button" onClick={() => setSelectedId(c.id)} className="flex-1 text-left">
                      <div className="flex justify-between gap-2">
                        <div>
                          <b>{c.name}</b>
                          <p className="text-xs opacity-70">{c.phone} · 가족 {c.family.length}명 · 기록 {(c.logs || []).length}건</p>
                          <p className="text-xs opacity-70">{info[0]} {info[1]} · {relationTempText(c.score)}</p>
                        </div>
                        <b>{relationTempText(c.score)}</b>
                      </div>
                    </button>
                  </div>
                );
              })}

              {totalCustomerPages > 1 ? (
                <div className="mt-4 flex items-center justify-between rounded-2xl bg-white p-2 text-sm">
                  <Button light onClick={() => setCustomerPage(Math.max(1, safeCustomerPage - 1))}>이전</Button>
                  <b>{safeCustomerPage} / {totalCustomerPages} 페이지</b>
                  <Button light onClick={() => setCustomerPage(Math.min(totalCustomerPages, safeCustomerPage + 1))}>다음</Button>
                </div>
              ) : null}
            </Card>
          </section>
          <section className="space-y-5">
            <Card>
              <div className="flex flex-col justify-between gap-3 md:flex-row">
                <div><h2 className="text-2xl font-black">{selected.name}</h2><p className="text-sm text-slate-500">{selected.phone}</p></div>
                <div className="flex flex-wrap gap-1.5"><SmallButton light onClick={() => recordAction('통화 완료')}>☎ 통화 완료</SmallButton><SmallButton onClick={openAppointment}>📅 상담 예약</SmallButton><SmallButton light onClick={openEdit}>✏️ 고객 수정</SmallButton><SmallButton light onClick={() => setModal('delete')}>🗑 고객 삭제</SmallButton></div>
              </div>
              <div className="mt-4 rounded-2xl bg-slate-50 p-4"><div className="flex justify-between"><div><p className="text-sm text-slate-500">관계온도</p><h3 className="text-xl font-black">{d[0]} {d[1]}</h3><p className="text-sm text-slate-500">{d[2]}</p></div><b className="text-3xl">{relationTempText(selected.score)}</b></div><div className="mt-3 h-3 rounded-full bg-white"><div className="h-3 rounded-full bg-slate-900" style={{ width: Math.min(100, selected.score || 0) + '%' }} /></div></div>
              <div className="mt-4 grid gap-3 md:grid-cols-2"><Info title="최초 등록일" value={selected.registeredAt || '미입력'} /><Info title="다음 연락일" value={selected.next} /><Info title="고객 주민등록번호" value={maskRrn(selected.rrn)} sub={birthFromRrn(selected.rrn) ? birthFromRrn(selected.rrn) + ' · ' + ageTextFromRrn(selected.rrn) : '나이 자동 계산 대기'} /><Info title="최근 기록" value={selected.lastAction || '-'} /></div>
              <div className="mt-4">
                <button type="button" onClick={() => setFamilyOpen(!familyOpen)} className="mb-2 flex w-full items-center justify-between rounded-2xl bg-slate-50 p-3 text-left">
                  <span className="font-black">가족 정보</span>
                  <span className="flex items-center gap-2"><Badge color="purple">{selected.family.length}명</Badge><span className="text-xs font-bold text-slate-500">{familyOpen ? '접기' : '펼치기'}</span></span>
                </button>
                {selected.family.length === 0 ? (
                  <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">등록된 가족 정보가 없습니다.</p>
                ) : !familyOpen ? (
                  <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">가족 정보 {selected.family.length}명이 등록되어 있습니다. 자세히 보려면 펼치기를 눌러주세요.</p>
                ) : (
                  selected.family.map((f) => (
                    <div key={f.id} className="mb-2 rounded-2xl bg-slate-50 p-3">
                      <b>{f.rel} · {f.name || '이름 미입력'} · {ageTextFromRrn(f.rrn)}</b>
                      <p className="text-sm text-slate-500">생년월일 {birthFromRrn(f.rrn) || '미입력'}</p>
                      <p className="text-sm text-slate-500">주민등록번호 {maskRrn(f.rrn)}</p>
                      <p className="text-sm text-slate-500">전화번호 {f.phone || '미입력'}</p>
                      <p className="text-sm">{f.memo || '메모 없음'}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-4"><p className="text-xs text-slate-400">상담후기</p><p className="whitespace-pre-wrap">{selected.review || '상담후기 없음'}</p></div>
              <div className="mt-4"><p className="text-xs text-slate-400">메모</p><p>{selected.memo || '메모 없음'}</p><div className="mt-2 flex flex-wrap gap-2">{(selected.tags || []).map((t) => <Badge key={t}>#{t}</Badge>)}</div></div>
            </Card>

            <LogManager customer={selected} logDraft={logDraft} setLogDraft={setLogDraft} onAdd={addLog} onDelete={deleteLog} onEdit={editLog} editingLogId={editingLogId} onCancelEdit={cancelEditLog} />

            <Card>
              <h2 className="font-black">연락 메시지 자동 초안</h2>
              <div className="my-3 grid grid-cols-2 gap-2 md:grid-cols-5">{Object.keys(messages).map((key) => <button key={key} type="button" onClick={() => setTemplate(key)} className={(template === key ? 'bg-slate-900 text-white ' : 'bg-slate-100 ') + 'rounded-2xl px-3 py-2 text-sm font-bold'}>{key}</button>)}</div>
              <textarea readOnly value={message} className="min-h-[190px] w-full rounded-2xl border bg-slate-50 p-4" />
              <div className="mt-3"><Button onClick={copyMessage}>{copied ? '복사 완료' : '메시지 복사'}</Button></div>
            </Card>
          </section>
        </main>

        {renderModal()}
      </div>
    </div>
  );
}
