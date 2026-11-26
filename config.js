// 小人物吐苦水：網站設定（公開鑰匙本來就會放在網頁裡，安全靠資料庫的規則）
window.TKS_CONFIG = {
  supabaseUrl: 'https://auheyogdyhamgewxpuwh.supabase.co',
  supabaseKey: 'sb_publishable_NOGZ9l-2r5vY8GxHY_G-1w_KS0gIv1O',

  categories: [
    { id: 'traffic', name: '交通停車', icon: '🚗' },
    { id: 'road',    name: '路面坑洞', icon: '🕳️' },
    { id: 'light',   name: '路燈',     icon: '💡' },
    { id: 'env',     name: '垃圾與環境', icon: '🗑️' },
    { id: 'drain',   name: '排水溝',   icon: '🌧️' },
    { id: 'noise',   name: '噪音',     icon: '📢' },
    { id: 'park',    name: '公園與設施', icon: '🌳' },
    { id: 'other',   name: '其他',     icon: '💬' }
  ],

  // 花蓮市各里（依聯合里分組；上線前再對一次市公所正式名單）
  areas: [
    { id: 'min', name: '民字頭', groups: [
      { name: '第一聯合里', villages: ['民勤里','民德里','民心里','民享里','民孝里','民運里','民政里','民意里','民立里','民樂里'] },
      { name: '第二聯合里', villages: ['民有里','民主里','民族里','民生里','民權里'] }
    ]},
    { id: 'zhu', name: '主字頭', groups: [
      { name: '第三聯合里', villages: ['主商里','主勤里','主工里','主信里','主義里','主睦里','主計里'] },
      { name: '第四聯合里', villages: ['主力里','主權里','主安里','主農里','主學里','主和里'] }
    ]},
    { id: 'guo', name: '國字頭', groups: [
      { name: '第五聯合里', villages: ['國風里','國威里','國治里','國安里','國光里','國防里','國華里','國魂里','國聯里','國盛里'] },
      { name: '第六聯合里', villages: ['國強里','國富里','國裕里','國慶里','國興里','國福里'] }
    ]}
  ],
  unknownVillage: '不確定／跨好幾個里',

  pageSize: 20,
  postMax: 500,
  commentMax: 300,
  photoMaxWidth: 1280
};
