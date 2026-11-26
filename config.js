// 小人物吐苦水：網站設定（公開鑰匙本來就會放在網頁裡，安全靠資料庫的規則）
window.TKS_CONFIG = {
  supabaseUrl: 'https://auheyogdyhamgewxpuwh.supabase.co',
  supabaseKey: 'sb_publishable_NOGZ9l-2r5vY8GxHY_G-1w_KS0gIv1O',

  // 2026-11-27 依市長信箱 1,918 件（2023 年後）分析，岳志選定 7 大項＋其他
  categories: [
    { id: 'traffic', name: '停車與交通', icon: '🚗', hint: '例：違停、路霸佔道、停車位、紅綠燈秒數、路口、標線、反射鏡、公車' },
    { id: 'road',    name: '道路、人行道、路燈、水溝', icon: '🛣️', hint: '例：路面坑洞、道路施工、人行道破損、路燈不亮、水溝不通、下雨積水' },
    { id: 'park',    name: '公園、綠地與市容', icon: '🌳', hint: '例：遊樂設施壞掉、公廁、球場、路樹修剪、雜草、市容、活動' },
    { id: 'env',     name: '垃圾與環境衛生', icon: '🗑️', hint: '例：垃圾車時間、資源回收、亂丟垃圾、廢棄車、蚊蟲老鼠、空汙' },
    { id: 'life',    name: '噪音、動物與生活安全', icon: '🔊', hint: '例：噪音、流浪狗、治安、違建' },
    { id: 'welfare', name: '福利與銀髮照顧', icon: '🧓', hint: '例：補助申請、長輩照顧、身障、育兒、急難救助' },
    { id: 'service', name: '公所服務', icon: '🏛️', hint: '例：申辦流程、回覆太慢、系統不好用。請描述事情經過，不要寫人名或外號' },
    { id: 'other',   name: '其他', icon: '💬', hint: '以上都不是的，都可以放這裡' }
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
