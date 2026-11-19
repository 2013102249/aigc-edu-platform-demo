/* ===== demo-mode.js —— 演示模式适配层 =====
   作用：WorkBuddy 云服务按精确 Origin 校验，GitHub Pages 域名下无法调用云端
   （登录 / 数据库 / LLM 均会被拒绝）。本文件检测部署域，在非 WorkBuddy 域上
   自动启用「演示模式」：内置数据快照 + 本地持久化 + 预置 AI 结果，
   保证 Demo 在 GitHub Pages 上完整可点；完整云端版链接见演示横幅。 */
(function () {
  var host = location.hostname;
  var REAL = host.indexOf('.app.workbuddy.host') !== -1 || host === 'localhost' || host === '127.0.0.1';
  if (REAL) return; // 完整云端版：不干预

  window.__DEMO_MODE = true;

  /* ---------- 种子数据（与云端种子一致 + 演示增强） ---------- */
  function seed() {
    var now = new Date().toISOString();
    var d = function (days) { return new Date(Date.now() + days * 86400e3).toISOString(); };
    return {
      seq: 100,
      courses: [
        { id: 1, title: 'AI 影视创作全链路实战', subtitle: '剧本解析 → 分镜 → 一致性 → 合成', description: '从一份剧本到一部成片：覆盖 AI 影视创作全链路，内嵌工作台跟练，毕业产出可投递短片作品集。', direction: 'video', cover_gradient: 'linear-gradient(135deg,#7C3AED,#2563EB)', price: 2999, status: 'published', sort: 1, created_at: now },
        { id: 2, title: 'AI 绘画从入门到商单', subtitle: '提示词 → 风格控制 → 商单实战', description: '面向副业与就业的 AI 绘画课程，从提示词语法到商单级交付，真实商单案例拆解。', direction: 'painting', cover_gradient: 'linear-gradient(135deg,#2563EB,#06B6D4)', price: 1999, status: 'published', sort: 2, created_at: now },
        { id: 3, title: 'AI 漫剧制作实战营', subtitle: '网文改编 → 角色设定 → 成片', description: '依托平台自研漫剧项目真实素材，从网文改编到漫剧成片，结课直接参与真实项目实战。', direction: 'manhua', cover_gradient: 'linear-gradient(135deg,#DB2777,#7C3AED)', price: 3999, status: 'published', sort: 3, created_at: now }
      ],
      lessons: [
        { id: 1, course_id: 1, title: 'AIGC 影视制作全景与工作流认知', kind: 'video', video_url: 'https://vjs.zencdn.net/v/oceans.mp4', duration_min: 25, content: '本章建立全链路认知：剧本解析、分镜生成、角色/场景一致性控制、视频合成四大环节如何协作，以及平台内嵌工作台的基本操作。', order_no: 1, is_free_preview: true, tool_template: { tool: 'script_analysis', prompt: '推荐模板：三幕式结构剧本', params: { model: 'aigc-video-v1', temperature: 0.6 } }, status: 'published', created_at: now },
        { id: 2, course_id: 1, title: '剧本结构与 AI 剧本解析实操', kind: 'video', video_url: 'https://media.w3.org/2010/05/sintel/trailer.mp4', duration_min: 32, content: '拆解三幕式剧本结构，动手在工作台完成剧本解析：自动拆分场次、角色、场景、情绪与道具清单，并对解析结果进行人工修正。', order_no: 2, is_free_preview: false, tool_template: { tool: 'script_analysis', prompt: '请解析以下剧本，输出场次/角色/场景/情绪/道具五张清单', params: { model: 'aigc-video-v1', temperature: 0.4 } }, assignment_title: '作业 1：解析一份 3 场次剧本', assignment_req: '在工作台粘贴自选剧本（≥3 场次），完成解析并修正至少 2 处角色/道具识别结果，快照提交为作业。', assignment_deadline: d(14), status: 'published', created_at: now },
        { id: 3, course_id: 1, title: '分镜语言与 AI 分镜生成', kind: 'video', video_url: 'https://media.w3.org/2010/05/bunny/trailer.mp4', duration_min: 40, content: '景别、机位、画面描述、台词与时长五要素的写法；基于解析结果自动生成分镜表，学习拖拽排序与逐镜重生成的判断标准。', order_no: 3, is_free_preview: false, tool_template: { tool: 'storyboard', prompt: '基于场次生成 6 镜分镜表，含景别/机位/画面描述/台词/时长', params: { model: 'aigc-video-v1', temperature: 0.7 } }, assignment_title: '作业 2：产出 6 镜分镜表', assignment_req: '任选一场次生成 ≥6 镜分镜表，调整顺序使叙事连贯，并对 1 镜重生成优化后提交。', assignment_deadline: d(21), status: 'published', created_at: now },
        { id: 4, course_id: 1, title: '角色/场景一致性控制与参考图库', kind: 'video', video_url: 'https://media.w3.org/2010/05/bunny/movie.mp4', duration_min: 35, content: '为每个角色与场景建立参考图库，让跨分镜生成自动引用同一组参考图与特征提示词；讲解一致性评估指标与常见崩坏修复。', order_no: 4, is_free_preview: false, tool_template: { tool: 'consistency', prompt: '为角色建立参考图库：正面/侧面/特写 + 特征提示词锁定', params: { model: 'aigc-video-v1', ref_lock: true } }, assignment_title: '作业 3：建立 2 角色 + 1 场景参考库', assignment_req: '为两个角色与一个场景各建立参考图条目（含特征提示词），并在 ≥3 个分镜中验证一致性后提交。', assignment_deadline: d(28), status: 'published', created_at: now },
        { id: 5, course_id: 1, title: '视频合成、配音字幕与成片导出', kind: 'video', video_url: 'https://vjs.zencdn.net/v/oceans.mp4', duration_min: 45, content: '按分镜顺序串联生成片段，叠加台词字幕与配乐，导出 1080p MP4；合成失败时定位单镜重跑的排查路径。', order_no: 5, is_free_preview: false, tool_template: { tool: 'compose', prompt: '按分镜顺序合成，叠加字幕与配乐', params: { resolution: '1080p', fps: 30 } }, assignment_title: '作业 4：导出 30 秒成片', assignment_req: '完成 ≥30 秒成片导出（1080p MP4），含字幕与配乐，提交作品到广场可获老师点评加权。', assignment_deadline: d(35), status: 'published', created_at: now },
        { id: 6, course_id: 1, title: '结课实战：完整短片创作与投递', kind: 'practice', video_url: null, duration_min: 60, content: '综合运用四个环节独立完成一部短片，老师逐项评审；优秀作品推荐至平台投稿通道。', order_no: 6, is_free_preview: false, tool_template: null, assignment_title: '结课作品：完整短片', assignment_req: '自主完成一部 ≥60 秒短片（含剧本解析记录与分镜表），通过作品广场发布并投递。', assignment_deadline: d(45), status: 'published', created_at: now },
        { id: 7, course_id: 2, title: '提示词的语法：从一句话到一幅画', kind: 'video', video_url: 'https://media.w3.org/2010/05/sintel/trailer.mp4', duration_min: 28, content: '主体、风格、构图、光影、质感五段式提示词写法；负向提示词与权重语法入门。', order_no: 1, is_free_preview: true, tool_template: { tool: 'painting', prompt: '{subject}, {style}, {composition}, {lighting}, {texture}', params: { steps: 30, cfg: 7 } }, status: 'published', created_at: now },
        { id: 8, course_id: 2, title: '构图与风格控制：参数详解', kind: 'video', video_url: 'https://media.w3.org/2010/05/bunny/trailer.mp4', duration_min: 36, content: '步数、CFG、采样器、尺寸对画面的影响；固定 seed 做可控迭代；风格一致性技巧。', order_no: 2, is_free_preview: false, tool_template: { tool: 'painting', prompt: '固定 seed 生成 3 种风格变体', params: { steps: 30, cfg: 7, seed: 42 } }, assignment_title: '作业 1：3 种风格变体', assignment_req: '同一主体固定 seed，生成国风/赛博/写实三种风格，对比参数后提交最佳组。', assignment_deadline: d(10), status: 'published', created_at: now },
        { id: 9, course_id: 2, title: '商单实战：电商海报与 IP 形象', kind: 'video', video_url: 'https://media.w3.org/2010/05/bunny/movie.mp4', duration_min: 42, content: '真实商单案例拆解：需求转译、主图规范、留白与文案位预留、客户返修的提示词应对。', order_no: 3, is_free_preview: false, tool_template: { tool: 'painting', prompt: 'product hero shot, clean background, commercial lighting', params: { steps: 35, cfg: 8, size: '1024x1024' } }, assignment_title: '作业 2：商单级海报一张', assignment_req: '按给定商品需求产出一张商单级主图，预留文案位，附提示词快照提交。', assignment_deadline: d(20), status: 'published', created_at: now },
        { id: 10, course_id: 2, title: '结课实战：作品集打磨与接单', kind: 'practice', video_url: null, duration_min: 30, content: '整理个人作品集，学习接单定价与交付流程；平台提供投稿与作品集导出通道。', order_no: 4, is_free_preview: false, tool_template: null, assignment_title: '结课作品：作品集 5 张', assignment_req: '整理 5 张主题一致的作品发布到作品广场，生成作品集导出。', assignment_deadline: d(30), status: 'published', created_at: now },
        { id: 11, course_id: 3, title: '漫剧是什么：从网文到爆款漫剧', kind: 'video', video_url: 'https://vjs.zencdn.net/v/oceans.mp4', duration_min: 24, content: '漫剧形态、平台分发逻辑与爆款数据拆解；60 秒竖屏漫剧的节奏模型。', order_no: 1, is_free_preview: true, tool_template: null, status: 'published', created_at: now },
        { id: 12, course_id: 3, title: '角色设定与分集剧本', kind: 'video', video_url: 'https://media.w3.org/2010/05/sintel/trailer.mp4', duration_min: 38, content: '从网文提取人设：外形、性格、口癖的结构化描述；分集剧本的钩子与卡点写法。', order_no: 2, is_free_preview: false, tool_template: { tool: 'script_analysis', prompt: '提取主角人设三要素并输出结构化描述', params: { model: 'aigc-video-v1', temperature: 0.5 } }, assignment_title: '作业 1：主角人设与三视图提示词', assignment_req: '完成主角人设卡 + 三视图（正面/侧面/背面）生成提示词，建立角色参考图库后提交。', assignment_deadline: d(12), status: 'published', created_at: now },
        { id: 13, course_id: 3, title: '分镜与成片节奏', kind: 'video', video_url: 'https://media.w3.org/2010/05/bunny/trailer.mp4', duration_min: 40, content: '60 秒漫剧 15-25 镜的节奏设计：开场 3 秒钩子、冲突升级、卡点收尾；批量生成分镜的抽查方法。', order_no: 3, is_free_preview: false, tool_template: { tool: 'storyboard', prompt: '按 60 秒竖屏节奏生成 15 镜分镜', params: { model: 'aigc-video-v1', temperature: 0.7 } }, assignment_title: '作业 2：一集 60 秒漫剧分镜', assignment_req: '产出 ≥15 镜分镜表并生成成片片段，提交后进入互评与老师点评流程。', assignment_deadline: d(24), status: 'published', created_at: now },
        { id: 14, course_id: 3, title: '实战：接入真实漫剧项目', kind: 'practice', video_url: null, duration_min: 60, content: '领取平台真实漫剧项目片段（来自内容创作板块），按交付要求完成实战任务，通过评审后进入项目作品集。', order_no: 4, is_free_preview: false, tool_template: null, assignment_title: '结课实战：真实项目交付', assignment_req: '领取真实项目任务，按交付物要求完成并提交，老师评审通过即计入项目作品集。', assignment_deadline: d(40), status: 'published', created_at: now }
      ],
      questions: [
        { id: 1, course_id: 2, lesson_id: null, type: 'single', stem: '下列哪项最能提升 AI 绘画中主体突出的效果？', options: ['A. 增加背景细节描述', 'B. 用主体权重语法并精简干扰描述', 'C. 把步数拉满到 100', 'D. 每次随机化 seed'], answer: 'B', analysis: '主体突出靠权重语法与描述聚焦；步数过高反而过拟合，随机 seed 会破坏可控性。', knowledge_point: '提示词', created_at: now },
        { id: 2, course_id: 2, lesson_id: null, type: 'judge', stem: '其他参数一致时，相同 seed 多次生成结果完全一致。', options: [], answer: 'true', analysis: 'seed 决定初始噪声，同参数同 seed 结果可复现，这是可控迭代的基础。', knowledge_point: '参数', created_at: now },
        { id: 3, course_id: 1, lesson_id: null, type: 'single', stem: '分镜表五要素中通常不包括哪一项？', options: ['A. 景别', 'B. 机位', 'C. 台词', 'D. 色温'], answer: 'D', analysis: '分镜表五要素为景别、机位、画面描述、台词、时长；色温属于美术设定。', knowledge_point: '分镜', created_at: now },
        { id: 4, course_id: 1, lesson_id: null, type: 'single', stem: '保持同一角色在多分镜中外观一致，最有效的做法是？', options: ['A. 每次重新完整描述角色', 'B. 固定角色参考图 + 特征提示词', 'C. 换更贵的模型', 'D. 拉长视频时长'], answer: 'B', analysis: '一致性靠参考图库锁定特征提示词，重描述会引入随机漂移。', knowledge_point: '一致性', created_at: now },
        { id: 5, course_id: 1, lesson_id: null, type: 'judge', stem: '剧本解析的输出通常包含场次、角色、场景、情绪与道具清单。', options: [], answer: 'true', analysis: '五张清单是后续分镜与一致性控制的输入。', knowledge_point: '剧本', created_at: now },
        { id: 6, course_id: 1, lesson_id: null, type: 'single', stem: '视频合成导出时，平台要求至少支持哪种规格？', options: ['A. 480p', 'B. 720p', 'C. 1080p', 'D. 4K'], answer: 'C', analysis: 'PRD 要求导出至少 1080p MP4，且支持单镜重跑定位失败分镜。', knowledge_point: '合成', created_at: now },
        { id: 7, course_id: 1, lesson_id: null, type: 'single', stem: '沉淀提示词模板的意义不包括哪一项？', options: ['A. 团队复用与教学效率', 'B. 可追溯当时使用的模型版本', 'C. 增加生成结果的随机性', 'D. 降低新手上手门槛'], answer: 'C', analysis: '模板是稳定复用，随机性恰恰是要被控制的东西。', knowledge_point: '模板', created_at: now },
        { id: 8, course_id: 3, lesson_id: null, type: 'judge', stem: '作业快照应记录生成时的提示词、参数与模型版本，便于老师复现。', options: [], answer: 'true', analysis: '模型升级后旧作业仍可复盘，这正是快照设计的意义。', knowledge_point: '快照', created_at: now },
        { id: 9, course_id: 3, lesson_id: null, type: 'single', stem: '60 秒竖屏漫剧的分镜数量通常在什么范围？', options: ['A. 3-5 镜', 'B. 15-25 镜', 'C. 50 镜以上', 'D. 不需要分镜'], answer: 'B', analysis: '竖屏漫剧信息密度高，60 秒通常 15-25 镜。', knowledge_point: '漫剧', created_at: now },
        { id: 10, course_id: 1, lesson_id: null, type: 'single', stem: '收到生成画面与分镜描述不符的评估反馈，应优先做什么？', options: ['A. 忽略评估继续', 'B. 对照分镜描述改写提示词后重跑', 'C. 直接换剧本', 'D. 降低分辨率'], answer: 'B', analysis: '先对齐描述再重跑，必要时单镜重生成，而非推倒重来。', knowledge_point: '评估', created_at: now }
      ],
      prompt_templates: [
        { id: 1, author_id: 'system-seed', author_name: '官方教研组', title: '电影感人物特写', content: 'cinematic close-up of {character_desc}, rim lighting, 35mm film grain, shallow depth of field, moody color grading --ar 16:9', params: { steps: 30, cfg: 7, motion: 5 }, version: 'v1.2', model_version: 'aigc-video-v1', direction: 'video', is_official: true, created_at: now },
        { id: 2, author_id: 'system-seed', author_name: '官方教研组', title: '国风漫剧场景', content: 'guofeng animation scene of {scene_desc}, soft ink texture, warm dusk light, consistent color grading, high detail --ar 9:16', params: { steps: 28, cfg: 6.5 }, version: 'v1.0', model_version: 'aigc-video-v1', direction: 'manhua', is_official: true, created_at: now },
        { id: 3, author_id: 'system-seed', author_name: '官方教研组', title: '电商商单主图', content: 'product hero shot of {product}, studio lighting, clean gradient background, commercial photography, negative space for copy --ar 1:1', params: { steps: 35, cfg: 8, size: '1024x1024' }, version: 'v1.1', model_version: 'aigc-paint-v2', direction: 'painting', is_official: true, created_at: now }
      ],
      coupons: [
        { id: 1, title: '新人立减 300 元', kind: 'full_reduce', amount: 300, threshold: 0, discount_rate: null, valid_until: d(92), status: 'active', created_at: now },
        { id: 2, title: '影视课专用满 2000 减 500', kind: 'full_reduce', amount: 500, threshold: 2000, discount_rate: null, valid_until: d(60), status: 'active', created_at: now },
        { id: 3, title: '双人拼团 85 折', kind: 'discount', amount: 0, threshold: 0, discount_rate: 85, valid_until: d(30), status: 'active', created_at: now }
      ],
      real_projects: [
        { id: 1, title: '《都市修仙》漫剧第 3 集分镜片段', description: '来自内容创作板块的真实漫剧项目：完成第 3 集 60 秒核心片段的分镜与三个成片镜头，通过评审后计入项目作品集并署名。', deliverable: '60 秒分镜表（≥15 镜）+ 3 个成片镜头（1080p）', requirements: '使用工作台完成；角色一致性需引用项目官方参考图库；单镜重跑记录保留在快照中。', deadline: d(31), reward: '作品署名 + 500 元项目激励', slots: 8, status: 'open', source_note: '内容创作板块白名单素材，仅限教学使用', created_at: now },
        { id: 2, title: '品牌宣传短片《未来工场》AI 分镜', description: '政企定制板块真实需求：为智能制造品牌完成 15 镜宣传短片分镜设计，风格参考工业科技感。', deliverable: '15 镜分镜表（含景别/机位/画面描述/时长）', requirements: '分镜需与脚本场次一一对应；通过一致性评估后交付。', deadline: d(20), reward: '作品署名 + 进入商单人才库', slots: 10, status: 'open', source_note: '内容创作板块白名单素材，仅限教学使用', created_at: now }
      ],
      works: [
        { id: 1, owner_id: 'demo-showcase', owner_name: '官方示例 · 学员作品', title: '《深海信使》分镜片段', description: 'AI 影视课结课作品：3 场次 12 镜，角色一致性由参考图库锁定，成片 48 秒。', direction: 'video', source: 'submission', visibility: 'public', cover_gradient: 'linear-gradient(135deg,#7C3AED,#2563EB)', project_tag: '影视创作第 4 期', created_at: now },
        { id: 2, owner_id: 'demo-showcase', owner_name: '官方示例 · 学员作品', title: '国风 IP 形象「茶小狸」', description: 'AI 绘画商单实战产出：电商主图 + 三视图，已交付某茶饮品牌。', direction: 'painting', source: 'workbench', visibility: 'public', cover_gradient: 'linear-gradient(135deg,#DB2777,#7C3AED)', project_tag: '商单实战', created_at: now }
      ],
      profiles: [
        { id: 1, owner_id: 'demo-student', nickname: '演示学员', role: 'student', email: 'student@demo.flhc.cn', avatar_emoji: '🧑‍🎓', created_at: now },
        { id: 2, owner_id: 'demo-teacher', nickname: '林老师', role: 'teacher', email: 'teacher@demo.flhc.cn', avatar_emoji: '👩‍🏫', created_at: now },
        { id: 3, owner_id: 'demo-admin', nickname: '平台管理员', role: 'admin', email: 'admin@demo.flhc.cn', avatar_emoji: '🛡️', created_at: now }
      ],
      lesson_progress: [
        { id: 1, owner_id: 'demo-student', course_id: 1, lesson_id: 1, last_position: 1490, duration: 1500, completed: true, watch_seconds: 1500, updated_at: now }
      ],
      practice_attempts: [
        { id: 1, owner_id: 'demo-student', question_id: 3, course_id: 1, answer: 'D', correct: false, created_at: now },
        { id: 2, owner_id: 'demo-student', question_id: 3, course_id: 1, answer: 'D', correct: false, created_at: now },
        { id: 3, owner_id: 'demo-student', question_id: 5, course_id: 1, answer: 'true', correct: true, created_at: now }
      ],
      submissions: [
        { id: 1, owner_id: 'demo-student', owner_name: '演示学员', lesson_id: 2, course_id: 1, title: '作业 1：解析一份 3 场次剧本', content: '解析了短片剧本《加班夜》，修正了 2 处道具识别。', snapshot: { model_version: 'aigc-video-v1', submitted_at: now, scenes: 3, shots: [], characters: [] }, score: 88, feedback: '场次拆分准确，情绪标注到位；道具清单遗漏了「手机」与「外卖袋」，建议对照原文逐句核对后再提交。', reviewer_name: '林老师', status: 'reviewed', created_at: now, reviewed_at: now },
        { id: 2, owner_id: 'demo-student', owner_name: '演示学员', lesson_id: 3, course_id: 1, title: '作业 2：产出 6 镜分镜表', content: '第 2 场次生成 6 镜并重排，1 镜重生成优化。', snapshot: { model_version: 'aigc-video-v1', submitted_at: now, scenes: 2, shots: [{ scene_no: 1, type: '远景', camera: '推镜', desc: '城市夜景开场', line: '', seconds: 4, prompt: '远景 城市夜景开场', params: { temperature: 0.7 } }, { scene_no: 1, type: '中景', camera: '跟拍', desc: '主角走进便利店', line: '关东煮来一份', seconds: 3, prompt: '中景 主角走进便利店', params: { temperature: 0.7 } }], characters: [] }, score: null, feedback: null, reviewer_name: null, status: 'submitted', created_at: now, reviewed_at: null }
      ],
      notifications: [
        { id: 1, owner_id: 'demo-student', title: '作业已点评：作业 1', content: '林老师 给你打了 88 分\n点评：场次拆分准确，情绪标注到位；道具清单遗漏了「手机」与「外卖袋」。', type: 'review', ref_id: 1, read: false, created_at: now },
        { id: 2, owner_id: 'demo-student', title: '欢迎加入 AIGC 教培平台', content: '从「学习仪表盘」开始你的第一课；完成课时后自动解锁下一节。', type: 'system', ref_id: null, read: true, created_at: now }
      ],
      project_claims: [
        { id: 1, owner_id: 'demo-student', owner_name: '演示学员', project_id: 1, status: 'claimed', deliverable_note: null, created_at: now }
      ],
      workbench_projects: [
        { id: 1, owner_id: 'demo-student', title: '《加班夜》短片工作台项目', script: '第1场 夜 内 出租屋\n林然加班回家，外卖凉了，屏幕还亮着未完成的分镜稿。\n第2场 夜 内 便利店\n她下楼买关东煮，遇到同样加班的邻居，两人短暂交谈。\n第3场 夜 内 出租屋\n回到房间，她把分镜稿最后一格补完，关掉台灯。', scenes: [
          { no: 1, summary: '林然深夜加班回家，疲惫不堪', location: '出租屋', time: '夜', emotion: '疲惫', characters: ['林然'], props: ['外卖', '电脑'], shots: [] },
          { no: 2, summary: '便利店偶遇邻居，短暂温暖', location: '便利店', time: '夜', emotion: '温暖', characters: ['林然', '邻居'], props: ['关东煮'], shots: [] },
          { no: 3, summary: '补完分镜稿，安然入睡', location: '出租屋', time: '夜', emotion: '释然', characters: ['林然'], props: ['台灯'], shots: [] }
        ], shots: [
          { scene_no: 1, type: '远景', camera: '缓推', desc: '城中村夜色，一扇窗亮着灯', line: '', seconds: 4, prompt: '远景 城中村夜色，一扇窗亮着灯 疲惫', params: { temperature: 0.7 } },
          { scene_no: 1, type: '中景', camera: '固定', desc: '林然瘫在椅子上，外卖未动', line: '又是一天……', seconds: 3, prompt: '中景 林然瘫在椅子上，外卖未动 疲惫', params: { temperature: 0.7 } },
          { scene_no: 2, type: '全景', camera: '环摇', desc: '便利店暖光，两人并肩站着', line: '你也刚下班？', seconds: 4, prompt: '全景 便利店暖光，两人并肩站着 温暖', params: { temperature: 0.7 } },
          { scene_no: 3, type: '特写', camera: '固定', desc: '台灯熄灭，屏幕暗下去', line: '', seconds: 3, prompt: '特写 台灯熄灭，屏幕暗下去 释然', params: { temperature: 0.7 } }
        ], characters: [
          { name: '林然', desc: '26 岁插画师，黑长发扎低马尾，圆框眼镜，米色针织开衫', refs: [{ label: '正面定妆', seed: 42133, gradient: 'linear-gradient(135deg,#7C3AED,#2563EB)', prompt: '26 岁插画师，黑长发扎低马尾，圆框眼镜，米色针织开衫, 正面定妆, consistent character reference, fixed seed=42133' }, { label: '侧面定妆', seed: 78201, gradient: 'linear-gradient(135deg,#DB2777,#7C3AED)', prompt: '26 岁插画师…侧面定妆, fixed seed=78201' }, { label: '面部特写', seed: 10944, gradient: 'linear-gradient(135deg,#2563EB,#06B6D4)', prompt: '26 岁插画师…面部特写, fixed seed=10944' }], locked: true },
          { name: '邻居', desc: '30 岁左右上班族，寸头，深蓝色工装外套', refs: [], locked: false }
        ], renders: [
          { shot_no: 1, status: 'done', resolution: '1080p', duration: 4, model_version: 'aigc-video-v1', prompt: '远景 城中村夜色', params: { resolution: '1080p', fps: 30 } },
          { shot_no: 2, status: 'done', resolution: '1080p', duration: 3, model_version: 'aigc-video-v1', prompt: '中景 林然瘫在椅子上', params: { resolution: '1080p', fps: 30 } },
          { shot_no: 3, status: 'done', resolution: '1080p', duration: 4, model_version: 'aigc-video-v1', prompt: '全景 便利店暖光', params: { resolution: '1080p', fps: 30 } },
          { shot_no: 4, status: 'done', resolution: '1080p', duration: 3, model_version: 'aigc-video-v1', prompt: '特写 台灯熄灭', params: { resolution: '1080p', fps: 30 } }
        ], model_version: 'aigc-video-v1', status: 'draft', created_at: now },
        { id: 2, owner_id: 'demo-student', title: '跟练 · 分镜重生成对比', script: '', scenes: [], shots: [], characters: [], renders: [], model_version: 'aigc-video-v1', status: 'draft', created_at: now }
      ],
      coupon_claims: [], leads: [
        { id: 1, owner_id: null, email: 'w1@test.cn', event: 'trial', first_channel: 'xhs', last_channel: 'xhs', utm: { utm_campaign: 'q3' }, created_at: now },
        { id: 2, owner_id: null, email: 'w2@test.cn', event: 'coupon', first_channel: 'douyin', last_channel: 'wechat', utm: {}, created_at: now },
        { id: 3, owner_id: null, email: 'w3@test.cn', event: 'trial', first_channel: 'baidu', last_channel: 'baidu', utm: {}, created_at: now }
      ], tenants: [
        { id: 1, name: '示例政企客户 A', plan: 'gov', model_quota: 1000, model_used: 230, contact: '王老师', created_at: now }
      ]
    };
  }

  /* ---------- 本地持久化 ---------- */
  var KEY = 'flhc_demo_db_v2', SKEY = 'flhc_demo_session_v2';
  var DB;
  try { DB = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { DB = null; }
  if (!DB || !DB.courses) { DB = seed(); persist(); }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) {} }
  function persistSession() { try { localStorage.setItem(SKEY, JSON.stringify(session)); } catch (e) {} }
  window.__demoReset = function () { DB = seed(); persist(); location.reload(); };

  function nextId(t) { DB.seq = (DB.seq || 100) + 1; return DB.seq; }
  function table(t) { if (!DB[t]) DB[t] = []; return DB[t]; }

  /* ---------- 会话 ---------- */
  var session = null;
  try { session = JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch (e) { session = null; }
  function findProfileByEmail(email) {
    return (DB.profiles || []).filter(function (p) { return p.email === email; })[0] || null;
  }
  function ensureUser(email) {
    var p = findProfileByEmail(email);
    if (p) return p;
    p = { id: nextId('profiles'), owner_id: 'demo-u' + (DB.seq), nickname: email.split('@')[0].slice(0, 20), role: 'student', email: email, avatar_emoji: '🧑‍🎓', created_at: new Date().toISOString() };
    DB.profiles.push(p); persist();
    return p;
  }
  function makeSession(profile) {
    return { user: { id: profile.owner_id, email: profile.email }, profile_id: profile.id };
  }

  /* ---------- Query Builder（SELECT 链式 + thenable） ---------- */
  function QB(t) {
    this.t = t; this._f = []; this._order = null; this._limit = null; this._single = false; this._maybe = false;
  }
  QB.prototype.select = function (c, opts) { return this; };
  QB.prototype.eq = function (k, v) { this._f.push(function (r) { return String(r[k]) === String(v); }); return this; };
  QB.prototype.neq = function (k, v) { this._f.push(function (r) { return String(r[k]) !== String(v); }); return this; };
  QB.prototype.gt = function (k, v) { this._f.push(function (r) { return r[k] > v; }); return this; };
  QB.prototype.gte = function (k, v) { this._f.push(function (r) { return r[k] >= v; }); return this; };
  QB.prototype.lt = function (k, v) { this._f.push(function (r) { return r[k] < v; }); return this; };
  QB.prototype.lte = function (k, v) { this._f.push(function (r) { return r[k] <= v; }); return this; };
  QB.prototype.ilike = function (k, v) {
    var pat = String(v).replace(/%/g, '').toLowerCase();
    this._f.push(function (r) { return String(r[k] || '').toLowerCase().indexOf(pat) !== -1; }); return this;
  };
  QB.prototype.in = function (k, arr) { this._f.push(function (r) { return (arr || []).map(String).indexOf(String(r[k])) !== -1; }); return this; };
  QB.prototype.is = function (k, v) { this._f.push(function (r) { return v === null ? (r[k] == null) : r[k] === v; }); return this; };
  QB.prototype.not = function (k, op, v) {
    var self = this;
    if (op === 'is') this._f.push(function (r) { return r[k] != null && r[k] !== ''; });
    else if (op === 'eq') this._f.push(function (r) { return String(r[k]) !== String(v); });
    return self;
  };
  QB.prototype.or = function (s) {
    // 简化支持 'a.eq.x,b.eq.y' 形式
    var parts = String(s).split(',');
    var conds = parts.map(function (p) { var kv = p.split('.'); return { k: kv[0], op: kv[1], v: kv.slice(2).join('.') }; });
    this._f.push(function (r) { return conds.some(function (c) { return String(r[c.k]) === String(c.v); }); });
    return this;
  };
  QB.prototype.order = function (k, o) { this._order = { k: k, asc: !(o && o.ascending === false) }; return this; };
  QB.prototype.limit = function (n) { this._limit = n; return this; };
  QB.prototype.range = function (a, b) { this._range = [a, b]; return this; };
  QB.prototype.single = function () { this._single = true; return this; };
  QB.prototype.maybeSingle = function () { this._maybe = true; return this; };
  QB.prototype._exec = function () {
    var rows = table(this.t).filter(function (r) {
      return this._f.every(function (f) { try { return f(r); } catch (e) { return false; } });
    }, this);
    if (this._order) {
      var k = this._order.k, asc = this._order.asc;
      rows = rows.slice().sort(function (a, b) {
        var x = a[k], y = b[k];
        if (x === y) return 0;
        var lt = x < y, gt = x > y;
        if (typeof x === 'string' || typeof y === 'string') {
          lt = String(x) < String(y); gt = String(x) > String(y);
        }
        return (asc ? (lt ? -1 : gt ? 1 : 0) : (gt ? -1 : lt ? 1 : 0));
      });
    }
    if (this._range) rows = rows.slice(this._range[0], this._range[1] + 1);
    else if (this._limit != null) rows = rows.slice(0, this._limit);
    var out = { data: rows, error: null };
    if (this._single) { out.data = rows[0] || null; if (!rows[0]) out.error = { message: 'no rows', code: 'PGRST116' }; }
    if (this._maybe) out.data = rows[0] || null;
    return out;
  };
  QB.prototype.then = function (resolve, reject) { resolve(this._exec()); };

  /* ---------- 写操作 builder ---------- */
  function WriteQB(t, patch, mode) {
    this.t = t; this.patch = patch; this.mode = mode; this._f = [];
    var self = this;
    this.eq = function (k, v) { self._f.push(function (r) { return String(r[k]) === String(v); }); return self; };
    this.in = function (k, arr) { self._f.push(function (r) { return (arr || []).map(String).indexOf(String(r[k])) !== -1; }); return self; };
    this.match = function (obj) {
      Object.keys(obj || {}).forEach(function (k) { self._f.push(function (r) { return String(r[k]) === String(obj[k]); }); });
      return self;
    };
    this._exec = function () {
      var rows = table(t);
      var matched = rows.filter(function (r) { return self._f.every(function (f) { try { return f(r); } catch (e) { return false; } }); });
      var out;
      if (mode === 'update') {
        matched.forEach(function (r) { Object.keys(self.patch || {}).forEach(function (k) { r[k] = self.patch[k]; }); });
        out = { data: matched.slice(), error: null };
      } else {
        DB[t] = rows.filter(function (r) { return matched.indexOf(r) === -1; });
        out = { data: matched.slice(), error: null };
      }
      persist();
      return out;
    };
    this.select = function () { return Promise.resolve(this._exec()); };
    this.then = function (resolve, reject) { resolve(this._exec()); };
  }

  function InsertRes(t, payload) {
    var rows = Array.isArray(payload) ? payload : [payload];
    var created = rows.map(function (r) {
      var cp = {};
      Object.keys(r || {}).forEach(function (k) { if (r[k] !== undefined) cp[k] = r[k]; });
      cp.id = nextId(t);
      if (!cp.owner_id && ['profiles', 'submissions', 'works', 'workbench_projects', 'coupon_claims', 'lesson_progress', 'practice_attempts', 'project_claims', 'prompt_templates'].indexOf(t) !== -1) {
        cp.owner_id = session ? session.user.id : 'demo-anon';
      }
      if (!cp.created_at) cp.created_at = new Date().toISOString();
      return cp;
    });
    DB[t] = table(t).concat(created);
    persist();
    this.data = created; this.error = null;
    var self = this;
    this.select = function () { return Promise.resolve({ data: self.data, error: null }); };
    this.then = function (resolve, reject) { resolve({ data: self.data, error: null }); };
  }

  var database = {
    from: function (t) {
      return {
        select: function (c, o) { return new QB(t).select(c, o); },
        insert: function (payload) { return new InsertRes(t, payload); },
        update: function (patch) { return new WriteQB(t, patch, 'update'); },
        delete: function () { return new WriteQB(t, null, 'delete'); },
        upsert: function (payload) {
          var rows = Array.isArray(payload) ? payload : [payload];
          rows.forEach(function (r) {
            var found = null;
            if (r.id != null) found = table(t).filter(function (x) { return String(x.id) === String(r.id); })[0];
            if (found) Object.assign(found, r); else DB[t] = table(t).concat([Object.assign({}, r, { id: nextId(t) })]);
          });
          persist();
          var res = { data: rows, error: null };
          res.select = function () { return Promise.resolve(res); };
          res.then = function (resolve) { resolve(res); };
          return res;
        },
        rpc: function (fn, params) { return Promise.resolve(rpc(fn, params)); }
      };
    }
  };

  function rpc(fn, params) {
    if (fn === 'claim_role') {
      var code = params && params.invite_code;
      var role = code === 'FLHC-ADMIN-2026' ? 'admin' : code === 'FLHC-TEACHER-2026' ? 'teacher' : 'student';
      if (session && role !== 'student') {
        var p = table('profiles').filter(function (x) { return x.owner_id === session.user.id; })[0];
        if (p) { p.role = role; persist(); }
      }
      return { data: role, error: null };
    }
    return { data: null, error: { message: '函数不存在（演示模式）' } };
  }

  /* ---------- Auth mock ---------- */
  var auth = {
    getSession: function () { return Promise.resolve({ data: session, error: null }); },
    getUser: function () { return Promise.resolve({ data: session ? { user: session.user } : null, error: null }); },
    signInWithPassword: function (_ref) {
      var email = _ref.email;
      var p = ensureUser(email);
      session = makeSession(p); persistSession();
      return Promise.resolve({ data: session, error: null });
    },
    sendOtp: function (_ref2) {
      var email = _ref2.email;
      return Promise.resolve({ data: { verificationId: 'demo-' + Date.now(), isExistingUser: !!findProfileByEmail(email) }, error: null });
    },
    verifyOtp: function (_ref3) {
      var email = _ref3.email;
      var p = ensureUser(email);
      session = makeSession(p); persistSession();
      return Promise.resolve({ data: { user: session.user }, error: null });
    },
    signOut: function () { session = null; persistSession(); return Promise.resolve({ error: null }); },
    onAuthStateChange: function () { return function () {}; },
    resetPasswordForEmail: function () {
      return Promise.resolve({ data: { updateUser: function () { return Promise.resolve({ error: null }); } }, error: null });
    },
    resetPasswordForOld: function () { return Promise.resolve({ error: null }); },
    refreshSession: function () { return Promise.resolve({ data: session, error: null }); },
    getAccessToken: function () { return Promise.resolve(session ? 'demo-token' : null); }
  };

  /* ---------- LLM mock（预置结果，模拟流式输出） ---------- */
  var MODELS = [
    { id: 'demo-aigc-v1', name: '演示模型 · AIGC 影视链路', disabled: false, temperature: 0.6 },
    { id: 'demo-fast-v1', name: '演示模型 · 快速版', disabled: false, temperature: 0.7 }
  ];
  function parseResult(script) {
    var s = String(script || '');
    var lines = s.split('\n').filter(function (l) { return l.trim(); });
    var scenes = lines.slice(0, 4).map(function (l, i) {
      return { no: i + 1, summary: l.replace(/^第?\d*场?\s*/, '').slice(0, 40) || '场次 ' + (i + 1) + ' 剧情梗概', location: i % 2 === 0 ? '出租屋' : '便利店', time: '夜', emotion: ['疲惫', '温暖', '释然', '期待'][i % 4], characters: ['林然'], props: ['外卖', '台灯', '电脑'].slice(0, (i % 3) + 1), shots: [] };
    });
    if (!scenes.length) scenes = [{ no: 1, summary: '示例场次：主角深夜工作', location: '出租屋', time: '夜', emotion: '疲惫', characters: ['林然'], props: ['电脑'], shots: [] }];
    return { scenes: scenes, characters: [{ name: '林然', desc: '26 岁插画师，黑长发扎低马尾，圆框眼镜，米色针织开衫' }] };
  }
  function storyboardResult(sceneIdx, scene) {
    var sc = scene || { no: 1, summary: '深夜工作', emotion: '疲惫' };
    var shots = [
      { type: '远景', camera: '缓推', desc: '环境交代：夜色中的城市一角', line: '', seconds: 4 },
      { type: '中景', camera: '固定', desc: '主体动作：人物进入场景并停顿', line: '', seconds: 3 },
      { type: '近景', camera: '手持跟拍', desc: '情绪特写：表情与细节', line: '这个画面感很强。', seconds: 3 },
      { type: '特写', camera: '固定', desc: '关键道具或动作落点', line: '', seconds: 2 },
      { type: '全景', camera: '拉远', desc: '收束镜头：场景与人物关系', line: '', seconds: 4 }
    ].map(function (s2) {
      return Object.assign({}, s2, { prompt: s2.type + ' ' + s2.desc + ' ' + (sc.emotion || ''), params: { temperature: 0.7 } });
    });
    return { shots: shots };
  }
  var llm = {
    models: { list: function () { return Promise.resolve(MODELS.slice()); } },
    chat: {
      completions: {
        create: function (opts) {
          var user = '';
          (opts.messages || []).forEach(function (m) { if (m.role === 'user') user += m.content + '\n'; });
          var sys = (opts.messages && opts.messages[0] && opts.messages[0].content) || '';
          var text;
          if (user.indexOf('解析以下剧本') !== -1 || user.indexOf('人设三要素') !== -1) {
            var script = user.split('剧本：')[1] || user.split('剧本：\n')[1] || user;
            text = JSON.stringify(parseResult(script));
          } else if (user.indexOf('分镜') !== -1) {
            var sc = null;
            try { sc = parseResult(user.split('场次：')[1] || user).scenes[0]; } catch (e) {}
            text = JSON.stringify(storyboardResult(0, sc));
          } else {
            text = JSON.stringify(storyboardResult(0, null));
          }
          var chunks = [];
          for (var i = 0; i < text.length; i += 24) chunks.push(text.slice(i, i + 24));
          var idx = 0;
          return {
            _sym: Symbol ? Symbol('demoStream') : 'demoStream',
            next: function () {
              if (idx >= chunks.length) return Promise.resolve({ done: true, value: undefined });
              var c = chunks[idx++];
              return new Promise(function (res) {
                setTimeout(function () {
                  res({ done: false, value: { choices: [{ delta: { content: c } }] } });
                }, 18);
              });
            }
          };
        }
      }
    }
  };

  /* 组装 mock cloud：为使 async iterator 生效，包一层 Symbol.asyncIterator */
  var mockCreate = llm.chat.completions.create;
  llm.chat.completions.create = function (opts) {
    var it = mockCreate(opts);
    it[Symbol.asyncIterator] = function () { return it; };
    return it;
  };

  window.cloud = { auth: auth, database: database, llm: llm };
  window.__DEMO_CONFIG = { endpoint: '（演示模式 · 本地数据）', publishableKey: 'demo' };

  /* ---------- 页面注入：快速体验入口 ---------- */
  var css = document.createElement('style');
  css.textContent = [
    '.demo-quick{border:1px dashed #C4B5FD;border-radius:12px;padding:14px 16px;margin-bottom:18px;background:#FAF7FF;}',
    '.demo-quick .t{font-size:13px;font-weight:800;color:#6D28D9;margin-bottom:4px;}',
    '.demo-quick .d{font-size:12px;color:#8E8CA8;margin-bottom:10px;}',
    '.demo-quick .btns{display:flex;gap:8px;flex-wrap:wrap;}'
  ].join('');
  document.head.appendChild(css);

  function inject() {
    if (location.pathname.indexOf('auth') !== -1) {
      var card = document.querySelector('.auth-card');
      if (card) {
        var box = document.createElement('div');
        box.className = 'demo-quick';
        box.innerHTML = '<div class="t">⚡ 快速体验（免注册）</div>' +
          '<div class="d">任选一个身份一键进入；也可使用任意邮箱 + 任意 6 位验证码自行注册。</div>' +
          '<div class="btns">' +
          '<button class="btn sm" data-r="student">学员体验</button>' +
          '<button class="btn sm soft" data-r="teacher">教师体验</button>' +
          '<button class="btn sm ghost" data-r="admin">管理员体验</button>' +
          '</div>';
        card.insertAdjacentElement('beforebegin', box);
        box.addEventListener('click', function (e) {
          var b = e.target.closest('button'); if (!b) return;
          var r = b.getAttribute('data-r');
          var p = (DB.profiles || []).filter(function (x) { return x.role === r; })[0];
          if (!p) return;
          session = makeSession(p); persistSession();
          toast && toast('已进入：' + p.nickname, 'ok');
          setTimeout(function () { location.href = window.homeOfRole ? window.homeOfRole(r) : 'learn.html'; }, 400);
        });
      }
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
  else inject();
})();
