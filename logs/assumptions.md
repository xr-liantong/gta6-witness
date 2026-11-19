# Assumptions — Wright (gta6-01)

无人确认时我自己拍的决定，写在这里备查。

## 2026-11-19 17:12 · 录音见证进程的存活判断

- 事实：`state\record-witness.pid` = `19328`；`state\record-witness.log` 只有启动时的两行说明，没有心跳或逐条写入。
- 我无法验证：本会话没有 shell、没有进程查询工具，`read`/`glob` 只能看文件内容，看不到进程表。
- 因此我假定：**录音可能在跑，也可能已停，二者都未被证实**。任何「录音在跑」的说法都不许出现在提交说明里，直到有人用 `Get-Process -Id 19328` 给出结果。
- 若 pid 失效：重启用例在 `NEXT.md` 第一行，或由 Chief 重开见证录音；重启会改变 recording id，需要重新确认提交仍按录音时间窗计。

## 2026-11-19 16:30 · `?demo` 定格只对自动化生效

- 决定：`navigator.webdriver` 为真或 URL 带 `?freeze=1` 时，demo 跑 4 秒后定格；人点开则持续可玩。
- 理由：定格原本是为了让截图工具不卡在永动的 rAF 上，但真人点开看到画面停住会误判成崩溃（Chief 就是这么报的）。自动化标记两者都能满足。

## 2026-11-19 16:20 · 修 `car.drive` 而不是给 car 加 drive 方法

- 决定：`player.driveStep` 改为 `fleet.drive(car, dt, controls)`，fleet 由 `createPlayer(world, scene, fleet)` 注入。
- 理由：车辆物理只有一处实现（`vehicles.js`），给每辆车挂方法会复制状态、并让「谁拥有物理」这件事变模糊；职责表也因此保持「vehicles 拥有物理」。
