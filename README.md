# 城市跑酷 City Runner

基于 Three.js 的 3D 无尽跑酷游戏。在程序生成的城市街道上奔跑、跳跃、滑铲，躲避障碍物，挑战最高分。

## 快速开始

```bash
# 启动服务器（端口 7080，局域网可访问）
./start.sh

# 停止服务器
./stop.sh
```

启动后访问 `http://localhost:7080`，局域网内其他设备通过本机 IP 访问。

## 操作方式

| 操作 | 键盘 | 手机 |
|------|------|------|
| 切换车道 | ← → / A D | 左右滑动 |
| 跳跃 | ↑ / W / 空格 | 上滑 |
| 滑铲 | ↓ / S | 下滑 |

## 版本历史

### v0.6 — 音效系统 + UI 精致化
- **Web Audio API 程序化音效**：所有声音由振荡器/噪声实时合成，无需音频文件
  - 背景音乐：五声音阶琶音 + bass + hi-hat，节拍随游戏速度变化
  - 动作音效：跳跃、落地、滑铲、变道、碰撞爆炸
  - 事件音效：里程碑 chime、加速提示、UI 点击
  - 脚步声随跑步速度同步
  - 静音控制 + 状态持久化
  - 移动端 AudioContext 自动解锁
- **UI 精致化**
  - 界面过渡：所有画面切换支持平滑淡入淡出动画
  - 开局倒计时：3-2-1-GO! 脉冲动画
  - HUD 重设计：分数居中大字显示 + 滚动动画
  - 里程碑弹窗：NICE! / COOL! / GREAT! / AMAZING! / INCREDIBLE!
  - 结算页扩展：距离、时间、最高速度统计 + NEW RECORD 动画
  - 菜单标题浮动动画 + Loading 发光脉冲
  - 移动端响应式适配

### v0.3 — Kenney 城市资源集成
- 资源管理器 (AssetManager)：预加载 Kenney CC0 城市模型
- 道路系统：Kenney 道路瓦片铺设，支持斑马线变体
- 建筑系统：随机选取 suburban/commercial 模型，缩放+旋转变化
- 障碍物：Kenney 模型替代彩色方块，碰撞盒与视觉解耦
- 街道装饰：路灯、树木、长椅随机放置
- Loading UI：进度条加载画面
- 全面降级：无资源文件时回退到 v0.2 程序化几何体

### v0.2 — 3D 角色模型与动画系统
- 集成 Quaternius 低多边形角色 (CC0)
- 9 组内置动画 + 平滑过渡
- 动画速度与游戏速度同步

### v0.1 — 灰盒原型
- Three.js 3D 场景 + 三车道跑酷核心
- 程序化城市生成 + 分块池化
- 碰撞检测 + 渐进难度 + 本地最高分

## 技术栈

- **引擎**: Three.js 0.163.0 (ES Module, CDN)
- **资源**: Kenney CC0 城市套件 / Quaternius 角色
- **构建**: 无需构建，纯 ES6 模块
- **服务**: Python http.server

## 项目结构

```
city-runner/
├── index.html              入口页面
├── main.js                 模块入口
├── style.css               UI 样式
├── start.sh / stop.sh      服务器启停脚本
├── assets/
│   ├── characters/         角色模型
│   ├── city/               Kenney 城市资源
│   │   ├── roads/          道路瓦片 GLB
│   │   ├── buildings/      建筑模型 GLB
│   │   └── props/          街道装饰 GLB
│   └── obstacles/          障碍物模型 GLB
└── src/
    ├── core/               Game, InputManager, AssetManager, SoundManager, UIManager
    ├── gameplay/           ScoreManager, DifficultyManager
    ├── player/             PlayerController, CharacterModel, AnimationController
    ├── rendering/          SceneSetup, Camera, Lighting, Sky
    └── world/              ChunkManager, CityChunk, LaneConfig
```

## 许可证

代码：MIT | 资源：CC0 (Kenney, Quaternius)
