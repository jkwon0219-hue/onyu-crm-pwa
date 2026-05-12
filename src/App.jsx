import React, { useEffect, useRef, useState } from "react";

const VAULT_KEY = "onyu_relationship_crm_secure_v1";
const OLD_KEYS = ["onyu_relationship_crm_v2", "onyu_relationship_crm_v1"];
const AUTO_LOCK_MS = 5 * 60 * 1000;
const ITERATIONS = 120000;
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

const pad = (n) => String(n).padStart(2, "0");
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
const birth = (value) => {
  const raw = String(value || "").trim();
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length === 8) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  return raw;
};
const formatRrn = (value) => {
  const raw = String(value || "").trim();
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length === 13) return `${digits.slice(0, 6)}-${digits.slice(6)}`;
  return raw;
};
const maskRrn = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "미입력";
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length >= 7) return `${digits.slice(0, 6)}-${digits.slice(6, 7)}******`;
  return raw;
};
const birthFromRrn = (value) => {
  const digits = String(value || "").replace(/[^0-9]/g, "");
  if (digits.length < 7) return "";
  const yy = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const dd = digits.slice(4, 6);
  const gender = digits.slice(6, 7);
  let century = "19";
  if (["3", "4", "7", "8"].includes(gender)) century = "20";
  return `${century}${yy}-${mm}-${dd}`;
};
const age = (value) => {
  const digits = birth(value).replace(/[^0-9]/g, "");
  if (digits.length !== 8) return "";
  const now = new Date();
  const y = Number(digits.slice(0, 4));
  const m = Number(digits.slice(4, 6));
  const d = Number(digits.slice(6, 8));
  let a = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) a -= 1;
  return a >= 0 ? a : "";
};
const ageFromRrn = (value) => {
  const b = birthFromRrn(value);
  return b ? age(b) : "";
};
const ageTextFromRrn = (value) => {
  const a = ageFromRrn(value);
  return a === "" ? "나이 자동 계산 대기" : `${a}세`;
};
const textToTags = (text) => String(text || "").split(",").map((v) => v.trim()).filter(Boolean);
const tagsToText = (tags) => Array.isArray(tags) ? tags.join(", ") : "";
const emptyFamily = () => ({ id: Date.now(), rel: "배우자", name: "", rrn: "", phone: "", birthday: "", memo: "" });
const emptyLog = () => ({ id: Date.now(), date: today(), time: nowTime(), kind: "문자", title: "", content: "" });
const emptyCustomer = () => ({
  id: Date.now(), name: "", phone: "", rrn: "", grade: "잠재", temp: "보통", status: "안부 필요",
  next: addDays(7), topic: "", memo: "", tags: [], score: 30, count: 0,
  lastAction: "신규 등록", family: [], logs: []
});

const sample = [
  {
    id: 1, name: "김민규", phone: "010-1234-5678", rrn: "840219-1234567", grade: "VIP", temp: "따뜻함",
    status: "안부 필요", next: today(), topic: "보험금 청구 사례 공유",
    memo: "소개 가능성 높음. 가족 보험도 관심 있음.", tags: ["소개 가능", "가족 확장"],
    score: 74, count: 8, lastAction: "기존 상담",
    family: [
      { id: 11, rel: "배우자", name: "배우자", rrn: "860521-2234567", phone: "010-0000-0000", birthday: "1986-05-21", memo: "실비 점검 필요" },
      { id: 12, rel: "자녀", name: "첫째", rrn: "180914-3234567", phone: "", birthday: "2018-09-14", memo: "어린이보험 확인 가능" }
    ],
    logs: []
  },
  {
    id: 2, name: "박지은", phone: "010-2345-6789", rrn: "901103-2234567", grade: "잠재", temp: "보통",
    status: "정보 전달", next: addDays(3), topic: "갱신 보험료 점검",
    memo: "보험료 부담 언급. 무리한 권유 느낌 주면 안 됨.", tags: ["보험료 부담"],
    score: 46, count: 3, lastAction: "정보 전달", family: [], logs: []
  },
  {
    id: 3, name: "이상훈", phone: "010-3456-7890", rrn: "790219-1234567", grade: "유지", temp: "차가움",
    status: "관계 회복", next: addDays(7), topic: "오랜만의 안부",
    memo: "오래 연락 안 됨. 솔직 담백형 메시지 추천.", tags: ["휴면"],
    score: 18, count: 0, lastAction: "장기 미접촉",
    family: [{ id: 31, rel: "배우자", name: "배우자", rrn: "", phone: "", birthday: "", memo: "가족 보장 확인 가능성 있음" }],
    logs: []
  }
];

const toB64 = (bytes) => {
  let text = "";
  for (let i = 0; i < bytes.length; i += 1) text += String.fromCharCode(bytes[i]);
  return btoa(text);
};
const fromB64 = (text) => {
  const raw = atob(text);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
};
const deriveKey = async (password, salt) => {
  const baseKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" }, baseKey, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
};
const encryptObject = async (payload, password) => {
  if (!crypto.subtle) throw new Error("이 브라우저는 암호화를 지원하지 않습니다.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const plain = new TextEncoder().encode(JSON.stringify(payload));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain));
  return { version: 1, salt: toB64(salt), iv: toB64(iv), data: toB64(cipher), savedAt: new Date().toISOString() };
};
const decryptObject = async (vault, password) => {
  const salt = fromB64(vault.salt);
  const iv = fromB64(vault.iv);
  const cipher = fromB64(vault.data);
  const key = await deriveKey(password, salt);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  return JSON.parse(new TextDecoder().decode(plain));
};
const readPlainCustomers = () => {
  for (const key of OLD_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // ignore
    }
  }
  return null;
};

const depth = (score) => {
  if (score >= 90) return ["🏆", "팬 고객", "실제 소개와 재상담이 자연스러운 매우 깊은 관계"];
  if (score >= 80) return ["🤝", "신뢰 관계", "꾸준한 소통이 쌓여 상담 대화가 자연스러운 관계"];
  if (score >= 60) return ["😊", "익숙한 관계", "안부와 정보 제공이 자연스럽게 받아들여지는 단계"];
  if (score >= 35) return ["🌱", "관계 회복 중", "판매보다 안부와 도움 되는 정보로 천천히 쌓아야 하는 단계"];
  return ["🧊", "차가운 관계", "짧고 부담 없는 연락부터 필요한 단계"];
};
const gain = (action) => {
  if (action === "상담 예약") return 5;
  if (action === "소개 요청") return 4;
  if (action === "통화 완료") return 3;
  if (action === "메시지 발송") return 1;
  return 1;
};
const nextDate = (action) => {
  if (action === "상담 예약") return addDays(1);
  if (action === "소개 요청") return addDays(30);
  if (action === "메시지 발송") return addDays(45);
  return addDays(60);
};
const nextTemp = (score) => score >= 80 ? "따뜻함" : score >= 40 ? "보통" : "차가움";
const actionFromLogKind = (kind) => {
  if (kind === "문자") return "메시지 발송";
  if (kind === "통화") return "통화 완료";
  if (kind === "상담") return "상담 예약";
  if (kind === "소개요청") return "소개 요청";
  return "기타";
};

const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
};

function Badge({ children, color = "slate" }) {
  const map = { slate: "bg-slate-100 text-slate-700", amber: "bg-amber-100 text-amber-800", blue: "bg-blue-100 text-blue-800", green: "bg-emerald-100 text-emerald-800", rose: "bg-rose-100 text-rose-800", purple: "bg-purple-100 text-purple-800" };
  return <span className={(map[color] || map.slate) + " rounded-full px-2.5 py-1 text-xs font-bold"}>{children}</span>;
}
function Button({ children, onClick, light = false, className = "", disabled = false }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={(light ? "border bg-white text-slate-700 " : "bg-slate-900 text-white ") + "rounded-2xl px-4 py-2.5 text-sm font-bold disabled:opacity-50 " + className}>{children}</button>;
}
function Card({ children, className = "" }) {
  return <div className={"rounded-3xl bg-white p-4 shadow-sm " + className}>{children}</div>;
}
function Info({ title, value, sub }) {
  return <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs text-slate-400">{title}</p><b>{value}</b>{sub && <p className="text-sm text-slate-500">{sub}</p>}</div>;
}

function LockScreen({ onLogin }) {
  const hasVault = Boolean(localStorage.getItem(VAULT_KEY));
  const hasPlain = Boolean(readPlainCustomers());
  const setupMode = !hasVault;
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    if (password.length < 4) return setError("암호는 4자리 이상 입력해 주세요.");
    try {
      setBusy(true);
      if (setupMode) {
        if (password !== confirmPassword) return setError("암호가 서로 다릅니다.");
        const initialCustomers = hasPlain ? readPlainCustomers() : sample;
        const vault = await encryptObject({ customers: initialCustomers }, password);
        localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
        OLD_KEYS.forEach((key) => localStorage.removeItem(key));
        onLogin(initialCustomers, password);
      } else {
        const vault = JSON.parse(localStorage.getItem(VAULT_KEY));
        const payload = await decryptObject(vault, password);
        onLogin(Array.isArray(payload.customers) ? payload.customers : [], password);
      }
    } catch {
      setError(setupMode ? "암호화 저장 중 오류가 났습니다." : "암호가 틀렸거나 저장 데이터가 손상되었습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-5 text-white">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 text-slate-900 shadow-xl">
        <p className="text-sm font-bold text-slate-500">고객 데이터 암호화</p>
        <h1 className="mt-1 text-2xl font-black">고객관리 앱 잠금</h1>
        <p className="mt-2 text-sm text-slate-500">고객정보는 비밀번호로 암호화되어 이 브라우저 안에 저장됩니다.</p>
        {setupMode && hasPlain && <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-800">기존 저장 고객을 발견했습니다. 암호 설정 후 암호화 저장으로 전환됩니다.</p>}
        <div className="mt-5 space-y-3">
          <input type="password" className="w-full rounded-2xl border p-3" placeholder={setupMode ? "새 암호 설정" : "암호 입력"} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
          {setupMode && <input type="password" className="w-full rounded-2xl border p-3" placeholder="새 암호 확인" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />}
          {error && <p className="text-sm font-bold text-rose-600">{error}</p>}
          <Button onClick={submit} className="w-full">{busy ? "처리 중..." : setupMode ? "암호 설정 후 시작" : "잠금 해제"}</Button>
        </div>
      </div>
    </div>
  );
}

function CustomerModal({ mode, form, setForm, familyDraft, setFamilyDraft, onSave, onClose }) {
  const [editingFamilyId, setEditingFamilyId] = useState(null);
  const saveFamily = () => {
    if (!familyDraft.name && !familyDraft.rrn && !familyDraft.phone && !familyDraft.memo) {
      alert("가족 이름, 주민등록번호, 전화번호, 메모 중 하나는 입력해 주세요.");
      return;
    }
    const saved = { ...familyDraft, id: editingFamilyId || Date.now(), rrn: formatRrn(familyDraft.rrn), phone: familyDraft.phone || "", birthday: birthFromRrn(familyDraft.rrn) };
    if (editingFamilyId) setForm({ ...form, family: form.family.map((f) => f.id === editingFamilyId ? saved : f) });
    else setForm({ ...form, family: [...form.family, saved] });
    setFamilyDraft(emptyFamily());
    setEditingFamilyId(null);
  };
  const editFamily = (family) => {
    setFamilyDraft({ ...family, rrn: formatRrn(family.rrn), phone: family.phone || "" });
    setEditingFamilyId(family.id);
  };
  const deleteFamily = (id) => {
    setForm({ ...form, family: form.family.filter((f) => f.id !== id) });
    if (editingFamilyId === id) {
      setFamilyDraft(emptyFamily());
      setEditingFamilyId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 md:items-center">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-3xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div><h2 className="text-xl font-black">{mode === "add" ? "고객 추가" : "고객 수정"}</h2><p className="text-sm text-slate-500">고객 정보와 가족 정보를 입력하세요.</p></div>
          <Button light onClick={onClose}>닫기</Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <input className="rounded-2xl border p-3" placeholder="고객명" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="rounded-2xl border p-3" placeholder="전화번호" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <div>
            <input className="w-full rounded-2xl border p-3" placeholder="주민등록번호 예: 840219-1234567" value={form.rrn || ""} onChange={(e) => setForm({ ...form, rrn: formatRrn(e.target.value) })} />
            <p className="mt-1 px-2 text-xs text-slate-500">자동 나이: {ageTextFromRrn(form.rrn)}</p>
          </div>
          <input className="rounded-2xl border p-3" placeholder="연락 목적" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
          <select className="rounded-2xl border p-3" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}><option>VIP</option><option>잠재</option><option>유지</option></select>
          <select className="rounded-2xl border p-3" value={form.temp} onChange={(e) => setForm({ ...form, temp: e.target.value })}><option>따뜻함</option><option>보통</option><option>차가움</option></select>
          <select className="rounded-2xl border p-3" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option>안부 필요</option><option>정보 전달</option><option>관계 회복</option><option>메시지 발송</option><option>통화 완료</option><option>상담 예약</option><option>소개 요청</option></select>
          <input className="rounded-2xl border p-3" placeholder="다음 연락일 YYYY-MM-DD" value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} />
          <input className="rounded-2xl border p-3 md:col-span-2" placeholder="태그 쉼표 구분" value={form.tagText} onChange={(e) => setForm({ ...form, tagText: e.target.value })} />
          <textarea className="min-h-[80px] rounded-2xl border p-3 md:col-span-2" placeholder="고객 메모" value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
        </div>

        <div className="mt-5 rounded-3xl bg-slate-50 p-4">
          <div className="mb-3 flex items-center justify-between"><h3 className="font-black">가족 구성원</h3><Badge color="purple">{form.family.length}명</Badge></div>
          <div className="grid gap-2 md:grid-cols-5">
            <select className="rounded-2xl border bg-white p-3" value={familyDraft.rel} onChange={(e) => setFamilyDraft({ ...familyDraft, rel: e.target.value })}><option>배우자</option><option>자녀</option><option>부모님</option><option>형제자매</option><option>기타</option></select>
            <input className="rounded-2xl border bg-white p-3" placeholder="이름/호칭" value={familyDraft.name} onChange={(e) => setFamilyDraft({ ...familyDraft, name: e.target.value })} />
            <input className="rounded-2xl border bg-white p-3" placeholder="주민등록번호" value={familyDraft.rrn || ""} onChange={(e) => setFamilyDraft({ ...familyDraft, rrn: formatRrn(e.target.value) })} />
            <input className="rounded-2xl border bg-white p-3" placeholder="가족 전화번호" value={familyDraft.phone || ""} onChange={(e) => setFamilyDraft({ ...familyDraft, phone: e.target.value })} />
            <div className="rounded-2xl border bg-white p-3 text-sm"><p className="text-xs text-slate-400">자동 나이</p><p className="font-bold">{ageTextFromRrn(familyDraft.rrn)}</p></div>
            <textarea className="min-h-[60px] rounded-2xl border bg-white p-3 md:col-span-5" placeholder="가족 메모" value={familyDraft.memo} onChange={(e) => setFamilyDraft({ ...familyDraft, memo: e.target.value })} />
            <Button onClick={saveFamily} className="md:col-span-5">{editingFamilyId ? "가족 수정 저장" : "가족 추가"}</Button>
            {editingFamilyId && <button type="button" className="rounded-2xl border bg-white p-3 text-sm font-bold md:col-span-5" onClick={() => { setFamilyDraft(emptyFamily()); setEditingFamilyId(null); }}>가족 수정 취소</button>}
          </div>

          {form.family.map((f) => (
            <div key={f.id} className="mt-2 flex justify-between rounded-2xl bg-white p-3 text-sm">
              <div>
                <b>{f.rel} · {f.name || "이름 미입력"} · {ageTextFromRrn(f.rrn)}</b>
                <p className="text-slate-500">생년월일 {birthFromRrn(f.rrn) || "미입력"}</p>
                <p className="text-slate-500">주민등록번호 {maskRrn(f.rrn)}</p>
                <p className="text-slate-500">전화번호 {f.phone || "미입력"}</p>
                <p>{f.memo || "메모 없음"}</p>
              </div>
              <div className="flex flex-col gap-2">
                <button type="button" className="text-xs font-bold text-blue-600" onClick={() => editFamily(f)}>수정</button>
                <button type="button" className="text-xs font-bold text-slate-500" onClick={() => deleteFamily(f.id)}>삭제</button>
              </div>
            </div>
          ))}
        </div>
        <Button onClick={onSave} className="mt-4 w-full">저장하기</Button>
      </div>
    </div>
  );
}

function LogManager({ customer, logDraft, setLogDraft, addLog, deleteLog }) {
  const [page, setPage] = useState(1);
  const logs = customer.logs || [];
  const perPage = 5;
  const totalPages = Math.max(1, Math.ceil(logs.length / perPage));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * perPage;
  const pageLogs = logs.slice(start, start + perPage);

  useEffect(() => { setPage(1); }, [customer.id]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-black">문자/연락 기록</h2>
        <Badge color="purple">{logs.length}건</Badge>
      </div>

      <div className="grid gap-2 md:grid-cols-5">
        <input className="rounded-2xl border p-3" value={logDraft.date} onChange={(e) => setLogDraft({ ...logDraft, date: e.target.value })} />
        <div className="rounded-2xl border bg-slate-50 p-3 text-sm"><p className="text-xs text-slate-400">자동 시간</p><p className="font-bold">{nowTime()}</p></div>
        <select className="rounded-2xl border p-3" value={logDraft.kind} onChange={(e) => setLogDraft({ ...logDraft, kind: e.target.value })}><option>문자</option><option>통화</option><option>상담</option><option>소개요청</option><option>기타</option></select>
        <input className="rounded-2xl border p-3 md:col-span-2" placeholder="제목 예: 관계회복 문자" value={logDraft.title} onChange={(e) => setLogDraft({ ...logDraft, title: e.target.value })} />
        <textarea className="min-h-[80px] rounded-2xl border p-3 md:col-span-5" placeholder="보낸 문자 내용 또는 통화 내용을 기록하세요." value={logDraft.content} onChange={(e) => setLogDraft({ ...logDraft, content: e.target.value })} />
      </div>

      <Button onClick={addLog} className="mt-3 w-full">기록 추가</Button>

      <div className="mt-4 space-y-2">
        {logs.length === 0 ? <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">아직 저장된 기록이 없습니다.</p> : pageLogs.map((log) => (
          <div key={log.id} className="rounded-2xl bg-slate-50 p-3 text-sm">
            <div className="flex justify-between gap-3">
              <div>
                <b>{log.date} {log.time || ""} · {log.kind} · {log.title || "제목 없음"}</b>
                <p className="mt-1 whitespace-pre-wrap text-slate-600">{log.content}</p>
              </div>
              <button type="button" className="text-xs font-bold text-slate-500" onClick={() => deleteLog(log.id)}>삭제</button>
            </div>
          </div>
        ))}
      </div>

      {logs.length > perPage && (
        <div className="mt-4 flex items-center justify-between rounded-2xl bg-white p-2 text-sm">
          <Button light onClick={() => setPage(Math.max(1, safePage - 1))}>이전</Button>
          <b>{safePage} / {totalPages} 페이지</b>
          <Button light onClick={() => setPage(Math.min(totalPages, safePage + 1))}>다음</Button>
        </div>
      )}
    </Card>
  );
}

export default function App() {
  const [unlocked, setUnlocked] = useState(false);
  const [sessionPassword, setSessionPassword] = useState("");
  const [customers, setCustomers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState("전체");
  const [gradeFilter, setGradeFilter] = useState("전체");
  const [template, setTemplate] = useState("관계회복");
  const [counselorName, setCounselorName] = useState("");
  const [modal, setModal] = useState("");
  const [form, setForm] = useState(emptyCustomer());
  const [familyDraft, setFamilyDraft] = useState(emptyFamily());
  const [logDraft, setLogDraft] = useState(emptyLog());
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pushStatus, setPushStatus] = useState("");
  const activityRef = useRef(Date.now());

  const persist = async (list = customers, password = sessionPassword) => {
    if (!password) return;
    setSaving(true);
    const vault = await encryptObject({ customers: list }, password);
    localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
    setSaving(false);
  };
  const lockApp = async () => {
    if (unlocked && sessionPassword) await persist(customers, sessionPassword);
    setUnlocked(false);
    setSessionPassword("");
    setCustomers([]);
    setSelectedId(null);
  };
  const handleLogin = (list, password) => {
    const normalized = list.map((c) => ({ ...c, rrn: c.rrn || "", family: c.family || [], logs: c.logs || [] }));
    setCustomers(normalized);
    setSelectedId(normalized[0]?.id || null);
    setSessionPassword(password);
    setUnlocked(true);
    activityRef.current = Date.now();
  };

  useEffect(() => {
    if (!unlocked || !sessionPassword) return undefined;
    const timer = setTimeout(() => { persist(customers, sessionPassword); }, 500);
    return () => clearTimeout(timer);
  }, [customers, unlocked, sessionPassword]);

  useEffect(() => {
    if (!unlocked) return undefined;
    const touch = () => { activityRef.current = Date.now(); };
    ["click", "keydown", "touchstart", "mousemove"].forEach((event) => window.addEventListener(event, touch));
    const timer = setInterval(() => { if (Date.now() - activityRef.current > AUTO_LOCK_MS) lockApp(); }, 30000);
    return () => {
      ["click", "keydown", "touchstart", "mousemove"].forEach((event) => window.removeEventListener(event, touch));
      clearInterval(timer);
    };
  }, [unlocked, sessionPassword, customers]);

  if (!unlocked) return <LockScreen onLogin={handleLogin} />;

  const selected = customers.find((c) => c.id === selectedId) || customers[0] || emptyCustomer();
  const due = customers.filter((c) => c.next <= today());
  const filtered = customers.filter((c) => {
    const passQuick = quickFilter === "전체" || (quickFilter === "오늘연락" && c.next <= today()) || (quickFilter === "VIP" && c.grade === "VIP") || (quickFilter === "가족정보" && c.family.length > 0);
    const passGrade = gradeFilter === "전체" || c.grade === gradeFilter;
    const passQuery = JSON.stringify(c).toLowerCase().includes(query.toLowerCase());
    return passQuick && passGrade && passQuery;
  });

  const counselor = counselorName.trim() || "담당 상담사";
  const messages = {
    관계회복: ["안녕하세요, " + selected.name + "님! " + counselor + "입니다.", "그동안 제가 더 세심하게 챙겨드렸어야 했는데 인사가 늦었습니다. 오늘 문득 생각나서 안부 여쭤봅니다.", "혹시 보험 관련해서 궁금하시거나 불편한 점은 없으셨나요? 부담 없이 말씀 주세요."],
    정보공유: ["안녕하세요, " + selected.name + "님! " + counselor + "입니다.", "최근 보험금 청구 상담 중 놓치기 쉬운 부분이 있어 연락드렸습니다.", selected.topic || "도움 될 만한 내용을 정리해드릴 수 있습니다."],
    생일: [selected.name + "님, 생일 진심으로 축하드립니다!", "오늘 하루 기분 좋은 시간 보내시고 건강하고 좋은 일 많으시길 응원하겠습니다."],
    갱신점검: ["안녕하세요, " + selected.name + "님! " + counselor + "입니다.", "보험은 시간이 지나면서 갱신, 보장 변화, 가족 상황 변화 때문에 한 번씩 점검이 필요합니다.", "필요하실 때 편하게 말씀 주세요."],
    소개요청: ["안녕하세요, " + selected.name + "님! " + counselor + "입니다.", "주변에 보험은 있는데 제대로 되어 있는지 모르겠거나 보험료가 부담되는 분이 계시면 편하게 소개해 주세요.", "무리한 권유 없이 필요한 부분만 정리해드리겠습니다."]
  };
  const message = messages[template].join(String.fromCharCode(10, 10));

  const updateCustomers = (nextList) => setCustomers(nextList.map((c) => ({ ...c, logs: c.logs || [], family: c.family || [] })));
  const openAdd = () => { setForm({ ...emptyCustomer(), id: Date.now(), tagText: "" }); setFamilyDraft(emptyFamily()); setModal("add"); };
  const openEdit = () => { setForm({ ...selected, logs: selected.logs || [], tagText: tagsToText(selected.tags) }); setFamilyDraft(emptyFamily()); setModal("edit"); };
  const saveCustomer = () => {
    if (!form.name.trim()) return alert("고객명을 입력해 주세요.");
    const saved = {
      ...form,
      rrn: formatRrn(form.rrn),
      tags: textToTags(form.tagText),
      family: form.family.map((f) => ({ ...f, rrn: formatRrn(f.rrn), phone: f.phone || "", birthday: birthFromRrn(f.rrn) })),
      logs: form.logs || []
    };
    delete saved.tagText;
    if (modal === "add") {
      const start = saved.temp === "따뜻함" ? 55 : saved.temp === "차가움" ? 10 : 30;
      const newCustomer = { ...saved, score: start, count: 0, lastAction: "신규 등록" };
      updateCustomers([newCustomer, ...customers]);
      setSelectedId(newCustomer.id);
    } else {
      updateCustomers(customers.map((c) => c.id === selected.id ? { ...c, ...saved } : c));
    }
    setModal("");
  };
  const record = (action) => {
    updateCustomers(customers.map((c) => {
      if (c.id !== selected.id) return c;
      const score = Math.min(100, (c.score || 0) + gain(action));
      return { ...c, status: action, next: nextDate(action), score, temp: nextTemp(score), count: (c.count || 0) + 1, lastAction: action };
    }));
  };
  const addManualLog = () => {
    if (!logDraft.content.trim() && !logDraft.title.trim()) return alert("기록할 제목이나 내용을 입력해 주세요.");
    const action = actionFromLogKind(logDraft.kind);
    updateCustomers(customers.map((c) => {
      if (c.id !== selected.id) return c;
      const score = Math.min(100, (c.score || 0) + gain(action));
      const savedLog = { ...logDraft, id: Date.now(), date: logDraft.date || today(), time: nowTime(), title: logDraft.title || action };
      return { ...c, logs: [savedLog, ...(c.logs || [])], status: action, next: nextDate(action), score, temp: nextTemp(score), count: (c.count || 0) + 1, lastAction: action };
    }));
    setLogDraft(emptyLog());
  };
  const deleteLog = (id) => updateCustomers(customers.map((c) => c.id === selected.id ? { ...c, logs: (c.logs || []).filter((l) => l.id !== id) } : c));
  const copyMessage = () => { navigator.clipboard?.writeText(message); setCopied(true); setTimeout(() => setCopied(false), 1200); };
  const changePassword = async () => {
    const next = prompt("새 암호를 입력하세요. 4자리 이상");
    if (!next || next.length < 4) return alert("암호 변경이 취소되었거나 4자리 미만입니다.");
    const confirmNext = prompt("새 암호를 한 번 더 입력하세요.");
    if (next !== confirmNext) return alert("암호가 서로 다릅니다.");
    await persist(customers, next);
    setSessionPassword(next);
    alert("암호가 변경되었습니다.");
  };
  const exportBackup = async () => {
    const backup = await encryptObject({ customers, exportedAt: new Date().toISOString() }, sessionPassword);
    const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "onyu-crm-encrypted-backup-" + today() + ".json"; a.click();
    URL.revokeObjectURL(url);
  };
  const importBackup = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const payload = await decryptObject(JSON.parse(text), sessionPassword);
      const list = Array.isArray(payload.customers) ? payload.customers : [];
      if (!confirm("백업 데이터로 현재 고객 목록을 교체할까요?")) return;
      updateCustomers(list);
      setSelectedId(list[0]?.id || null);
      alert("복원이 완료되었습니다.");
    } catch {
      alert("복원 실패: 현재 암호와 백업 암호가 다르거나 파일이 손상되었습니다.");
    }
    event.target.value = "";
  };
  const resetData = () => {
    if (!confirm("샘플 데이터로 초기화할까요? 현재 저장된 고객 데이터가 바뀝니다.")) return;
    updateCustomers(sample);
    setSelectedId(sample[0].id);
  };

  const enablePush = async () => {
    try {
      setPushStatus("");
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        alert("이 브라우저는 웹 푸시 알림을 지원하지 않습니다.");
        return;
      }
      if (!VAPID_PUBLIC_KEY) {
        alert("VAPID 공개키가 설정되지 않았습니다. README의 Netlify 환경변수 설정을 먼저 해주세요.");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        alert("알림 권한이 허용되지 않았습니다.");
        return;
      }
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      }
      const response = await fetch("/.netlify/functions/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription })
      });
      if (!response.ok) throw new Error("구독 저장 실패");
      setPushStatus("푸시 알림 켜짐");
      alert("푸시 알림이 켜졌습니다. 매일 오전 9시에 일반 알림이 발송됩니다.");
    } catch (error) {
      console.error(error);
      alert("푸시 알림 설정 중 오류가 났습니다. 환경변수와 Netlify Functions 배포를 확인해 주세요.");
    }
  };
  const sendTestPush = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) return alert("먼저 푸시 알림을 켜주세요.");
      const response = await fetch("/.netlify/functions/test-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription })
      });
      if (!response.ok) throw new Error("테스트 푸시 실패");
      alert("테스트 푸시를 보냈습니다.");
    } catch (error) {
      console.error(error);
      alert("테스트 푸시 발송 실패. Netlify 환경변수와 Functions를 확인해 주세요.");
    }
  };

  const d = depth(selected.score || 0);

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-bold text-slate-500">🔐 암호화 고객관리 CRM</p>
            <h1 className="text-3xl font-black">관계가 다시 살아나는 고객관리</h1>
            {pushStatus && <p className="mt-1 text-sm font-bold text-emerald-700">{pushStatus}</p>}
          </div>
          <div className="flex flex-col gap-2 md:items-end">
            <input className="w-full rounded-2xl border bg-white p-3 text-sm md:w-64" placeholder="상담사 이름 예: 홍길동" value={counselorName} onChange={(e) => setCounselorName(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Button onClick={openAdd}>＋ 고객 추가</Button>
              <Button light onClick={enablePush}>푸시 알림 켜기</Button>
              <Button light onClick={sendTestPush}>테스트 푸시</Button>
              <Button light onClick={exportBackup}>암호화 백업</Button>
              <label className="cursor-pointer rounded-2xl border bg-white px-4 py-2.5 text-sm font-bold text-slate-700">복원<input type="file" accept="application/json" className="hidden" onChange={importBackup} /></label>
              <Button light onClick={lockApp}>잠금</Button>
              <Button light onClick={changePassword}>암호 변경</Button>
              <Button light onClick={resetData}>초기화</Button>
            </div>
          </div>
        </header>

        {due.length > 0 && (
          <div className="mb-5 rounded-3xl border border-rose-100 bg-rose-50 p-4 text-rose-800">
            <b>🔔 오늘 연락 대상 {due.length}명</b>
            <p className="text-sm">{due.map((c) => c.name).join(", ")}</p>
          </div>
        )}

        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["전체", customers.length, "전체 고객"],
            ["오늘연락", due.length, "오늘 연락"],
            ["VIP", customers.filter(c => c.grade === "VIP").length, "VIP"],
            ["가족정보", customers.filter(c => c.family.length > 0).length, "가족 정보 보유"]
          ].map(([key, value, label]) => (
            <button key={key} onClick={() => { setQuickFilter(key); setQuery(""); setGradeFilter("전체"); }} className={(quickFilter === key ? "ring-2 ring-slate-900 " : "") + "rounded-3xl bg-white p-4 text-left shadow-sm"}>
              <b className="text-2xl">{value}</b><p className="text-sm text-slate-500">{label}</p>
            </button>
          ))}
        </div>

        <main className="grid gap-5 lg:grid-cols-[1fr_1.15fr]">
          <section className="space-y-5">
            <Card>
              <div className="mb-3 flex items-center justify-between"><h2 className="font-black">고객 목록</h2><Badge color="purple">{quickFilter}</Badge></div>
              <div className="mb-3 flex gap-2">
                <input className="flex-1 rounded-2xl border p-3" placeholder="검색" value={query} onChange={(e) => setQuery(e.target.value)} />
                <select className="rounded-2xl border p-3" value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}><option>전체</option><option>VIP</option><option>잠재</option><option>유지</option></select>
              </div>
              {filtered.map((c) => {
                const info = depth(c.score || 0);
                return (
                  <button key={c.id} onClick={() => setSelectedId(c.id)} className={(c.id === selected.id ? "bg-slate-900 text-white " : "bg-white ") + "mb-2 w-full rounded-2xl border p-3 text-left"}>
                    <div className="flex justify-between"><div><b>{c.name}</b><p className="text-xs opacity-70">{c.phone} · 가족 {c.family.length}명 · 기록 {(c.logs || []).length}건</p><p className="text-xs opacity-70">{info[0]} {info[1]}</p></div><b>{c.score}</b></div>
                  </button>
                );
              })}
            </Card>
          </section>

          <section className="space-y-5">
            <Card>
              <div className="flex flex-col justify-between gap-3 md:flex-row">
                <div><h2 className="text-2xl font-black">{selected.name}</h2><p className="text-sm text-slate-500">{selected.phone}</p><div className="mt-2 flex gap-2"><Badge color={selected.grade === "VIP" ? "amber" : selected.grade === "잠재" ? "blue" : "green"}>{selected.grade}</Badge><Badge>{selected.temp}</Badge></div></div>
                <div className="flex flex-wrap gap-2"><Button light onClick={openEdit}>✏️ 고객 수정</Button><Button light onClick={() => record("통화 완료")}>☎ 통화 완료</Button><Button onClick={() => record("상담 예약")}>📅 상담 예약</Button></div>
              </div>

              <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                <div className="flex justify-between"><div><p className="text-sm text-slate-500">관계 깊이</p><h3 className="text-xl font-black">{d[0]} {d[1]}</h3><p className="text-sm text-slate-500">{d[2]}</p></div><b className="text-3xl">{selected.score}</b></div>
                <div className="mt-3 h-3 rounded-full bg-white"><div className="h-3 rounded-full bg-slate-900" style={{ width: Math.min(100, selected.score || 0) + "%" }} /></div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Info title="연락 목적" value={selected.topic || "미입력"} />
                <Info title="다음 연락일" value={selected.next} />
                <Info title="고객 주민등록번호" value={maskRrn(selected.rrn)} sub={birthFromRrn(selected.rrn) ? `${birthFromRrn(selected.rrn)} · ${ageTextFromRrn(selected.rrn)}` : "나이 자동 계산 대기"} />
                <Info title="최근 기록" value={selected.lastAction || "-"} />
              </div>

              <div className="mt-4">
                <div className="mb-2 flex justify-between"><h3 className="font-black">가족 정보</h3><Badge color="purple">{selected.family.length}명</Badge></div>
                {selected.family.length === 0 ? <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">등록된 가족 정보가 없습니다.</p> : selected.family.map((f) => (
                  <div key={f.id} className="mb-2 rounded-2xl bg-slate-50 p-3">
                    <b>{f.rel} · {f.name || "이름 미입력"} · {ageTextFromRrn(f.rrn)}</b>
                    <p className="text-sm text-slate-500">생년월일 {birthFromRrn(f.rrn) || "미입력"}</p>
                    <p className="text-sm text-slate-500">주민등록번호 {maskRrn(f.rrn)}</p>
                    <p className="text-sm text-slate-500">전화번호 {f.phone || "미입력"}</p>
                    <p className="text-sm">{f.memo || "메모 없음"}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4"><p className="text-xs text-slate-400">메모</p><p>{selected.memo || "메모 없음"}</p><div className="mt-2 flex flex-wrap gap-2">{(selected.tags || []).map(t => <Badge key={t}>#{t}</Badge>)}</div></div>
            </Card>

            <LogManager customer={selected} logDraft={logDraft} setLogDraft={setLogDraft} addLog={addManualLog} deleteLog={deleteLog} />

            <Card>
              <h2 className="font-black">연락 메시지 자동 초안</h2>
              <div className="my-3 grid grid-cols-2 gap-2 md:grid-cols-5">
                {Object.keys(messages).map((key) => <button key={key} onClick={() => setTemplate(key)} className={(template === key ? "bg-slate-900 text-white " : "bg-slate-100 ") + "rounded-2xl px-3 py-2 text-sm font-bold"}>{key}</button>)}
              </div>
              <textarea readOnly value={message} className="min-h-[190px] w-full rounded-2xl border bg-slate-50 p-4" />
              <div className="mt-3 flex flex-wrap gap-2"><Button onClick={copyMessage}>{copied ? "복사 완료" : "메시지 복사"}</Button></div>
            </Card>
          </section>
        </main>

        {modal && <CustomerModal mode={modal} form={form} setForm={setForm} familyDraft={familyDraft} setFamilyDraft={setFamilyDraft} onSave={saveCustomer} onClose={() => setModal("")} />}
      </div>
    </div>
  );
}
