// 小人物吐苦水：岳志的管理頁（放行、下架、蓋「小人物已反映」章）
(function () {
  'use strict';

  const C = window.TKS_CONFIG;
  const app = document.getElementById('app');
  const POST_COLS = 'id,created_at,citizen_no,category,village,body,photo_path,status,hold_reason,me_too_count,comment_count,report_count,reflected_note,reflected_at';
  const COMMENT_COLS = 'id,created_at,post_id,citizen_no,body,status,hold_reason,report_count';

  if (!window.supabase) { app.textContent = '網頁載入失敗，請檢查網路後重新整理。'; return; }
  // 管理頁用自己的登入資料，不會跟一般發文的匿名身分混在一起
  const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'tks-admin-auth' }
  });

  // ---------- 小工具 ----------
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k in el && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  function render(...nodes) { app.replaceChildren(...nodes.flat(Infinity).filter(n => n != null && n !== false)); }
  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 3000);
  }
  const catOf = id => C.categories.find(c => c.id === id) || { name: '其他', icon: '💬' };
  function when(iso) {
    const d = new Date(iso);
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function errText(e) { return (e && e.message) || '發生錯誤'; }
  async function signedUrls(paths) {
    const list = [...new Set(paths.filter(Boolean))];
    if (!list.length) return {};
    const { data } = await sb.storage.from('photos').createSignedUrls(list, 3600);
    const map = {};
    (data || []).forEach(x => { if (x.signedUrl) map[x.path] = x.signedUrl; });
    return map;
  }

  // ---------- 登入 ----------
  function pageLogin(note) {
    const email = h('input', { type: 'text', inputmode: 'email', autocomplete: 'email', placeholder: '你的 Email' });
    const msg = h('div', {});
    const btn = h('button', { type: 'submit', class: 'btn primary block' }, '寄登入連結給我');
    render(h('form', { class: 'card', onsubmit: async (ev) => {
      ev.preventDefault(); msg.replaceChildren();
      const v = email.value.trim();
      if (!/^\S+@\S+\.\S+$/.test(v)) { msg.append(h('div', { class: 'notice err' }, '請填正確的 Email')); return; }
      btn.disabled = true;
      const { error } = await sb.auth.signInWithOtp({
        email: v,
        options: { emailRedirectTo: location.origin + location.pathname }
      });
      btn.disabled = false;
      if (error) { msg.append(h('div', { class: 'notice err' }, /rate|seconds/i.test(error.message) ? '寄太多次了，請過一陣子再試。' : '寄信失敗：' + errText(error))); return; }
      msg.append(h('div', { class: 'notice ok' }, '已寄出！請到信箱打開「Your sign-in link」那封信，點裡面的連結就會回到這裡並登入。（信可能在垃圾郵件匣）'));
    } },
      h('h1', {}, '🔐 管理頁登入'),
      note ? h('div', { class: 'notice warn' }, note) : null,
      h('p', { class: 'hint' }, '不用密碼：填 Email，收信點連結就能進來。'),
      h('label', { class: 'field' }, 'Email', email), msg, h('p', {}), btn));
  }

  // ---------- 主畫面 ----------
  let tab = 'held';
  async function pageAdmin(user) {
    const tabs = [['held', '⏳ 待審'], ['public', '✅ 已公開'], ['hidden', '🙈 已藏起來']];
    const body = h('div', {});
    const heldBadge = h('span', { class: 'badge', hidden: true });
    const tabBtns = tabs.map(([k, label]) => h('button', {
      class: 'btn small' + (tab === k ? ' on' : ''),
      onclick: () => { tab = k; tabBtns.forEach((b, i) => b.classList.toggle('on', tabs[i][0] === k)); load(); }
    }, label, k === 'held' ? heldBadge : null));

    async function refreshBadge() {
      const [a, b] = await Promise.all([
        sb.from('posts').select('id', { count: 'exact', head: true }).eq('status', 'held'),
        sb.from('comments').select('id', { count: 'exact', head: true }).eq('status', 'held')
      ]);
      const n = (a.count || 0) + (b.count || 0);
      heldBadge.textContent = String(n); heldBadge.hidden = n === 0;
    }

    async function load() {
      body.replaceChildren(h('p', { class: 'empty' }, '載入中…'));
      refreshBadge();
      const { data: posts, error } = await sb.from('posts').select(POST_COLS).eq('status', tab)
        .order('created_at', { ascending: tab === 'held' }).limit(100);
      if (error) { body.replaceChildren(h('div', { class: 'notice err' }, errText(error))); return; }
      let comments = [];
      if (tab !== 'public') {
        const r = await sb.from('comments').select(COMMENT_COLS).eq('status', tab)
          .order('created_at', { ascending: tab === 'held' }).limit(100);
        if (r.error) { body.replaceChildren(h('div', { class: 'notice err' }, errText(r.error))); return; }
        comments = r.data;
      }
      const urls = await signedUrls(posts.map(p => p.photo_path));
      const parts = [];
      if (tab === 'held') parts.push(h('p', { class: 'hint' }, '舊的在上面。放行＝公開；下架＝藏起來（之後還能救回）。'));
      if (posts.length) {
        parts.push(h('h2', {}, '文章（' + posts.length + '）'));
        posts.forEach(p => parts.push(postCard(p, urls[p.photo_path])));
      }
      if (comments.length) {
        parts.push(h('h2', {}, '留言（' + comments.length + '）'));
        comments.forEach(c => parts.push(commentCard(c)));
      }
      if (!parts.length || (!posts.length && !comments.length)) {
        parts.push(h('p', { class: 'empty' }, tab === 'held' ? '目前沒有要審的，太好了 🎉' : '這裡是空的。'));
      }
      body.replaceChildren(...parts);
    }

    async function setPost(id, fields, okMsg) {
      const { error } = await sb.from('posts').update(fields).eq('id', id);
      if (error) { toast('失敗：' + errText(error)); return false; }
      toast(okMsg); load(); return true;
    }
    async function setComment(id, fields, okMsg) {
      const { error } = await sb.from('comments').update(fields).eq('id', id);
      if (error) { toast('失敗：' + errText(error)); return false; }
      toast(okMsg); load(); return true;
    }

    function postCard(p, url) {
      const c = catOf(p.category);
      const actions = [];
      if (p.status !== 'public') actions.push(h('button', { class: 'btn primary small', onclick: () => setPost(p.id, { status: 'public', hold_reason: null }, '已放行公開') }, '✅ 放行'));
      if (p.status !== 'hidden') actions.push(h('button', { class: 'btn small danger', onclick: () => {
        if (confirm('確定要把這篇藏起來嗎？（之後可以在「已藏起來」救回）')) setPost(p.id, { status: 'hidden' }, '已藏起來');
      } }, '🙈 下架'));

      let stampBox = null;
      if (p.status === 'public') {
        const note = h('input', { type: 'text', maxlength: '100', placeholder: '例：11/30 已向市公所反映' });
        note.value = p.reflected_note || '';
        stampBox = h('div', { class: 'sub' },
          p.reflected_at ? h('div', { class: 'stamp' }, h('b', {}, '✅ 小人物已反映'), p.reflected_note || '', ' (' + when(p.reflected_at) + ')') : null,
          h('label', { class: 'field' }, p.reflected_at ? '修改說明' : '蓋「小人物已反映」章', note),
          h('div', { class: 'actions' },
            h('button', { class: 'btn primary small', onclick: () => {
              const v = note.value.trim();
              if (!v) { toast('請寫一句說明'); return; }
              setPost(p.id, { reflected_note: v, reflected_at: p.reflected_at || new Date().toISOString() }, '已蓋章');
            } }, p.reflected_at ? '更新說明' : '蓋章'),
            p.reflected_at ? h('button', { class: 'btn small', onclick: () => {
              if (confirm('確定要拿掉「小人物已反映」章嗎？')) setPost(p.id, { reflected_note: null, reflected_at: null }, '已拿掉章');
            } }, '拿掉章') : null));
      }

      const commentsBox = h('div', {});
      const showComments = p.status === 'public' && p.comment_count > 0
        ? h('button', { class: 'btn link small', onclick: async () => {
            const { data, error } = await sb.from('comments').select(COMMENT_COLS).eq('post_id', p.id).eq('status', 'public').order('created_at');
            if (error) { toast(errText(error)); return; }
            commentsBox.replaceChildren(h('div', { class: 'sub' }, data.map(cm => commentCard(cm, true))));
          } }, '看這篇的 ' + p.comment_count + ' 則留言')
        : null;

      return h('article', { class: 'card' },
        h('div', { class: 'meta' },
          h('span', { class: 'tag' }, c.icon + ' ' + c.name),
          h('span', {}, '📍 ' + p.village), h('span', {}, '市民 #' + p.citizen_no),
          h('span', {}, when(p.created_at)), h('a', { href: 'index.html#/post/' + p.id, target: '_blank' }, '#' + p.id)),
        p.hold_reason ? h('div', { class: 'reason' }, '原因：' + p.hold_reason) : null,
        p.report_count ? h('div', { class: 'reason' }, '被檢舉 ' + p.report_count + ' 次') : null,
        h('div', { class: 'body' }, p.body),
        url ? h('img', { class: 'photo', src: url, alt: '附圖' }) : (p.photo_path ? h('p', { class: 'hint' }, '（照片讀取失敗）') : null),
        h('div', { class: 'counts' }, h('span', {}, '🙋 ' + p.me_too_count), h('span', {}, '💬 ' + p.comment_count)),
        h('div', { class: 'actions' }, actions, showComments),
        commentsBox, stampBox);
    }

    function commentCard(cm, compact) {
      const actions = [];
      if (cm.status !== 'public') actions.push(h('button', { class: 'btn primary small', onclick: () => setComment(cm.id, { status: 'public', hold_reason: null }, '已放行公開') }, '✅ 放行'));
      if (cm.status !== 'hidden') actions.push(h('button', { class: 'btn small danger', onclick: () => {
        if (confirm('確定要把這則留言藏起來嗎？')) setComment(cm.id, { status: 'hidden' }, '已藏起來');
      } }, '🙈 下架'));
      const inner = [
        h('div', { class: 'meta' }, h('span', {}, '市民 #' + cm.citizen_no), h('span', {}, when(cm.created_at)),
          compact ? null : h('a', { href: 'index.html#/post/' + cm.post_id, target: '_blank' }, '在文章 #' + cm.post_id)),
        cm.hold_reason ? h('div', { class: 'reason' }, '原因：' + cm.hold_reason) : null,
        cm.report_count ? h('div', { class: 'reason' }, '被檢舉 ' + cm.report_count + ' 次') : null,
        h('div', { class: 'body' }, cm.body),
        h('div', { class: 'actions' }, actions)];
      return compact ? h('div', { class: 'comment' }, inner) : h('article', { class: 'card' }, inner);
    }

    render(
      h('div', { class: 'meta' }, h('span', {}, '已登入：' + (user.email || '')),
        h('button', { class: 'btn link small', onclick: async () => { await sb.auth.signOut(); start(); } }, '登出')),
      h('div', { class: 'tabs' }, tabBtns),
      body);
    load();
  }

  // ---------- 啟動 ----------
  async function start() {
    const { data } = await sb.auth.getSession();
    const session = data.session;
    if (!session || session.user.is_anonymous) { pageLogin(); return; }
    const { data: ok, error } = await sb.rpc('is_admin');
    if (error || !ok) {
      render(h('div', { class: 'card' },
        h('h1', {}, '登入成功，但還不是管理員'),
        h('p', {}, '已登入：' + (session.user.email || '')),
        h('p', { class: 'hint' }, '如果你是岳志，請跟小志說「登入好了」，小志把這個帳號設成管理員後，按下面的按鈕重新整理就能進來。'),
        h('div', { class: 'actions' },
          h('button', { class: 'btn primary', onclick: start }, '重新檢查'),
          h('button', { class: 'btn small', onclick: async () => { await sb.auth.signOut(); start(); } }, '登出'))));
      return;
    }
    pageAdmin(session.user);
  }
  sb.auth.onAuthStateChange((evt) => { if (evt === 'SIGNED_IN' && location.hash.includes('access_token')) history.replaceState(null, '', location.pathname); });
  start();
})();
