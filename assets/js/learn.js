/* ===== 学员端 learn.js ===== */
const $ = (id) => document.getElementById(id);
const view = () => document.getElementById('view');

let ME = null;          // profile
let SESSION = null;
let ROUTE = '';
const COURSE_SECTIONS = [
  { key: 'dashboard', label: '学习仪表盘', ico: '📊' },
  { key: 'courses', label: '全部课程', ico: '📚' },
  { key: 'assignments', label: '我的作业', ico: '📝' },
  { key: 'works', label: '作品广场', ico: '🖼️' },
  { key: 'projects', label: '真实项目实战', ico: '🎯' },
  { key: 'workbench', label: 'AI 创作工作台', ico: '🛠️' },
  { key: 'me', label: '个人中心', ico: '👤' },
];

/* ---------- 引导 ---------- */
(async function boot() {
  SESSION = await requireSession();
  if (!SESSION) { location.href = 'auth.html'; return; }
  ME = await ensureProfile(SESSION.user);
  if (!ME) { toast('资料初始化失败，请重新登录', 'err'); return; }
  $('user-badge').textContent = (ME.nickname || '学员') + ' · ' + (ME.role === 'student' ? '学员' : ME.role === 'teacher' ? '教师' : '管理员');
  if (ME.role !== 'student') {
    const link = document.createElement('a');
    link.href = homeOfRole(ME.role); link.textContent = ME.role === 'admin' ? '← 管理端' : '← 教师端';
    document.querySelector('.nav-links').prepend(link);
  }
  renderSide();
  window.addEventListener('hashchange', route);
  route();
})();

function renderSide() {
  document.getElementById('side').innerHTML =
    '<div class="side-group">学习</div>' +
    COURSE_SECTIONS.map(s => `<a href="#/${s.key}" data-key="${s.key}">${s.ico} ${s.label}</a>`).join('') +
    '<div class="side-group">支持</div><a href="index.html#trial">预约试听</a><a href="index.html#coupons">优惠券</a>';
}
function markSide(key) {
  document.querySelectorAll('#side a').forEach(a => a.classList.toggle('active', a.dataset.key === key));
  document.querySelectorAll('#bottom-nav a').forEach(a => a.classList.toggle('active', a.dataset.bkey === key));
}

/* ---------- 路由 ---------- */
async function route() {
  const h = location.hash.replace(/^#\//, '') || 'dashboard';
  const [key, arg] = h.split('/');
  ROUTE = key;
  markSide(key);
  window.scrollTo(0, 0);
  view().innerHTML = '<div class="loading"><span class="spin"></span>加载中…</div>';
  try {
    if (key === 'dashboard') await vDashboard();
    else if (key === 'courses') await vCourses();
    else if (key === 'course') await vCourse(arg);
    else if (key === 'lesson') await vLesson(arg);
    else if (key === 'assignments') await vAssignments();
    else if (key === 'works') await vWorks();
    else if (key === 'projects') await vProjects();
    else if (key === 'workbench') await vWorkbench(arg);
    else if (key === 'me') await vMe();
    else await vDashboard();
  } catch (e) {
    console.error('[learn] view error:', e && e.message);
    view().innerHTML = `<div class="empty"><div class="ico">⚠️</div>${esc(e.message || '加载失败')}<div class="mt16"><a class="btn ghost sm" href="#/dashboard">返回仪表盘</a></div></div>`;
  }
}

/* ---------- 数据助手 ---------- */
async function myProgress() {
  const { data } = await cloud.database.from('lesson_progress').select('*').eq('owner_id', SESSION.user.id);
  return data || [];
}
async function courseLessons(courseId) {
  const { data } = await cloud.database.from('lessons').select('*').eq('course_id', courseId).eq('status', 'published').order('order_no');
  return data || [];
}
function lockStates(lessons, progress) {
  const doneIds = new Set(progress.filter(p => p.completed).map(p => p.lesson_id));
  let prevDone = true;
  return lessons.map((l, i) => {
    const unlocked = i === 0 || l.is_free_preview || prevDone;
    const done = doneIds.has(l.id);
    prevDone = done && i === 0 ? true : done ? true : (i === 0 ? true : prevDone && false);
    // 顺序解锁：上一节完成才解锁下一节
    prevDone = i === 0 ? done : (prevDone && done);
    return { lesson: l, unlocked, done };
  });
}

/* ============ 学习仪表盘 ============ */
async function vDashboard() {
  const [progress, subs, coursesRes, noticesRes, attemptsRes] = await Promise.all([
    myProgress(),
    cloud.database.from('submissions').select('*').order('created_at', { ascending: false }).limit(50),
    cloud.database.from('courses').select('*').eq('status', 'published'),
    cloud.database.from('notifications').select('*').eq('owner_id', SESSION.user.id).order('created_at', { ascending: false }).limit(8),
    cloud.database.from('practice_attempts').select('*'),
  ]);
  const courses = coursesRes.data || [];
  const subsData = subs.data || [];
  const attempts = attemptsRes.data || [];
  const totalLessons = {};
  for (const c of courses) totalLessons[c.id] = 0;
  const doneMap = {};
  progress.forEach(p => { if (p.completed) { doneMap[p.course_id] = (doneMap[p.course_id] || 0) + 1; } });

  // 连续学习天数
  const days = new Set(progress.map(p => fmtDate(p.updated_at)));
  let streak = 0;
  const d = new Date();
  if (!days.has(fmtDate(d))) d.setDate(d.getDate() - 1);
  while (days.has(fmtDate(d))) { streak++; d.setDate(d.getDate() - 1); }

  const lastStudy = progress.length ? progress.map(p => p.updated_at).sort().pop() : null;
  const undoneSubs = subsData.filter(s => s.status === 'submitted');
  const unread = (noticesRes.data || []).filter(n => !n.read).length;

  const mastery = await calcMastery(attempts, subsData);

  view().innerHTML = `
    <h2 style="font-weight:900;font-size:22px">你好，${esc(ME.nickname || '学员')} ${ME.avatar_emoji || ''}</h2>
    <p class="muted small mt8">目标：毕业时带走可展示、可投递的作品。今天也从一节课开始。</p>
    <div class="grid c4 mt16">
      <div class="stat"><div class="num">${progress.filter(p => p.completed).length}</div><div class="lbl">已完成课时</div></div>
      <div class="stat"><div class="num">${undoneSubs.length}</div><div class="lbl">待点评作业</div><div class="sub">提交后 48h 内反馈</div></div>
      <div class="stat"><div class="num">${streak}<span style="font-size:14px"> 天</span></div><div class="lbl">连续学习</div><div class="sub">${lastStudy ? '最近学习 ' + fmtTime(lastStudy) : '今天开始第一课吧'}</div></div>
      <div class="stat"><div class="num">${unread}</div><div class="lbl">未读通知</div><div class="sub">点评反馈会在这里出现</div></div>
    </div>

    <div class="grid c2 mt16">
      <div class="card">
        <div class="card-title">🎯 掌握度画像 <span class="hint">题目正确率 60% + 作业评分 40%</span></div>
        ${mastery.length ? mastery.map(m => `
          <div class="bar-row"><span class="bl" title="${esc(m.kp)}">${esc(m.kp)}</span>
            <div class="progress-track"><div class="progress-fill" style="width:${m.score}%"></div></div>
            <span class="bv">${m.score}%</span>
            <span class="badge ${m.score >= 80 ? 'green' : m.score >= 60 ? 'orange' : 'gray'}">${m.score >= 80 ? '优秀' : m.score >= 60 ? '良好' : '待加强'}</span>
          </div>`).join('') : '<div class="empty"><div class="ico">🧭</div>完成随堂练习与作业后，这里会生成你的掌握度画像</div>'}
      </div>
      <div class="card">
        <div class="card-title">🔔 最新通知</div>
        ${(noticesRes.data || []).length ? (noticesRes.data || []).map(n => `
          <div style="padding:10px 0;border-bottom:1px solid #F2F0FA">
            <div class="flex jcb aic"><b style="font-size:14px">${esc(n.title)}</b><span class="muted small">${fmtTime(n.created_at)}</span></div>
            <div class="muted small mt8" style="white-space:pre-wrap">${esc(n.content || '')}</div>
          </div>`).join('') : '<div class="empty"><div class="ico">📭</div>暂无通知</div>'}
      </div>
    </div>

    <div class="card">
      <div class="card-title">📚 我的课程进度 <a class="btn ghost sm" href="#/courses" style="margin-left:auto">全部课程</a></div>
      ${courses.length ? `<table class="tbl"><thead><tr><th>课程</th><th>方向</th><th>完成进度</th><th></th></tr></thead><tbody>
        ${courses.map(c => {
          const dl = doneMap[c.id] || 0;
          const total = totalLessons[c.id];
          return `<tr><td><b>${esc(c.title)}</b></td><td>${dirLabel(c.direction)}</td>
            <td style="min-width:160px"><div class="flex aic gap8"><div class="progress-track"><div class="progress-fill" style="width:${dl && total ? Math.round(dl / Math.max(total, 1) * 100) : 0}%"></div></div><span class="muted small">${dl} 课时</span></div></td>
            <td><a class="btn sm soft" href="#/course/${c.id}">继续学习</a></td></tr>`;
        }).join('')}</tbody></table>` : '<div class="empty"><div class="ico">🚀</div>还没有课程，去<a class="link" href="#/courses">选一门课</a>开始吧</div>'}
    </div>`;
}

async function calcMastery(attempts, subs) {
  // 题目维度
  const qIds = [...new Set(attempts.map(a => a.question_id))];
  const kpMap = {};
  if (qIds.length) {
    const { data: qs } = await cloud.database.from('questions').select('id, knowledge_point').in('id', qIds);
    const qKp = {}; (qs || []).forEach(q => qKp[q.id] = q.knowledge_point);
    const best = {}; // question_id → 是否曾答对
    attempts.forEach(a => { if (a.correct) best[a.question_id] = true; });
    attempts.forEach(a => { if (!best[a.question_id]) best[a.question_id] = best[a.question_id] || false; });
    Object.keys(best).forEach(qid => {
      const kp = qKp[qid] || '综合';
      if (!kpMap[kp]) kpMap[kp] = { right: 0, total: 0 };
      kpMap[kp].total++; if (best[qid]) kpMap[kp].right++;
    });
  }
  // 作业维度（按知识点未关联，按课程方向近似归入）
  const scores = subs.filter(s => s.score != null);
  const subAvg = scores.length ? Math.round(scores.reduce((t, s) => t + s.score, 0) / scores.length) : null;
  const result = Object.keys(kpMap).map(kp => {
    const acc = Math.round(kpMap[kp].right / kpMap[kp].total * 100);
    const score = subAvg != null ? Math.round(acc * 0.6 + subAvg * 0.4) : acc;
    return { kp, score };
  });
  if (!result.length && subAvg != null) result.push({ kp: '作业综合', score: subAvg });
  return result.sort((a, b) => b.score - a.score);
}

/* ============ 课程列表 ============ */
async function vCourses() {
  const { data } = unwrap(await cloud.database.from('courses').select('*').eq('status', 'published').order('sort'));
  view().innerHTML = `
    <h2 style="font-weight:900;font-size:22px">全部课程</h2>
    <div class="grid c3 mt16">
      ${data.map(c => `
        <div class="card course-card" onclick="location.hash='#/course/${c.id}'">
          <div class="course-cover" style="background:${esc(c.cover_gradient)}">${dirIco(c.direction)} ${esc(c.title)}<span class="price-chip">${fmtMoney(c.price)}</span></div>
          <div class="course-body">
            <div class="flex gap8"><span class="badge">${dirLabel(c.direction)}</span></div>
            <p class="muted small mt8" style="min-height:40px">${esc(c.description || '')}</p>
          </div>
        </div>`).join('')}
    </div>`;
}

/* ============ 课程详情（章节树 + 锁课） ============ */
async function vCourse(id) {
  const { data: c } = await cloud.database.from('courses').select('*').eq('id', id).maybeSingle();
  if (!c) { view().innerHTML = '<div class="empty">课程不存在</div>'; return; }
  const [lessons, progress] = await Promise.all([courseLessons(id), myProgress()]);
  const locks = lockStates(lessons, progress);

  view().innerHTML = `
    <a class="muted small" href="#/courses">← 全部课程</a>
    <div class="card mt16" style="background:${esc(c.cover_gradient)};border:none;color:#fff">
      <div class="flex jcb aic" style="flex-wrap:wrap;gap:10px">
        <div>
          <h2 style="font-size:24px;font-weight:900">${dirIco(c.direction)} ${esc(c.title)}</h2>
          <p style="opacity:.9;margin-top:6px">${esc(c.subtitle || '')} · 共 ${lessons.length} 课时 · ${fmtMoney(c.price)}</p>
        </div>
        <button class="btn lg" style="background:#fff;color:var(--primary)" onclick="startCourse(${c.id})">开始 / 继续学习</button>
      </div>
    </div>
    <div class="card">
      <div class="card-title">课程目录 <span class="hint">完成当前课时自动解锁下一课时；免费试听课时无需条件</span></div>
      ${lessons.map((l, i) => {
        const st = locks[i];
        const p = progress.find(x => x.lesson_id === l.id);
        const pct = p && p.duration ? Math.min(100, Math.round((p.last_position / p.duration) * 100)) : 0;
        return `
        <div class="lesson-item ${st.unlocked ? '' : 'locked'} ${st.done ? 'done' : ''}" onclick="${st.unlocked ? `location.hash='#/lesson/${l.id}'` : `toast('先完成上一课时即可解锁本课时')`}">
          <div class="lesson-idx">${st.done ? '✓' : st.unlocked ? i + 1 : '🔒'}</div>
          <div style="flex:1;min-width:0">
            <div class="flex aic gap8" style="flex-wrap:wrap">
              <b>${esc(l.title)}</b>
              ${l.is_free_preview ? '<span class="badge green">免费试听</span>' : ''}
              ${l.kind === 'live' ? '<span class="badge orange">直播</span>' : ''}
              ${l.assignment_title ? '<span class="badge blue">有作业</span>' : ''}
            </div>
            <div class="muted small mt8">${l.kind === 'video' ? '视频 ' + l.duration_min + ' 分钟' : '实战练习 · 约 ' + l.duration_min + ' 分钟'}${l.assignment_title ? ' · 作业：' + esc(l.assignment_title) : ''}</div>
          </div>
          ${st.unlocked && pct > 0 ? `<span class="muted small">已学 ${pct}%</span>` : ''}
        </div>`;
      }).join('')}
    </div>`;
}
async function startCourse(courseId) {
  const lessons = await courseLessons(courseId);
  const progress = await myProgress();
  const locks = lockStates(lessons, progress);
  const firstOpen = locks.find(x => x.unlocked && !x.done) || locks[0];
  if (firstOpen) location.hash = '#/lesson/' + firstOpen.lesson.id;
}

/* ============ 课时学习页 ============ */
let PV = { saveTimer: null, watchBase: 0, lesson: null };
async function vLesson(id) {
  const { data: l } = await cloud.database.from('lessons').select('*').eq('id', id).maybeSingle();
  if (!l) { view().innerHTML = '<div class="empty">课时不存在</div>'; return; }
  const [lessons, progress] = await Promise.all([courseLessons(l.course_id), myProgress()]);
  const locks = lockStates(lessons, progress);
  const st = locks.find(x => x.lesson.id === l.id);
  if (st && !st.unlocked) { toast('本课时未解锁', 'err'); location.hash = '#/course/' + l.course_id; return; }
  const p = progress.find(x => x.lesson_id === l.id);
  const { data: course } = await cloud.database.from('courses').select('*').eq('id', l.course_id).maybeSingle();
  const idx = lessons.findIndex(x => x.id === l.id);

  PV.lesson = l; PV.watchBase = p ? Number(p.watch_seconds || 0) : 0;

  const tpl = l.tool_template || {};
  view().innerHTML = `
    <a class="muted small" href="#/course/${l.course_id}">← ${esc(course ? course.title : '')}</a>
    <div class="grid mt16" style="grid-template-columns:1fr;gap:16px">
      <div class="player">
        ${l.kind === 'video' && l.video_url ? `
          <video id="pv" src="${esc(l.video_url)}" controls playsinline preload="metadata"></video>
          <div class="player-bar">
            <span class="badge green" style="background:rgba(255,255,255,.12);color:#fff">${esc(l.title)}</span>
            <span class="pos" id="pv-pos">00:00 / --:--</span>
            <div class="spacer" style="flex:1"></div>
            <span class="muted small" style="color:#8E8CA8">倍速</span>
            <div class="speed" id="speed-btns">
              ${[0.75, 1, 1.25, 1.5, 2].map(s => `<button data-s="${s}" class="${s === 1 ? 'on' : ''}">${s}x</button>`).join('')}
            </div>
          </div>` : `
          <div class="player-fallback">
            <div style="font-size:40px;margin-bottom:10px">${l.kind === 'live' ? '📺' : '🧪'}</div>
            <b style="color:#E4E4E7;font-size:16px">${esc(l.title)}</b>
            <p class="mt8">${l.kind === 'live' ? '直播课时：老师开课后此处进入直播间，中断时自动切回放。' : '实战练习课时：请直接在下方完成练习任务。'}</p>
          </div>`}
      </div>

      <div class="card">
        <div class="flex jcb aic" style="flex-wrap:wrap;gap:10px">
          <div><h3 style="font-weight:800;font-size:17px">${esc(l.title)}</h3><p class="muted small mt8">${esc(l.content || '')}</p></div>
          ${tpl.tool ? `<button class="btn" onclick="gotoWorkbench(${l.id})">🛠️ 一键跟练（自动带入模板）</button>` : ''}
        </div>
        ${tpl.tool ? `<div class="snap-grid mt16">
          <div class="snap-box"><div class="k">跟练工具</div><div class="v">${esc(tpl.tool)}</div></div>
          <div class="snap-box"><div class="k">推荐提示词</div><div class="v">${esc(tpl.prompt || '')}</div></div>
          <div class="snap-box"><div class="k">推荐参数</div><div class="v">${esc(typeof tpl.params === 'string' ? tpl.params : JSON.stringify(tpl.params))}</div></div>
        </div>` : ''}
      </div>

      ${l.assignment_title ? assignmentCard(l, p) : ''}

      <div id="quiz-box" class="card"><div class="card-title">随堂练习 <span class="hint">提交后立即判分，可重做，最高成绩计入掌握度</span><span class="hint"><span class="spin"></span></span></div></div>

      <div class="flex jcb mt16">
        ${idx > 0 ? `<a class="btn ghost" href="#/lesson/${lessons[idx - 1].id}">← 上一课时</a>` : '<span></span>'}
        ${idx < lessons.length - 1 ? `<a class="btn ghost" href="#/lesson/${lessons[idx + 1].id}">下一课时 →</a>` : `<a class="btn" href="#/course/${l.course_id}">完成本课 🎉</a>`}
      </div>
    </div>`;

  if (l.kind === 'video' && l.video_url) setupPlayer(l, p);
  loadQuiz(l.course_id);
}

function assignmentCard(l, p) {
  return `
  <div class="card" id="assign-card">
    <div class="card-title">📝 ${esc(l.assignment_title)} <span class="hint">截止 ${fmtTime(l.assignment_deadline)}</span></div>
    <p class="muted small">${esc(l.assignment_req || '')}</p>
    <div id="assign-status" class="mt16"><span class="muted small">作业状态加载中…</span></div>
  </div>`;
}

function setupPlayer(l, p) {
  const v = $('pv');
  if (!v) return;
  const posEl = $('pv-pos');
  v.addEventListener('loadedmetadata', () => {
    if (p && p.last_position > 5 && p.last_position < v.duration - 10) {
      v.currentTime = Number(p.last_position); toast('已恢复到上次观看位置', 'ok');
    }
  });
  v.addEventListener('timeupdate', () => {
    if (posEl && v.duration) posEl.textContent = fmtDur(v.currentTime) + ' / ' + fmtDur(v.duration);
    if (!PV.saveTimer && v.currentTime > 0) {
      PV.saveTimer = setTimeout(() => { PV.saveTimer = null; saveProgress(v, false); }, 5000);
    }
  });
  v.addEventListener('pause', () => saveProgress(v, false));
  v.addEventListener('ended', () => saveProgress(v, true));
  // 手机切后台 / 锁屏时保存一次进度，避免系统杀掉页面丢进度
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && v && v.currentTime > 0) saveProgress(v, false);
  });
  window.addEventListener('beforeunload', () => { try { saveProgressSync(v, false); } catch (e) {} });
  $('speed-btns').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    v.playbackRate = parseFloat(b.dataset.s);
    document.querySelectorAll('#speed-btns button').forEach(x => x.classList.toggle('on', x === b));
  });
}
function saveProgressSync(v, ended) {
  const body = {
    course_id: PV.lesson.course_id, lesson_id: PV.lesson.id,
    last_position: v.currentTime || 0, duration: v.duration || 0,
    completed: ended || (v.duration ? v.currentTime / v.duration >= 0.9 : false),
  };
  const bl = new Blob([JSON.stringify(body)]), ok = true;
  saveProgressRemote(body, true);
}
async function saveProgress(v, ended) {
  await saveProgressRemote({
    course_id: PV.lesson.course_id, lesson_id: PV.lesson.id,
    last_position: v.currentTime || 0, duration: v.duration || 0,
    completed: ended || (v.duration ? v.currentTime / v.duration >= 0.9 : false),
  });
}
async function saveProgressRemote(body, fire) {
  try {
    body.watch_seconds = PV.watchBase;
    const { data: exist } = await cloud.database.from('lesson_progress').select('id, watch_seconds, completed')
      .eq('owner_id', SESSION.user.id).eq('lesson_id', body.lesson_id).maybeSingle();
    if (exist) {
      const patch = { last_position: body.last_position, duration: body.duration, updated_at: new Date().toISOString() };
      if (body.completed) patch.completed = true;
      if (PV.watchBase > Number(exist.watch_seconds || 0)) patch.watch_seconds = PV.watchBase;
      await cloud.database.from('lesson_progress').update(patch).eq('id', exist.id);
    } else {
      await cloud.database.from('lesson_progress').insert(body);
    }
  } catch (e) { console.error('[cloud] progress save failed:', e && e.message); }
}

function gotoWorkbench(lessonId) {
  const l = PV.lesson;
  const tpl = l && l.tool_template ? encodeURIComponent(JSON.stringify(l.tool_template)) : '';
  location.hash = '#/workbench/new?lesson=' + lessonId + '&tpl=' + tpl;
}

/* ---------- 随堂练习 ---------- */
async function loadQuiz(courseId) {
  const { data: qs } = await cloud.database.from('questions').select('*').eq('course_id', courseId).limit(3);
  const box = $('quiz-box');
  if (!box) return;
  if (!qs || !qs.length) { box.innerHTML = '<div class="card-title">随堂练习</div><div class="muted small">本课程暂无配套小题</div>'; return; }
  box.innerHTML = '<div class="card-title">随堂练习 <span class="hint">提交后立即判分，可重做，最高成绩计入掌握度</span></div>' +
    qs.map((q, qi) => {
      const isJudge = q.type === 'judge';
      const opts = isJudge ? ['true', 'false'] : (q.options || []);
      return `
      <div style="padding:14px 0;border-bottom:1px solid #F2F0FA" id="q-${q.id}">
        <b style="font-size:14px">${qi + 1}. ${esc(q.stem)}</b> <span class="tag">${esc(q.knowledge_point)}</span>
        <div class="mt8" id="q-opts-${q.id}">
          ${opts.map(o => `<label style="display:flex;gap:8px;align-items:center;padding:6px 0;cursor:pointer" class="small">
            <input type="radio" name="q-${q.id}" value="${esc(o)}" onchange="document.getElementById('fb-${q.id}').style.display='none'"> ${esc(o)}</label>`).join('')}
        </div>
        <div class="flex aic gap12 mt8">
          <button class="btn sm" onclick="submitQuiz(${q.id}, '${isJudge ? 'judge' : 'single'}')">提交答案</button>
          <span id="fb-${q.id}" class="small" style="display:none"></span>
        </div>
        <div class="small muted mt8" id="qa-${q.id}" style="display:none">解析：${esc(q.analysis || '')}</div>
      </div>`;
    }).join('');
  window.__quizCache = qs;
}
async function submitQuiz(qid, type) {
  const sel = document.querySelector(`input[name="q-${qid}"]:checked`);
  if (!sel) return toast('请先选择答案', 'err');
  const q = (window.__quizCache || []).find(x => x.id === qid);
  const correct = String(sel.value) === String(q.answer);
  try {
    await cloud.database.from('practice_attempts').insert({ question_id: qid, course_id: q.course_id, answer: sel.value, correct });
  } catch (e) { console.error('[cloud] attempt save failed:', e && e.message); }
  const fb = $('fb-' + qid);
  fb.style.display = '';
  fb.innerHTML = correct ? '<span class="badge green">回答正确</span>' : `<span class="badge red">回答错误，正确答案：${esc(q.answer)}</span>`;
  $('qa-' + qid).style.display = '';
  toast(correct ? '答对了！' : '已记录本次作答，可重做', correct ? 'ok' : '');
}

/* ============ 作业列表 ============ */
async function vAssignments() {
  const [subsRes, lessonsRes, coursesRes] = await Promise.all([
    cloud.database.from('submissions').select('*').order('created_at', { ascending: false }),
    cloud.database.from('lessons').select('id, title, assignment_title, course_id, assignment_deadline').not('assignment_title', 'is', null).eq('status', 'published'),
    cloud.database.from('courses').select('id, title'),
  ]);
  const subs = subsRes.data || [], lessons = lessonsRes.data || [], courses = coursesRes.data || [];
  const cName = (cid) => (courses.find(c => c.id === cid) || {}).title || '-';
  const myByLesson = {}; subs.forEach(s => { if (!myByLesson[s.lesson_id]) myByLesson[s.lesson_id] = s; });

  view().innerHTML = `
    <h2 style="font-weight:900;font-size:22px">我的作业</h2>
    <p class="muted small mt8">布置作业后 7 天内提交；点评后 48 小时内可见反馈。快照保留生成时的提示词、参数与模型版本。</p>
    <div class="card mt16">
      ${lessons.length ? `<table class="tbl"><thead><tr><th>课程 / 课时</th><th>作业</th><th>截止</th><th>状态</th><th>成绩</th><th></th></tr></thead><tbody>
      ${lessons.map(l => {
        const s = myByLesson[l.id];
        const status = !s ? '<span class="badge gray">未提交</span>' : s.status === 'reviewed' ? '<span class="badge green">已点评</span>' : '<span class="badge orange">待点评</span>';
        return `<tr>
          <td class="small">${esc(cName(l.course_id))}<div class="muted">${esc(l.title)}</div></td>
          <td class="small">${esc(l.assignment_title)}</td>
          <td class="small muted">${fmtTime(l.assignment_deadline)}</td>
          <td>${status}</td>
          <td>${s && s.score != null ? '<b style="color:var(--primary)">' + s.score + '</b>' : '-'}</td>
          <td><a class="btn sm soft" href="#/lesson/${l.id}">${!s ? '去提交' : s.status === 'reviewed' ? '看点评' : '查看/重交'}</a></td>
        </tr>`;
      }).join('')}</tbody></table>` : '<div class="empty">暂无作业任务</div>'}
    </div>`;
}

/* ============ 作品广场 ============ */
async function vWorks() {
  const { data } = await cloud.database.from('works').select('*').eq('visibility', 'public').order('created_at', { ascending: false });
  const mine = (data || []).filter(w => w.owner_id === SESSION.user.id);
  const others = (data || []).filter(w => w.owner_id !== SESSION.user.id);
  view().innerHTML = `
    <div class="flex jcb aic" style="flex-wrap:wrap;gap:10px">
      <div><h2 style="font-weight:900;font-size:22px">作品广场</h2><p class="muted small mt8">发布前默认仅自己与老师可见；发布需二次确认。所有作品发布前已过内容安全检查。</p></div>
      <button class="btn" onclick="publishWorkModal()">＋ 发布我的作品</button>
    </div>
    <div class="grid c3 mt16">
      ${[...mine, ...others].map(w => `
        <div class="card">
          <div class="course-cover" style="background:${esc(w.cover_gradient || gradOf(w.id))};height:110px;border-radius:12px">${dirIco(w.direction)} <span style="font-size:15px">${esc(w.title)}</span></div>
          <div class="flex gap8 mt8" style="flex-wrap:wrap">
            <span class="badge">${dirLabel(w.direction)}</span>
            ${w.project_tag ? `<span class="badge blue">${esc(w.project_tag)}</span>` : ''}
            ${w.owner_id === SESSION.user.id ? '<span class="badge gray">我的</span>' : ''}
          </div>
          <p class="muted small mt8" style="min-height:38px">${esc(w.description || '')}</p>
          <div class="flex jcb aic mt8"><span class="muted small">${esc(w.owner_name || '学员')}</span><span class="muted small">${fmtDate(w.created_at)}</span></div>
        </div>`).join('') || '<div class="empty">还没有作品，成为第一个发布的人吧</div>'}
    </div>`;
}
async function publishWorkModal() {
  // 候选：已提交的作业 + 工作台项目
  const [subsRes, wbRes] = await Promise.all([
    cloud.database.from('submissions').select('*').order('created_at', { ascending: false }).limit(20),
    cloud.database.from('workbench_projects').select('*').order('created_at', { ascending: false }).limit(20),
  ]);
  const cands = [
    ...(subsRes.data || []).map(s => ({ src: 'submission', ref: s.id, title: s.title || '作业作品', desc: s.content || '', direction: null })),
    ...(wbRes.data || []).map(p => ({ src: 'workbench', ref: p.id, title: p.title, desc: 'AI 工作台产出 · ' + ((p.scenes || []).length) + ' 场次 ' + ((p.shots_count) || '') , direction: 'video' })),
  ];
  if (!cands.length) return toast('先完成作业或在工作台产出作品后再发布');
  const mask = document.createElement('div');
  mask.className = 'modal-mask';
  mask.innerHTML = `
    <div class="modal">
      <h3>发布作品到广场</h3>
      <div class="field"><label>选择来源</label>
        <select id="pw-src" class="input">${cands.map((c, i) => `<option value="${i}">[${c.src === 'submission' ? '作业' : '工作台'}] ${esc(c.title)}</option>`).join('')}</select>
      </div>
      <div class="field"><label>作品标题</label><input id="pw-title" class="input" placeholder="给作品起个名字"></div>
      <div class="field"><label>作品说明</label><textarea id="pw-desc" class="input" placeholder="创作思路、用到的工具链…"></textarea></div>
      <div class="field"><label>可见性</label>
        <select id="pw-vis" class="input"><option value="public">公开（广场可见）</option><option value="private">私密（仅自己与老师）</option></select>
      </div>
      <p class="small muted">提示：发布到广场的作品默认对全部学员可见；你生成的作品所有权与授权边界见《用户协议》。提交前将进行内容安全检查。</p>
      <div class="actions"><button class="btn ghost" onclick="this.closest('.modal-mask').remove()">取消</button><button class="btn" id="pw-ok">发布</button></div>
    </div>`;
  document.body.appendChild(mask);
  mask.querySelector('#pw-ok').onclick = async () => {
    const c = cands[parseInt(mask.querySelector('#pw-src').value, 10)];
    const title = mask.querySelector('#pw-title').value.trim() || c.title;
    const desc = mask.querySelector('#pw-desc').value.trim() || c.desc;
    const vis = mask.querySelector('#pw-vis').value;
    const bad = contentSafeCheck(title + ' ' + desc);
    if (bad) return toast(bad, 'err');
    const yes = await confirmModal({ title: '确认发布？', text: `「${title}」将以${vis === 'public' ? '公开' : '私密'}方式${vis === 'public' ? '发布到作品广场' : '保存'}，可在个人中心调整。`, okText: '确认发布' });
    if (!yes) return;
    try {
      unwrap(await cloud.database.from('works').insert({
        title, description: desc, source: c.src, visibility: vis,
        direction: c.direction || 'video',
        owner_name: ME.nickname || '学员',
        cover_gradient: gradOf(title), project_tag: c.src === 'submission' ? '作业产出' : '工作台产出',
      }));
      mask.remove(); toast('作品已发布到广场', 'ok'); route();
    } catch (e) { toast(e.message, 'err'); }
  };
}

/* ============ 真实项目实战 ============ */
async function vProjects() {
  const [prRes, claimsRes] = await Promise.all([
    cloud.database.from('real_projects').select('*').order('id'),
    cloud.database.from('project_claims').select('*'),
  ]);
  const projects = prRes.data || [], claims = claimsRes.data || [];
  view().innerHTML = `
    <h2 style="font-weight:900;font-size:22px">真实项目实战</h2>
    <p class="muted small mt8">项目片段来自内容创作板块（白名单教学素材）。明确交付物、截止时间与评审标准；完成后进入项目作品集。</p>
    <div class="grid c2 mt16">
      ${projects.map(p => {
        const cl = claims.find(c => c.project_id === p.id);
        return `
        <div class="card">
          <div class="flex jcb aic"><span class="badge blue">实战任务</span><span class="muted small">截止 ${fmtDate(p.deadline)} · 名额 ${p.slots}</span></div>
          <h3 style="font-weight:800;margin-top:10px">${esc(p.title)}</h3>
          <p class="muted small mt8">${esc(p.description || '')}</p>
          <div class="mt8 small"><b>交付物：</b>${esc(p.deliverable || '-')}</div>
          <div class="mt8 small"><b>评审要求：</b>${esc(p.requirements || '-')}</div>
          <div class="flex jcb aic mt16">
            <span class="tag">${esc(p.reward || '')}</span>
            ${cl
              ? `<span class="badge ${cl.status === 'approved' ? 'green' : 'orange'}">${cl.status === 'approved' ? '已通过评审' : cl.status === 'submitted' ? '已交付待评审' : '已领取'}</span>`
              : `<button class="btn sm" onclick="claimProject(${p.id},'${esc(p.title)}')">领取任务</button>`}
          </div>
        </div>`;
      }).join('') || '<div class="empty">暂无招募中的项目</div>'}
    </div>`;
}
async function claimProject(id, title) {
  const yes = await confirmModal({ title: '领取实战任务', text: `领取「${title}」后请按交付物要求在截止时间前完成，可从 AI 工作台发起创作。`, okText: '确认领取' });
  if (!yes) return;
  try {
    unwrap(await cloud.database.from('project_claims').insert({ project_id: id, owner_name: ME.nickname }));
    unwrap(await cloud.database.from('leads').insert({ event: 'project_claim', ...attrPayload() }));
    toast('任务已领取，去工作台开始创作吧', 'ok'); route();
  } catch (e) { toast(e.message.includes('已存在') ? '你已领取过该任务' : e.message, 'err'); }
}

/* ============ 个人中心 ============ */
async function vMe() {
  const [claimsRes, couponsRes, worksRes, noticesRes] = await Promise.all([
    cloud.database.from('coupon_claims').select('*'),
    cloud.database.from('coupons').select('*'),
    cloud.database.from('works').select('*').eq('owner_id', SESSION.user.id),
    cloud.database.from('notifications').select('*').eq('owner_id', SESSION.user.id).order('created_at', { ascending: false }),
  ]);
  const cMap = {}; (couponsRes.data || []).forEach(c => cMap[c.id] = c);
  const myCoupons = (claimsRes.data || []).map(cl => ({ ...cl, coupon: cMap[cl.coupon_id] })).filter(x => x.coupon);

  view().innerHTML = `
    <div class="card">
      <div class="flex aic gap12">
        <div style="width:56px;height:56px;border-radius:16px;background:var(--grad-brand);display:flex;align-items:center;justify-content:center;font-size:28px">${ME.avatar_emoji || '🧑‍🎓'}</div>
        <div style="flex:1">
          <div class="flex aic gap8"><b style="font-size:18px">${esc(ME.nickname || '')}</b><span class="badge">${ME.role === 'student' ? '学员' : ME.role}</span></div>
          <div class="muted small mt8">学习汇报与变现通道都在这里</div>
        </div>
        <button class="btn ghost sm" onclick="logout()">退出登录</button>
      </div>
    </div>

    <div class="grid c3 mt16">
      <div class="card">
        <div class="card-title">💰 变现 / 投稿通道</div>
        <p class="muted small">V1 阶段不站内闭环交易，通过以下官方通道投稿与接单：</p>
        <div class="mt16">
          <div class="lesson-item" style="margin-bottom:8px" onclick="toast('已打开官方投稿通道说明（V1 演示入口）')"><div class="lesson-idx">📮</div><div><b class="small">官方投稿通道</b><div class="muted small">优秀作品推荐至合作 MCN 与平台账号矩阵</div></div></div>
          <div class="lesson-item" style="margin-bottom:8px" onclick="toast('已打开接单广场说明（V1 演示入口）')"><div class="lesson-idx">🤝</div><div><b class="small">接单广场</b><div class="muted small">按方向匹配商单需求，结课学员优先</div></div></div>
          <div class="lesson-item" onclick="window.print()"><div class="lesson-idx">📄</div><div><b class="small">作品集导出（PDF）</b><div class="muted small">打印当前作品集视图，另存为 PDF 投递</div></div></div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">🎫 我的优惠券</div>
        ${myCoupons.length ? myCoupons.map(x => `
          <div style="padding:10px 0;border-bottom:1px solid #F2F0FA">
            <div class="flex jcb aic"><b class="small">${esc(x.coupon.title)}</b><span class="badge ${x.used ? 'gray' : 'green'}">${x.used ? '已使用' : '可用'}</span></div>
            <div class="muted small mt8">券码 ${esc(x.code)} · 有效期至 ${fmtDate(x.coupon.valid_until)}</div>
          </div>`).join('') : '<div class="empty"><div class="ico">🎫</div>暂无优惠券，去官网领取</div>'}
      </div>
      <div class="card" id="portfolio-card">
        <div class="card-title">🖼️ 我的作品集</div>
        ${(worksRes.data || []).length ? (worksRes.data || []).map(w => `
          <div style="padding:9px 0;border-bottom:1px solid #F2F0FA">
            <div class="flex jcb aic"><b class="small">${esc(w.title)}</b><span class="badge ${w.visibility === 'public' ? 'green' : 'gray'}">${w.visibility === 'public' ? '公开' : '私密'}</span></div>
            <div class="muted small mt8">${esc((w.description || '').slice(0, 40))}</div>
          </div>`).join('') : '<div class="empty"><div class="ico">🖼️</div>还没有作品，去发布第一件吧</div>'}
      </div>
    </div>

    <div class="card">
      <div class="card-title">🔔 全部通知</div>
      ${(noticesRes.data || []).length ? (noticesRes.data || []).map(n => `
        <div style="padding:10px 0;border-bottom:1px solid #F2F0FA">
          <div class="flex jcb aic"><b style="font-size:14px">${n.read ? '' : '🔵 '}${esc(n.title)}</b><span class="muted small">${fmtTime(n.created_at)}</span></div>
          <div class="muted small mt8" style="white-space:pre-wrap">${esc(n.content || '')}</div>
        </div>`).join('') : '<div class="empty">暂无通知</div>'}
      ${(noticesRes.data || []).some(n => !n.read) ? '<button class="btn ghost sm mt16" onclick="markAllRead()">全部标记已读</button>' : ''}
    </div>`;
}
async function markAllRead() {
  const { data } = await cloud.database.from('notifications').select('id, read').eq('owner_id', SESSION.user.id);
  for (const n of (data || []).filter(x => !x.read)) {
    await cloud.database.from('notifications').update({ read: true }).eq('id', n.id);
  }
  toast('已全部标记为已读', 'ok'); route();
}
async function logout() {
  const yes = await confirmModal({ title: '退出登录', text: '退出后需要重新登录才能继续学习。', okText: '退出' });
  if (!yes) return;
  await cloud.auth.signOut();
  location.href = 'auth.html';
}

/* ---------- 工作台（独立模块） ---------- */
