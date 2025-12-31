// skills.js —— 技能数据库
window.SKILLS_DB = [
  // ===== 增益（buff）=====
  {
    id: "buff_001",
    name: "战意",
    type: "buff",
    icon: "💠",
    releaseTurn: 1,
    display: {
      kindText: "祝福",
      freq: 1,
      effectParts: [
        { t: "text", v: "进入战斗时提升" },
        { t: "pct", v: 20 },
        { t: "text", v: "的" },
        { t: "elem", elem: "physical", label: "物理强度" },
        { t: "text", v: "（示例）。" }
      ]
    },
    backend: {}
  },
  {
    id: "buff_002",
    name: "坚守",
    type: "buff",
    icon: "🛡️",
    releaseTurn: 2,
    display: {
      kindText: "祝福",
      freq: 2,
      effectParts: [
        { t: "text", v: "获得" },
        { t: "pct", v: 30 },
        { t: "text", v: "的" },
        { t: "elem", elem: "physical", label: "护甲" },
        { t: "text", v: "（示例）。" }
      ]
    },
    backend: {}
  },

  // ===== 主动（active）=====
  {
    id: "act_002",
    name: "斩击",
    type: "active",
    icon: "./技能图标/斩击.png",
    releaseTurn: 1,
    display: {
      kindText: "战技",
      freq: 1,
      effectParts: [
        { t: "text", v: "对敌方进行一次斩击，造成一次" },
        { t: "pct", v: 100 },
        { t: "text", v: "的物理伤害。" }
      ]
    },
    backend: {
      cooldownSec: 0,
      damage: { element: "physical", ratio: 1.0 },
      anim: { type: "gif", src: "./anim/slash.gif" },
      sfx: { src: "./sfx/slash.mp3" }
    }
  },

  {
    id: "act_003",
    name: "雷击",
    type: "active",
    icon: "⚡",
    releaseTurn: 3,
    display: {
      kindText: "法术",
      freq: 3,
      effectParts: [
        { t: "text", v: "召唤落雷，造成" },
        { t: "pct", v: 120 },
        { t: "text", v: "的雷电伤害（示例）。" }
      ]
    },
    backend: { damage: { element: "lightning", ratio: 1.2 } }
  },

  {
    id: "act_004",
    name: "超重击",
    type: "active",
    icon: "./技能图标/超重击.png",
    releaseTurn: 2,
    display: {
      kindText: "战技",
      freq: 2,
      effectParts: [
        { t: "text", v: "蓄力2秒后对敌人造成" },
        { t: "pct", v: 250 },
        { t: "text", v: "的物理伤害，并将敌人击倒。" }
      ]
    },
    backend: {
      cooldownSec: 6,
      cast: { chargeSec: 2 },
      // ✅ 250% = 2.5
      damage: { element: "physical", ratio: 2.5 },
      cc: { type: "knockdown", interrupt: true },
      anim: { type: "gif", src: "./anim/heavy.gif" },
      sfx: { src: "./sfx/heavy.mp3" }
    }
  },

  // ===== 被动（passive）=====
  {
    id: "pas_001",
    name: "荆棘",
    type: "passive",
    icon: "🌿",
    releaseTurn: 0,
    display: {
      kindText: "被动",
      freq: 0,
      effectParts: [
        { t: "text", v: "受到攻击时反弹" },
        { t: "pct", v: 15 },
        { t: "text", v: "的伤害（示例）。" }
      ]
    },
    backend: {}
  }
];