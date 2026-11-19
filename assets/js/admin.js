/* ===== 管理端 admin.js ===== */
const $ = (id) => document.getElementById(id);
const view = () => document.getElementById('view');
let ME = null, SESSION = null;

(async function boot() {
  SESSION = await requireSession();
  if (!SESSION) { location.href = 'auth.html'; return; }
  ME = await ensureProfile(SESSION.user);
  if (!ME || ME.role !== 'admin') {
    view().innerHTML = '<div class="empty"><div class="ico">🔒</div>该页面仅管理员可访问（教师请使用教师端）<div class="mt16"><a class="btn" href="learn.html">返回学习中心</a></div></div>';
    if (ME) $('user-badge').textContent = (ME.nickname || '') + ' · ' + ME.role;
    return;
  }
  $('user-badge').textContent = (ME.nickname || '') + ' · 管理员';
  window.addEventListener('hashchange', route);
  route();
})();
async function logout() { await cloud.auth.signOut(); location.href = 'auth.html'; }

/* 审计日志：管理端手动操作留痕（操作人 / 时间 / 前后值），写入 notifications(type=audit) */
async function audit(action, detail) {
  try {
    await cloud.database.from('notifications').insert({
      owner_id: SESSION.user.id, type: 'audit', title: '[审计] ' + action,
      content: JSON.stringify({ by: ME.nickname, at: new Date().toISOString(), detail }),
    });
  } catch (e) { console.error('[cloud] audit failed:', e && e.message); }
}

function markSide(key) { document.querySelectorAll('.side a').forEach(a => a.classList.toggle('active', a.dataset.key === key)); }
async function route() {
  const key = (location.hash.replace(/^#\//, '') || 'dash').split('/')[0];
  markSide(key);
  view().innerHTML = '<div class="loading"><span class="spin"></span>加载中…</div>';
  try {
    if (key === 'dash') await vDash();
    else if (key === 'courses') await vCourses();
    else if (key === 'questions') await vQuestions();
    else if (key === 'coupons') await vCoupons();
    else if (key === 'projects') await vProjects();
    else if (key === 'students') await vStudents();
    else if (key === 'tenants') await vTenants();
    else if (key === 'leads') await vLeads();
    else await vDash();
  } catch (e) {
    console.error('[admin] view error:', e && e.message);
    view().innerHTML = `<div class="empty"><div class="ico">⚠️</div>${esc(e.message || '加载失败')}</div>`;
  }
}
const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '-';

/* ============ 数据看板（口径与 PRD 第二章一致） ============ */
async function vDash() {
  const [profilesRes, progressRes, subsRes, worksRes, leadsRes, lessonsRes, attemptsRes] = await Promise.all([
    cloud.database.from('profiles').select('*'),
    cloud.database.from('lesson_progress').select('*'),
    cloud.database.from('submissions').select('*'),
    cloud.database.from('works').select('*'),
    cloud.database.from('leads').select('*'),
    cloud.database.from('lessons').select('id').eq('status', 'published'),
    cloud.database.from('practice_attempts').select('*'),
  ]);
  const students = (profilesRes.data || []).filter(p => p.role === 'student');
  const subs = subsRes.data || [];
  const leads = leadsRes.data || [];
  const doneN = progressRes.data.filter(p => p.completed).length;
  const reviewed = subs.filter(s => s.status === 'reviewed');
  const in48h = reviewed.filter(s => s.reviewed_at && s.created_at && (new Date(s.reviewed_at) - new Date(s.created_at)) <= 48 * 3600e3).length;
  const byCh = {};
  leads.forEach(l => { const ch = l.first_channel || 'direct'; byCh[ch] = (byCh[ch] || 0) + 1; });
  const chKeys = Object.keys(byCh).sort((a, b) => byCh[b] - byCh[a]).slice(0, 6);
  const quizUsers = new Set(attemptsRes.data.map(a => a.owner_id)).size;

  view().innerHTML = `
    <h2 style="font-weight:900;font-size:22px">数据看板</h2>
    <p class="muted small mt8">指标口径与 PRD V1.0 第二章一致；目标值待首月真实数据校准后回写。</p>
    <div class="grid c4 mt16">
      <div class="stat"><div class="num">${students.length}</div><div class="lbl">注册学员数</div></div>
      <div class="stat"><div class="num">${doneN}</div><div class="lbl">已完成课次</div><div class="sub">在架课时 ${(lessonsRes.data || []).length}</div></div>
      <div class="stat"><div class="num">${pct(in48h, reviewed.length)}</div><div class="lbl">48h 点评率</div><div class="sub">已点评 ${reviewed.length} / 提交 ${subs.length}</div></div>
      <div class="stat"><div class="num">${(worksRes.data || []).filter(w => w.visibility === 'public').length}</div><div class="lbl">广场公开作品</div></div>
    </div>
    <div class="grid c2 mt16">
      <div class="card">
        <div class="card-title">📣 渠道线索分布 <span class="hint">首次 + 末次双记录</span></div>
        ${chKeys.length ? chKeys.map(ch => `
          <div class="bar-row"><span class="bl">${esc(ch)}</span>
            <div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, byCh[ch] * 12)}%"></div></div>
            <span class="bv">${byCh[ch]}</span></div>`).join('') : '<div class="empty">暂无线索，去落地页产生第一条吧</div>'}
        <div class="flex gap8 mt16" style="flex-wrap:wrap">
          <span class="badge blue">试听预约 ${leads.filter(l => l.event === 'trial').length}</span>
          <span class="badge green">领券 ${leads.filter(l => l.event === 'coupon').length}</span>
          <span class="badge gray">线索总数 ${leads.length}</span>
        </div>
      </div>
      <div class="card">
        <div class="card-title">🧪 题库使用率 <span class="hint">周期内至少完成 1 题的学员占比</span></div>
        <div class="bar-row"><span class="bl">做题学员占比</span><div class="progress-track"><div class="progress-fill" style="width:${pct(quizUsers, Math.max(students.length, 1)).replace('%', '')}%"></div></div><span class="bv">${pct(quizUsers, Math.max(students.length, 1))}</span></div>
        <p class="small muted">累计作答 ${attemptsRes.data.length} 次 · 作业提交 ${subs.length} 份</p>
        <p class="small muted mt16">说明：留存率（队列追踪）与付费转化率（漏斗）在支付与埋点完备后由数据团队回写目标值。</p>
      </div>
    </div>`;
}

/* ============ 课程 / 课时管理 ============ */
async function vCourses() {
  const [coursesRes, lessonsRes] = await Promise.all([
    cloud.database.from('courses').select('*').order('sort'),
    cloud.database.from('lessons').select('*').order('order_no'),
  ]);
  const courses = coursesRes.data || [], lessons = lessonsRes.data || [];
  view().innerHTML = `
    <div class="flex jcb aic" style="flex-wrap:wrap;gap:10px">
      <div><h2 style="font-weight:900;font-size:22px">课程 / 课时管理</h2><p class="muted small mt8">运营自助配置，变更即时生效，不依赖研发发版。</p></div>
      <button class="btn" onclick="editCourse()">＋ 新建课程</button>
    </div>
    ${courses.map(c => {
      const ls = lessons.filter(l => l.course_id === c.id);
      return `
      <div class="card mt16">
        <div class="flex jcb aic" style="flex-wrap:wrap;gap:10px">
          <div class="flex aic gap8" style="flex-wrap:wrap">
            <span style="width:14px;height:14px;border-radius:4px;background:${esc(c.cover_gradient)}"></span>
            <b>${esc(c.title)}</b><span class="badge">${dirLabel(c.direction)}</span>
            <span class="badge ${c.status === 'published' ? 'green' : 'gray'}">${c.status === 'published' ? '已上架' : '草稿'}</span>
            <span class="muted small">${fmtMoney(c.price)} · ${ls.length} 课时</span>
          </div>
          <div class="flex gap8">
            <button class="btn sm ghost" onclick="editCourse(${c.id})">编辑</button>
            <button class="btn sm soft" onclick="editLesson(${c.id})">＋ 课时</button>
            <button class="btn sm ghost" onclick="toggleCourse(${c.id},'${c.status}')">${c.status === 'published' ? '下架' : '上架'}</button>
          </div>
        </div>
        ${ls.length ? `<table class="tbl mt16"><thead><tr><th>#</th><th>课时</th><th>类型</th><th>试听</th><th>作业</th><th></th></tr></thead><tbody>
          ${ls.map(l => `<tr>
            <td class="muted">${l.order_no}</td><td class="small"><b>${esc(l.title)}</b></td>
            <td class="small">${l.kind === 'video' ? '视频' : l.kind === 'live' ? '直播' : '练习'}</td>
            <td>${l.is_free_preview ? '<span class="badge green">试听</span>' : '-'}</td>
            <td class="small muted">${esc(l.assignment_title || '-')}</td>
            <td><button class="btn sm soft" onclick="editLesson(${c.id},${l.id})">编辑</button></td>
          </tr>`).join('')}</tbody></table>` : '<div class="empty small">暂无课时</div>'}
      </div>`;
    }).join('') || '<div class="empty">暂无课程</div>'}`;
}
async function toggleCourse(id, status) {
  const ns = status === 'published' ? 'draft' : 'published';
  try {
    await cloud.database.from('courses').update({ status: ns }).eq('id', id);
    await audit('课程上下架', { id, from: status, to: ns });
    toast(ns === 'published' ? '已上架' : '已下架', 'ok'); route();
  } catch (e) { toast(e.message, 'err'); }
}
function editCourse(id) {
  const mask = document.createElement('div');
  mask.className = 'modal-mask';
  mask.innerHTML = `
    <div class="modal">
      <h3>${id ? '编辑课程' : '新建课程'}</h3>
      <div class="row">
        <div class="field" style="flex:2"><label>课程名称</label><input id="ec-title" class="input"></div>
        <div class="field"><label>副标题</label><input id="ec-sub" class="input"></div>
      </div>
      <div class="field"><label>课程简介</label><textarea id="ec-desc" class="input"></textarea></div>
      <div class="row">
        <div class="field"><label>方向</label><select id="ec-dir" class="input">
          ${['video', 'painting', 'manhua'].map(d => `<option value="${d}">${dirLabel(d)}</option>`).join('')}</select></div>
        <div class="field"><label>价格（元）</label><input id="ec-price" class="input" type="number" value="1999"></div>
        <div class="field"><label>状态</label><select id="ec-status" class="input">
          <option value="draft">草稿</option><option value="published">已上架</option></select></div>
      </div>
      <div class="actions"><button class="btn ghost" onclick="this.closest('.modal-mask').remove()">取消</button><button class="btn" id="ec-ok">保存</button></div>
    </div>`;
  document.body.appendChild(mask);
  if (id) {
    cloud.database.from('courses').select('*').eq('id', id).maybeSingle().then(({ data }) => {
      if (!data) return;
      mask.querySelector('#ec-title').value = data.title || '';
      mask.querySelector('#ec-sub').value = data.subtitle || '';
      mask.querySelector('#ec-desc').value = data.description || '';
      mask.querySelector('#ec-dir').value = data.direction;
      mask.querySelector('#ec-price').value = data.price;
      mask.querySelector('#ec-status').value = data.status;
    });
  }
  mask.querySelector('#ec-ok').onclick = async () => {
    const body = {
      title: mask.querySelector('#ec-title').value.trim(), subtitle: mask.querySelector('#ec-sub').value.trim(),
      description: mask.querySelector('#ec-desc').value.trim(), direction: mask.querySelector('#ec-dir').value,
      price: parseInt(mask.querySelector('#ec-price').value, 10) || 0, status: mask.querySelector('#ec-status').value,
    };
    if (!body.title) return toast('请填写课程名称', 'err');
    try {
      if (id) { await cloud.database.from('courses').update(body).eq('id', id); await audit('编辑课程', { id, ...body }); }
      else { await cloud.database.from('courses').insert(body); await audit('新建课程', body); }
      mask.remove(); toast('已保存', 'ok'); route();
    } catch (e) { toast(e.message, 'err'); }
  };
}
function editLesson(courseId, lessonId) {
  const mask = document.createElement('div');
  mask.className = 'modal-mask';
  mask.innerHTML = `
    <div class="modal">
      <h3>${lessonId ? '编辑课时' : '新建课时'}</h3>
      <div class="row">
        <div class="field" style="flex:2"><label>课时名称</label><input id="el-title" class="input"></div>
        <div class="field"><label>类型</label><select id="el-kind" class="input">
          <option value="video">视频</option><option value="live">直播</option><option value="practice">练习</option></select></div>
        <div class="field" style="flex:0 0 84px"><label>排序</label><input id="el-order" class="input" type="number" value="9"></div>
      </div>
      <div class="field"><label>视频地址（视频课时）</label><input id="el-url" class="input" placeholder="https://...mp4"></div>
      <div class="field"><label>课时简介</label><textarea id="el-content" class="input" style="min-height:56px"></textarea></div>
      <div class="row">
        <div class="field"><label>时长（分钟）</label><input id="el-dur" class="input" type="number" value="20"></div>
        <div class="field"><label>免费试听</label><select id="el-free" class="input"><option value="no">否</option><option value="yes">是（试听漏斗标记）</option></select></div>
        <div class="field"><label>状态</label><select id="el-status" class="input"><option value="published">已发布</option><option value="draft">草稿</option></select></div>
      </div>
      <div class="row">
        <div class="field"><label>作业标题（留空则无作业）</label><input id="el-at" class="input"></div>
        <div class="field" style="flex:2"><label>作业要求</label><input id="el-ar" class="input"></div>
      </div>
      <div class="actions"><button class="btn ghost" onclick="this.closest('.modal-mask').remove()">取消</button><button class="btn" id="el-ok">保存</button></div>
    </div>`;
  document.body.appendChild(mask);
  if (lessonId) {
    cloud.database.from('lessons').select('*').eq('id', lessonId).maybeSingle().then(({ data }) => {
      if (!data) return;
      mask.querySelector('#el-title').value = data.title || '';
      mask.querySelector('#el-kind').value = data.kind;
      mask.querySelector('#el-order').value = data.order_no;
      mask.querySelector('#el-url').value = data.video_url || '';
      mask.querySelector('#el-content').value = data.content || '';
      mask.querySelector('#el-dur').value = data.duration_min;
      mask.querySelector('#el-free').value = data.is_free_preview ? 'yes' : 'no';
      mask.querySelector('#el-status').value = data.status || 'published';
      mask.querySelector('#el-at').value = data.assignment_title || '';
      mask.querySelector('#el-ar').value = data.assignment_req || '';
    });
  }
  mask.querySelector('#el-ok').onclick = async () => {
    const body = {
      course_id: courseId,
      title: mask.querySelector('#el-title').value.trim(), kind: mask.querySelector('#el-kind').value,
      order_no: parseInt(mask.querySelector('#el-order').value, 10) || 9,
      video_url: mask.querySelector('#el-url').value.trim() || null,
      content: mask.querySelector('#el-content').value.trim(),
      duration_min: parseInt(mask.querySelector('#el-dur').value, 10) || 10,
      is_free_preview: mask.querySelector('#el-free').value === 'yes',
      status: mask.querySelector('#el-status').value,
      assignment_title: mask.querySelector('#el-at').value.trim() || null,
      assignment_req: mask.querySelector('#el-ar').value.trim() || null,
    };
    if (!body.title) return toast('请填写课时名称', 'err');
    try {
      if (lessonId) { await cloud.database.from('lessons').update(body).eq('id', lessonId); await audit('编辑课时', { lessonId, ...body }); }
      else { await cloud.database.from('lessons').insert(body); await audit('新建课时', body); }
      mask.remove(); toast('已保存', 'ok'); route();
    } catch (e) { toast(e.message, 'err'); }
  };
}

/* ============ 题库管理 ============ */
async function vQuestions() {
  const { data } = await cloud.database.from('questions').select('*').order('id');
  view().innerHTML = `
    <div class="flex jcb aic" style="flex-wrap:wrap;gap:10px">
      <div><h2 style="font-weight:900;font-size:22px">题库管理</h2><p class="muted small mt8">知识点选择题 / 判断题，课时后嵌入，最高成绩计入掌握度。</p></div>
      <button class="btn" onclick="editQuestion()">＋ 新建题目</button>
    </div>
    <div class="card mt16">
      ${(data || []).length ? `<table class="tbl"><thead><tr><th>#</th><th>题型</th><th>题干</th><th>答案</th><th>知识点</th><th></th></tr></thead><tbody>
      ${(data || []).map(q => `<tr>
        <td class="muted">${q.id}</td><td><span class="badge">${q.type === 'judge' ? '判断' : '单选'}</span></td>
        <td class="small" style="max-width:420px">${esc(q.stem)}</td><td><b>${esc(q.answer)}</b></td>
        <td><span class="tag">${esc(q.knowledge_point)}</span></td>
        <td><button class="btn sm soft" onclick="editQuestion(${q.id})">编辑</button></td>
      </tr>`).join('')}</tbody></table>` : '<div class="empty">暂无题目</div>'}
    </div>`;
}
function editQuestion(id) {
  const mask = document.createElement('div');
  mask.className = 'modal-mask';
  mask.innerHTML = `
    <div class="modal">
      <h3>${id ? '编辑题目' : '新建题目'}</h3>
      <div class="field"><label>题干</label><textarea id="eq-stem" class="input"></textarea></div>
      <div class="row">
        <div class="field"><label>题型</label><select id="eq-type" class="input"><option value="single">单选</option><option value="judge">判断</option></select></div>
        <div class="field" style="flex:2"><label>选项（单选用 | 分隔，如 A. xx | B. xx）</label><input id="eq-opts" class="input"></div>
      </div>
      <div class="row">
        <div class="field"><label>答案（单选填选项原文，判断填 true/false）</label><input id="eq-ans" class="input"></div>
        <div class="field"><label>知识点</label><input id="eq-kp" class="input" value="基础"></div>
      </div>
      <div class="field"><label>解析</label><textarea id="eq-ana" class="input" style="min-height:52px"></textarea></div>
      <div class="actions"><button class="btn ghost" onclick="this.closest('.modal-mask').remove()">取消</button><button class="btn" id="eq-ok">保存</button></div>
    </div>`;
  document.body.appendChild(mask);
  if (id) {
    cloud.database.from('questions').select('*').eq('id', id).maybeSingle().then(({ data }) => {
      if (!data) return;
      mask.querySelector('#eq-stem').value = data.stem || '';
      mask.querySelector('#eq-type').value = data.type;
      mask.querySelector('#eq-opts').value = (data.options || []).join(' | ');
      mask.querySelector('#eq-ans').value = data.answer || '';
      mask.querySelector('#eq-kp').value = data.knowledge_point || '';
      mask.querySelector('#eq-ana').value = data.analysis || '';
    });
  }
  mask.querySelector('#eq-ok').onclick = async () => {
    const type = mask.querySelector('#eq-type').value;
    const body = {
      type,
      stem: mask.querySelector('#eq-stem').value.trim(),
      options: type === 'judge' ? [] : mask.querySelector('#eq-opts').value.split('|').map(s => s.trim()).filter(Boolean),
      answer: mask.querySelector('#eq-ans').value.trim(),
      knowledge_point: mask.querySelector('#eq-kp').value.trim() || '基础',
      analysis: mask.querySelector('#eq-ana').value.trim(),
    };
    if (!body.stem || !body.answer) return toast('题干与答案必填', 'err');
    try {
      if (id) { await cloud.database.from('questions').update(body).eq('id', id); await audit('编辑题目', { id }); }
      else { await cloud.database.from('questions').insert(body); await audit('新建题目', { stem: body.stem.slice(0, 20) }); }
      mask.remove(); toast('已保存', 'ok'); route();
    } catch (e) { toast(e.message, 'err'); }
  };
}

/* ============ 优惠券管理 ============ */
async function vCoupons() {
  const [cpRes, claimsRes] = await Promise.all([
    cloud.database.from('coupons').select('*').order('id'),
    cloud.database.from('coupon_claims').select('*'),
  ]);
  const claimN = {};
  (claimsRes.data || []).forEach(c => claimN[c.coupon_id] = (claimN[c.coupon_id] || 0) + 1);
  view().innerHTML = `
    <div class="flex jcb aic" style="flex-wrap:wrap;gap:10px">
      <div><h2 style="font-weight:900;font-size:22px">优惠券管理</h2><p class="muted small mt8">规则可配置（面额 / 门槛 / 有效期 / 适用课程），发放与核销全链路可查。</p></div>
      <button class="btn" onclick="editCoupon()">＋ 新建优惠券</button>
    </div>
    <div class="card mt16">
      ${(cpRes.data || []).length ? `<table class="tbl"><thead><tr><th>名称</th><th>规则</th><th>有效期</th><th>已领</th><th>状态</th><th></th></tr></thead><tbody>
      ${(cpRes.data || []).map(c => `<tr>
        <td class="small"><b>${esc(c.title)}</b></td>
        <td class="small">${c.kind === 'discount' ? c.discount_rate + ' 折' : '满 ' + fmtMoney(c.threshold) + ' 减 ' + fmtMoney(c.amount)}</td>
        <td class="small muted">${fmtDate(c.valid_until)}</td>
        <td>${claimN[c.id] || 0}</td>
        <td><span class="badge ${c.status === 'active' ? 'green' : 'gray'}">${c.status === 'active' ? '进行中' : '已停用'}</span></td>
        <td><button class="btn sm ghost" onclick="toggleCoupon(${c.id},'${c.status}')">${c.status === 'active' ? '停用' : '启用'}</button></td>
      </tr>`).join('')}</tbody></table>` : '<div class="empty">暂无优惠券</div>'}
    </div>`;
}
async function toggleCoupon(id, status) {
  const ns = status === 'active' ? 'inactive' : 'active';
  try {
    await cloud.database.from('coupons').update({ status: ns }).eq('id', id);
    await audit('优惠券启停', { id, to: ns });
    toast('已更新', 'ok'); route();
  } catch (e) { toast(e.message, 'err'); }
}
function editCoupon() {
  const mask = document.createElement('div');
  mask.className = 'modal-mask';
  mask.innerHTML = `
    <div class="modal" style="width:480px">
      <h3>新建优惠券</h3>
      <div class="field"><label>名称</label><input id="cp-title" class="input" placeholder="如：新人立减 300"></div>
      <div class="row">
        <div class="field"><label>类型</label><select id="cp-kind" class="input"><option value="full_reduce">满减</option><option value="discount">折扣</option></select></div>
        <div class="field"><label>面额（元）</label><input id="cp-amount" class="input" type="number" value="300"></div>
        <div class="field"><label>门槛（元，0 无门槛）</label><input id="cp-th" class="input" type="number" value="0"></div>
      </div>
      <div class="row">
        <div class="field"><label>折扣（85 = 85 折）</label><input id="cp-rate" class="input" type="number" value="85"></div>
        <div class="field"><label>有效天数</label><input id="cp-days" class="input" type="number" value="30"></div>
      </div>
      <div class="actions"><button class="btn ghost" onclick="this.closest('.modal-mask').remove()">取消</button><button class="btn" id="cp-ok">创建</button></div>
    </div>`;
  document.body.appendChild(mask);
  mask.querySelector('#cp-ok').onclick = async () => {
    const kind = mask.querySelector('#cp-kind').value;
    const days = parseInt(mask.querySelector('#cp-days').value, 10) || 30;
    const body = {
      title: mask.querySelector('#cp-title').value.trim(), kind,
      amount: parseInt(mask.querySelector('#cp-amount').value, 10) || 0,
      threshold: parseInt(mask.querySelector('#cp-th').value, 10) || 0,
      discount_rate: parseInt(mask.querySelector('#cp-rate').value, 10) || 85,
      valid_until: new Date(Date.now() + days * 86400e3).toISOString(),
      status: 'active',
    };
    if (!body.title) return toast('请填写名称', 'err');
    try {
      await cloud.database.from('coupons').insert(body);
      await audit('新建优惠券', { title: body.title });
      mask.remove(); toast('已创建', 'ok'); route();
    } catch (e) { toast(e.message, 'err'); }
  };
}

/* ============ 实战项目管理 ============ */
async function vProjects() {
  const { data } = await cloud.database.from('real_projects').select('*').order('id');
  view().innerHTML = `
    <div class="flex jcb aic" style="flex-wrap:wrap;gap:10px">
      <div><h2 style="font-weight:900;font-size:22px">实战项目管理</h2><p class="muted small mt8">内容创作板块白名单素材，仅限教学使用；明确交付物、截止时间与评审标准。</p></div>
      <button class="btn" onclick="editProject()">＋ 发布实战任务</button>
    </div>
    <div class="grid c2 mt16">
      ${(data || []).map(p => `
        <div class="card">
          <div class="flex jcb aic"><span class="badge ${p.status === 'open' ? 'green' : 'gray'}">${p.status === 'open' ? '招募中' : '已结束'}</span><span class="muted small">截止 ${fmtDate(p.deadline)}</span></div>
          <h3 style="font-weight:800;margin-top:8px">${esc(p.title)}</h3>
          <p class="muted small mt8">${esc(p.description || '')}</p>
          <div class="small mt8"><b>交付：</b>${esc(p.deliverable || '-')}</div>
          <div class="flex jcb aic mt16">
            <span class="tag">${esc(p.reward || '')}</span>
            <button class="btn sm ghost" onclick="toggleProject(${p.id},'${p.status}')">${p.status === 'open' ? '结束招募' : '重新开放'}</button>
          </div>
        </div>`).join('') || '<div class="empty">暂无项目</div>'}
    </div>`;
}
async function toggleProject(id, status) {
  const ns = status === 'open' ? 'closed' : 'open';
  try {
    await cloud.database.from('real_projects').update({ status: ns }).eq('id', id);
    await audit('实战项目状态', { id, to: ns });
    toast('已更新', 'ok'); route();
  } catch (e) { toast(e.message, 'err'); }
}
function editProject() {
  const mask = document.createElement('div');
  mask.className = 'modal-mask';
  mask.innerHTML = `
    <div class="modal">
      <h3>发布实战任务</h3>
      <div class="field"><label>任务标题</label><input id="pj-title" class="input"></div>
      <div class="field"><label>任务描述</label><textarea id="pj-desc" class="input"></textarea></div>
      <div class="row">
        <div class="field" style="flex:2"><label>交付物要求</label><input id="pj-del" class="input"></div>
        <div class="field"><label>截止天数</label><input id="pj-days" class="input" type="number" value="21"></div>
      </div>
      <div class="row">
        <div class="field"><label>激励</label><input id="pj-reward" class="input" placeholder="署名 + 激励金"></div>
        <div class="field" style="flex:0 0 100px"><label>名额</label><input id="pj-slots" class="input" type="number" value="10"></div>
      </div>
      <div class="actions"><button class="btn ghost" onclick="this.closest('.modal-mask').remove()">取消</button><button class="btn" id="pj-ok">发布</button></div>
    </div>`;
  document.body.appendChild(mask);
  mask.querySelector('#pj-ok').onclick = async () => {
    const days = parseInt(mask.querySelector('#pj-days').value, 10) || 21;
    const body = {
      title: mask.querySelector('#pj-title').value.trim(), description: mask.querySelector('#pj-desc').value.trim(),
      deliverable: mask.querySelector('#pj-del').value.trim(),
      deadline: new Date(Date.now() + days * 86400e3).toISOString(),
      reward: mask.querySelector('#pj-reward').value.trim(),
      slots: parseInt(mask.querySelector('#pj-slots').value, 10) || 10,
      status: 'open', source_note: '内容创作板块白名单素材，仅限教学使用',
    };
    if (!body.title) return toast('请填写标题', 'err');
    try {
      await cloud.database.from('real_projects').insert(body);
      await audit('发布实战任务', { title: body.title });
      mask.remove(); toast('已发布', 'ok'); route();
    } catch (e) { toast(e.message, 'err'); }
  };
}

/* ============ 学员与教务 ============ */
async function vStudents() {
  const [profilesRes, progressRes, subsRes, auditsRes] = await Promise.all([
    cloud.database.from('profiles').select('*').order('created_at', { ascending: false }),
    cloud.database.from('lesson_progress').select('*'),
    cloud.database.from('submissions').select('*'),
    cloud.database.from('notifications').select('*').eq('type', 'audit').order('created_at', { ascending: false }).limit(12),
  ]);
  const profiles = profilesRes.data || [];
  view().innerHTML = `
    <h2 style="font-weight:900;font-size:22px">学员与教务</h2>
    <p class="muted small mt8">查看学员学习进度与购课情况；角色调整等手动操作全部留审计日志（操作人 / 时间 / 前后值）。</p>
    <div class="card mt16">
      ${profiles.length ? `<table class="tbl"><thead><tr><th>学员</th><th>角色</th><th>完课数</th><th>作业</th><th>注册时间</th><th>操作</th></tr></thead><tbody>
      ${profiles.map(p => {
        const doneN = progressRes.data.filter(x => x.owner_id === p.owner_id && x.completed).length;
        const subN = subsRes.data.filter(x => x.owner_id === p.owner_id).length;
        return `<tr>
          <td class="small"><b>${esc(p.nickname || '未命名')}</b></td>
          <td><span class="badge ${p.role === 'student' ? 'gray' : p.role === 'teacher' ? 'blue' : 'red'}">${p.role}</span></td>
          <td>${doneN}</td><td>${subN}</td>
          <td class="small muted">${fmtDate(p.created_at)}</td>
          <td><button class="btn sm soft" onclick="setRole(${p.id},'${esc(p.nickname || '')}','${p.role}')">调整角色</button></td>
        </tr>`;
      }).join('')}</tbody></table>` : '<div class="empty">暂无用户</div>'}
    </div>
    <div class="card">
      <div class="card-title">🧾 审计日志（最近 12 条）</div>
      ${(auditsRes.data || []).length ? (auditsRes.data || []).map(a => `
        <div style="padding:9px 0;border-bottom:1px solid #F2F0FA" class="small">
          <div class="flex jcb aic"><b>${esc(a.title)}</b><span class="muted">${fmtTime(a.created_at)}</span></div>
          <div class="muted mt8" style="word-break:break-all">${esc((a.content || '').slice(0, 160))}</div>
        </div>`).join('') : '<div class="empty">暂无审计记录</div>'}
    </div>`;
}
async function setRole(id, name, role) {
  const target = prompt(`调整 ${name} 的角色（student / teacher / admin）`, role);
  if (!target || !['student', 'teacher', 'admin'].includes(target)) return;
  try {
    await cloud.database.from('profiles').update({ role: target }).eq('id', id);
    await audit('调整角色', { id, name, from: role, to: target });
    toast('角色已调整', 'ok'); route();
  } catch (e) { toast(e.message, 'err'); }
}

/* ============ B 端租户管理 ============ */
async function vTenants() {
  const { data } = await cloud.database.from('tenants').select('*').order('id');
  view().innerHTML = `
    <div class="flex jcb aic" style="flex-wrap:wrap;gap:10px">
      <div><h2 style="font-weight:900;font-size:22px">B 端租户管理</h2>
      <p class="muted small mt8">为政企客户开通独立租户：专属课程、学员名单与模型调用额度；租户间数据、课程、订单严格隔离，C 端不可见 B 端专属内容。</p></div>
      <button class="btn" onclick="editTenant()">＋ 开通租户</button>
    </div>
    <div class="grid c3 mt16">
      ${(data || []).map(t => `
        <div class="card">
          <div class="flex jcb aic"><b>${esc(t.name)}</b><span class="badge blue">${esc(t.plan || 'standard')}</span></div>
          <div class="mt8 small muted">联系人：${esc(t.contact || '-')}</div>
          <div class="bar-row mt8"><span class="bl">模型额度</span>
            <div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, Math.round((t.model_used || 0) / Math.max(t.model_quota || 1, 1) * 100))}%"></div></div>
            <span class="bv">${t.model_used || 0}/${t.model_quota || 0}</span></div>
          <div class="muted small mt8">开通于 ${fmtDate(t.created_at)}</div>
        </div>`).join('') || '<div class="empty">暂无租户</div>'}
    </div>`;
}
function editTenant() {
  const mask = document.createElement('div');
  mask.className = 'modal-mask';
  mask.innerHTML = `
    <div class="modal" style="width:460px">
      <h3>开通 B 端租户</h3>
      <div class="row">
        <div class="field" style="flex:2"><label>企业名称</label><input id="tn-name" class="input"></div>
        <div class="field"><label>套餐</label><select id="tn-plan" class="input"><option value="standard">标准版</option><option value="pro">专业版</option><option value="gov">政企定制</option></select></div>
      </div>
      <div class="row">
        <div class="field"><label>联系人</label><input id="tn-contact" class="input"></div>
        <div class="field"><label>模型调用额度</label><input id="tn-quota" class="input" type="number" value="1000"></div>
      </div>
      <div class="actions"><button class="btn ghost" onclick="this.closest('.modal-mask').remove()">取消</button><button class="btn" id="tn-ok">开通</button></div>
    </div>`;
  document.body.appendChild(mask);
  mask.querySelector('#tn-ok').onclick = async () => {
    const body = {
      name: mask.querySelector('#tn-name').value.trim(), plan: mask.querySelector('#tn-plan').value,
      contact: mask.querySelector('#tn-contact').value.trim(),
      model_quota: parseInt(mask.querySelector('#tn-quota').value, 10) || 1000, model_used: 0,
    };
    if (!body.name) return toast('请填写企业名称', 'err');
    try {
      await cloud.database.from('tenants').insert(body);
      await audit('开通租户', { name: body.name, plan: body.plan });
      mask.remove(); toast('租户已开通', 'ok'); route();
    } catch (e) { toast(e.message, 'err'); }
  };
}

/* ============ 营销线索归因 ============ */
async function vLeads() {
  const { data } = await cloud.database.from('leads').select('*').order('created_at', { ascending: false }).limit(80);
  view().innerHTML = `
    <h2 style="font-weight:900;font-size:22px">营销线索归因</h2>
    <p class="muted small mt8">落地页 UV → 试听 / 领券全链路按渠道、活动归因；同一用户跨渠道点击按「首次 + 末次」双记录，数据可导出。</p>
    <div class="card mt16">
      ${(data || []).length ? `<table class="tbl"><thead><tr><th>时间</th><th>事件</th><th>邮箱 / 联系方式</th><th>首次渠道</th><th>末次渠道</th><th>UTM</th></tr></thead><tbody>
      ${(data || []).map(l => `<tr>
        <td class="small muted">${fmtTime(l.created_at)}</td>
        <td><span class="badge ${l.event === 'trial' ? 'blue' : l.event === 'coupon' ? 'green' : 'gray'}">${esc(l.event)}</span></td>
        <td class="small">${esc(l.email || l.phone || l.name || '-')}</td>
        <td class="small">${esc(l.first_channel || '-')}</td>
        <td class="small">${esc(l.last_channel || '-')}</td>
        <td class="small muted" style="max-width:180px;overflow:hidden;text-overflow:ellipsis">${esc(JSON.stringify(l.utm || {}))}</td>
      </tr>`).join('')}</tbody></table>` : '<div class="empty">暂无线索</div>'}
    </div>
    <button class="btn ghost mt16" onclick="exportLeads()">⬇️ 导出 CSV</button>`;
  window.__leadsCache = data || [];
}
function exportLeads() {
  const rows = [['时间', '事件', '邮箱', '首次渠道', '末次渠道', 'UTM']];
  (window.__leadsCache || []).forEach(l => rows.push([fmtTime(l.created_at), l.event, l.email || '', l.first_channel || '', l.last_channel || '', JSON.stringify(l.utm || {})]));
  const csv = '\ufeff' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'leads-' + fmtDate(new Date().toISOString()) + '.csv';
  a.click();
  toast('CSV 已导出', 'ok');
}
