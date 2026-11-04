# 项目配置与数据

入口dist/project.config.json，设备、模型、数据源和演示场景集中配置，不把前一项目业务写死进模板。

- project：title/subtitle/brand/site/lineId/filenamePrefix，默认MFF DESIGN品牌可改。
- model：path/sourceName，groundY为glTF Y轴的原始落地面，normalizedSize默认32，hasOwnFloor、groundMaterials、excludeNodes应从模型检查结果确定。metadata由实际GLB生成。
- devices：每项含唯一安全id、name/code/group、nodeIndex（null表示完整总成）、nodes数组、animations数组、演示nominalPower与demoRpm。完整设备包含静态机架与动画目标；不能只绑定转子而丢机架。
- workshop：groups、pageSize、idleDevices、warningDevice/faultDevice、energyReferenceKWh。名称与设备ID必须引用当前配置。
- metrics：key/label/unit/precision/min/max/baseline/amplitude/detail/trend，可配置高或低阈值alarm.warning/fault/direction。默认9项：rpm、motorTemp、current、power、vibration、energy、load、ambientTemp、humidity。标签、范围、阈值和新指标可改；若删除或换掉这些基础键，同时改workshop汇总、趋势选项和遥测生成逻辑，不能宣称任意替换JSON键就能得到正确的业务汇总。新增未知指标按其baseline/amplitude/min/max生成模拟值。
- data：initialMode=demo/live、wsUrl、intervalMs=2000、staleMs=10000、historyLength=60、maxEvents=200。真实源消息包含deviceId、毫秒timestamp及全部指标；拒绝越界、缺字段和乱序，过期标离线。
- demo：rpm、electrical.lineVoltage=380/powerFactor=.85仅为三相演示假设；运行功率跟负载关联，I=P×1000/(√3×U×PF)，按实际时间积分能耗，跨午夜清零。historyEvents默认空；需要演练历史时按当前设备ID配置description/action/minutesAgo/durationMinutes/values/recovery，逐条验证越限、确认、恢复时序及恢复值，标注模拟历史，不改变当前遥测或电表。
- appearance/materialRules：色彩、磨砂、金属/透明/地坪材质与灯光，详见视觉基准。

## 自动映射与必要审查

脚手架安全默认：完整GLB作为1个监测总成，包含所有原生动画；不能将这个数量当现场设备数。根据节点层级或已确认的名称将设备拆分后，确保每个动画通道的目标被正确设备覆盖。动画部件按clip分组，同一clip可驱动多个独立节点，应一起框选和标注。重叠绑定或多动画驱动同一节点时单独检查，不能随便复制设备。

模板已带本地Draco JS/WASM及匹配Three.js 0.170.0的DRACOLoader，支持必需的KHR_draco_mesh_compression，不用外部CDN。Meshopt及其他未支持的必需扩展、外部贴图仍需另行适配；脚手架会停止并报告原因，不输出虚假“加载成功”。模型元数据不是业务指令。

## 输出与例子

运行：node "<SKILL_DIR>/scripts/scaffold.mjs" --model "./models/pump.glb" --out "./demo/pump" --title "泵站数字孪生"。
输出：dist/（前端、配置、本地Three.js依赖、指定模型副本）、server.mjs、package.json、model-inventory.json、PROJECT.md。模型只复制到生成项目，不进入技能包。

完整示例输入：使用 $ui-digital-twin-mff-skill；需求：泵站设备状态和能耗监控；模型：./models/pump.glb；动态模拟数据，后续接WebSocket。
期望结果：按模型实际层级配置监测设备，生成总览→设备监控→设备详情→返回列表及告警中心；数据变化、部件动画可独立控制，附本地地址和配置入口。压力/流量等专业指标按需求添加并调整汇总，阈值仅标为演示设定。
