// assets/js/core/storage.js
(function () {
  const NS = (window.TAHITI = window.TAHITI || {});
  const storage = (NS.storage = NS.storage || {});

  // 统一存档 key（以后所有页面都用这个）
  const PLAYER_KEY = "tahiti_player_v1";
  storage.PLAYER_KEY = PLAYER_KEY;

  // 你项目的玩家默认结构（以后加字段也在这里扩展）
  function defaultPlayer() {
    return {
      name: "冒险者",
      level: 1,
      exp: 0,
      expNext: 200,
      progress: "普通1",

      str: 10,
      agi: 10,
      sta: 10,
      spi: 10,
      free: 0,

      gold: 0,
      diamond: 0,

      // ✅ 玩家“已拥有”的技能ID列表：没拥有就不会显示在技能库
      ownedSkills: ["act_002", "act_004"], // ✅ 玩家初始只拥有：斩击 + 超重击
    };
  }
  storage.defaultPlayer = defaultPlayer;

  function safeParse(raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  // 读取玩家（自动补全缺失字段）
  storage.loadPlayer = function loadPlayer() {
    const raw = localStorage.getItem(PLAYER_KEY);
  
    // ✅ 没有存档：创建一次默认存档（以后所有页面都安全）
    if (!raw) {
      const p = defaultPlayer();
      localStorage.setItem(PLAYER_KEY, JSON.stringify(p));
      return p;
    }
  
    const parsed = safeParse(raw);
  
    // ✅ 存档坏了：先备份再重置（避免“直接丢档”）
    if (!parsed || typeof parsed !== "object") {
      try {
        localStorage.setItem(PLAYER_KEY + "_broken_backup_" + Date.now(), raw);
      } catch {}
      const p = defaultPlayer();
      localStorage.setItem(PLAYER_KEY, JSON.stringify(p));
      return p;
    }
  
    // ✅ 自动补字段（以后你加新字段也不会把旧档弄坏）
    const merged = { ...defaultPlayer(), ...parsed };
    // ✅ 自动迁移：老存档没有 ownedSkills 时，从“已装备(loadout)”里推导一份
    if (!Array.isArray(merged.ownedSkills)) merged.ownedSkills = [];

    if (merged.ownedSkills.length === 0) {
      try {
        const rawLoadout = localStorage.getItem("tahiti_loadout_v1");
        const lo = rawLoadout ? JSON.parse(rawLoadout) : null;

        const collect = []
          .concat(Array.isArray(lo?.buff) ? lo.buff : [])
          .concat(Array.isArray(lo?.active) ? lo.active : [])
          .concat(Array.isArray(lo?.passive) ? lo.passive : [])
          .filter(x => typeof x === "string" && x.trim());

        // 去重
        merged.ownedSkills = Array.from(new Set(collect));
      } catch {}
    }
    localStorage.setItem(PLAYER_KEY, JSON.stringify(merged));
    return merged;
  };

  // 保存玩家
  storage.savePlayer = function savePlayer(player) {
    localStorage.setItem(PLAYER_KEY, JSON.stringify(player));
  };

  // ===== 技能拥有系统（ownedSkills）=====
  function normalizeSkillIds(arr) {
    const a = Array.isArray(arr) ? arr : [];
    const clean = [];
    const seen = new Set();
    for (const x of a) {
      const id = String(x || "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      clean.push(id);
    }
    return clean;
  }

  storage.hasSkill = function hasSkill(skillId) {
    const p = storage.loadPlayer();
    const owned = normalizeSkillIds(p.ownedSkills);
    return owned.includes(String(skillId || "").trim());
  };

  storage.setOwnedSkills = function setOwnedSkills(skillIds) {
    const ids = normalizeSkillIds(skillIds);
    return storage.updatePlayer((p) => {
      p.ownedSkills = ids;
    });
  };

  storage.grantSkill = function grantSkill(skillId) {
    const id = String(skillId || "").trim();
    if (!id) return storage.loadPlayer();
    return storage.updatePlayer((p) => {
      const owned = normalizeSkillIds(p.ownedSkills);
      if (!owned.includes(id)) owned.push(id);
      p.ownedSkills = owned;
    });
  };

  storage.revokeSkill = function revokeSkill(skillId) {
    const id = String(skillId || "").trim();
    if (!id) return storage.loadPlayer();
    return storage.updatePlayer((p) => {
      const owned = normalizeSkillIds(p.ownedSkills).filter((x) => x !== id);
      p.ownedSkills = owned;
    });
  };

  // 原子更新：load -> 修改 -> save（推荐所有系统用它）
  storage.updatePlayer = function updatePlayer(mutator) {
    const p = storage.loadPlayer();
    mutator(p);
    storage.savePlayer(p);
    return p;
  };

  // 常用：发放自由点
  storage.grantFreePoints = function grantFreePoints(n) {
    const add = Number(n) || 0;
    if (add <= 0) return storage.loadPlayer();
    return storage.updatePlayer((p) => {
      p.free += add;
    });
  };

  // 常用：发放金币/钻石（以后用）
  storage.grantGold = function grantGold(n) {
    const add = Number(n) || 0;
    if (add <= 0) return storage.loadPlayer();
    return storage.updatePlayer((p) => {
      p.gold += add;
    });
  };

  storage.grantDiamond = function grantDiamond(n) {
    const add = Number(n) || 0;
    if (add <= 0) return storage.loadPlayer();
    return storage.updatePlayer((p) => {
      p.diamond += add;
    });
  };
  
  // ✅ 发放技能（以后打怪掉落/任务奖励都走这个）
  storage.grantSkill = function grantSkill(skillId) {
    const id = String(skillId || "").trim();
    if (!id) return storage.loadPlayer();

    return storage.updatePlayer((p) => {
      if (!Array.isArray(p.ownedSkills)) p.ownedSkills = [];
      if (!p.ownedSkills.includes(id)) p.ownedSkills.push(id);
    });
  };

  // ✅ 判断是否拥有
  storage.hasSkill = function hasSkill(skillId) {
    const p = storage.loadPlayer();
    return Array.isArray(p.ownedSkills) && p.ownedSkills.includes(String(skillId || "").trim());
  };
  
})();