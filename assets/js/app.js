/* ===== 弗露化成 AIGC 教培平台 · 公共初始化与工具 ===== */
/* 云服务 publicConfig（由 workbuddy_cloud_service activate 返回） */
const WB_PUBLIC_CONFIG = {
  endpoint: 'https://aigc-edu-platform.app.workbuddy.host',
  publishableKey: 'wbpk_5zh9j1UHjuEvmVL5UuB1xP_mK6QM5XIeJ4nWfgLBjtUhOw0qqKz02me',
};

/* demo-mode.js 在非 WorkBuddy 域（如 GitHub Pages）上会注入 window.cloud 演示实现；
   完整云端版使用真实 SDK 客户端。 */
const cloud = window.__DEMO_MODE && window.cloud
  ? window.cloud
  : WorkBuddyCloud.createWorkBuddyCloud({
      endpoint: WB_PUBLIC_CONFIG.endpoint,
      publishableKey: WB_PUBLIC_CONFIG.publishableKey,
    });

/* ---------- 通用工具 ---------- */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function toast(msg, type) {
  let w = document.getElementById('toast-wrap');
  if (!w) { w = document.createElement('div'); w.id = 'toast-wrap'; document.body.appendChild(w); }
  const t = document.createElement('div');
  t.className = 'toast' + (type ? ' ' + type : '');
  t.textContent = msg;
  w.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 320); }, 2600);
}
function fmtMoney(n) { return '¥' + Number(n || 0).toLocaleString('zh-CN'); }
function fmtTime(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d)) return '-';
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fmtDate(iso) { return fmtTime(iso).slice(0, 10); }
function fmtDur(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
function unwrap(res, label) {
  if (res && res.error) {
    console.error('[cloud]', label || 'request', 'failed:', res.error && res.error.message ? res.error.message : res.error);
    throw new Error(humanDbError(res.error));
  }
  return res && res.data;
}
function humanDbError(err) {
  const code = err && err.code;
  if (code === '42501') return '没有权限执行该操作';
  if (code === '42P01') return '数据表尚未初始化';
  if (code === '23505') return '记录已存在，请勿重复提交';
  if (code === '23503') return '关联数据不存在';
  return (err && err.message) || '请求失败，请稍后重试';
}
const DIRECTION = {
  painting: { label: 'AI 绘画', ico: '🎨' },
  video: { label: 'AI 影视', ico: '🎬' },
  manhua: { label: 'AI 漫剧', ico: '📖' },
};
function dirLabel(d) { return (DIRECTION[d] || {}).label || d || '-'; }
function dirIco(d) { return (DIRECTION[d] || {}).ico || '✨'; }

/* 渐变色封面（确定性哈希 → 双色渐变，用于 AI 生成的占位画面） */
const GRADS = [
  'linear-gradient(135deg,#7C3AED,#2563EB)', 'linear-gradient(135deg,#DB2777,#7C3AED)',
  'linear-gradient(135deg,#0891B2,#2563EB)', 'linear-gradient(135deg,#9333EA,#DB2777)',
  'linear-gradient(135deg,#2563EB,#059669)', 'linear-gradient(135deg,#D97706,#DB2777)',
];
function gradOf(seed) {
  let h = 0;
  const s = String(seed || 'x');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return GRADS[h % GRADS.length];
}

/* 内容安全：提交 / 发布前的本地基础审核（演示级词表 + 长度校验） */
const BLOCK_WORDS = ['暴力', '赌博', '色情', '毒品', '枪支', '自杀'];
function contentSafeCheck(text) {
  const t = String(text || '');
  if (!t.trim()) return '内容不能为空';
  if (t.length > 5000) return '内容过长（上限 5000 字）';
  for (const w of BLOCK_WORDS) {
    if (t.includes(w)) return `内容包含敏感词「${w}」，请修改后再提交`;
  }
  return null;
}

/* ---------- 认证 ---------- */
async function requireSession() {
  const { data: session, error } = await cloud.auth.getSession();
  if (error || !session) return null;
  return session;
}
async function currentProfile() {
  const { data, error } = await cloud.database.from('profiles')
    .select('*').eq('owner_id', (await cloud.auth.getSession()).data.user.id).maybeSingle();
  if (error) return null;
  return data;
}
async function ensureProfile(user, nicknameFallback) {
  // 首次进入时自动创建资料行（owner_id 由数据库默认 auth.uid() 填充，前端不发送）
  const uid = user.id;
  const { data: existing } = await cloud.database.from('profiles').select('*').eq('owner_id', uid).maybeSingle();
  if (existing) return existing;
  const nickname = (user.email || '新学员').split('@')[0].slice(0, 20);
  const ins = await cloud.database.from('profiles').insert({ nickname: nicknameFallback || nickname }).select();
  if (ins.error) { console.error('[cloud] profile create failed:', ins.error.message); return null; }
  return ins.data && ins.data[0];
}
function homeOfRole(role) {
  if (role === 'admin') return 'admin.html';
  if (role === 'teacher') return 'teacher.html';
  return 'learn.html';
}

/* ---------- 渠道归因（首次 + 末次双记录） ---------- */
function captureChannel() {
  try {
    const q = new URLSearchParams(location.search);
    const ch = q.get('ch') || q.get('channel') || '';
    const utm = {};
    for (const [k, v] of q.entries()) if (k.startsWith('utm_')) utm[k] = v;
    if (!ch && Object.keys(utm).length === 0 && !document.referrer) return;
    const rec = JSON.parse(localStorage.getItem('flhc_attr') || '{}');
    const stamp = { ch, utm, t: Date.now() };
    if (!rec.first) rec.first = stamp;
    rec.last = stamp;
    localStorage.setItem('flhc_attr', JSON.stringify(rec));
  } catch (e) { /* 归因失败不阻塞页面 */ }
}
function attrPayload() {
  try {
    const rec = JSON.parse(localStorage.getItem('flhc_attr') || '{}');
    return {
      first_channel: (rec.first && rec.first.ch) || 'direct',
      last_channel: (rec.last && rec.last.ch) || 'direct',
      utm: (rec.last && rec.last.utm) || {},
    };
  } catch (e) { return { first_channel: 'direct', last_channel: 'direct', utm: {} }; }
}

/* ---------- 轻量确认弹窗（替代原生 confirm） ---------- */
function confirmModal(opts) {
  return new Promise((resolve) => {
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML = `
      <div class="modal" style="width:420px">
        <h3>${esc(opts.title || '请确认')}</h3>
        <div class="muted" style="margin-bottom:6px">${opts.html || esc(opts.text || '')}</div>
        <div class="actions">
          <button class="btn ghost" data-a="no">取消</button>
          <button class="btn" data-a="yes">${esc(opts.okText || '确认')}</button>
        </div>
      </div>`;
    mask.addEventListener('click', (e) => {
      if (e.target === mask) { mask.remove(); resolve(false); return; }
      const a = e.target.getAttribute && e.target.getAttribute('data-a');
      if (a === 'yes') { mask.remove(); resolve(true); }
      if (a === 'no') { mask.remove(); resolve(false); }
    });
    document.body.appendChild(mask);
  });
}

/* ---------- 模型缓存（LLM 模型列表一次拉取复用） ---------- */
let _modelsCache = null;
async function listModels() {
  if (_modelsCache) return _modelsCache;
  try {
    const models = await cloud.llm.models.list();
    _modelsCache = (models || []).filter((m) => m.disabled !== true);
  } catch (e) {
    console.error('[cloud] models.list failed:', e && e.message);
    _modelsCache = [];
  }
  return _modelsCache;
}

/* 一次性 LLM 调用：流式收集完整文本（内部使用，UI 不逐字渲染） */
async function llmComplete(modelId, systemPrompt, userPrompt, opts) {
  let out = '';
  for await (const chunk of cloud.llm.chat.completions.create({
    model: modelId,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    stream: true,
    temperature: (opts && opts.temperature) != null ? opts.temperature : 0.5,
    response_format: (opts && opts.json) ? { type: 'json_object' } : undefined,
  })) {
    const d = chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
    if (d && d.content) out += d.content;
  }
  return out;
}
function extractJson(text) {
  if (!text) throw new Error('模型返回为空');
  let t = text.trim();
  const m = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) t = m[1].trim();
  const s = t.indexOf('{'), a = t.indexOf('[');
  const start = (a !== -1 && (a < s || s === -1)) ? a : s;
  if (start > 0) t = t.slice(start);
  const lastB = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (lastB !== -1) t = t.slice(0, lastB + 1);
  return JSON.parse(t);
}
function llmErrText(e) {
  const code = e && e.error && e.error.code ? e.error.code : '';
  if (code.startsWith('quota_')) return '模型调用额度受限，请稍后重试';
  if (code.startsWith('auth_')) return '服务鉴权异常，请联系管理员';
  if (code.startsWith('gateway_') || code.startsWith('model_')) return '模型服务暂不可用，可点击重试或更换模型';
  return (e && e.message) || '生成失败，请重试';
}
