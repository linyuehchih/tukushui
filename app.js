// 小人物吐苦水：市民用的網頁（首頁列表、發文、文章討論、版規、我的發文）
(function () {
  'use strict';

  const C = window.TKS_CONFIG;
  const app = document.getElementById('app');
  const fab = document.getElementById('fab');
  const POST_COLS = 'id,created_at,citizen_no,category,village,body,photo_path,status,hold_reason,me_too_count,comment_count,reflected_note,reflected_at';

  if (!window.supabase) {
    app.textContent = '網頁載入失敗，請檢查網路後重新整理。';
    return;
  }
  const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'tks-auth' }
  });

  // ---------- 小工具 ----------
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'text') el.textContent = v;
      else if (k in el && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  function render(...nodes) {
    app.replaceChildren(...nodes.flat(Infinity).filter(n => n != null && n !== false));
    window.scrollTo(0, 0);
  }
  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 3200);
  }
  const store = {
    get(k, d) { try { const v = localStorage.getItem('tks-' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('tks-' + k, JSON.stringify(v)); } catch (e) { /* 私密視窗可能不能存，沒關係 */ } }
  };
  const catOf = id => C.categories.find(c => c.id === id) || { name: '其他', icon: '💬' };
  function timeAgo(iso) {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return '剛剛';
    if (s < 3600) return Math.floor(s / 60) + ' 分鐘前';
    if (s < 86400) return Math.floor(s / 3600) + ' 小時前';
    if (s < 86400 * 7) return Math.floor(s / 86400) + ' 天前';
    const d = new Date(iso);
    return (d.getMonth() + 1) + '/' + d.getDate();
  }
  function friendlyError(err) {
    const m = (err && err.message) || '';
    if (/[一-鿿]/.test(m)) return m; // 資料庫給的中文訊息直接顯示
    if (/fetch|network/i.test(m)) return '網路好像不太穩，請稍後再試。';
    return '發生錯誤，請稍後再試。';
  }
  async function ensureSession() {
    const { data } = await sb.auth.getSession();
    if (data.session) {
      // 確認這個身分還有效（被清掉的話就換一個新的匿名身分）
      const { data: u, error: ue } = await sb.auth.getUser();
      if (!ue && u && u.user) return u.user.id;
      await sb.auth.signOut({ scope: 'local' });
    }
    const { data: d2, error } = await sb.auth.signInAnonymously();
    if (error) throw new Error('暫時無法連線，請稍後再試。');
    return d2.user.id;
  }
  async function signedUrls(paths) {
    const list = [...new Set(paths.filter(Boolean))];
    if (!list.length) return {};
    const { data } = await sb.storage.from('photos').createSignedUrls(list, 3600);
    const map = {};
    (data || []).forEach(x => { if (x.signedUrl) map[x.path] = x.signedUrl; });
    return map;
  }
  function villageSelect(value, withAll) {
    const sel = h('select', { required: !withAll });
    sel.append(h('option', { value: '' }, withAll ? '全部地區' : '請選擇地區'));
    if (withAll) {
      C.areas.forEach(a => sel.append(h('option', { value: 'area:' + a.id }, '【' + a.name + '】全部')));
    }
    C.areas.forEach(a => a.groups.forEach(g => {
      const og = h('optgroup', { label: a.name + '｜' + g.name });
      g.villages.forEach(v => og.append(h('option', { value: v }, v)));
      sel.append(og);
    }));
    sel.append(h('option', { value: C.unknownVillage }, C.unknownVillage));
    sel.value = value || '';
    return sel;
  }
  function categorySelect(value, withAll) {
    const sel = h('select', { required: !withAll },
      h('option', { value: '' }, withAll ? '全部分類' : '請選擇分類'),
      C.categories.map(c => h('option', { value: c.id }, c.icon + ' ' + c.name)));
    sel.value = value || '';
    return sel;
  }
  function counterFor(textarea, max) {
    const el = h('div', { class: 'counter' });
    const upd = () => {
      const n = textarea.value.length;
      el.textContent = n + ' / ' + max;
      el.classList.toggle('over', n > max);
    };
    textarea.addEventListener('input', upd); upd();
    return el;
  }
  function stamp(p) {
    if (!p.reflected_at) return null;
    return h('div', { class: 'stamp' }, h('b', {}, '✅ 小人物已反映'),
      p.reflected_note || '', ' ', h('span', { class: 'meta' }, timeAgo(p.reflected_at)));
  }
  function postMeta(p) {
    const c = catOf(p.category);
    return h('div', { class: 'meta' },
      h('span', { class: 'tag' }, c.icon + ' ' + c.name),
      h('span', {}, '📍 ' + p.village),
      h('span', {}, '花蓮市民 #' + p.citizen_no),
      h('span', {}, timeAgo(p.created_at)));
  }
  function myPostIds() { return store.get('my-posts', []); }
  function addMyPost(id) { const a = myPostIds(); if (!a.includes(id)) { a.unshift(id); store.set('my-posts', a.slice(0, 100)); } }
  function myMeToo() { return store.get('me-too', []); }

  // ---------- 首頁 ----------
  const filters = store.get('filters', { sort: 'new', cat: '', area: '' });
  if (filters.cat && !C.categories.some(c => c.id === filters.cat)) filters.cat = ''; // 舊分類已改名
  async function pageList() {
    fab.hidden = false;
    const listEl = h('div', {});
    const moreBtn = h('button', { class: 'btn block', hidden: true }, '載入更多');
    let offset = 0;

    const catSel = categorySelect(filters.cat, true);
    const areaSel = villageSelect(filters.area, true);
    const sortBtns = [['new', '🕒 最新'], ['hot', '🙋 最多人遇過']].map(([k, label]) =>
      h('button', { class: 'btn small' + (filters.sort === k ? ' on' : ''), onclick: () => { filters.sort = k; changed(); } }, label));
    catSel.addEventListener('change', () => { filters.cat = catSel.value; changed(); });
    areaSel.addEventListener('change', () => { filters.area = areaSel.value; changed(); });
    function changed() {
      store.set('filters', filters);
      sortBtns.forEach((b, i) => b.classList.toggle('on', ['new', 'hot'][i] === filters.sort));
      offset = 0; listEl.replaceChildren(); load();
    }

    async function load() {
      moreBtn.hidden = true;
      const loading = h('p', { class: 'empty' }, '載入中…');
      listEl.append(loading);
      let q = sb.from('posts').select(POST_COLS).eq('status', 'public');
      if (filters.cat) q = q.eq('category', filters.cat);
      if (filters.area.startsWith('area:')) {
        const a = C.areas.find(x => 'area:' + x.id === filters.area);
        if (a) q = q.in('village', a.groups.flatMap(g => g.villages));
      } else if (filters.area) q = q.eq('village', filters.area);
      if (filters.sort === 'hot') q = q.order('me_too_count', { ascending: false });
      q = q.order('created_at', { ascending: false }).range(offset, offset + C.pageSize - 1);
      const { data, error } = await q;
      loading.remove();
      if (error) { listEl.append(h('div', { class: 'notice err' }, friendlyError(error))); return; }
      if (!data.length && offset === 0) {
        listEl.append(h('p', { class: 'empty' }, '這裡還沒有人吐苦水。你可以當第一個！'));
        return;
      }
      const urls = await signedUrls(data.map(p => p.photo_path));
      data.forEach(p => listEl.append(postCard(p, urls[p.photo_path])));
      offset += data.length;
      moreBtn.hidden = data.length < C.pageSize;
    }
    moreBtn.addEventListener('click', load);

    render(
      h('section', { class: 'card' },
        h('div', { class: 'filters' }, h('label', {}, h('span', { class: 'sr' }, '分類'), catSel), h('label', {}, h('span', { class: 'sr' }, '地區'), areaSel)),
        h('div', { class: 'seg' }, sortBtns)),
      listEl, moreBtn,
      myPostIds().length ? h('p', { class: 'empty' }, h('a', { href: '#/mine' }, '看我發過的文')) : null
    );
    load();
  }

  function postCard(p, url) {
    return h('article', { class: 'card' },
      h('a', { class: 'post-link', href: '#/post/' + p.id },
        postMeta(p),
        h('div', { class: 'body clip' }, p.body),
        url ? h('img', { class: 'thumb', src: url, alt: '附圖', loading: 'lazy' }) : null,
        stamp(p),
        h('div', { class: 'counts' },
          h('span', {}, '🙋 ' + p.me_too_count + ' 人也遇過'),
          h('span', {}, '💬 ' + p.comment_count + ' 則留言'))));
  }

  // ---------- 發文 ----------
  function pageNew() {
    fab.hidden = true;
    const draft = store.get('draft', {});
    const catSel = categorySelect(draft.cat);
    const vilSel = villageSelect(draft.village);
    const body = h('textarea', { maxlength: String(C.postMax + 50), placeholder: '發生什麼事？在哪裡？多久了？\n例：國聯一路靠近○○路口的路燈壞了快一個禮拜，晚上很暗。' });
    body.value = draft.body || '';
    const saveDraft = () => store.set('draft', { cat: catSel.value, village: vilSel.value, body: body.value });
    [catSel, vilSel].forEach(el => el.addEventListener('change', saveDraft));
    const catHint = h('p', { class: 'hint' });
    const showCatHint = () => { const c = C.categories.find(x => x.id === catSel.value); catHint.textContent = c ? c.hint : '不知道選哪個？選「其他」也可以。'; };
    catSel.addEventListener('change', showCatHint); showCatHint();
    body.addEventListener('input', saveDraft);

    let photoBlob = null;
    const fileIn = h('input', { type: 'file', accept: 'image/*', class: 'sr', id: 'photo-in' });
    const preview = h('img', { class: 'photo-preview', hidden: true, alt: '照片預覽' });
    const removeBtn = h('button', { type: 'button', class: 'btn small', hidden: true, onclick: () => {
      photoBlob = null; preview.hidden = true; removeBtn.hidden = true; fileIn.value = '';
    } }, '拿掉照片');
    fileIn.addEventListener('change', async () => {
      const f = fileIn.files[0];
      if (!f) return;
      try {
        photoBlob = await shrinkPhoto(f);
        preview.src = URL.createObjectURL(photoBlob);
        preview.hidden = false; removeBtn.hidden = false;
      } catch (e) {
        photoBlob = null; toast('這張照片讀不出來，換一張試試看。');
      }
    });

    const agree = h('input', { type: 'checkbox', id: 'agree' });
    const msg = h('div', {});
    const submit = h('button', { type: 'submit', class: 'btn primary block' }, '送出');

    const form = h('form', { class: 'card', novalidate: true, onsubmit: async (ev) => {
      ev.preventDefault();
      msg.replaceChildren();
      const text = body.value.trim();
      const problems = [];
      if (!catSel.value) problems.push('請選分類');
      if (!vilSel.value) problems.push('請選地區');
      if (text.length < 5) problems.push('內容至少寫 5 個字');
      if (text.length > C.postMax) problems.push('內容最多 ' + C.postMax + ' 字');
      if (!agree.checked) problems.push('請勾選「我看過版規了」');
      if (problems.length) { msg.append(h('div', { class: 'notice err' }, problems.join('、'))); return; }

      submit.disabled = true; submit.textContent = '送出中…';
      try {
        const uid = await ensureSession();
        let photo_path = null;
        if (photoBlob) {
          photo_path = uid + '/' + crypto.randomUUID() + '.jpg';
          const up = await sb.storage.from('photos').upload(photo_path, photoBlob, { contentType: 'image/jpeg', upsert: false });
          if (up.error) throw new Error('照片上傳失敗，請換一張或先不附照片。');
        }
        const { data, error } = await sb.from('posts')
          .insert({ category: catSel.value, village: vilSel.value, body: text, photo_path })
          .select('id,status,hold_reason').single();
        if (error) throw error;
        addMyPost(data.id);
        store.set('draft', {});
        if (data.status === 'public') {
          toast('已經上線了！');
          location.hash = '#/post/' + data.id;
        } else {
          render(h('div', { class: 'notice warn' },
            h('p', {}, h('b', {}, '小志先幫你保留了 🙏')),
            h('p', {}, '原因：' + (data.hold_reason || '需要再看一下') + '。'),
            h('p', {}, '這不是刪除，岳志看過、確認沒有點名或個資問題後就會公開。')),
            h('a', { class: 'btn block', href: '#/mine' }, '看我發過的文'),
            h('p', {}, ''),
            h('a', { class: 'btn primary block', href: '#/' }, '回首頁'));
        }
      } catch (e) {
        msg.append(h('div', { class: 'notice err' }, friendlyError(e)));
        submit.disabled = false; submit.textContent = '送出';
      }
    } },
      h('h1', {}, '✍️ 我要吐苦水'),
      h('p', { class: 'hint' }, '不用註冊、匿名發文，只會顯示「花蓮市民 #編號」。'),
      h('label', { class: 'field' }, '分類', catSel), catHint,
      h('label', { class: 'field' }, '地區', vilSel),
      h('label', { class: 'field', for: 'body' }, '想說什麼'),
      body, counterFor(body, C.postMax),
      h('p', { class: 'hint' }, '對事不對人：可以罵路燈、罵水溝，請不要點名特定的人，也不要寫電話、門牌、車牌。'),
      h('div', { class: 'field' }, '照片（選填，最多 1 張）'),
      h('div', { class: 'photo-pick' },
        h('label', { class: 'btn small', for: 'photo-in' }, '📷 選照片'), fileIn, preview, removeBtn),
      h('p', { class: 'hint' }, '有照片的文會先給岳志看過再公開（避免拍到別人的臉或車牌）。照片的拍攝地點等資訊會自動去掉。'),
      h('p', {}, h('label', {}, agree, ' 我看過', h('a', { href: '#/rules', target: '_blank' }, '版規'), '了')),
      msg, submit);
    body.id = 'body';
    render(form, h('p', {}, h('a', { class: 'btn link', href: '#/' }, '← 回首頁')));
  }

  async function shrinkPhoto(file) {
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (e) {
      bmp = await new Promise((ok, bad) => {
        const img = new Image(); img.onload = () => ok(img); img.onerror = bad;
        img.src = URL.createObjectURL(file);
      });
    }
    const scale = Math.min(1, C.photoMaxWidth / bmp.width);
    const w = Math.round(bmp.width * scale), hgt = Math.round(bmp.height * scale);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = hgt;
    cv.getContext('2d').drawImage(bmp, 0, 0, w, hgt);
    for (const q of [0.82, 0.7, 0.55]) {
      const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', q));
      if (blob && blob.size < 2.8 * 1024 * 1024) return blob;
    }
    throw new Error('too big');
  }

  // ---------- 文章頁 ----------
  async function pageDetail(id) {
    fab.hidden = false;
    render(h('p', { class: 'empty' }, '載入中…'));
    const { data: p, error } = await sb.from('posts').select(POST_COLS).eq('id', id).maybeSingle();
    if (error) { render(h('div', { class: 'notice err' }, friendlyError(error))); return; }
    if (!p) {
      render(h('div', { class: 'notice warn' }, '找不到這篇，可能還在等岳志看過，或已經被藏起來。'),
        h('a', { class: 'btn block', href: '#/' }, '回首頁'));
      return;
    }
    const isPublic = p.status === 'public';
    const urls = await signedUrls([p.photo_path]);

    // 我也遇過
    const done = myMeToo().includes(p.id);
    const countEl = h('span', {}, String(p.me_too_count));
    const meTooBtn = h('button', { class: 'btn' + (done ? ' on' : ''), disabled: done || !isPublic, onclick: async () => {
      meTooBtn.disabled = true;
      try {
        await ensureSession();
        const { error: e } = await sb.from('me_too').insert({ post_id: p.id });
        if (e && e.code !== '23505') throw e;
        const a = myMeToo(); a.push(p.id); store.set('me-too', a);
        meTooBtn.classList.add('on');
        const { data: fresh } = await sb.from('posts').select('me_too_count').eq('id', p.id).maybeSingle();
        if (fresh) countEl.textContent = String(fresh.me_too_count);
        toast('收到！你不是一個人。');
      } catch (e) { meTooBtn.disabled = false; toast(friendlyError(e)); }
    } }, '🙋 我也遇過（', countEl, '）');

    const commentsEl = h('div', {});
    async function loadComments() {
      const { data, error: e } = await sb.from('comments')
        .select('id,created_at,citizen_no,body,status').eq('post_id', p.id).neq('status', 'hidden')
        .order('created_at', { ascending: true });
      if (e) { commentsEl.replaceChildren(h('div', { class: 'notice err' }, friendlyError(e))); return; }
      if (!data.length) { commentsEl.replaceChildren(h('p', { class: 'empty' }, '還沒有留言。有解法、有經驗，都歡迎分享！')); return; }
      commentsEl.replaceChildren(...data.map(c => h('div', { class: 'comment' },
        h('div', { class: 'meta' }, h('span', {}, '花蓮市民 #' + c.citizen_no), h('span', {}, timeAgo(c.created_at)),
          c.status === 'held' ? h('span', { class: 'tag' }, '只有你看得到・等岳志看過才公開') : null),
        h('div', { class: 'body' }, c.body),
        c.status === 'public' ? h('button', { class: 'btn link small', onclick: () => report('comment', c.id) }, '檢舉') : null)));
    }

    const cBody = h('textarea', { placeholder: '你有遇過嗎？有什麼辦法？可以打哪個專線？', style: 'min-height:110px' });
    const cMsg = h('div', {});
    const cBtn = h('button', { type: 'submit', class: 'btn primary' }, '留言');
    const cForm = h('form', { onsubmit: async (ev) => {
      ev.preventDefault(); cMsg.replaceChildren();
      const text = cBody.value.trim();
      if (!text) return;
      if (text.length > C.commentMax) { cMsg.append(h('div', { class: 'notice err' }, '留言最多 ' + C.commentMax + ' 字')); return; }
      cBtn.disabled = true;
      try {
        await ensureSession();
        const { data, error: e } = await sb.from('comments').insert({ post_id: p.id, body: text })
          .select('id,status,hold_reason').single();
        if (e) throw e;
        cBody.value = '';
        cBody.dispatchEvent(new Event('input'));
        if (data.status === 'public') toast('留言成功！');
        else cMsg.append(h('div', { class: 'notice warn' }, '小志先幫你保留這則留言（' + (data.hold_reason || '需要再看一下') + '），岳志看過就會公開。'));
        await loadComments();
      } catch (e) { cMsg.append(h('div', { class: 'notice err' }, friendlyError(e))); }
      cBtn.disabled = false;
    } }, cBody, counterFor(cBody, C.commentMax), cMsg, h('div', { class: 'actions' }, cBtn));

    render(
      !isPublic ? h('div', { class: 'notice warn' }, '這篇只有你看得到：小志先幫你保留（' + (p.hold_reason || '需要再看一下') + '），岳志看過就會公開。') : null,
      h('article', { class: 'card' },
        postMeta(p),
        h('div', { class: 'body' }, p.body),
        urls[p.photo_path] ? h('img', { class: 'photo', src: urls[p.photo_path], alt: '附圖' }) : null,
        stamp(p),
        h('div', { class: 'actions' },
          meTooBtn,
          h('button', { class: 'btn small', onclick: () => share(p) }, '分享'),
          isPublic ? h('button', { class: 'btn link small', onclick: () => report('post', p.id) }, '檢舉') : null)),
      h('section', { class: 'card' }, h('h2', {}, '💬 一起想辦法'), commentsEl, isPublic ? cForm : null),
      h('p', {}, h('a', { class: 'btn link', href: '#/' }, '← 回首頁'))
    );
    loadComments();
  }

  async function report(type, id) {
    if (!confirm('確定要檢舉嗎？\n（例如：點名罵人、造謠、個資、廣告）')) return;
    try {
      await ensureSession();
      const { error } = await sb.from('reports').insert({ target_type: type, target_id: id });
      if (error && error.code !== '23505') throw error;
      toast(error ? '你已經檢舉過了，謝謝！' : '收到，謝謝你幫忙顧！');
    } catch (e) { toast(friendlyError(e)); }
  }

  async function share(p) {
    const url = location.href.split('#')[0] + '#/post/' + p.id;
    const text = '【小人物吐苦水】' + p.body.slice(0, 40) + (p.body.length > 40 ? '…' : '');
    try {
      if (navigator.share) { await navigator.share({ title: '小人物吐苦水', text, url }); return; }
      await navigator.clipboard.writeText(text + '\n' + url);
      toast('連結已複製，可以貼到 LINE 或臉書');
    } catch (e) { /* 使用者取消分享 */ }
  }

  // ---------- 我的發文 ----------
  async function pageMine() {
    fab.hidden = false;
    const ids = myPostIds();
    if (!ids.length) { render(h('p', { class: 'empty' }, '這支手機還沒發過文。'), h('a', { class: 'btn primary block', href: '#/new' }, '我要吐苦水')); return; }
    render(h('p', { class: 'empty' }, '載入中…'));
    await sb.auth.getSession();
    const { data, error } = await sb.from('posts').select(POST_COLS).in('id', ids).order('created_at', { ascending: false });
    if (error) { render(h('div', { class: 'notice err' }, friendlyError(error))); return; }
    const urls = await signedUrls(data.map(p => p.photo_path));
    render(h('h1', {}, '我發過的文'),
      h('p', { class: 'hint' }, '只記在這支手機上；換手機或清除瀏覽資料就看不到這份清單（文章本身還在）。'),
      data.map(p => h('div', {},
        p.status === 'held' ? h('div', { class: 'notice warn' }, '⏳ 等岳志看過才公開（' + (p.hold_reason || '') + '）') : null,
        postCard(p, urls[p.photo_path]))),
      data.length < ids.length ? h('p', { class: 'hint' }, '有 ' + (ids.length - data.length) + ' 篇已經看不到（被藏起來或已刪除）。') : null,
      h('p', {}, h('a', { class: 'btn link', href: '#/' }, '← 回首頁')));
  }

  // ---------- 版規 ----------
  function pageRules() {
    fab.hidden = false;
    render(h('section', { class: 'card rules' },
      h('h1', {}, '📜 版規'),
      h('ol', {},
        h('li', {}, h('b', {}, '對事不對人：'), '可以罵路燈、罵水溝、罵制度，不要點名罵特定的人（包括公務員、民代、鄰居）。對公所服務不滿，請描述事情經過，不要寫人名或外號。'),
        h('li', {}, h('b', {}, '不造謠：'), '沒確認的事請寫「聽說」「我看到」，不要寫成事實。'),
        h('li', {}, h('b', {}, '不貼個資：'), '不要寫電話、地址門牌、車牌、別人的全名；照片不要拍到別人的臉或車牌。'),
        h('li', {}, h('b', {}, '歡迎給解方：'), '留言可以是「我也遇過」，更歡迎「我試過這個辦法」「可以打這個專線」。'),
        h('li', {}, h('b', {}, '小志會先篩：'), '有些文字或附照片的文，會先保留給岳志看過才公開，不是刪掉。'),
        h('li', {}, h('b', {}, '大家一起顧：'), '看到不妥的內容可以按「檢舉」；岳志有權把違反版規的內容藏起來。'),
        h('li', {}, h('b', {}, '這裡不是官方管道：'), '急事、危險請打 1999（花蓮縣民服務專線）或 110／119。')),
      h('p', { class: 'hint' }, '「小人物已反映」章：代表岳志已經把這個問題帶去反映，不代表已經解決，也不保證每件都追到底。')),
      h('p', {}, h('a', { class: 'btn link', href: '#/' }, '← 回首頁')));
  }

  // ---------- 路由 ----------
  function route() {
    const hash = location.hash || '#/';
    let m;
    if (hash === '#/new') return pageNew();
    if (hash === '#/rules') return pageRules();
    if (hash === '#/mine') return pageMine();
    if ((m = hash.match(/^#\/post\/(\d+)$/))) return pageDetail(Number(m[1]));
    return pageList();
  }
  window.addEventListener('hashchange', route);
  route();
})();
