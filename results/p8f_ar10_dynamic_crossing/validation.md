# P8F — OpenWater 6DOF AR10 closed-loop validation

**P8F_TASK_COMPLETE_WITH_RUNTIME_DEGRADATION**

任务安全完成，但严格 primary PASS 未成立。终止握手有1条控制消息因 EPISODE_GENERATION_MISMATCH 被拒绝；按零无效控制消息的严格解释保守归入 runtime degradation。没有在失败后修改生产代码、调参或重跑。

H1 按第37节门槛 PASS；其终止握手也出现同类 generation 拒绝，已保留原始 commands.json。它不改变已冻结的 H1 航行安全和反事实冲突证据。H2 单列这条消息，不能用前端 invalid_messages=0 掩盖 limiter 的 accepted=false。


Full Planner report: research/lifted_stp/results/p8f_openwater_ar10/validation.md
