# UI_Digital_Twin_MFF_Skill

根据项目需求与用户自备的 GLB，辅助编程 agent 搭建可配置的 Three.js 数字孪生监控 Demo。此目录已整合技能说明、三个必要工具、完整前端模板、本地 Three.js / Draco 依赖及 MIT LICENSE，可独立复制使用。

**必须自备 GLB 模型。本 skill 没有自动生成模型的功能，也不会给静态模型自动制作机械动画。**

**skill 辅助生成的数据为演示参考数据，不作为真实数据指导项目生产工作。**

## 项目解决什么问题

复用全屏三维模型、磨砂监控 UI、字号层级、金属光影和页面跳转流程，减少数字孪生演示项目重复搭建前端的工作。

- 设计师：提供有权使用的 GLB，核对比例、方向、地面零点与材质；整理设备和部件节点。需要独立播放的动画必须提前在模型中制作，并提供业务指标及视觉需求。
- 开发：检查模型结构，确认设备与动画绑定，配置指标、范围、阈值和模拟工况；验证数据联动及两种目标分辨率。接入真实现场时需另行提供网关、接口、数据库和适配代码。

输出为可继续开发的演示前端，不是已经接入生产设备的完整工业平台。

## 主要功能

- 四页闭环：运行总览、设备监控、设备详情、告警中心；设备卡片进入单机详情，返回保留列表状态。
- 全屏模型，浅灰 `#edf0f2` 背景、蓝色交互、半透明磨砂渐隐侧栏；最小字号 11px，优先适配 1920×1080 和 2560×1440。
- 设备隔离、部件近看与原生动画部件标注；已有动画可分别播放、暂停、复位、调速和调整进度。
- 金属、喷漆、玻璃、橡胶分别处理，环境反射和接地阴影可配置；预警与故障统一为红色材质及紧凑红光，无描边。
- 动态模拟温湿度、转速、温度、电流、功率、振动、用电及负载；统一状态驱动计数、曲线、卡片、详情、告警和会话 CSV 导出。
- 告警筛选、触发快照、确认及恢复记录；瀑布流在宽度不超过 1920px 时为两列，更宽时为四列。
- 可切换 WebSocket 遥测接收模式；断线显示离线，不自动退回模拟。

默认脚手架将整个 GLB 作为一个待审查的“监测总成”，不会自动准确识别现场全部设备。需根据模型层级拆分设备，不能把动画数量当作设备数量。默认指标的专业含义、额定参数与阈值都需按实际项目核对。

历史数据和事件仅保存在当前页面会话中；没有内置后端持久化。动画操作不控制真实设备。已内置 Draco 解码；Meshopt、其他未支持的必需扩展和外部贴图需另行适配。

## 目录内容

```text
skill_UI20261104/
├── README.md
├── LICENSE
└── ui-digital-twin-mff-skill/       # 安装时复制此完整目录
    ├── SKILL.md
    ├── LICENSE
    ├── agents/openai.yaml          # 可选 OpenAI 界面元数据
    ├── scripts/                   # 检查模型、生成项目、检查项目
    ├── references/                # 数据、视觉、跨 agent 使用规范
    └── assets/frontend-template/  # 前端与本地运行依赖
```

本分发目录不包含客户 GLB、设备截图、开发测试副本、历史包或校验缓存。模板中的 `dist/` 是必要运行文件，不能作为普通构建垃圾删除。模板本身未绑定模型，需要先生成项目。

## 安装方法

准备 Node.js 22+、支持 WebGL 的浏览器，以及能读写本地文件和运行终端的编程 agent。标准生成和启动不需要 `npm install`。Python / PyYAML 仅用于开发者运行官方技能结构校验。

将 `ui-digital-twin-mff-skill` 整个目录复制到宿主的技能目录，不要只复制 `SKILL.md`：

| 宿主 | 项目级技能父目录 | 用户级技能父目录 |
|---|---|---|
| Codex | `.agents/skills/` | `~/.agents/skills/` |
| Claude Code | `.claude/skills/` | `~/.claude/skills/` |
| Cursor | `.cursor/skills/` | `~/.cursor/skills/` |
| GitHub Copilot / VS Code | `.github/skills/` | `~/.copilot/skills/` |
| OpenCode | `.opencode/skills/` | `~/.config/opencode/skills/` |
| Gemini CLI | `.gemini/skills/` | `~/.gemini/skills/` |

安装后按宿主要求重新加载技能。技能不依赖 Codex API 或特定工具供应商；`agents/openai.yaml` 可由其他宿主忽略。各产品版本的自动发现行为需在对应宿主确认，不能将目录兼容视为所有 agent 会话均已实测。来源与注意事项见[跨 agent 说明](ui-digital-twin-mff-skill/references/agent-portability.md)。

没有技能自动发现功能时，让 agent 读取本目录内的 `ui-digital-twin-mff-skill/SKILL.md`，并明确技能目录、模型位置和输出目录即可。

## 使用方法

在宿主中调用 `$ui-digital-twin-mff-skill`，同时提供项目需求、明确的模型文件及输出位置。模型和技能必须能被 agent 所在环境实际访问；远程 agent 的本地路径与本机路径不同。

也可以从本分发目录运行现有工具，例如在 PowerShell 中：

```powershell
$skillDir = (Resolve-Path './ui-digital-twin-mff-skill').Path
node "$skillDir/scripts/inspect-model.mjs" --model './models/equipment.glb'
node "$skillDir/scripts/scaffold.mjs" --model './models/equipment.glb' --out './demo' --title '设备数字孪生'
node "$skillDir/scripts/check-project.mjs" './demo'
Set-Location './demo'
node server.mjs
```

`./models/equipment.glb` 是需要自行准备的示例输入，包内没有此文件。新项目输出目录应为空；已有项目应直接修改。默认预览地址为 `http://127.0.0.1:4173/`，更改端口可在启动前设置 `PORT` 环境变量。默认仅提供本机预览，不自动发布公网、初始化 Git 或上传 GitHub。

## 输入输出示例

输入：

```text
使用 $ui-digital-twin-mff-skill。
项目需求：设备车间数字孪生，监控温度、湿度、能耗和设备运行状态。
模型：./models/equipment.glb（我自行提供，路径相对项目工作区）。
数据：动态模拟。
输出：./demo。
```

输出：

```text
demo/
├── dist/                  # 页面、配置、本地依赖和用户模型副本
│   ├── project.config.json
│   └── assets/model.glb
├── server.mjs
├── package.json
├── model-inventory.json
└── PROJECT.md
```

agent 根据实际模型拆分设备并调整配置，验证模型加载、数据范围、动画与页面流程，交付启动命令和预览地址。无原生动画时显示空态；不编造机械运动。配置指标和业务汇总可能需要共同修改，不能承诺只改任意 JSON 键就能自动完成业务适配。

本项目许可证见 [LICENSE](LICENSE)。随附第三方组件保留其已有许可证和版权声明。
