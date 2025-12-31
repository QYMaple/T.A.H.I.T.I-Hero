// enemyPool.js
(function () {
  window.TAHITI = window.TAHITI || {};
  window.TAHITI.db = window.TAHITI.db || {};

  // ✅ 敌人列表：你以后只需要在这里不断追加
  const ENEMIES = [
    { id:"enemy_slime",  name:"史莱姆",  str:6,  agi:6,  sta:6,  spi:3 },
    { id:"enemy_goblin", name:"哥布林",  str:17,  agi:4,  sta:13,  spi:0 },
    { id:"enemy_wolf",   name:"野狼",    str:13,  agi:14,  sta:12,  spi:0 },
  ];

  // ✅ 标准 enemyPool：battle.js 会读取这两个函数
  const enemyPool = {
    allIds() {
      return ENEMIES.map(e => e.id);
    },
    findById(id) {
      return ENEMIES.find(e => e.id === id) || null;
    },
    // 可选：以后你想拿完整列表也方便
    all() {
      return ENEMIES.slice();
    }
  };

  window.TAHITI.db.enemyPool = enemyPool;
})();