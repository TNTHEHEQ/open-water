# P8G — 3D Historical Replay Validation

状态：**P8G_VISUAL_REPLAY_PASS**。本阶段仅 PAPER_VISUALIZATION，无新物理验证。

## 逐项验收

| # | 问题 | 结果 |
|---|---|---|
| 1 | replay.html 独立运行 | YES，静态 localhost 服务即可，无 Planner 连接。 |
| 2 | 唯一冻结数据源 | YES，P8F2 run_20261009T065318Z_h2；1914 ticks + 初始快照。 |
| 3 | 重新运行物理仿真 | NO。Boat 只做 update(0) transform 同步。负向测试仅触发阻断器，未进入物理方法。 |
| 4 | 调用轨迹求解 | NO。未运行 IPOPT 或 p8f-run。 |
| 5 | 修改 controller | NO。生产 controller、Boat physics、限速器均未修改。 |
| 6 | 原 Zodiac 船模 | YES，原 GLB 哈希校验；原加载路径、5.5 m、reversed、visualDraft、材质。 |
| 7 | ENU/Three quaternion | YES，原 adapter；所有样本 round-trip、三轴方向及艏向自动检查。 |
| 8 | heave/roll/pitch 来源 | 全部来自历史 pose；插值仅作显示。 |
| 9 | 目标类型 | 仍为 SIMULATOR_OWNED_KINEMATIC_CV_DISC，没有第二艘 6DOF 船。 |
| 10 | 半径/buffer/岸界 | 2.5 m / 0.5 m / [-10,+10] m，来源合同保持不变。 |
| 11 | 真实激活计划 | 7 个；telemetry 身份优先。 |
| 12 | 真实切换 | 6 次；原生事件到首次 telemetry 新身份约 0.04 s，分别保留。 |
| 13 | ACTIVE suffix | YES；t_abs - 原 plan_start_sim_time，无 retime/stitch/blend。 |
| 14 | 实际轨迹未来泄漏 | 默认 NO；向后 seek 回退。可选全历史图层明确标记 includes future。 |
| 15 | 时间拖动确定性 | YES；重复随机/反向 seek 数值一致且 source 不变。 |
| 16 | 四种相机 | Chase、Top、Free Orbit、Encounter Overview；C、Reset View。 |
| 17 | 播放控制 | 五档倍速、暂停、逐帧、时间条、事件/会遇跳转均通过 Chrome 检查。 |
| 18 | CPA/bank 官方数值 | 5.1134505020859 m / 1.443611819878718 m，原审计不变。 |
| 19 | 海面标注 | YES；Recorded 6DOF pose / Illustrative water surface。HDR/normal map 只参与显示。 |
| 20 | 自动一致性测试 | 11/11，0 skipped；A–T 覆盖，双导出一致，缺失/篡改 fail closed；JS/HTML lint 通过。 |
| 21 | 真实浏览器验收 | YES，已安装 Windows Google Chrome 154.0.8037.97，经用户允许的 Playwright；真实 WebGL 截图检查。扩展连接失败未使用内置浏览器。 |
| 22 | Windows localhost | YES，HTTP 200；可见 Chrome 窗口已打开，服务保留。 |
| 23 | 论文 PNG | YES，六张经 Save PNG 下载的 3200×1670 PNG，加四种相机及界面截图。 |
| 24 | 历史 P8F/P8F1/P8F2 证据修改 | NO；8240 历史文件哈希一致，Planner 工作区不变。 |
| 25 | 最终状态 | P8G_VISUAL_REPLAY_PASS；仅 PAPER_VISUALIZATION，P8F2 数值 PASS 不变。 |

## 证据与限制

原始数据哈希、派生文件哈希和 GLB 身份见 dataset_manifest.json；A–T 见 replay_parity.json；Chrome 控件/下载/资源检查见 browser_acceptance.json。400 次 seek 后 GPU 资源计数保持不变。六张截图时间规则来自 metrics.json，而非美观选点。

默认 Chase + 2× HD；支持 3× Paper。全景覆盖整段航道，船会相应变小，可用 Free Orbit 放大。模型保持原始细节，未用新资产替换。Paper Mode 降低水面反光和纹理干扰。海面没有历史波相证据，不代表重建的实测海况。

未运行历史物理测试或新增闭环实验。原生 TASK_COMPLETE 57.46 s，接收端完成/最终快照 57.48 s；worker 8 终止后丢弃只作诊断，未激活。

## 使用

Windows Chrome: http://localhost:8089/replay.html 。当前旧页面 Ctrl+F5 获取新版本。详见 ../../docs/P8G_3D_REPLAY.md。

## 提交

A: f8f1086126e640f605b0ed0c1c472b93ddb3cafc，B: e6b886b54eae3b3664ba9077bd163f5fa409efde，均已推送并核验 origin/test。C: 080c938c048a6288226fe139786818b113175f9f；交付哈希与下载元数据清理另随收尾提交推送；两个 main 保持原 SHA。

P8G 完成后停止继续扩展可视化功能；后续阶段为 PAPER_FREEZE 与论文写作，不在本次启动。
