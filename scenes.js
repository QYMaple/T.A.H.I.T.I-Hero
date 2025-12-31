// scenes.js
(function () {
  window.TAHITI = window.TAHITI || {};
  window.TAHITI.scenes = window.TAHITI.scenes || {};

  // ✅ 你以后只需要在这里“加配置”，不用复制 battle.html
  // 用法：battle.html?scene=endless
  // 或： battle.html?scene=slime_test

  window.TAHITI.scenes.endless = {
    id: "endless",
    title: "无尽模式",
    mode: "endless",
    pickEnemy: "random",      // random / fixed
    floorStart: 1,
    // 预留：以后你想每层加成可以放这里
    scaling: { hpMulPerFloor: 0.0 }
  };

  window.TAHITI.scenes.slime_test = {
    id: "slime_test",
    title: "史莱姆草地",
    mode: "single",
    pickEnemy: "fixed",
    enemyId: "enemy_slime"
  };
})();