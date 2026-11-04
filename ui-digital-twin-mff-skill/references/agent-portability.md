# 跨Agent安装与执行

技能使用[Agent Skills开放格式](https://agentskills.io/specification)：SKILL.md＋references/scripts/assets。agents/openai.yaml是可选界面元数据；项目生成不调用Codex API、OpenAI API、专有MCP或任何特定供应商CLI。宿主安装和发现规则不同，不能把“文件兼容”误写成“所有agent原生会话均已实测”。

## 安装位置

将**完整技能文件夹**复制到下面某一个位置。不要只复制SKILL.md，不要在同一宿主的多个扫描目录重复安装同名不同版本。表中路径后面均需再接ui-digital-twin-mff-skill/。

| 宿主 | 项目级技能父目录 | 用户级技能父目录 | 依据 |
|---|---|---|---|
| Codex | .agents/skills/ | ~/.agents/skills/ | [官方说明](https://learn.chatgpt.com/docs/build-skills)；当前开发机另有已识别的~/.codex/skills/安装 |
| Claude Code | .claude/skills/ | ~/.claude/skills/ | [官方说明](https://code.claude.com/docs/en/skills) |
| Cursor | .cursor/skills/（也支持.agents/skills/） | ~/.cursor/skills/ | [官方说明](https://cursor.com/help/customization/skills) |
| GitHub Copilot / VS Code | .github/skills/ | ~/.copilot/skills/ | [官方说明](https://code.visualstudio.com/docs/agent-customization/agent-skills) |
| OpenCode | .opencode/skills/（也支持.agents/skills/） | ~/.config/opencode/skills/ | [官方说明](https://opencode.ai/docs/skills/) |
| Gemini CLI | .gemini/skills/（也支持.agents/skills/） | ~/.gemini/skills/ | [官方说明](https://geminicli.com/docs/cli/skills/) |
| 其他agent | 任意能完整读取的本地目录 | 按宿主文档 | 使用下面的显式读文件方式，不要求原生发现机制 |

目录与产品功能可能变化；未发现时查看宿主技能列表/当前官方文档，或直接提供SKILL.md路径。不要为发现技能而初始化Git。远程/云端agent必须能访问上传或挂载后的模型与整个技能目录；用户本机路径不等于远程路径。本技能不自动上传模型或同步个人技能。

## 任意支持本地工具的agent通用入口

复制此请求并替换路径：

> 请先读取 /absolute/path/ui-digital-twin-mff-skill/SKILL.md，并按其相对路径读取所需references。技能根目录为 /absolute/path/ui-digital-twin-mff-skill。需求：设备环境、能耗与状态监控；模型：/absolute/path/models/equipment.glb；输出：/absolute/path/demo；数据：动态模拟。使用本地Node工具完成搭建和验证。模型由我提供，不生成模型；演示数据不指导生产；不初始化Git、不上传模型。

不支持skills发现但能读文件和执行终端的agent，也能按此工作流搭建。只有纯对话、没有文件/终端权限的agent无法直接生成和启动本地项目；需要用户在本机运行命令。浏览器工具不是脚手架依赖，但没有浏览器时不能声称视觉验收通过。

## 不依赖agent的命令行入口

下列命令在PowerShell、bash/zsh中写法相同；替换为真实绝对路径即可。脚本从自身位置找模板，不依赖终端所在目录。

~~~text
node "/absolute/path/ui-digital-twin-mff-skill/scripts/inspect-model.mjs" --model "/absolute/path/equipment.glb"
node "/absolute/path/ui-digital-twin-mff-skill/scripts/scaffold.mjs" --model "/absolute/path/equipment.glb" --out "/absolute/path/demo" --title "设备数字孪生"
node "/absolute/path/ui-digital-twin-mff-skill/scripts/check-project.mjs" "/absolute/path/demo"
node "/absolute/path/demo/server.mjs"
~~~

需要Node.js 22+（当前实测24.22.1）、可写工作区、自备GLB；运行前端需要WebGL浏览器。没有npm/Python/Codex也可执行正常生成和启动。Python＋PyYAML仅用于维护者运行官方技能验证。默认server只监听127.0.0.1:4173；云端容器需宿主自己的端口转发或另行部署，不能把远程localhost当用户本机可访问地址。

新项目默认是待核对的完整监测总成，不替代设备语义绑定。GLB内原生动画才可控制；Draco本地解码已内置，其他未支持的必需扩展及外部资源会报错，需要显式适配。

## 兼容性验证口径

检查三件事：技能格式可解析；移动到宿主目录后在无Codex环境变量的独立工作目录可运行inspect/scaffold/check；生成项目能启动并从HTTP读取模型/配置/解码器。支持上述标准目录不等于已运行所有厂商agent的真实会话。本地未安装的CLI不标为“原生agent端到端通过”。报告和当前验证范围见项目根README及verification结果。
