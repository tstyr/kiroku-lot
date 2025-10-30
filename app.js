// テスト点数記録アプリ（ローカルストレージ保存）
(() => {
  const APP_VERSION = 'v1.01';  // アプリケーションバージョン
  const LS_KEY = 'kiroku_lot_tests_v1';

  function uid() { return Math.random().toString(36).slice(2,9); }

  const els = {
    testSelect: null,
    addTestBtn: null,
    deleteTestBtn: null,
    newTestName: null,
    saveAsPrevBtn: null,
    exportBtn: null,
    importInput: null,
    boardTitle: null,
    scoreTableBody: null,
    totalScore: null,
    avgScore: null,
    newSubjectName: null,
    newSubjectScore: null,
    addSubjectBtn: null,
    shareBtn: null,
    shareLink: null,
    copyShareBtn: null,
    templateShareLink: null,
    copyTemplateShareBtn: null,
  showTemplateQRBtn: null,
  downloadTemplateQRBtn: null,
  templateQR: null,
    publishBtn: null,
    pasteShared: null,
    loadSharedBtn: null,
    saveSharedBtn: null,
    compareResult: null
  };

  let testRecords = [];
  let currentTestId = null;
  let templates = [];
  const TEMPLATE_LS_KEY = 'kiroku_lot_templates_v1';

  function $(id){ return document.getElementById(id); }

  function load(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      if(!raw) return createInitialSample();
      return JSON.parse(raw);
    }catch(e){ console.error('load error', e); return createInitialSample(); }
  }

  function loadTemplates() {
    try {
      const raw = localStorage.getItem(TEMPLATE_LS_KEY);
      if(!raw) return [];
      return JSON.parse(raw);
    } catch(e) {
      console.error('template load error', e);
      return [];
    }
  }

  function saveTemplates() {
    localStorage.setItem(TEMPLATE_LS_KEY, JSON.stringify(templates));
  }

  function saveAsTemplate() {
    const test = testRecords.find(t => t.id === currentTestId);
    if(!test) return alert('テンプレートとして保存するテストがありません');
    const name = prompt('テンプレート名を入力してください', test.name + 'のテンプレート');
    if(!name) return;
    
    const template = {
      id: uid(),
      name: name,
      subjects: test.subjects.map(s => ({name: s.name})) // 点数は含めない
    };
    
    templates.push(template);
    saveTemplates();
    alert('テンプレートを保存しました');
  }

  function applyTemplate(templateId) {
    const template = templates.find(t => t.id === templateId);
    if(!template) return;
    
    if(!currentTestId) {
      addTest('新しいテスト');
    }
    
    const test = testRecords.find(t => t.id === currentTestId);
    if(!test) return;
    
    // 既存の教科を保持しつつ、テンプレートの教科を追加
    template.subjects.forEach(subj => {
      if(!test.subjects.find(s => s.name === subj.name)) {
        test.subjects.push({name: subj.name, score: null});
      }
    });

    // テスト種類にもテンプレートの教科を自動追加
    const existingTestSelect = document.getElementById('newSubjectName');
    if(existingTestSelect) {
      template.subjects.forEach(subj => {
        const opt = document.createElement('option');
        opt.value = subj.name;
        opt.textContent = subj.name;
        if(!Array.from(existingTestSelect.options).find(o => o.value === subj.name)) {
          existingTestSelect.appendChild(opt);
        }
      });
    }
    
    save();
    renderBoard();
  }

  function shareTemplate(templateId) {
    const template = templates.find(t => t.id === templateId);
    if(!template) return alert('共有するテンプレートがありません');
    
    const payload = JSON.stringify(template);
    const encoded = utf8_to_b64(payload);
    const url = location.origin + location.pathname + '?template=' + encodeURIComponent(encoded);
    
    // set into template share input if present, otherwise fallback to generic shareLink
    if(els.templateShareLink) {
      els.templateShareLink.value = url;
    } else if(els.shareLink) {
      els.shareLink.value = url;
    }
    // 自動でQRも更新
    updateTemplateQR(url);
    return url;
  }

  function loadSharedTemplate() {
    const sp = new URLSearchParams(location.search).get('template');
    if(!sp) return null;
    try {
      const decoded = b64_to_utf8(decodeURIComponent(sp));
      return JSON.parse(decoded);
    } catch(e) {
      console.error('parseTemplateParam', e);
      return null;
    }
  }

  function copyTemplateShareLink(){
    const v = els.templateShareLink?.value;
    if(!v) return alert('先にテンプレートの共有リンクを作成してください');
    navigator.clipboard?.writeText(v).then(()=> alert('テンプレートリンクをコピーしました'))
      .catch(()=> alert('コピーに失敗しました。手動でコピーしてください'));
  }

  function updateTemplateQR(url){
    if(!els || !els.templateQR) return;
    if(!url){ els.templateQR.style.display = 'none'; els.templateQR.src = ''; return; }
    try{
      // Use a simple external QR API to generate an image; encode URI safely
      const encoded = encodeURIComponent(url);
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encoded}`;
      els.templateQR.src = qrUrl;
      els.templateQR.style.display = 'inline-block';
    }catch(e){ console.error('updateTemplateQR', e); }
  }

  function downloadTemplateQR(){
    const img = els.templateQR;
    if(!img || !img.src) return alert('QRが生成されていません');
    // download via opening a hidden link
    const a = document.createElement('a');
    a.href = img.src;
    a.download = 'template_qr.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function createInitialSample(){
    const sample = [{
      id: uid(),
      name: '定期テスト（サンプル）',
      subjects: [
        {name:'国語', score:80},
        {name:'数学', score:75},
        {name:'英語', score:88}
      ],
      previous: [
        {name:'国語', score:78},
        {name:'数学', score:70},
        {name:'英語', score:82}
      ]
    }];
    localStorage.setItem(LS_KEY, JSON.stringify(sample));
    return sample;
  }

  function save(){ localStorage.setItem(LS_KEY, JSON.stringify(testRecords)); }

  function refreshTestSelect(){
    els.testSelect.innerHTML = '';
    testRecords.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id; opt.textContent = t.name;
      els.testSelect.appendChild(opt);
    });
    if(!currentTestId && testRecords.length) currentTestId = testRecords[0].id;
    if(currentTestId) els.testSelect.value = currentTestId;
  }

  function renameCurrentTest() {
    const test = testRecords.find(t => t.id === currentTestId);
    if(!test) return alert('リネームするテストが選択されていません');
    const newName = prompt('新しいテスト名を入力してください', test.name);
    if(!newName || newName === test.name) return;
    test.name = newName;
    save();
    refreshTestSelect();
    renderBoard();
  }

  function renderBoard(){
    const test = testRecords.find(t=>t.id===currentTestId);
    if(!test) return;
    
    // 現在のテストに対応するテンプレートを探す
    const existingTemplate = templates.find(t => t.name === `${test.name}のテンプレート`);
    if(existingTemplate) {
      // テンプレートを更新
      existingTemplate.subjects = test.subjects.map(s => ({name: s.name}));
      saveTemplates();
      refreshTemplateSelect();
    }
  }

  function renderBoard(){
    const test = testRecords.find(t=>t.id===currentTestId);
    if(!test){
      els.boardTitle.textContent = '—';
      els.scoreTableBody.innerHTML = '';
      els.totalScore.textContent = '0';
      els.avgScore.textContent = '0';
      return;
    }
    els.boardTitle.textContent = test.name;
    els.scoreTableBody.innerHTML = '';

    const prevMap = new Map((test.previous||[]).map(s => [s.name, s.score]));

    test.subjects.forEach((sub, idx) => {
      const tr = document.createElement('tr');

      // 教科名
      const tdName = document.createElement('td');
      const nameInput = document.createElement('input');
      nameInput.value = sub.name;
      nameInput.addEventListener('change', e=>{
        sub.name = e.target.value.trim(); save(); renderBoard();
      });
      tdName.appendChild(nameInput);
      tr.appendChild(tdName);

      // 点数
      const tdScore = document.createElement('td');
      const scoreInput = document.createElement('input');
      scoreInput.type = 'number'; scoreInput.min = 0; scoreInput.max = 100;
      scoreInput.value = (typeof sub.score === 'number') ? sub.score : '';
      scoreInput.addEventListener('input', e=>{
        const v = e.target.value;
        sub.score = v === '' ? null : Number(v);
        save(); 
        updateTotals(test); 
        renderBoard();
        // 点数変更時に自動的に共有リンクを更新
        generateShareLink();
        // 比較データが入力されている場合は自動的に比較を更新
        const shared = loadSharedFromText(els.pasteShared.value);
        if(shared) renderComparison(shared);
      });
      tdScore.appendChild(scoreInput);
      tr.appendChild(tdScore);

      // 前回
      const tdPrev = document.createElement('td');
      const prevVal = prevMap.has(sub.name) ? prevMap.get(sub.name) : null;
      tdPrev.textContent = (prevVal === null || prevVal === undefined) ? '—' : prevVal;
      tr.appendChild(tdPrev);

      // 差分
      const tdDiff = document.createElement('td');
      if(prevVal !== null && prevVal !== undefined && sub.score != null){
        const diff = sub.score - prevVal;
        const span = document.createElement('span');
        span.textContent = (diff >= 0 ? `+${diff}` : diff);
        span.className = diff >= 0 ? 'delta-up' : 'delta-down';
        tdDiff.appendChild(span);
      } else { tdDiff.textContent = '—'; }
      tr.appendChild(tdDiff);

      // 操作
      const tdOps = document.createElement('td');
      const delBtn = document.createElement('button');
      delBtn.className = 'action-btn'; delBtn.textContent = '削除';
      delBtn.addEventListener('click', ()=>{
        if(!confirm(`教科「${sub.name}」を削除しますか？`)) return;
        test.subjects.splice(idx,1); save();
        updateCurrentTemplate(); // テンプレートを自動更新
        renderBoard();
      });
      tdOps.appendChild(delBtn);
      tr.appendChild(tdOps);

      els.scoreTableBody.appendChild(tr);
    });

    updateTotals(test);
    // グラフを描画（共有データがある場合は一緒に表示）
    const shared = loadSharedFromText(els.pasteShared?.value);
    drawChart(test, shared);
  }

  function updateTotals(test){
    const scores = test.subjects.map(s => (typeof s.score === 'number') ? s.score : null).filter(v=>v!==null);
    const total = scores.reduce((a,b)=>a+b,0);
    const avg = scores.length ? (total / scores.length) : 0;
    els.totalScore.textContent = Math.round(total * 100) / 100;
    els.avgScore.textContent = Math.round(avg * 100) / 100;
  }

  // --- グラフ描画 ---
  function drawChart(test, sharedTest){
    const canvas = document.getElementById('scoreChart');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    // サイズ調整（高DPR対応）
    const DPR = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(300, rect.width * DPR);
    canvas.height = Math.max(150, rect.height * DPR);
    ctx.scale(DPR, DPR);
    // 背景クリア
    ctx.clearRect(0,0,rect.width,rect.height);

    if(!test || !test.subjects || !test.subjects.length){
      ctx.fillStyle = '#334155'; ctx.font = '14px sans-serif';
      ctx.fillText('教科を追加するとグラフが表示されます', 10, 30);
      return;
    }

    // 教科名を統合（自分のと共有データの両方の教科を含める）
    const allSubjects = new Set([
      ...test.subjects.map(s => s.name),
      ...(sharedTest?.subjects || []).map(s => s.name)
    ]);

    const labels = Array.from(allSubjects);
    // 自分のデータ
    const curr = labels.map(name => {
      const sub = test.subjects.find(s => s.name === name);
      return sub && typeof sub.score === 'number' ? sub.score : null;
    });
    // 共有データ
    const shared = labels.map(name => {
      const sub = sharedTest?.subjects?.find(s => s.name === name);
      return sub && typeof sub.score === 'number' ? sub.score : null;
    });

    // 値の最大（100を上限にする）
    const maxVal = Math.max(100, 
      ...curr.filter(v=>v!=null),
      ...(shared ? shared.filter(v=>v!=null) : [])
    );

    const w = rect.width;
    const h = rect.height;
    const padding = {top:18, right:12, bottom:36, left:28};
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    // グラフの凡例
    ctx.fillStyle = '#475569';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    const legendY = padding.top - 4;
    ctx.fillText('あなた', w - 120, legendY);
    if(shared) {
      ctx.fillText('共有データ', w - 10, legendY);
    }

    // 軸描画（グリッド）
    ctx.strokeStyle = '#eef2ff'; ctx.lineWidth = 1;
    ctx.beginPath();
    const gridLines = 4;
    for(let i=0;i<=gridLines;i++){
      const y = padding.top + (chartH * i / gridLines);
      ctx.moveTo(padding.left, y); ctx.lineTo(padding.left + chartW, y);
    }
    ctx.stroke();

    // バー描画
    const barGroupW = chartW / labels.length;
    const barWidth = Math.min(48, barGroupW * 0.45);

    labels.forEach((lab, idx) => {
      const xCenter = padding.left + barGroupW * idx + barGroupW / 2;
      // 共有データ
      const sv = shared ? shared[idx] : null;
      if(sv != null){
        const sh = (sv / maxVal) * chartH;
        ctx.fillStyle = '#fca5a5';  // 薄い赤色
        ctx.fillRect(xCenter - barWidth - 4, padding.top + chartH - sh, barWidth, sh);
      }
      // 自分のデータ
      const cv = curr[idx];
      if(cv != null){
        const ch = (cv / maxVal) * chartH;
        // グラデーション風
        const grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
        grad.addColorStop(0, '#60a5fa'); grad.addColorStop(1, '#6ee7b7');
        ctx.fillStyle = grad;
        ctx.fillRect(xCenter + 4, padding.top + chartH - ch, barWidth, ch);
        // 値ラベル
        ctx.fillStyle = '#0f172a'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(String(cv), xCenter + 8, padding.top + chartH - ch - 6);
      }
      // xラベル
      ctx.fillStyle = '#475569'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
      const labelY = padding.top + chartH + 18;
      ctx.fillText(lab, xCenter + 8, labelY);
    });

    // y軸値（左）
    ctx.fillStyle = '#94a3b8'; ctx.font = '11px sans-serif'; ctx.textAlign = 'right';
    for(let i=0;i<=gridLines;i++){
      const val = Math.round(maxVal * (gridLines - i) / gridLines);
      const y = padding.top + (chartH * i / gridLines) + 4;
      ctx.fillText(String(val), padding.left - 8, y);
    }
  }

  function addTest(name){
    const t = {id: uid(), name: name || '無題', subjects: [], previous: []};
    testRecords.push(t); currentTestId = t.id; save(); refreshTestSelect(); renderBoard();
  }

  function deleteCurrentTest(){
    const idx = testRecords.findIndex(t=>t.id===currentTestId);
    if(idx===-1) return;
    if(!confirm(`テスト「${testRecords[idx].name}」を削除しますか？`)) return;
    testRecords.splice(idx,1);
    currentTestId = testRecords.length ? testRecords[0].id : null;
    save(); refreshTestSelect(); renderBoard();
  }

  function addSubjectToCurrent(name, score){
    const test = testRecords.find(t=>t.id===currentTestId);
    if(!test) return alert('先にテストを作成してください');
    test.subjects.push({name: name || '無題', score: score === '' ? null : (score==null ? null : Number(score))});
    save();
    updateCurrentTemplate(); // テンプレートを自動更新
    renderBoard();
  }

  function saveAsPrevious(){
    const test = testRecords.find(t=>t.id===currentTestId);
    if(!test) return;
    test.previous = test.subjects.map(s => ({name:s.name, score: s.score}));
    save(); renderBoard(); alert('現状を前回として保存しました');
  }

  function exportJSON(){
    const blob = new Blob([JSON.stringify(testRecords, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `testRecords_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  }

  // --- 共有 / 比較機能 ---
  function utf8_to_b64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }
  function b64_to_utf8(str) {
    return decodeURIComponent(escape(atob(str)));
  }

  function generateShareLink(){
    const test = testRecords.find(t=>t.id===currentTestId);
    if(!test) return alert('共有するテストがありません');
    // attach username if available
    const username = localStorage.getItem('kl_username') || null;
    const payloadObj = Object.assign({}, test, {username});
    const payload = JSON.stringify(payloadObj);
    const encoded = utf8_to_b64(payload);
    const url = location.origin + location.pathname + '?share=' + encodeURIComponent(encoded);
    els.shareLink.value = url;
    return url;
  }

  function copyShareLink(){
    const v = els.shareLink.value;
    if(!v) return alert('先に共有リンクを作成してください');
    navigator.clipboard?.writeText(v).then(()=> alert('リンクをコピーしました'))
      .catch(()=> alert('コピーに失敗しました。手動でコピーしてください'));
  }

  function parseSharedParam(){
    const sp = new URLSearchParams(location.search).get('share');
    if(!sp) return null;
    try{
      const decoded = b64_to_utf8(decodeURIComponent(sp));
      return JSON.parse(decoded);
    }catch(e){ console.error('parseSharedParam',e); return null; }
  }

  function loadSharedFromText(txt){
    if(!txt) return null;
    // if it looks like a URL with ?share=, extract
    try{
      if(txt.includes('?share=')){
        const u = new URL(txt.trim());
        const sp = u.searchParams.get('share');
        if(sp){ return JSON.parse(b64_to_utf8(decodeURIComponent(sp))); }
      }
    }catch(e){ /* not a URL */ }
    // try raw base64 or raw json
    try{
      // base64 attempt
      const maybe = txt.trim();
      if(maybe.startsWith('{') || maybe.startsWith('[')){
        return JSON.parse(maybe);
      }
      // try base64 decode -> json
      const dec = b64_to_utf8(maybe);
      return JSON.parse(dec);
    }catch(e){ console.error('loadSharedFromText', e); alert('共有データの形式が不正です'); return null; }
  }

  function renderComparison(shared){
    const test = testRecords.find(t=>t.id===currentTestId);
    const container = els.compareResult;
    if(!test){ container.innerHTML = '<div>現在のテストが選択されていません</div>'; return; }
    if(!shared){ container.innerHTML = '<div>共有データが読み込まれていません</div>'; return; }

    const prevMap = new Map((test.previous||[]).map(s=>[s.name,s.score]));
    const sharedPrevMap = new Map((shared.previous||[]).map(s=>[s.name,s.score]));

    // combine subject names from both
    const names = Array.from(new Set([...(test.subjects||[]).map(s=>s.name), ...(shared.subjects||[]).map(s=>s.name)]) );

    let html = '';
    html += `<table class="compare-table"><thead><tr><th>教科</th><th>あなた</th><th>共有者</th><th>差分</th></tr></thead><tbody>`;
    let totalA=0, countA=0, totalB=0, countB=0;
    names.forEach(name=>{
      const aSub = (test.subjects||[]).find(s=>s.name===name);
      const bSub = (shared.subjects||[]).find(s=>s.name===name);
      const a = aSub && typeof aSub.score==='number' ? aSub.score : null;
      const b = bSub && typeof bSub.score==='number' ? bSub.score : null;
      if(a!=null){ totalA+=a; countA++; }
      if(b!=null){ totalB+=b; countB++; }
      let diff = '—';
      if(a!=null && b!=null){ const d = a - b; diff = (d>=0?`+${d}`:d); }
      html += `<tr><td>${name}</td><td>${a==null?'—':a}</td><td>${b==null?'—':b}</td><td>${diff}</td></tr>`;
    });
    html += `</tbody></table>`;
    html += `<div class="compare-summary"><div class="badge">あなた 合計: ${Math.round(totalA*100)/100} 平均: ${countA?Math.round((totalA/countA)*100)/100:0}</div><div class="badge">共有者 合計: ${Math.round(totalB*100)/100} 平均: ${countB?Math.round((totalB/countB)*100)/100:0}</div></div>`;
    container.innerHTML = html;
    
    // 比較グラフを描画
    drawChart(test, shared);
  }

  function saveSharedAsTest(shared){
    if(!shared) return alert('保存するデータがありません');
    const name = prompt('保存するテスト名を入力してください', shared.name || '共有テスト');
    if(!name) return;
    const t = {id: uid(), name, subjects: shared.subjects || [], previous: shared.previous || []};
    testRecords.push(t); save(); refreshTestSelect(); alert('共有データをテストとして保存しました');
  }

  // Publish: open GitHub new issue page with payload in body (user will submit issue)
  function publishToIssue(){
    const test = testRecords.find(t=>t.id===currentTestId);
    if(!test) return alert('投稿するテストがありません');
    const username = localStorage.getItem('kl_username') || '';
    const payloadObj = Object.assign({}, test, {username});
    const body = encodeURIComponent('共有データ (JSON)\n\n' + JSON.stringify(payloadObj, null, 2));
    const title = encodeURIComponent(`[投稿] ${payloadObj.name || 'テスト' } by ${username || '名無し'}`);
    // Open GitHub issue new with prefilled title/body
    const url = `https://github.com/tstyr/kiroku-lot/issues/new?title=${title}&body=${body}`;
    window.open(url, '_blank');
  }

  function importJSON(file){
    const fr = new FileReader();
    fr.onload = () => {
      try{
        const parsed = JSON.parse(fr.result);
        if(!Array.isArray(parsed)) throw new Error('形式が不正です');
        parsed.forEach(t => { if(!t.id) t.id = uid(); testRecords.push(t); });
        save(); refreshTestSelect(); renderBoard(); alert('インポートが完了しました');
      }catch(e){ alert('インポートに失敗しました: ' + e.message); }
    };
    fr.readAsText(file);
  }

  function refreshTemplateSelect() {
    const select = els.templateSelect;
    select.innerHTML = '<option value="">テンプレートを選択...</option>';
    templates.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      select.appendChild(opt);
    });
  }

  function bind(){
    els.testSelect = $('testSelect');
    els.addTestBtn = $('addTestBtn');
    els.deleteTestBtn = $('deleteTestBtn');
    els.renameTestBtn = $('renameTestBtn');
    els.newTestName = $('newTestName');
    els.saveAsPrevBtn = $('saveAsPrevBtn');
    els.exportBtn = $('exportBtn');
    els.importInput = $('importInput');
    els.boardTitle = $('boardTitle');
    els.scoreTableBody = document.querySelector('#scoreTable tbody');
    els.totalScore = $('totalScore');
    els.avgScore = $('avgScore');
    els.newSubjectName = $('newSubjectName');
    els.newSubjectScore = $('newSubjectScore');
    els.addSubjectBtn = $('addSubjectBtn');
    els.templateSelect = $('templateSelect');
    els.saveTemplateBtn = $('saveTemplateBtn');
    els.applyTemplateBtn = $('applyTemplateBtn');
    els.shareTemplateBtn = $('shareTemplateBtn');
    els.templateShareLink = $('templateShareLink');
    els.copyTemplateShareBtn = $('copyTemplateShareBtn');
    els.showTemplateQRBtn = $('showTemplateQRBtn');
    els.downloadTemplateQRBtn = $('downloadTemplateQRBtn');
    els.templateQR = $('templateQR');
  // share / compare elements
  els.shareBtn = $('shareBtn');
  els.shareLink = $('shareLink');
  els.copyShareBtn = $('copyShareBtn');
  els.publishBtn = $('publishBtn');
  els.pasteShared = $('pasteShared');
  els.loadSharedBtn = $('loadSharedBtn');
  els.saveSharedBtn = $('saveSharedBtn');
  els.compareResult = $('compareResult');

    els.addTestBtn.addEventListener('click', ()=>{
      const name = els.newTestName.value.trim();
      addTest(name || `テスト ${testRecords.length+1}`);
      els.newTestName.value = '';
    });
    els.renameTestBtn.addEventListener('click', renameCurrentTest);
    els.deleteTestBtn.addEventListener('click', deleteCurrentTest);
    els.testSelect.addEventListener('change', e=>{ currentTestId = e.target.value; renderBoard(); });
    els.addSubjectBtn.addEventListener('click', ()=>{
      const name = els.newSubjectName.value.trim();
      const score = els.newSubjectScore.value;
      if(!name) return alert('教科名を入力してください');
      addSubjectToCurrent(name, score);
      els.newSubjectName.value = ''; els.newSubjectScore.value = '';
    });
    els.saveAsPrevBtn.addEventListener('click', saveAsPrevious);
    els.exportBtn.addEventListener('click', exportJSON);
    els.importInput.addEventListener('change', (e)=>{ const file = e.target.files[0]; if(file) importJSON(file); });
    // share / compare handlers
    if(els.shareBtn) els.shareBtn.addEventListener('click', ()=>{ generateShareLink(); });
    if(els.copyShareBtn) els.copyShareBtn.addEventListener('click', copyShareLink);
    if(els.publishBtn) els.publishBtn.addEventListener('click', publishToIssue);
    if(els.loadSharedBtn) els.loadSharedBtn.addEventListener('click', ()=>{
      const txt = els.pasteShared.value;
      const shared = loadSharedFromText(txt);
      if(shared) renderComparison(shared);
    });
    // 共有データが貼り付けられたら自動的に比較を実行
    if(els.pasteShared) els.pasteShared.addEventListener('input', ()=>{
      const txt = els.pasteShared.value;
      const shared = loadSharedFromText(txt);
      if(shared) renderComparison(shared);
    });
    if(els.saveSharedBtn) els.saveSharedBtn.addEventListener('click', ()=>{
      const txt = els.pasteShared.value;
      const shared = loadSharedFromText(txt);
      if(shared) saveSharedAsTest(shared);
    });

    // テンプレートセレクトで選択したら自動で共有リンクを生成
    if(els.templateSelect) els.templateSelect.addEventListener('change', (e) => {
      const tid = e.target.value;
      if(!tid){ if(els.templateShareLink) els.templateShareLink.value = ''; return; }
      shareTemplate(tid);
    });

    if(els.copyTemplateShareBtn) els.copyTemplateShareBtn.addEventListener('click', copyTemplateShareLink);
    if(els.showTemplateQRBtn) els.showTemplateQRBtn.addEventListener('click', ()=>{
      const link = els.templateShareLink?.value || els.shareLink?.value;
      if(!link) return alert('先にテンプレート共有リンクを生成してください');
      // toggle display (but update QR first)
      updateTemplateQR(link);
      els.templateQR.style.display = 'inline-block';
    });
    if(els.downloadTemplateQRBtn) els.downloadTemplateQRBtn.addEventListener('click', downloadTemplateQR);

    // テンプレート関連のイベントハンドラ
    els.saveTemplateBtn.addEventListener('click', saveAsTemplate);
    els.applyTemplateBtn.addEventListener('click', () => {
      const templateId = els.templateSelect.value;
      if(!templateId) return alert('テンプレートを選択してください');
      applyTemplate(templateId);
    });
    els.shareTemplateBtn.addEventListener('click', () => {
      const templateId = els.templateSelect.value;
      if(!templateId) return alert('テンプレートを選択してください');
      shareTemplate(templateId);
    });
  }

  // バージョン表示の更新
  function updateVersionLabel() {
    const versionLabel = document.getElementById('versionLabel');
    if (versionLabel) {
      versionLabel.textContent = APP_VERSION;
    }
  }

  // 初期化
  document.addEventListener('DOMContentLoaded', ()=>{
    testRecords = load();
    templates = loadTemplates();
    updateVersionLabel();
    if(testRecords.length) currentTestId = testRecords[0].id;
    bind(); refreshTestSelect(); refreshTemplateSelect(); renderBoard();
    // ウィンドウリサイズ時にグラフを再描画
    window.addEventListener('resize', ()=>{
      const test = testRecords.find(t=>t.id===currentTestId);
      drawChart(test);
    });
    window.addEventListener('beforeunload', ()=> save());
    // parse share and template params on load
    const sharedFromUrl = parseSharedParam();
    if(sharedFromUrl){
      const pasteEl = document.getElementById('pasteShared');
      if(pasteEl) pasteEl.value = JSON.stringify(sharedFromUrl, null, 2);
      renderComparison(sharedFromUrl);
    }

    // テンプレートの共有URLから読み込み
    const sharedTemplate = loadSharedTemplate();
    if(sharedTemplate){
      const confirmed = confirm(`共有されたテンプレート「${sharedTemplate.name}」を読み込みますか？`);
      if(confirmed){
        templates.push(sharedTemplate);
        saveTemplates();
        refreshTemplateSelect();
        alert('テンプレートを読み込みました');
      }
    }
  });

  // (完了) renderBoard で drawChart を直接呼び出すようにしました

})();
