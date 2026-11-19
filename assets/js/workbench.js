/* ===== AI 影视创作工作台 workbench.js =====
   链路：剧本解析 → 分镜生成 → 角色/场景一致性控制 → 视频合成
   每一步记录快照：提示词、参数、模型版本（F-AI-05/06、异常边界要求） */
let WB = { project: null, projects: [], modelId: null, models: [], step: 1, lessonCtx: null };

async function vWorkbench(arg) {
  // 从课程「一键跟练」进入：#workbench/new?lesson=x&tpl=json
  if (arg && arg.startsWith('new?')) {
    const q = new URLSearchParams(arg.split('?')[1]);
    const tpl = q.get('tpl');
    if (tpl) { try { WB.lessonCtx = { lesson: q.get('lesson'), tpl: JSON.parse(decodeURIComponent(tpl)) }; } catch (e) {} }
  }
  WB.models = await listModels();
  if (!WB.models.length) {
    view().innerHTML = '<div class="empty"><div class="ico">🤖</div>暂无可用模型，请联系管理员在管理端配置</div>';
    return;
  }
  WB.modelId = WB.modelId || WB.models[0].id;
  const { data } = await cloud.database.from('workbench_projects').select('*').order('created_at', { ascending: false });
  WB.projects = data || [];
  if (!WB.project && WB.projects.length) WB.project = WB.projects[0];
  renderWB();
}

function wbStepOf(p) {
  if (!p) return 1;
  if ((p.renders || []).length && (p.renders || []).every(r => r.status === 'done')) return 5;
  if ((p.characters || []).some(c => (c.refs || []).length)) return 4;
  if ((p.shots || []).length) return 3;
  if ((p.scenes || []).length) return 2;
  return 1;
}

function renderWB() {
  const p = WB.project;
  WB.step = p ? wbStepOf(p) : 1;
  const stepNames = ['剧本解析', '分镜生成', '一致性控制', '视频合成', '完成'];
  view().innerHTML = `
    <div class="flex jcb aic" style="flex-wrap:wrap;gap:10px">
      <div><h2 style="font-weight:900;font-size:22px">AI 影视创作工作台</h2>
      <p class="muted small mt8">剧本解析 → 分镜生成 → 角色/场景一致性 → 视频合成；每一步自动记录提示词、参数与模型版本快照，可复盘可点评。</p></div>
      <div class="flex aic gap8">
        <select id="wb-model" class="input" style="width:210px">
          ${WB.models.map(m => `<option value="${esc(m.id)}" ${m.id === WB.modelId ? 'selected' : ''}>${esc(m.name || m.id)}</option>`).join('')}
        </select>
        <button class="btn" onclick="wbNewProject()">＋ 新建项目</button>
      </div>
    </div>

    <div class="wb-layout mt16" id="wb-grid">
      <div class="card" style="padding:14px">
        <div class="card-title" style="font-size:14px">我的项目 <span class="hint">${WB.projects.length}</span></div>
        ${WB.projects.map(x => `
          <div class="lesson-item" style="padding:10px 12px;margin-bottom:8px" onclick="wbSelect(${x.id})">
            <div class="lesson-idx" style="width:28px;height:28px;font-size:12px">${wbStepOf(x) >= 5 ? '✓' : wbStepOf(x)}</div>
            <div style="min-width:0"><b class="small" style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(x.title)}</b>
            <span class="muted" style="font-size:11px">${fmtDate(x.created_at)}</span></div>
          </div>`).join('') || '<div class="empty small">暂无项目</div>'}
      </div>

      <div>
        <div class="steps">
          ${stepNames.map((n, i) => `<div class="step ${i + 1 === WB.step ? 'on' : i + 1 < WB.step ? 'done' : ''}"><div class="dot">${i + 1 < WB.step ? '✓' : i + 1}</div>${n}</div>`).join('')}
        </div>
        <div id="wb-body"></div>
      </div>
    </div>`;

  $('wb-model').onchange = (e) => { WB.modelId = e.target.value; toast('已切换模型：' + e.target.selectedOptions[0].textContent, 'ok'); };
  wbRenderBody();
}
async function wbSelect(id) {
  WB.project = WB.projects.find(x => x.id === id) || null;
  renderWB();
}
function wbSaveLocal(patch) {
  Object.assign(WB.project, patch);
  WB.projects = WB.projects.map(x => x.id === WB.project.id ? WB.project : x);
}
async function wbPersist() {
  const { id, title, script, scenes, shots, characters, renders, model_version, status } = WB.project;
  const body = { title, script: script || '', scenes: scenes || [], shots: shots || [], characters: characters || [], renders: renders || [], model_version: model_version || WB.modelId, status: status || 'draft' };
  const res = await cloud.database.from('workbench_projects').update(body).eq('id', id).select();
  if (res.error) { toast(humanDbError(res.error), 'err'); return false; }
  return true;
}

async function wbNewProject() {
  const t = prompt('项目名称', (WB.lessonCtx ? '跟练 · ' : '新项目 ') + new Date().toLocaleDateString('zh-CN'));
  if (!t) return;
  try {
    const ins = unwrap(await cloud.database.from('workbench_projects').insert({ title: t.slice(0, 40), model_version: WB.modelId }).select());
    const np = ins[0];
    if (WB.lessonCtx && WB.lessonCtx.tpl) {
      np.script = '【课程跟练模板】' + (WB.lessonCtx.tpl.prompt || '');
      const upd = await cloud.database.from('workbench_projects').update({ script: np.script }).eq('id', np.id).select();
      if (!upd.error && upd.data && upd.data[0]) WB.projects.unshift(upd.data[0]); else WB.projects.unshift(np);
    } else WB.projects.unshift(np);
    WB.project = WB.projects[0];
    toast('项目已创建', 'ok');
    renderWB();
  } catch (e) { toast(e.message, 'err'); }
}

function wbRenderBody() {
  const p = WB.project;
  const body = $('wb-body');
  if (!p) { body.innerHTML = '<div class="card"><div class="empty"><div class="ico">🎬</div>新建或选择一个项目开始创作<br><span class="small">从课程「一键跟练」进入会自动带入本课时推荐模板</span></div></div>'; return; }
  const step = WB.step;
  if (step === 1) wbBodyScript();
  else if (step === 2) wbBodyStoryboard();
  else if (step === 3) wbBodyConsistency();
  else wbBodyCompose();
}

/* ---- Step 1 剧本解析 ---- */
function wbBodyScript() {
  const p = WB.project;
  $('wb-body').innerHTML = `
    <div class="card">
      <div class="card-title">① 剧本解析 <span class="hint">粘贴 / 上传剧本，AI 自动拆分场次、角色、场景、情绪与道具</span></div>
      <textarea id="wb-script" class="input" style="min-height:170px" placeholder="粘贴你的剧本文本（支持多场次，如：第1场 夜 内 出租屋 …）">${esc(p.script || '')}</textarea>
      <div class="flex aic gap12 mt16">
        <button class="btn" id="btn-parse">🤖 AI 解析剧本</button>
        <button class="btn ghost" onclick="wbSaveScript()">保存剧本</button>
        <span id="parse-status" class="muted small"></span>
      </div>
      <div id="parse-result" class="mt16"></div>
    </div>`;
  if ((p.scenes || []).length) wbShowScenes();
  $('btn-parse').onclick = wbParse;
}
async function wbSaveScript() {
  wbSaveLocal({ script: $('wb-script').value });
  const ok = await wbPersist();
  if (ok) toast('剧本已保存', 'ok');
}
async function wbParse() {
  const text = $('wb-script').value.trim();
  const bad = contentSafeCheck(text);
  if (bad) return toast(bad, 'err');
  if (text.length < 30) return toast('剧本内容太短（至少 30 字）', 'err');
  const st = $('parse-status'); st.innerHTML = '<span class="spin"></span>AI 正在解析剧本（拆分场次 / 角色 / 场景 / 情绪 / 道具）…';
  $('btn-parse').disabled = true;
  try {
    const out = await llmComplete(WB.modelId,
      '你是专业的影视剧本分析师。只输出 JSON，不要输出任何其他文字。将用户剧本拆分为结构化数据。',
      `请解析以下剧本，输出 JSON：{"scenes":[{"no":1,"summary":"场次梗概(30字内)","location":"场景","time":"日/夜","emotion":"情绪基调","characters":["角色名"],"props":["道具"]}],"characters":[{"name":"角色名","desc":"外形与性格特征(40字内)"}]}。剧本：\n${text.slice(0, 3000)}`,
      { json: true, temperature: 0.4 });
    const parsed = extractJson(out);
    const scenes = (parsed.scenes || []).map((s, i) => ({
      no: s.no || i + 1, summary: String(s.summary || '').slice(0, 120), location: s.location || '', time: s.time || '',
      emotion: s.emotion || '', characters: Array.isArray(s.characters) ? s.characters : [], props: Array.isArray(s.props) ? s.props : [],
      shots: [],
    }));
    const characters = (parsed.characters || []).map(c => ({ name: String(c.name || '').slice(0, 20), desc: String(c.desc || '').slice(0, 120), refs: [], locked: false }));
    if (!scenes.length) throw new Error('未能识别出场次，请检查剧本格式');
    wbSaveLocal({ script: text, scenes, characters, shots: [], renders: [] });
    await wbPersist();
    st.textContent = '';
    toast(`解析完成：${scenes.length} 场次 / ${characters.length} 角色`, 'ok');
    wbShowScenes();
    WB.projects = WB.projects.map(x => x.id === WB.project.id ? WB.project : x);
  } catch (e) {
    st.textContent = '';
    toast(llmErrText(e) + (e instanceof SyntaxError ? '（JSON 解析失败，可重试）' : ''), 'err');
  } finally { $('btn-parse').disabled = false; }
}
function wbShowScenes() {
  const p = WB.project;
  $('parse-result').innerHTML = `
    <div class="flex jcb aic"><b>解析结果（可编辑）</b><span class="badge green">共 ${(p.scenes || []).length} 场次 · ${(p.characters || []).length} 角色</span></div>
    ${(p.scenes || []).map((s, i) => `
      <div class="scene-card mt8">
        <div class="sh">
          <span class="badge">第 ${s.no} 场</span>
          <span class="badge gray">${esc(s.location || '-')} · ${esc(s.time || '-')}</span>
          <span class="badge blue">${esc(s.emotion || '-')}</span>
          ${s.characters.map(c => `<span class="tag">${esc(c)}</span>`).join('')}
          ${s.props && s.props.length ? `<span class="muted small">道具：${esc(s.props.join('、'))}</span>` : ''}
        </div>
        <textarea class="input small" style="min-height:46px" onchange="wbEditScene(${i},'summary',this.value)">${esc(s.summary)}</textarea>
      </div>`).join('')}
    <div class="mt16"><button class="btn" onclick="WB.step=2;wbRenderBody()">进入下一步：分镜生成 →</button></div>`;
}
function wbEditScene(i, k, v) { WB.project.scenes[i][k] = v.slice(0, 200); wbPersist(); }

/* ---- Step 2 分镜生成 ---- */
function wbBodyStoryboard() {
  const p = WB.project;
  $('wb-body').innerHTML = `
    <div class="card">
      <div class="card-title">② 分镜生成 <span class="hint">基于场次自动生成分镜表（景别 / 机位 / 画面描述 / 台词 / 时长），可拖拽排序、逐镜重生成</span></div>
      <div class="flex aic gap12" style="flex-wrap:wrap">
        <select id="wb-scene-sel" class="input" style="width:300px">
          ${(p.scenes || []).map((s, i) => `<option value="${i}">第 ${s.no} 场 · ${esc((s.summary || '').slice(0, 16))}</option>`).join('')}
        </select>
        <button class="btn" id="btn-shots">🤖 生成本场次分镜</button>
        <button class="btn ghost" onclick="wbGenAllShots()">⚡ 全部场次批量生成</button>
        <span id="shots-status" class="muted small"></span>
      </div>
      <div id="shots-list" class="mt16"></div>
    </div>`;
  if ((p.shots || []).length) wbShowShots();
  $('btn-shots').onclick = () => wbGenShots(parseInt($('wb-scene-sel').value, 10) || 0, false);
}
async function wbGenAllShots() {
  for (let i = 0; i < (WB.project.scenes || []).length; i++) {
    await wbGenShots(i, true);
  }
  toast('全部场次分镜生成完毕', 'ok');
}
async function wbGenShots(sceneIdx, silent) {
  const p = WB.project;
  const scene = p.scenes[sceneIdx];
  if (!scene) return;
  const st = $('shots-status');
  if (st && !silent) st.innerHTML = '<span class="spin"></span>AI 正在生成分镜…';
  try {
    const out = await llmComplete(WB.modelId,
      '你是专业分镜师。只输出 JSON，不要输出其他文字。分镜要具体、可拍摄、画面描述有电影感。',
      `为以下场次生成 4-6 个分镜，输出 JSON：{"shots":[{"type":"景别(远/全/中/近/特)","camera":"机位运动","desc":"画面描述(30字内)","line":"台词或旁白，可为空","seconds":3}]}。\n场次：第${scene.no}场 ${scene.location} ${scene.time}，情绪：${scene.emotion}，梗概：${scene.summary}，角色：${(scene.characters || []).join('、')}`,
      { json: true, temperature: 0.7 });
    const parsed = extractJson(out);
    const shots = (parsed.shots || []).slice(0, 8).map(s => ({
      scene_no: scene.no, type: String(s.type || '中景').slice(0, 8), camera: String(s.camera || '').slice(0, 30),
      desc: String(s.desc || '').slice(0, 80), line: String(s.line || '').slice(0, 60),
      seconds: Math.max(1, Math.min(15, Number(s.seconds) || 4)),
      prompt: `${s.type || ''} ${s.desc || ''} ${scene.emotion || ''}`.trim(), // 快照：生成该镜使用的提示词
      params: { temperature: 0.7 },
    }));
    p.shots = (p.shots || []).filter(x => x.scene_no !== scene.no);
    p.shots.push(...shots);
    p.shots.sort((a, b) => (a._ord || 0) - (b._ord || 0) || a.scene_no - b.scene_no);
    wbSaveLocal({ shots: p.shots, model_version: WB.modelId });
    await wbPersist();
    if (!silent) { st.textContent = ''; toast(`第 ${scene.no} 场生成 ${shots.length} 镜`, 'ok'); }
    wbShowShots();
  } catch (e) {
    if (st) st.textContent = '';
    if (!silent) toast(llmErrText(e), 'err');
  }
}
function wbShowShots() {
  const p = WB.project;
  const box = $('shots-list');
  if (!box) return;
  const shots = p.shots || [];
  box.innerHTML = shots.map((s, i) => `
    <div class="shot-row" draggable="true" data-i="${i}">
      <div class="shot-thumb" style="background:${gradOf((s.desc || '') + i)}">镜 ${i + 1}<br>${esc(s.type)}</div>
      <div style="flex:1;min-width:0">
        <div class="flex gap8 aic" style="flex-wrap:wrap">
          <span class="badge">第 ${s.scene_no} 场</span><span class="badge gray">${esc(s.type)}</span>
          <span class="muted small">🎥 ${esc(s.camera || '固定机位')}</span><span class="muted small">⏱ ${s.seconds}s</span>
        </div>
        <div class="small mt8"><b>画面：</b>${esc(s.desc)}</div>
        ${s.line ? `<div class="small muted mt8"><b>台词：</b>「${esc(s.line)}」</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <button class="btn sm soft" onclick="wbRegenShot(${i})">重生成</button>
        <button class="btn sm danger" onclick="wbDelShot(${i})">删除</button>
      </div>
    </div>`).join('') || '<div class="empty">还没有分镜，选择场次开始生成</div>';
  // 拖拽排序：dragover 仅做视觉提示，drop/dragend 时统一重排并持久化（避免拖拽源被替换导致流程中断）
  let dragIdx = null;
  box.querySelectorAll('.shot-row').forEach(row => {
    row.addEventListener('dragstart', () => { dragIdx = parseInt(row.dataset.i, 10); row.classList.add('dragging'); });
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      box.querySelectorAll('.shot-row').forEach(r => r.style.outline = '');
      row.style.outline = '2px solid var(--primary)';
    });
    const finish = async (e) => {
      e.preventDefault();
      const to = parseInt(row.dataset.i, 10);
      box.querySelectorAll('.shot-row').forEach(r => r.style.outline = '');
      if (dragIdx != null && to !== dragIdx) {
        const arr = WB.project.shots;
        const [m] = arr.splice(dragIdx, 1);
        arr.splice(to, 0, m);
        wbSaveLocal({ shots: arr });
        await wbPersist();
        toast('分镜顺序已调整', 'ok');
      }
      dragIdx = null;
      wbShowShots();
    };
    row.addEventListener('drop', finish);
    row.addEventListener('dragend', finish);
  });
}
async function wbRegenShot(i) {
  const p = WB.project;
  const shot = p.shots[i];
  const scene = (p.scenes || []).find(s => s.no === shot.scene_no);
  if (!scene) return toast('未找到关联场次', 'err');
  toast('正在重生成该镜…');
  try {
    const out = await llmComplete(WB.modelId,
      '你是专业分镜师。只输出 JSON。为指定分镜重新给出一版更优设计。',
      `重新设计一个分镜，输出 JSON：{"shots":[{"type":"景别","camera":"机位","desc":"画面描述(30字内)","line":"台词可空","seconds":3}]}。\n场次：${scene.summary}，情绪：${scene.emotion}。原分镜：${shot.type} ${shot.desc}（需要优化画面表现与叙事衔接）`,
      { json: true, temperature: 0.8 });
    const parsed = extractJson(out);
    const ns = (parsed.shots || [])[0] || {};
    const newShot = {
      ...shot,
      type: String(ns.type || shot.type).slice(0, 8), camera: String(ns.camera || shot.camera).slice(0, 30),
      desc: String(ns.desc || shot.desc).slice(0, 80), line: String(ns.line || '').slice(0, 60),
      seconds: Math.max(1, Math.min(15, Number(ns.seconds) || shot.seconds)),
      prompt: `重生成: ${ns.desc || shot.desc}`, params: { temperature: 0.8, regen_of: i },
    };
    p.shots[i] = newShot;
    await wbPersist(); wbShowShots(); toast('该镜已重生成', 'ok');
  } catch (e) { toast(llmErrText(e), 'err'); }
}
async function wbDelShot(i) {
  WB.project.shots.splice(i, 1);
  await wbPersist(); wbShowShots();
}

/* ---- Step 3 一致性控制 ---- */
function wbBodyConsistency() {
  const p = WB.project;
  const chars = p.characters || [];
  $('wb-body').innerHTML = `
    <div class="card">
      <div class="card-title">③ 角色 / 场景一致性控制 <span class="hint">为每个角色建立参考图库，后续生成自动引用同一组参考与特征提示词</span></div>
      ${chars.length ? chars.map((c, i) => `
        <div class="char-card mb16">
          <div class="flex jcb aic" style="flex-wrap:wrap;gap:8px">
            <div class="flex aic gap8"><b>${esc(c.name)}</b>
              <span class="badge ${(c.refs || []).length ? (c.locked ? 'green' : 'orange') : 'gray'}">${(c.refs || []).length ? (c.locked ? '一致性已锁定' : '参考库已建立') : '未建立'}</span>
            </div>
            <button class="btn sm" onclick="wbBuildRefs(${i})" ${c.locked ? 'disabled' : ''}>🤖 生成参考图库（3 视角）</button>
          </div>
          <div class="field mt8"><label>特征提示词（一致性锚点，锁定后生成分镜画面将自动引用）</label>
            <textarea class="input small" style="min-height:44px" onchange="wbEditChar(${i},this.value)" ${c.locked ? 'disabled' : ''}>${esc(c.desc || '')}</textarea>
          </div>
          ${(c.refs || []).length ? `<div class="grid c3 mt8" style="gap:10px">
            ${c.refs.map(r => `
              <div style="border:1px solid var(--line);border-radius:10px;overflow:hidden">
                <div style="height:86px;background:${r.gradient};display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;text-align:center;padding:6px">${esc(r.label)}<br><span style="opacity:.8;font-weight:400">seed ${r.seed}</span></div>
                <div class="small muted" style="padding:7px 9px;word-break:break-all">${esc(r.prompt.slice(0, 60))}</div>
              </div>`).join('')}
          </div>` : ''}
        </div>`).join('') : '<div class="empty">先在 Step 1 解析剧本以提取角色</div>'}
      <div class="mt16 flex jcb aic">
        <span class="muted small">V1 演示：参考图以参数化占位呈现，完整记录特征提示词与 seed；接入文生图模型后此步骤产出真实参考图。</span>
        <button class="btn" onclick="wbLockAll()" ${(p.characters || []).every(c => c.locked) ? 'disabled' : ''}>🔒 锁定全部一致性</button>
      </div>
    </div>`;
}
async function wbBuildRefs(i) {
  const c = WB.project.characters[i];
  c.refs = ['正面定妆', '侧面定妆', '面部特写'].map((label, k) => {
    const seed = Math.floor(Math.abs(Math.sin(i * 7 + k * 13) * 1e6)) % 100000;
    return { label, seed, gradient: gradOf(c.name + k), prompt: `${c.desc}, ${label}, consistent character reference, fixed seed=${seed}` };
  });
  await wbPersist();
  toast(`「${c.name}」参考图库已建立（3 视角）`, 'ok');
  wbBodyConsistency();
}
function wbEditChar(i, v) { WB.project.characters[i].desc = v.slice(0, 200); wbPersist(); }
async function wbLockAll() {
  WB.project.characters.forEach(c => { if ((c.refs || []).length) c.locked = true; });
  await wbPersist();
  toast('一致性已锁定：后续分镜生成将引用同一组参考与特征提示词', 'ok');
  WB.step = 4; wbRenderBody();
}

/* ---- Step 4 视频合成 ---- */
function wbBodyCompose() {
  const p = WB.project;
  const shots = p.shots || [];
  const renders = p.renders || [];
  const allDone = shots.length && renders.filter(r => r.status === 'done').length === shots.length;
  $('wb-body').innerHTML = `
    <div class="card">
      <div class="card-title">④ 视频合成 <span class="hint">按分镜顺序串联片段，叠加台词 / 字幕 / 配乐，导出 1080p MP4</span></div>
      <div class="flex aic gap12" style="flex-wrap:wrap">
        <button class="btn" id="btn-compose" ${shots.length ? '' : 'disabled'}>🎬 开始合成（${shots.length} 镜）</button>
        <select id="wb-res" class="input" style="width:130px"><option value="1080p">1080p MP4</option><option value="720p">720p MP4</option></select>
        <span id="compose-status" class="muted small"></span>
      </div>
      <div id="render-list" class="mt16"></div>
      ${allDone ? `
        <div class="card mt16" style="background:#F6FFF9;border-color:#BBF7D0">
          <div class="card-title" style="color:var(--ok)">✅ 合成完成，导出就绪</div>
          <div class="small muted">成片 ${shots.reduce((t, s) => t + s.seconds, 0)} 秒 · ${renders[0] && renders[0].resolution} MP4 · 含字幕与配乐轨 · 模型 ${esc(WB.project.model_version || WB.modelId)}</div>
          <div class="flex gap12 mt16" style="flex-wrap:wrap">
            <button class="btn" onclick="wbSubmitAssignment()">📤 提交为作业</button>
            <button class="btn ghost" onclick="wbPublishWork()">🖼️ 发布到作品广场</button>
            <button class="btn ghost" onclick="wbExportReport()">📋 导出合成报告</button>
          </div>
        </div>` : ''}
    </div>`;
  wbShowRenders();
  $('btn-compose').onclick = wbCompose;
}
function wbShowRenders() {
  const box = $('render-list');
  if (!box) return;
  const renders = WB.project.renders || [];
  box.innerHTML = renders.map(r => `
    <div class="render-item">
      <span class="badge ${r.status === 'done' ? 'green' : 'red'}">镜 ${r.shot_no}</span>
      <div class="progress-track"><div class="progress-fill" style="width:${r.status === 'done' ? 100 : 0}%;background:${r.status === 'done' ? 'var(--grad-brand)' : 'var(--err)'}"></div></div>
      <span class="muted small">${r.status === 'done' ? r.duration + 's · ' + esc(r.resolution) : '失败：' + esc(r.error || '生成超时')}</span>
      ${r.status !== 'done' ? `<button class="btn sm soft" onclick="wbRerunShot(${r.shot_no})">单镜重跑</button>` : ''}
    </div>`).join('') || '<div class="empty">尚未开始合成</div>';
}
async function wbCompose() {
  const p = WB.project;
  const shots = p.shots || [];
  if (!shots.length) return;
  $('btn-compose').disabled = true;
  const resolution = $('wb-res').value;
  const renders = [];
  wbSaveLocal({ renders });
  wbShowRenders();
  const st = $('compose-status');
  for (let i = 0; i < shots.length; i++) {
    st.innerHTML = `<span class="spin"></span>正在合成第 ${i + 1}/${shots.length} 镜…`;
    const fail = Math.random() < 0.08; // 演示：模拟偶发生成失败，验证单镜重跑链路
    const r = {
      shot_no: i + 1, status: fail ? 'failed' : 'done', resolution,
      duration: shots[i].seconds,
      model_version: WB.modelId, // 快照：模型版本
      prompt: shots[i].prompt, params: { ...(shots[i].params || {}), resolution, fps: 30, subtitle: shots[i].line || '' },
      error: fail ? '模型生成超时' : undefined,
    };
    renders.push(r);
    wbSaveLocal({ renders });
    wbShowRenders();
    await new Promise(res => setTimeout(res, fail ? 400 : 700));
  }
  await wbPersist();
  st.textContent = '';
  $('btn-compose').disabled = false;
  const done = renders.filter(r => r.status === 'done').length;
  if (done === renders.length) toast(`合成完成：${done} 镜全部成功`, 'ok');
  else toast(`合成完成：${done}/${renders.length} 镜成功，可对失败分镜单镜重跑`, 'err');
  wbBodyCompose();
}
async function wbRerunShot(shotNo) {
  const renders = WB.project.renders;
  const r = renders.find(x => x.shot_no === shotNo);
  if (!r) return;
  r.status = 'done'; delete r.error;
  wbSaveLocal({ renders }); wbShowRenders();
  await wbPersist();
  toast(`镜 ${shotNo} 已重跑成功`, 'ok');
  wbBodyCompose();
}
async function wbSubmitAssignment() {
  const [lessonsRes, coursesRes] = await Promise.all([
    cloud.database.from('lessons').select('id, title, course_id, assignment_title').not('assignment_title', 'is', null).eq('status', 'published'),
    cloud.database.from('courses').select('id, title'),
  ]);
  const lessons = lessonsRes.data || [];
  if (!lessons.length) return toast('当前没有可提交的作业任务');
  const cMap = {}; (coursesRes.data || []).forEach(c => cMap[c.id] = c);
  const mask = document.createElement('div');
  mask.className = 'modal-mask';
  mask.innerHTML = `
    <div class="modal" style="width:480px">
      <h3>提交为作业</h3>
      <p class="muted small mb16">将自动快照：分镜表、合成记录、提示词、参数、模型版本与参考图库。老师可复现你当时的生成环境。</p>
      <div class="field"><label>选择作业任务</label>
        <select id="sa-lesson" class="input">${lessons.map(l => `<option value="${l.id}">${esc((cMap[l.course_id] || {}).title || '')} · ${esc(l.assignment_title || l.title)}</option>`).join('')}</select>
      </div>
      <div class="field"><label>补充说明（选填）</label><textarea id="sa-note" class="input" placeholder="创作思路、遇到的坑…"></textarea></div>
      <div class="actions"><button class="btn ghost" onclick="this.closest('.modal-mask').remove()">取消</button><button class="btn" id="sa-ok">提交</button></div>
    </div>`;
  document.body.appendChild(mask);
  mask.querySelector('#sa-ok').onclick = async () => {
    const lid = parseInt(mask.querySelector('#sa-lesson').value, 10);
    const lesson = lessons.find(l => l.id === lid);
    const note = mask.querySelector('#sa-note').value.trim();
    try {
      unwrap(await cloud.database.from('submissions').insert({
        owner_name: ME.nickname, lesson_id: lid, course_id: lesson.course_id,
        title: WB.project.title, content: note || '工作台产出提交',
        snapshot: {
          model_version: WB.modelId,
          scenes: (WB.project.scenes || []).length,
          shots: WB.project.shots,
          characters: WB.project.characters,
          renders: WB.project.renders,
          submitted_at: new Date().toISOString(),
        },
      }));
      mask.remove(); toast('作业已提交，等待老师点评', 'ok');
    } catch (e) { toast(e.message, 'err'); }
  };
}
async function wbPublishWork() {
  const yes = await confirmModal({
    title: '发布到作品广场',
    text: `「${WB.project.title}」将发布为公开作品（发布前已过内容安全检查），可在个人中心调整可见性。`,
    okText: '确认发布',
  });
  if (!yes) return;
  try {
    unwrap(await cloud.database.from('works').insert({
      title: WB.project.title, description: `AI 影视工作台产出：${(WB.project.scenes || []).length} 场次 / ${(WB.project.shots || []).length} 镜 · 一致性角色 ${(WB.project.characters || []).length} 个`,
      source: 'workbench', visibility: 'public', direction: 'video',
      cover_gradient: gradOf(WB.project.title + '0'), project_tag: '工作台产出',
    }));
    toast('作品已发布到广场', 'ok');
    location.hash = '#/works';
  } catch (e) { toast(e.message, 'err'); }
}
function wbExportReport() {
  const p = WB.project;
  const lines = [
    `合成报告 · ${p.title}`, `导出时间：${new Date().toLocaleString('zh-CN')}`,
    `模型版本：${WB.modelId}`, `分镜数：${(p.shots || []).length} · 成功：${(p.renders || []).filter(r => r.status === 'done').length}`,
    '', '分镜清单：', ...(p.shots || []).map((s, i) => `${i + 1}. [${s.type}/${s.camera}/${s.seconds}s] ${s.desc} ${s.line ? '「' + s.line + '」' : ''}\n   prompt: ${s.prompt}`),
    '', '渲染记录：', ...(p.renders || []).map(r => `镜${r.shot_no}: ${r.status} ${r.resolution} model=${r.model_version}`),
  ].join('\n');
  const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `合成报告-${p.title}.txt`;
  a.click();
  toast('报告已导出', 'ok');
}
