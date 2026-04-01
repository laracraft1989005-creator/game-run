/**
 * MissionDefinitions — 任务数据定义
 * 单局任务池 + 永久成就列表
 */

// ─── 单局任务池（每局随机抽3个）───

export const SESSION_MISSIONS = [
    // 金币类
    { id: 's_coins_30',  category: 'coins',    stat: 'sessionCoins',    value: 30,   reward: 50,   description: '收集30个金币' },
    { id: 's_coins_60',  category: 'coins',    stat: 'sessionCoins',    value: 60,   reward: 100,  description: '收集60个金币' },
    { id: 's_coins_100', category: 'coins',    stat: 'sessionCoins',    value: 100,  reward: 200,  description: '收集100个金币' },

    // 距离类
    { id: 's_dist_300',  category: 'distance', stat: 'sessionDistance', value: 300,  reward: 80,   description: '跑过300米' },
    { id: 's_dist_600',  category: 'distance', stat: 'sessionDistance', value: 600,  reward: 150,  description: '跑过600米' },
    { id: 's_dist_1000', category: 'distance', stat: 'sessionDistance', value: 1000, reward: 300,  description: '跑过1000米' },

    // 跳跃类
    { id: 's_jumps_10',  category: 'jumps',    stat: 'sessionJumps',    value: 10,   reward: 60,   description: '跳跃10次' },
    { id: 's_jumps_20',  category: 'jumps',    stat: 'sessionJumps',    value: 20,   reward: 120,  description: '跳跃20次' },

    // 滑铲类
    { id: 's_slides_8',  category: 'slides',   stat: 'sessionSlides',   value: 8,    reward: 60,   description: '滑铲8次' },
    { id: 's_slides_15', category: 'slides',   stat: 'sessionSlides',   value: 15,   reward: 120,  description: '滑铲15次' },

    // 分数类
    { id: 's_score_1000', category: 'score',   stat: 'sessionScore',    value: 1000, reward: 100,  description: '得分达到1000' },
    { id: 's_score_3000', category: 'score',   stat: 'sessionScore',    value: 3000, reward: 250,  description: '得分达到3000' },

    // 道具类
    { id: 's_powerups_3', category: 'powerup', stat: 'sessionPowerUps', value: 3,    reward: 100,  description: '拾取3个道具' },

    // 骑乘类
    { id: 's_ride_1',    category: 'ride',     stat: 'sessionRides',    value: 1,    reward: 80,   description: '触发一次公交骑乘' },

    // 变道类
    { id: 's_lanes_20',  category: 'lanes',    stat: 'sessionLaneSwitches', value: 20, reward: 70, description: '切换车道20次' },

    // 速度类
    { id: 's_speed_28',  category: 'speed',    stat: 'sessionMaxSpeed', value: 28,   reward: 120,  description: '速度达到28' },
];

// ─── 永久成就（按难度排序）───

export const ACHIEVEMENT_MISSIONS = [
    // 距离里程碑
    { id: 'a_dist_2000',   stat: 'totalDistance', value: 2000,  reward: 200,  description: '累计跑过2000米' },
    { id: 'a_dist_5000',   stat: 'totalDistance', value: 5000,  reward: 500,  description: '累计跑过5000米' },
    { id: 'a_dist_20000',  stat: 'totalDistance', value: 20000, reward: 1500, description: '累计跑过20000米' },

    // 金币里程碑
    { id: 'a_coins_1000',  stat: 'totalCoins',   value: 1000,  reward: 200,  description: '累计收集1000金币' },
    { id: 'a_coins_5000',  stat: 'totalCoins',   value: 5000,  reward: 800,  description: '累计收集5000金币' },

    // 游戏局数
    { id: 'a_games_10',    stat: 'totalGames',   value: 10,    reward: 200,  description: '游玩10局' },
    { id: 'a_games_50',    stat: 'totalGames',   value: 50,    reward: 500,  description: '游玩50局' },

    // 动作累计
    { id: 'a_jumps_200',   stat: 'totalJumps',   value: 200,   reward: 300,  description: '累计跳跃200次' },
    { id: 'a_slides_100',  stat: 'totalSlides',  value: 100,   reward: 300,  description: '累计滑铲100次' },

    // 骑乘累计
    { id: 'a_rides_10',    stat: 'totalRides',   value: 10,    reward: 300,  description: '累计骑乘10次' },

    // 解锁类（动态检查）
    { id: 'a_skins_all',   stat: 'totalSkinsUnlocked', value: 6, reward: 2000, description: '解锁全部角色' },
];
