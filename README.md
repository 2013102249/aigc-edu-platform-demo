# 弗露化成 · AIGC 职业技能教培平台（可点击 Demo）

AI 产品经理作品集配套 Demo：覆盖营销落地页、学员学习端、AI 影视创作工作台（剧本解析 → 分镜 → 一致性 → 合成）、教师批改端、机构管理端五端闭环。

- **在线 Demo（本仓库 Pages）**：https://2013102249.github.io/aigc-edu-platform-demo/
- **完整云端版**：https://aigc-edu-platform.app.workbuddy.host/

> 演示说明：GitHub Pages 版运行在「演示模式」——数据为本地快照（localStorage），可完整交互三端角色与工作台流程，AI 生成结果为预置样例；完整云端版具备真实注册登录与 LLM 调用。

## 演示账号（GitHub Pages 版）
- 学员 / 教师 / 管理员：登录页「演示快速体验」一键进入
- 或任意邮箱 + 任意 6 位验证码

## 技术
纯静态 HTML/CSS/JS（无构建），哈希路由单页；完整版后端为 Serverless（数据库 + 认证 + 免密钥 LLM），GitHub Pages 下由演示适配层接管（assets/js/demo-mode.js）。

## 分支结构
- main：生产代码，推送即自动部署到 GitHub Pages（branch source）
