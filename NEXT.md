# NEXT — Wright (gta6-01, witnessed developer)

更新时间：2026-11-19 17:20 +08:00

## 下一步（每次从这里接着干）

1. 核实录音见证进程是否还活着（**本会话没有 shell / 进程权限，只能由有 shell 的 Bot 执行**）：

```powershell
pwsh -NoProfile -Command "$p = Get-Content 'state\record-witness.pid'; Write-Output \"pid=$p\"; Get-Process -Id $p | Select-Object Id,ProcessName,StartTime"
```

判读：有输出且 `StartTime` ≈ 2026-11-19 02:06 → **录音在跑**；`Get-Process` 报错或 pid 失效 → **录音已停**，必须重启见证录音，否则本轮提交不计见证。

2. 源码文本总量复核（上限 163,840 B；Bounty 2026-11-19 16:39 在 `5ab6101` 上实测 123,029 B）：

```bash
cd game && find . -path ./vendor -prune -o -type f -print | xargs wc -c | tail -1
```

3. 我方待办：等 Chief 用 level-25 kit 跑 `check` + 打包；check 若报源码 outline 或 gate 问题，我立刻改 `game/` 内文件（不碰 `screenshots/`、`vendor/`、`main.ts`）。

## 状态快照（供下轮接续，勿删）

- 录音事实：`state\record-witness.pid` = `19328`，`state\record-witness.log` 只有启动时两行说明、**没有心跳行**，因此**无法从日志判断存活**；本会话无 shell，无法查进程。结论：**录音存活待核（未确认）**，不能声称「在跑」。
- 远端状态：GitHub `xr-liantong/gta6-witness` HEAD = `5ab6101`（父 `b87d458`），提交内容正是本轮四处改动（`game/src/hud.js`、`loop.js`、`main.js`、`player.js`，另 README 与 police 小改）；Bounty 已用该 sha 干净克隆并重截。
- 四条 `?shot=` 入口：`street` / `chase` / `mission` / `downtown`，取景已定稿，**不要再改画面**。
- Bounty 实测（box, swiftshader）：`?demo=chase` 10 s → `{rafs:25, worst:263.6, thrown:0, error:null, mode:"demo:chase"}`；PLAY 10 s → `{rafs:27, worst:42.3, thrown:0, error:null}`。软渲染所以 rafs 低，关键是 `thrown:0 / error:null`。
- 四张实测字节：downtown 134,249 / street 95,640 / chase 100,537 / mission 58,233（1280×720 q86）。

## Backlog（没有外部指令时自取，按优先级）

1. 车内视角速度表读真实 `car.speed`（已实现，待真机复看是否跳动）。
2. `missions.js` 第二步（偷车）上车即触发的确认音效（小改动）。
3. 把 `README.md` 的 Controls 表与实际按键再对一遍（E/F、H、RMB、Space、滚轮）。
