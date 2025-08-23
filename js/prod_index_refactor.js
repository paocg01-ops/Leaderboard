<<<<<<< HEAD
/* File: prod_index.refactor.js   Purpose: Clean, single-source JS that restores search + modal from prototype,   removes hard-coded data coupling, and works with Supabase.   Drop this <script> after supabase-js and remove old duplicate inline scripts.      QA fixes in this revision:   - Current week: compute badges (earned) client-side and reflect in modal/rows.   - Last week: suppress motivational copy (only earned badges shown).   - Search: data-driven + deduped in active tab; correct single-result message;      highlight in both desktop + mobile without double counting.   - Magic cursor: lightweight init.   - Countdown + week progress: initialize + tick; support segmented UI (days/hours/minutes/seconds)     and #weekProgress/#progressPercentage.*/// ===== 0) SUPABASE CLIENT (reuse your prod keys via env/HTML) =====// IMPORTANT: If you already define `sb` elsewhere, remove it there and keep this one.const SUPABASE_URL = window.SUPABASE_URL || "https://dcxljettjctekbhxcyrw.supabase.co";const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjeGxqZXR0amN0ZWtiaHhjeXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzMDYyOTgsImV4cCI6MjA3MDg4MjI5OH0.X7OWTobYUQqKJA41BlozsMqqqRd_ndO-uh9gxRv9s7U";const sb = window.supabase?.createClient?.(SUPABASE_URL, SUPABASE_ANON_KEY);// ===== 1) HELPERS =====const $ = (id) => document.getElementById(id);const setText = (id, v) => { const el = $(id); if (el) el.textContent = v; };function fmt(n) { return Number(n || 0).toLocaleString(); }function trophyForRank(rank) {  if (rank === 1) return '<span class="trophy gold">­ƒÑç</span>';  if (rank === 2) return '<span class="trophy silver">­ƒÑê</span>';  if (rank === 3) return '<span class="trophy bronze">­ƒÑë</span>';  return '';}function deriveBadges(p) {  // thresholds  const chestHero = (p.treats || 0) >= 100;  const legend = (p.score || 0) >= 2000;  const consistent = (p.treats || 0) >= 70 && (p.score || 0) >= 1000;  let badges = '';  if (chestHero)  badges += '<span class="achievement-badge chest-hero">Chest Hero</span>';  if (legend)     badges += '<span class="achievement-badge score-legend">Legend</span>';  if (consistent) badges += '<span class="achievement-badge consistent-warrior">Consistent</span>';  return { badges, chestHero, legend, consistent };}function getActiveTabContainer() {  return document.querySelector('.tab-content.active') || document;}// ===== 2) RENDER (desktop rows + mobile cards) =====function renderLeaderboard(list, targetId) {  const host = $(targetId);  if (!host) return;  if (!Array.isArray(list) || list.length === 0) {    host.innerHTML = `      <div class="empty-state">        <h3>­ƒÄ» Ready for Battle!</h3>        <p>No data yet.</p>      </div>`;    return;  }  // context for click handlers + modal behavior  const context = targetId === 'leaderboardContentLast' ? 'last' : 'current';  const rowsHTML = list.map((p, i) => {    const r = Number(p.rank ?? i + 1);    const name = p.name ?? '';    const score = Number(p.score || 0);    const treats = Number(p.treats || 0);    const rankClass = r === 1 ? 'rank-1' : r === 2 ? 'rank-2' : r === 3 ? 'rank-3' : '';    const isTop3 = r <= 3;    const trophyHTML = p.trophyHTML || trophyForRank(r);    const badgesHTML = p.badgesHTML || '';    const badgeProgress = p.badgeProgress || '';    return `      <div class="player-row ${isTop3 ? 'top-3' : ''}"           data-context="${context}"           data-rank="${r}" data-name="${name.replace(/"/g, '&quot;')}"           data-score="${score}" data-chests="${treats}"           data-badges="${badgesHTML.replace(/"/g, '&quot;')}"           data-badge-progress="${badgeProgress.replace(/"/g, '&quot;')}">        <div class="rank ${rankClass}">#${r}</div>        <div class="player-name clickable-name">          <span class="clan-emblem">­ƒºü</span>          <span class="player-name-text">${name}</span>          ${trophyHTML}          ${badgesHTML}          ${badgeProgress ? `<span class="badge-progress">${badgeProgress}</span>` : ''}        </div>        <div class="stat score">Ô¡É ${fmt(score)}</div>        <div class="stat">­ƒì¬ ${fmt(treats)}</div>      </div>      <!-- Mobile card mirror -->      <div class="mobile-card"           data-context="${context}"           data-rank="${r}" data-name="${name.replace(/"/g, '&quot;')}"           data-score="${score}" data-chests="${treats}"           data-badges="${badgesHTML.replace(/"/g, '&quot;')}"           data-badge-progress="${badgeProgress.replace(/"/g, '&quot;')}">        <div class="mobile-card-row1">          <div class="mobile-rank ${rankClass}">#${r}</div>          <div class="mobile-name">${name} ${trophyHTML}</div>        </div>        <div class="mobile-card-row2">          <div class="mobile-badges">${badgesHTML}</div>          <div class="mobile-stats">            <div class="mobile-score">Ô¡É ${fmt(score)}</div>            <div class="mobile-chests">­ƒì¬ ${fmt(treats)}</div>          </div>        </div>      </div>`;  }).join('');  host.innerHTML = rowsHTML;  // Wire features AFTER rendering  setupSearch(list);  setupMobileCardHandlers();  setupDesktopRowHandlers();}// ===== 3) SEARCH (data-driven, active-tab, deduped) =====function setupSearch(players) {  const searchInput = $('nameSearch');  const clearBtn = $('clearBtn');  const searchResults = $('searchResults');  if (!searchInput || !searchResults) return;  function handle(term) {    const t = term.trim().toLowerCase();    if (t) {      if (clearBtn) clearBtn.style.display = 'flex';      performSearch(t, players);    } else {      if (clearBtn) clearBtn.style.display = 'none';      clearSearch();    }  }  // idempotent listeners  searchInput.oninput = (e) => handle(e.target.value || '');  searchInput.onkeypress = (e) => { if (e.key === 'Enter') handle(searchInput.value || ''); };  if (clearBtn) clearBtn.onclick = () => clearSearch();}function performSearch(searchTerm, players) {  const container = getActiveTabContainer();  const searchResults = $('searchResults');  if (!container || !searchResults) return;  // reset any previous highlights (rows)  const rows = container.querySelectorAll('.player-row');  rows.forEach(row => {    row.classList.remove('search-match');    const nameEl = row.querySelector('.player-name');    if (nameEl && nameEl.dataset.originalHtml) nameEl.innerHTML = nameEl.dataset.originalHtml;    else if (nameEl) nameEl.dataset.originalHtml = nameEl.innerHTML;  });  // reset mobile cards  const cards = container.querySelectorAll('.mobile-card');  cards.forEach(card => {    const nameEl = card.querySelector('.mobile-name');    if (nameEl && nameEl.dataset.originalText) nameEl.innerHTML = nameEl.dataset.originalText;    else if (nameEl) nameEl.dataset.originalText = nameEl.innerHTML;  });  // matches from DATA (deduped by name)  const matches = players.filter(p => (p.name || '').toLowerCase().includes(searchTerm));  if (matches.length === 0) {    searchResults.innerHTML = `­ƒÿö No players found matching "${searchTerm}"`;    return;  }  // highlight & maybe scroll  if (matches.length === 1) {    const name = matches[0].name;    const row = container.querySelector(`.player-row[data-name="${CSS.escape(name)}"]`);    const card = container.querySelector(`.mobile-card[data-name="${CSS.escape(name)}"]`);    // highlight desktop row name    if (row) {      const nameEl = row.querySelector('.player-name');      if (nameEl) {        if (!nameEl.dataset.originalHtml) nameEl.dataset.originalHtml = nameEl.innerHTML;        const rx = new RegExp(`(${searchTerm})`, 'gi');        nameEl.innerHTML = nameEl.innerHTML.replace(rx, '<span class="highlight-match">$1</span>');        row.classList.add('search-match');        setTimeout(() => row.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);      }    }    // highlight mobile card name too    if (card) {      const nameEl = card.querySelector('.mobile-name');      if (nameEl) {        if (!nameEl.dataset.originalText) nameEl.dataset.originalText = nameEl.innerHTML;        const rx = new RegExp(`(${searchTerm})`, 'gi');        nameEl.innerHTML = nameEl.innerHTML.replace(rx, '<span class="highlight-match">$1</span>');      }    }    // rank from row if present, else from data order (1-based)    let rank = 1 + players.findIndex(p => p.name === name);    if (row && row.dataset.rank) rank = Number(row.dataset.rank);    searchResults.innerHTML = `­ƒÄ» Found "${name}" at rank #${rank}!`;  } else {    // multiple    searchResults.innerHTML = `­ƒöì Found ${matches.length} players matching "${searchTerm}"`;    // light highlight all found    matches.forEach(m => {      const row = container.querySelector(`.player-row[data-name="${CSS.escape(m.name)}"]`);      const card = container.querySelector(`.mobile-card[data-name="${CSS.escape(m.name)}"]`);      if (row) {        const nameEl = row.querySelector('.player-name');        if (nameEl) {          if (!nameEl.dataset.originalHtml) nameEl.dataset.originalHtml = nameEl.innerHTML;          const rx = new RegExp(`(${searchTerm})`, 'gi');          nameEl.innerHTML = nameEl.innerHTML.replace(rx, '<span class="highlight-match">$1</span>');          row.classList.add('search-match');        }      }      if (card) {        const nameEl = card.querySelector('.mobile-name');        if (nameEl) {          if (!nameEl.dataset.originalText) nameEl.dataset.originalText = nameEl.innerHTML;          const rx = new RegExp(`(${searchTerm})`, 'gi');          nameEl.innerHTML = nameEl.innerHTML.replace(rx, '<span class="highlight-match">$1</span>');        }      }    });  }}function clearSearch() {  const searchInput = $('nameSearch');  const clearBtn = $('clearBtn');  const searchResults = $('searchResults');  const container = getActiveTabContainer();  if (searchInput) searchInput.value = '';  if (clearBtn) clearBtn.style.display = 'none';  if (searchResults) searchResults.innerHTML = '';  container.querySelectorAll('.player-row').forEach(row => {    row.classList.remove('search-match');    const nameEl = row.querySelector('.player-name');    if (nameEl && nameEl.dataset.originalHtml) nameEl.innerHTML = nameEl.dataset.originalHtml;  });  container.querySelectorAll('.mobile-card').forEach(card => {    const nameEl = card.querySelector('.mobile-name');    if (nameEl && nameEl.dataset.originalText) nameEl.innerHTML = nameEl.dataset.originalText;  });}// ===== 4) CLICK HANDLERS + MODAL =====function setupMobileCardHandlers() {  document.querySelectorAll('.mobile-card').forEach(card => {    card.onclick = () => {      const rank = Number(card.getAttribute('data-rank'));      const name = card.getAttribute('data-name') || '';      const score = Number(card.getAttribute('data-score')) || 0;      const chests = Number(card.getAttribute('data-chests')) || 0;      const badges = card.getAttribute('data-badges') || '';      const badgeProgress = card.getAttribute('data-badge-progress') || '';      const context = card.getAttribute('data-context') || 'current';      showPlayerModal(rank, name, score, chests, badges, badgeProgress, context);    };  });}function setupDesktopRowHandlers() {  document.querySelectorAll('.player-row').forEach(row => {    const nameEl = row.querySelector('.clickable-name');    if (!nameEl) return;    nameEl.style.cursor = 'pointer';    nameEl.onclick = (e) => {      e.stopPropagation();      const rank = Number(row.getAttribute('data-rank'));      const name = row.getAttribute('data-name') || '';      const score = Number(row.getAttribute('data-score')) || 0;      const chests = Number(row.getAttribute('data-chests')) || 0;      const badges = row.getAttribute('data-badges') || '';      const badgeProgress = row.getAttribute('data-badge-progress') || '';      const context = row.getAttribute('data-context') || 'current';      showPlayerModal(rank, name, score, chests, badges, badgeProgress, context);    };  });}function showPlayerModal(rank, playerName, score, chests, badges, badgeProgress, context = 'current') {  const modal = $('playerModal');  if (!modal) return;  const modalRank = $('modalRank');  const modalPlayerName = $('modalPlayerName');  const modalScore = $('modalScore');  const modalChests = $('modalChests');  const modalBadges = $('modalBadges');  const modalProgress = $('modalProgress');  if (modalRank) { modalRank.textContent = `#${rank}`; modalRank.className = `modal-rank ${rank <= 3 ? `rank-${rank}` : ''}`; }  if (modalPlayerName) modalPlayerName.textContent = playerName;  if (modalScore) modalScore.textContent = fmt(score);  if (modalChests) modalChests.textContent = fmt(chests);  if (modalBadges) modalBadges.innerHTML = badges || '<span style="opacity:.6;font-style:italic;">No badges earned yet</span>';  // Progress copy behavior depends on context  if (!modalProgress) {    // nothing to update  } else if (context === 'last') {    // Last week ÔåÆ no motivational copy    modalProgress.innerHTML = '';  } else {    // Current week ÔåÆ show progress, but mark Earned when thresholds met    let progressHTML = '<h4>­ƒÄ» Badge Progress</h4>';    const hasChestHero = (badges || '').includes('Chest Hero');    const hasLegend = (badges || '').includes('Legend');    const hasConsistent = (badges || '').includes('Consistent');    if (hasChestHero) {      progressHTML += '<div class="progress-item earned">­ƒì¬ <strong>Chest Hero</strong> - Ô£à Earned! (100+ chests)</div>';    } else {      const need = Math.max(0, 100 - chests);      progressHTML += `<div class="progress-item ${need===0?'earned':'needed'}">­ƒì¬ <strong>Chest Hero</strong> - ${need===0?'Ô£à Earned!':`Need ${need} more chests (currently ${fmt(chests)}/100)`}</div>`;    }    if (hasLegend) {      progressHTML += '<div class="progress-item earned">Ô¡É <strong>Legend</strong> - Ô£à Earned! (2000+ points)</div>';    } else {      const need = Math.max(0, 2000 - score);      progressHTML += `<div class="progress-item ${need===0?'earned':'needed'}">Ô¡É <strong>Legend</strong> - ${need===0?'Ô£à Earned!':`Need ${need} more points (currently ${fmt(score)}/2000)`}</div>`;    }    if (hasConsistent) {      progressHTML += '<div class="progress-item earned">­ƒÄ» <strong>Consistent</strong> - Ô£à Earned! (ÔëÑ70 chests & ÔëÑ1000 points)</div>';    } else {      const chN = Math.max(0, 70 - chests);      const ptN = Math.max(0, 1000 - score);      if (chN === 0 && ptN === 0) {        progressHTML += '<div class="progress-item earned">­ƒÄ» <strong>Consistent</strong> - Ô£à Earned!</div>';      } else if (chN === 0) {        progressHTML += `<div class="progress-item needed">­ƒÄ» <strong>Consistent</strong> - Need ${ptN} more points (chests: Ô£à ${fmt(chests)}/70, points: ${fmt(score)}/1000)</div>`;      } else if (ptN === 0) {        progressHTML += `<div class="progress-item needed">­ƒÄ» <strong>Consistent</strong> - Need ${chN} more chests (chests: ${fmt(chests)}/70, points: Ô£à ${fmt(score)}/1000)</div>`;      } else {        progressHTML += `<div class="progress-item needed">­ƒÄ» <strong>Consistent</strong> - Need ${chN} chests AND ${ptN} points (currently ${fmt(chests)}/70, ${fmt(score)}/1000)</div>`;      }    }    modalProgress.innerHTML = progressHTML;  }  modal.classList.add('active');  document.body.style.overflow = 'hidden'; // UX}function closePlayerModal() {  const modal = $('playerModal');  if (!modal) return;  modal.classList.remove('active');  document.body.style.overflow = '';}// click outside to closeaddEventListener('click', (e) => {  const modal = $('playerModal');  if (e.target === modal) closePlayerModal();});// ===== 5) DATA LOADERS =====async function loadCurrentWeek() {  const { data, error } = await sb    .from('players_current')    .select('name, score, treats, rank')    .order('score', { ascending: false });  if (error) { console.error('players_current error', error); return; }  const rows = (data || []).slice();  // decorate ranks + trophies  rows.sort((a,b)=> (b.score||0) - (a.score||0))      .forEach((p, idx) => { p.rank = idx + 1; p.trophyHTML = trophyForRank(p.rank); });  // derive badges for CURRENT WEEK (so modal shows Earned and rows show chips)  rows.forEach(p => {    const d = deriveBadges(p);    p.badgesHTML = d.badges;     // show chips    p.badgeProgress = '';        // keep rows/cards clean; progress only in modal  });  // KPIs  const total = rows.length;  const avgTreats = total ? Math.round(rows.reduce((a,b)=>a+(b.treats||0),0)/total) : 0;  const avgScore  = total ? Math.round(rows.reduce((a,b)=>a+(b.score||0),0)/total)  : 0;  setText('totalWarriors', total);  setText('totalChests',  avgTreats);  setText('totalScore',   avgScore);  renderLeaderboard(rows, 'leaderboardContent');}async function loadLastWeek() {  const { data, error } = await sb    .from('players_last')    .select('name, score, treats, rank')    .order('score', { ascending: false });  if (error) { console.error('players_last error', error); return; }  const rows = (data || []).slice();  // ONLY earned badges; no motivational copy for last week  rows.forEach(p => {    const d = deriveBadges(p);    p.badgesHTML = d.badges;    p.badgeProgress = '';  });  renderLeaderboard(rows, 'leaderboardContentLast');  // KPIs text  if (!rows.length) {    setText('lastWeekWinner', 'ÔÇö');    setText('lastWeekParticipants', '0');    setText('lastWeekTopScore', '0');  } else {    setText('lastWeekWinner', rows[0].name);    setText('lastWeekParticipants', rows.length);    const maxScore = Math.max(...rows.map(p => Number(p.score)||0));    setText('lastWeekTopScore', fmt(maxScore));  }}// ===== 6) WEEK CYCLES + COUNTDOWN + PROGRESS =====function calculateWeekCycles() {  try {    const now = new Date();    const mexicoTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Mexico_City" }));    let currentWeekStart = new Date(mexicoTime);    let currentWeekEnd = new Date(mexicoTime);    const currentDay = mexicoTime.getDay();    const currentHour = mexicoTime.getHours();    const currentMinute = mexicoTime.getMinutes();    if (currentDay === 0) { // Sunday      if (currentHour < 11) {        currentWeekStart.setDate(currentWeekStart.getDate() - 7);        currentWeekStart.setHours(11, 0, 0, 0);        currentWeekEnd.setHours(10, 59, 59, 999);      } else {        currentWeekStart.setHours(11, 0, 0, 0);        currentWeekEnd.setDate(currentWeekEnd.getDate() + 7);        currentWeekEnd.setHours(10, 59, 59, 999);      }    } else {      const daysFromLastSunday = currentDay;      currentWeekStart.setDate(currentWeekStart.getDate() - daysFromLastSunday);      currentWeekStart.setHours(11, 0, 0, 0);      const daysUntilNextSunday = 7 - currentDay;      currentWeekEnd.setDate(currentWeekEnd.getDate() + daysUntilNextSunday);      currentWeekEnd.setHours(10, 59, 59, 999);    }    const lastWeekStart = new Date(currentWeekStart.getTime() - (7 * 24 * 60 * 60 * 1000));    const lastWeekEnd = new Date(currentWeekStart.getTime() - 1);    const fmtOpt = { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Mexico_City' };    const currentCycleText = `${currentWeekStart.toLocaleDateString('en-US', fmtOpt)} - ${currentWeekEnd.toLocaleDateString('en-US', fmtOpt)}`;    const lastCycleText = `${lastWeekStart.toLocaleDateString('en-US', fmtOpt)} - ${lastWeekEnd.toLocaleDateString('en-US', fmtOpt)}`;    const currentCycleDates = $('currentCycleDates');    const lastCycleDates = $('lastCycleDates');    if (currentCycleDates) currentCycleDates.textContent = currentCycleText;    if (lastCycleDates) lastCycleDates.textContent = lastCycleText;    return { current: { start: currentWeekStart, end: currentWeekEnd }, last: { start: lastWeekStart, end: lastWeekEnd } };  } catch (e) {    console.error('Week cycle calculation error:', e);    const currentCycleDates = $('currentCycleDates');    const lastCycleDates = $('lastCycleDates');    if (currentCycleDates) currentCycleDates.textContent = 'Error calculating current cycle';    if (lastCycleDates) lastCycleDates.textContent = 'Error calculating last cycle';    return null;  }}function updateCountdown() {  try {    const now = new Date();    const mexicoTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Mexico_City" }));    let nextSunday = new Date(mexicoTime);    const currentDay = mexicoTime.getDay();    if (currentDay === 0) {      const h = mexicoTime.getHours();      const m = mexicoTime.getMinutes();      if (h < 10 || (h === 10 && m < 59)) {        nextSunday.setHours(10, 59, 0, 0);      } else {        nextSunday.setDate(nextSunday.getDate() + 7);        nextSunday.setHours(10, 59, 0, 0);      }    } else {      const daysUntilSunday = 7 - currentDay;      nextSunday.setDate(nextSunday.getDate() + daysUntilSunday);      nextSunday.setHours(10, 59, 0, 0);    }    const diff = nextSunday.getTime() - mexicoTime.getTime();    // Support two UIs: a single #countdown element or a segmented #countdownDisplay with #days/#hours/#minutes/#seconds    const single = document.getElementById('countdown');    const segmented = document.getElementById('countdownDisplay');    if (diff > 0) {      const d = Math.floor(diff / (24*60*60*1000));      const h = Math.floor((diff % (24*60*60*1000)) / (60*60*1000));      const m = Math.floor((diff % (60*60*1000)) / (60*1000));      const s = Math.floor((diff % (60*1000)) / 1000);      if (single) single.textContent = `${d}d ${h}h ${m}m ${s}s`;      if (segmented) {        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = String(val).padStart(2, '0'); };        set('days', d);        set('hours', h);        set('minutes', m);        set('seconds', s);      }    } else {      if (single) single.textContent = 'Cycle ended';      if (segmented) ['days','hours','minutes','seconds'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '00'; });    }  } catch (e) {    console.error('Countdown error', e);  }}function updateWeekProgress() {  try {    const cycle = window.__weekCycles?.current;    if (!cycle) return;    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));    const total = cycle.end.getTime() - cycle.start.getTime();    const elapsed = Math.max(0, Math.min(total, now.getTime() - cycle.start.getTime()));    const pct = total > 0 ? Math.floor((elapsed / total) * 100) : 0;    const bar = document.getElementById('weekProgress');    const label = document.getElementById('progressPercentage');    if (bar) bar.style.width = `${pct}%`;    if (label) label.textContent = `${pct}%`;  } catch (e) { console.error('Week progress error', e); }}// ===== 7) MAGIC CURSOR (lightweight) =====function initMagicCursor() {  if ('ontouchstart' in window) return; // avoid on touch devices  if (document.querySelector('.magic-cursor')) return;  const dot = document.createElement('div');  dot.className = 'magic-cursor';  Object.assign(dot.style, {    position: 'fixed', left: '0px', top: '0px', width: '14px', height: '14px',    borderRadius: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none',    zIndex: 9999, background: 'rgba(255,255,255,0.6)', boxShadow: '0 0 12px rgba(255,255,255,0.6)'  });  document.body.appendChild(dot);  window.addEventListener('mousemove', (e) => {    dot.style.left = e.clientX + 'px';    dot.style.top  = e.clientY + 'px';  }, { passive: true });}// ===== 8) TABS =====function showTab(tabName) {  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));  const tab = document.getElementById(`${tabName}-tab`);  if (tab) tab.classList.add('active');  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset?.tab === tabName || btn.textContent?.trim()?.includes(tabName)));  document.querySelectorAll('.leaderboard-only').forEach(el => { el.style.display = (tabName === 'leaderboard') ? '' : 'none'; });  if (tabName === 'leaderboard') loadCurrentWeek();  if (tabName === 'lastweek') loadLastWeek();}// ===== 9) BOOT =====document.addEventListener('DOMContentLoaded', () => {  window.__weekCycles = calculateWeekCycles();  updateCountdown();  updateWeekProgress();  setInterval(() => { updateCountdown(); updateWeekProgress(); }, 1000);  initMagicCursor();  // default tab  showTab('leaderboard');});
=======
/* File: prod_index.refactor.js
   Purpose: Clean, single-source JS that restores search + modal from prototype,
   removes hard-coded data coupling, and works with Supabase.
   Drop this <script> after supabase-js and remove old duplicate inline scripts.
   
   QA fixes in this revision:
   - Current week: compute badges (earned) client-side and reflect in modal/rows.
   - Last week: suppress motivational copy (only earned badges shown).
   - Search: data-driven + deduped in active tab; correct single-result message; 
     highlight in both desktop + mobile without double counting.
   - Magic cursor: lightweight init.
   - Countdown + week progress: initialize + tick; support segmented UI (days/hours/minutes/seconds)
     and #weekProgress/#progressPercentage.
*/

// ===== 0) SUPABASE CLIENT (reuse your prod keys via env/HTML) =====
// IMPORTANT: If you already define `sb` elsewhere, remove it there and keep this one.
const SUPABASE_URL = window.SUPABASE_URL || "https://dcxljettjctekbhxcyrw.supabase.co";
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjeGxqZXR0amN0ZWtiaHhjeXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzMDYyOTgsImV4cCI6MjA3MDg4MjI5OH0.X7OWTobYUQqKJA41BlozsMqqqRd_ndO-uh9gxRv9s7U";
const sb = window.supabase?.createClient?.(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== 1) HELPERS =====
const $ = (id) => document.getElementById(id);
const setText = (id, v) => { const el = $(id); if (el) el.textContent = v; };

function fmt(n) { return Number(n || 0).toLocaleString(); }

function trophyForRank(rank) {
  if (rank === 1) return '<span class="trophy gold">🥇</span>';
  if (rank === 2) return '<span class="trophy silver">🥈</span>';
  if (rank === 3) return '<span class="trophy bronze">🥉</span>';
  return '';
}

function deriveBadges(p) {
  // thresholds
  const chestHero = (p.treats || 0) >= 100;
  const legend = (p.score || 0) >= 2000;
  const consistent = (p.treats || 0) >= 70 && (p.score || 0) >= 1000;
  let badges = '';
  if (chestHero)  badges += '<span class="achievement-badge chest-hero">Chest Hero</span>';
  if (legend)     badges += '<span class="achievement-badge score-legend">Legend</span>';
  if (consistent) badges += '<span class="achievement-badge consistent-warrior">Consistent</span>';
  return { badges, chestHero, legend, consistent };
}

function getActiveTabContainer() {
  return document.querySelector('.tab-content.active') || document;
}

// ===== 2) RENDER (desktop rows + mobile cards) =====
function renderLeaderboard(list, targetId) {
  const host = $(targetId);
  if (!host) return;
  if (!Array.isArray(list) || list.length === 0) {
    host.innerHTML = `
      <div class="empty-state">
        <h3>🎯 Ready for Battle!</h3>
        <p>No data yet.</p>
      </div>`;
    return;
  }

  // context for click handlers + modal behavior
  const context = targetId === 'leaderboardContentLast' ? 'last' : 'current';

  const rowsHTML = list.map((p, i) => {
    const r = Number(p.rank ?? i + 1);
    const name = p.name ?? '';
    const score = Number(p.score || 0);
    const treats = Number(p.treats || 0);
    const rankClass = r === 1 ? 'rank-1' : r === 2 ? 'rank-2' : r === 3 ? 'rank-3' : '';
    const isTop3 = r <= 3;
    const trophyHTML = p.trophyHTML || trophyForRank(r);
    const badgesHTML = p.badgesHTML || '';
    const badgeProgress = p.badgeProgress || '';

    return `
      <div class="player-row ${isTop3 ? 'top-3' : ''}"
           data-context="${context}"
           data-rank="${r}" data-name="${name.replace(/"/g, '&quot;')}"
           data-score="${score}" data-chests="${treats}"
           data-badges="${badgesHTML.replace(/"/g, '&quot;')}"
           data-badge-progress="${badgeProgress.replace(/"/g, '&quot;')}">
        <div class="rank ${rankClass}">#${r}</div>
        <div class="player-name clickable-name">
          <span class="clan-emblem">🧁</span>
          <span class="player-name-text">${name}</span>
          ${trophyHTML}
          ${badgesHTML}
          ${badgeProgress ? `<span class="badge-progress">${badgeProgress}</span>` : ''}
        </div>
        <div class="stat score">⭐ ${fmt(score)}</div>
        <div class="stat">🍪 ${fmt(treats)}</div>
      </div>
      <!-- Mobile card mirror -->
      <div class="mobile-card"
           data-context="${context}"
           data-rank="${r}" data-name="${name.replace(/"/g, '&quot;')}"
           data-score="${score}" data-chests="${treats}"
           data-badges="${badgesHTML.replace(/"/g, '&quot;')}"
           data-badge-progress="${badgeProgress.replace(/"/g, '&quot;')}">
        <div class="mobile-card-row1">
          <div class="mobile-rank ${rankClass}">#${r}</div>
          <div class="mobile-name">${name} ${trophyHTML}</div>
        </div>
        <div class="mobile-card-row2">
          <div class="mobile-badges">${badgesHTML}</div>
          <div class="mobile-stats">
            <div class="mobile-score">⭐ ${fmt(score)}</div>
            <div class="mobile-chests">🍪 ${fmt(treats)}</div>
          </div>
        </div>
      </div>`;
  }).join('');

  host.innerHTML = rowsHTML;

  // Wire features AFTER rendering
  setupSearch(list);
  setupMobileCardHandlers();
  setupDesktopRowHandlers();
}

// ===== 3) SEARCH (data-driven, active-tab, deduped) =====
function setupSearch(players) {
  const searchInput = $('nameSearch');
  const clearBtn = $('clearBtn');
  const searchResults = $('searchResults');
  if (!searchInput || !searchResults) return;

  function handle(term) {
    const t = term.trim().toLowerCase();
    if (t) {
      if (clearBtn) clearBtn.style.display = 'flex';
      performSearch(t, players);
    } else {
      if (clearBtn) clearBtn.style.display = 'none';
      clearSearch();
    }
  }

  // idempotent listeners
  searchInput.oninput = (e) => handle(e.target.value || '');
  searchInput.onkeypress = (e) => { if (e.key === 'Enter') handle(searchInput.value || ''); };
  if (clearBtn) clearBtn.onclick = () => clearSearch();
}

function performSearch(searchTerm, players) {
  const container = getActiveTabContainer();
  const searchResults = $('searchResults');
  if (!container || !searchResults) return;

  // reset any previous highlights (rows)
  const rows = container.querySelectorAll('.player-row');
  rows.forEach(row => {
    row.classList.remove('search-match');
    const nameEl = row.querySelector('.player-name');
    if (nameEl && nameEl.dataset.originalHtml) nameEl.innerHTML = nameEl.dataset.originalHtml;
    else if (nameEl) nameEl.dataset.originalHtml = nameEl.innerHTML;
  });
  // reset mobile cards
  const cards = container.querySelectorAll('.mobile-card');
  cards.forEach(card => {
    const nameEl = card.querySelector('.mobile-name');
    if (nameEl && nameEl.dataset.originalText) nameEl.innerHTML = nameEl.dataset.originalText;
    else if (nameEl) nameEl.dataset.originalText = nameEl.innerHTML;
  });

  // matches from DATA (deduped by name)
  const matches = players.filter(p => (p.name || '').toLowerCase().includes(searchTerm));

  if (matches.length === 0) {
    searchResults.innerHTML = `😔 No players found matching "${searchTerm}"`;
    return;
  }

  // highlight & maybe scroll
  if (matches.length === 1) {
    const name = matches[0].name;
    const row = container.querySelector(`.player-row[data-name="${CSS.escape(name)}"]`);
    const card = container.querySelector(`.mobile-card[data-name="${CSS.escape(name)}"]`);

    // highlight desktop row name
    if (row) {
      const nameEl = row.querySelector('.player-name');
      if (nameEl) {
        if (!nameEl.dataset.originalHtml) nameEl.dataset.originalHtml = nameEl.innerHTML;
        const rx = new RegExp(`(${searchTerm})`, 'gi');
        nameEl.innerHTML = nameEl.innerHTML.replace(rx, '<span class="highlight-match">$1</span>');
        row.classList.add('search-match');
        setTimeout(() => row.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
      }
    }
    // highlight mobile card name too
    if (card) {
      const nameEl = card.querySelector('.mobile-name');
      if (nameEl) {
        if (!nameEl.dataset.originalText) nameEl.dataset.originalText = nameEl.innerHTML;
        const rx = new RegExp(`(${searchTerm})`, 'gi');
        nameEl.innerHTML = nameEl.innerHTML.replace(rx, '<span class="highlight-match">$1</span>');
      }
    }

    // rank from row if present, else from data order (1-based)
    let rank = 1 + players.findIndex(p => p.name === name);
    if (row && row.dataset.rank) rank = Number(row.dataset.rank);
    searchResults.innerHTML = `🎯 Found "${name}" at rank #${rank}!`;
  } else {
    // multiple
    searchResults.innerHTML = `🔍 Found ${matches.length} players matching "${searchTerm}"`;
    // light highlight all found
    matches.forEach(m => {
      const row = container.querySelector(`.player-row[data-name="${CSS.escape(m.name)}"]`);
      const card = container.querySelector(`.mobile-card[data-name="${CSS.escape(m.name)}"]`);
      if (row) {
        const nameEl = row.querySelector('.player-name');
        if (nameEl) {
          if (!nameEl.dataset.originalHtml) nameEl.dataset.originalHtml = nameEl.innerHTML;
          const rx = new RegExp(`(${searchTerm})`, 'gi');
          nameEl.innerHTML = nameEl.innerHTML.replace(rx, '<span class="highlight-match">$1</span>');
          row.classList.add('search-match');
        }
      }
      if (card) {
        const nameEl = card.querySelector('.mobile-name');
        if (nameEl) {
          if (!nameEl.dataset.originalText) nameEl.dataset.originalText = nameEl.innerHTML;
          const rx = new RegExp(`(${searchTerm})`, 'gi');
          nameEl.innerHTML = nameEl.innerHTML.replace(rx, '<span class="highlight-match">$1</span>');
        }
      }
    });
  }
}

function clearSearch() {
  const searchInput = $('nameSearch');
  const clearBtn = $('clearBtn');
  const searchResults = $('searchResults');
  const container = getActiveTabContainer();
  if (searchInput) searchInput.value = '';
  if (clearBtn) clearBtn.style.display = 'none';
  if (searchResults) searchResults.innerHTML = '';
  container.querySelectorAll('.player-row').forEach(row => {
    row.classList.remove('search-match');
    const nameEl = row.querySelector('.player-name');
    if (nameEl && nameEl.dataset.originalHtml) nameEl.innerHTML = nameEl.dataset.originalHtml;
  });
  container.querySelectorAll('.mobile-card').forEach(card => {
    const nameEl = card.querySelector('.mobile-name');
    if (nameEl && nameEl.dataset.originalText) nameEl.innerHTML = nameEl.dataset.originalText;
  });
}

// ===== 4) CLICK HANDLERS + MODAL =====
function setupMobileCardHandlers() {
  document.querySelectorAll('.mobile-card').forEach(card => {
    card.onclick = () => {
      const rank = Number(card.getAttribute('data-rank'));
      const name = card.getAttribute('data-name') || '';
      const score = Number(card.getAttribute('data-score')) || 0;
      const chests = Number(card.getAttribute('data-chests')) || 0;
      const badges = card.getAttribute('data-badges') || '';
      const badgeProgress = card.getAttribute('data-badge-progress') || '';
      const context = card.getAttribute('data-context') || 'current';
      showPlayerModal(rank, name, score, chests, badges, badgeProgress, context);
    };
  });
}

function setupDesktopRowHandlers() {
  document.querySelectorAll('.player-row').forEach(row => {
    const nameEl = row.querySelector('.clickable-name');
    if (!nameEl) return;
    nameEl.style.cursor = 'pointer';
    nameEl.onclick = (e) => {
      e.stopPropagation();
      const rank = Number(row.getAttribute('data-rank'));
      const name = row.getAttribute('data-name') || '';
      const score = Number(row.getAttribute('data-score')) || 0;
      const chests = Number(row.getAttribute('data-chests')) || 0;
      const badges = row.getAttribute('data-badges') || '';
      const badgeProgress = row.getAttribute('data-badge-progress') || '';
      const context = row.getAttribute('data-context') || 'current';
      showPlayerModal(rank, name, score, chests, badges, badgeProgress, context);
    };
  });
}

function showPlayerModal(rank, playerName, score, chests, badges, badgeProgress, context = 'current') {
  const modal = $('playerModal');
  if (!modal) return;
  const modalRank = $('modalRank');
  const modalPlayerName = $('modalPlayerName');
  const modalScore = $('modalScore');
  const modalChests = $('modalChests');
  const modalBadges = $('modalBadges');
  const modalProgress = $('modalProgress');

  if (modalRank) { modalRank.textContent = `#${rank}`; modalRank.className = `modal-rank ${rank <= 3 ? `rank-${rank}` : ''}`; }
  if (modalPlayerName) modalPlayerName.textContent = playerName;
  if (modalScore) modalScore.textContent = fmt(score);
  if (modalChests) modalChests.textContent = fmt(chests);
  if (modalBadges) modalBadges.innerHTML = badges || '<span style="opacity:.6;font-style:italic;">No badges earned yet</span>';

  // Progress copy behavior depends on context
  if (!modalProgress) {
    // nothing to update
  } else if (context === 'last') {
    // Last week → no motivational copy
    modalProgress.innerHTML = '';
  } else {
    // Current week → show progress, but mark Earned when thresholds met
    let progressHTML = '<h4>🎯 Badge Progress</h4>';
    const hasChestHero = (badges || '').includes('Chest Hero');
    const hasLegend = (badges || '').includes('Legend');
    const hasConsistent = (badges || '').includes('Consistent');

    if (hasChestHero) {
      progressHTML += '<div class="progress-item earned">🍪 <strong>Chest Hero</strong> - ✅ Earned! (100+ chests)</div>';
    } else {
      const need = Math.max(0, 100 - chests);
      progressHTML += `<div class="progress-item ${need===0?'earned':'needed'}">🍪 <strong>Chest Hero</strong> - ${need===0?'✅ Earned!':`Need ${need} more chests (currently ${fmt(chests)}/100)`}</div>`;
    }

    if (hasLegend) {
      progressHTML += '<div class="progress-item earned">⭐ <strong>Legend</strong> - ✅ Earned! (2000+ points)</div>';
    } else {
      const need = Math.max(0, 2000 - score);
      progressHTML += `<div class="progress-item ${need===0?'earned':'needed'}">⭐ <strong>Legend</strong> - ${need===0?'✅ Earned!':`Need ${need} more points (currently ${fmt(score)}/2000)`}</div>`;
    }

    if (hasConsistent) {
      progressHTML += '<div class="progress-item earned">🎯 <strong>Consistent</strong> - ✅ Earned! (≥70 chests & ≥1000 points)</div>';
    } else {
      const chN = Math.max(0, 70 - chests);
      const ptN = Math.max(0, 1000 - score);
      if (chN === 0 && ptN === 0) {
        progressHTML += '<div class="progress-item earned">🎯 <strong>Consistent</strong> - ✅ Earned!</div>';
      } else if (chN === 0) {
        progressHTML += `<div class="progress-item needed">🎯 <strong>Consistent</strong> - Need ${ptN} more points (chests: ✅ ${fmt(chests)}/70, points: ${fmt(score)}/1000)</div>`;
      } else if (ptN === 0) {
        progressHTML += `<div class="progress-item needed">🎯 <strong>Consistent</strong> - Need ${chN} more chests (chests: ${fmt(chests)}/70, points: ✅ ${fmt(score)}/1000)</div>`;
      } else {
        progressHTML += `<div class="progress-item needed">🎯 <strong>Consistent</strong> - Need ${chN} chests AND ${ptN} points (currently ${fmt(chests)}/70, ${fmt(score)}/1000)</div>`;
      }
    }
    modalProgress.innerHTML = progressHTML;
  }

  modal.classList.add('active');
  document.body.style.overflow = 'hidden'; // UX
}

function closePlayerModal() {
  const modal = $('playerModal');
  if (!modal) return;
  modal.classList.remove('active');
  document.body.style.overflow = '';
}

// click outside to close
addEventListener('click', (e) => {
  const modal = $('playerModal');
  if (e.target === modal) closePlayerModal();
});

// ===== 5) DATA LOADERS =====
async function loadCurrentWeek() {
  const { data, error } = await sb
    .from('players_current')
    .select('name, score, treats, rank')
    .order('score', { ascending: false });
  if (error) { console.error('players_current error', error); return; }
  const rows = (data || []).slice();

  // decorate ranks + trophies
  rows.sort((a,b)=> (b.score||0) - (a.score||0))
      .forEach((p, idx) => { p.rank = idx + 1; p.trophyHTML = trophyForRank(p.rank); });

  // derive badges for CURRENT WEEK (so modal shows Earned and rows show chips)
  rows.forEach(p => {
    const d = deriveBadges(p);
    p.badgesHTML = d.badges;     // show chips
    p.badgeProgress = '';        // keep rows/cards clean; progress only in modal
  });

  // KPIs
  const total = rows.length;
  const avgTreats = total ? Math.round(rows.reduce((a,b)=>a+(b.treats||0),0)/total) : 0;
  const avgScore  = total ? Math.round(rows.reduce((a,b)=>a+(b.score||0),0)/total)  : 0;
  setText('totalWarriors', total);
  setText('totalChests',  avgTreats);
  setText('totalScore',   avgScore);

  renderLeaderboard(rows, 'leaderboardContent');
}

async function loadLastWeek() {
  const { data, error } = await sb
    .from('players_last')
    .select('name, score, treats, rank')
    .order('score', { ascending: false });
  if (error) { console.error('players_last error', error); return; }
  const rows = (data || []).slice();

  // ONLY earned badges; no motivational copy for last week
  rows.forEach(p => {
    const d = deriveBadges(p);
    p.badgesHTML = d.badges;
    p.badgeProgress = '';
  });

  renderLeaderboard(rows, 'leaderboardContentLast');

  // KPIs text
  if (!rows.length) {
    setText('lastWeekWinner', '—');
    setText('lastWeekParticipants', '0');
    setText('lastWeekTopScore', '0');
  } else {
    setText('lastWeekWinner', rows[0].name);
    setText('lastWeekParticipants', rows.length);
    const maxScore = Math.max(...rows.map(p => Number(p.score)||0));
    setText('lastWeekTopScore', fmt(maxScore));
  }
}

// ===== 6) WEEK CYCLES + COUNTDOWN + PROGRESS =====
function calculateWeekCycles() {
  try {
    const now = new Date();
    const mexicoTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
    let currentWeekStart = new Date(mexicoTime);
    let currentWeekEnd = new Date(mexicoTime);
    const currentDay = mexicoTime.getDay();
    const currentHour = mexicoTime.getHours();
    const currentMinute = mexicoTime.getMinutes();

    if (currentDay === 0) { // Sunday
      if (currentHour < 11) {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        currentWeekStart.setHours(11, 0, 0, 0);
        currentWeekEnd.setHours(10, 59, 59, 999);
      } else {
        currentWeekStart.setHours(11, 0, 0, 0);
        currentWeekEnd.setDate(currentWeekEnd.getDate() + 7);
        currentWeekEnd.setHours(10, 59, 59, 999);
      }
    } else {
      const daysFromLastSunday = currentDay;
      currentWeekStart.setDate(currentWeekStart.getDate() - daysFromLastSunday);
      currentWeekStart.setHours(11, 0, 0, 0);
      const daysUntilNextSunday = 7 - currentDay;
      currentWeekEnd.setDate(currentWeekEnd.getDate() + daysUntilNextSunday);
      currentWeekEnd.setHours(10, 59, 59, 999);
    }

    const lastWeekStart = new Date(currentWeekStart.getTime() - (7 * 24 * 60 * 60 * 1000));
    const lastWeekEnd = new Date(currentWeekStart.getTime() - 1);

    const fmtOpt = { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Mexico_City' };
    const currentCycleText = `${currentWeekStart.toLocaleDateString('en-US', fmtOpt)} - ${currentWeekEnd.toLocaleDateString('en-US', fmtOpt)}`;
    const lastCycleText = `${lastWeekStart.toLocaleDateString('en-US', fmtOpt)} - ${lastWeekEnd.toLocaleDateString('en-US', fmtOpt)}`;

    const currentCycleDates = $('currentCycleDates');
    const lastCycleDates = $('lastCycleDates');
    if (currentCycleDates) currentCycleDates.textContent = currentCycleText;
    if (lastCycleDates) lastCycleDates.textContent = lastCycleText;

    return { current: { start: currentWeekStart, end: currentWeekEnd }, last: { start: lastWeekStart, end: lastWeekEnd } };
  } catch (e) {
    console.error('Week cycle calculation error:', e);
    const currentCycleDates = $('currentCycleDates');
    const lastCycleDates = $('lastCycleDates');
    if (currentCycleDates) currentCycleDates.textContent = 'Error calculating current cycle';
    if (lastCycleDates) lastCycleDates.textContent = 'Error calculating last cycle';
    return null;
  }
}

function updateCountdown() {
  try {
    const now = new Date();
    const mexicoTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
    let nextSunday = new Date(mexicoTime);
    const currentDay = mexicoTime.getDay();
    if (currentDay === 0) {
      const h = mexicoTime.getHours();
      const m = mexicoTime.getMinutes();
      if (h < 10 || (h === 10 && m < 59)) {
        nextSunday.setHours(10, 59, 0, 0);
      } else {
        nextSunday.setDate(nextSunday.getDate() + 7);
        nextSunday.setHours(10, 59, 0, 0);
      }
    } else {
      const daysUntilSunday = 7 - currentDay;
      nextSunday.setDate(nextSunday.getDate() + daysUntilSunday);
      nextSunday.setHours(10, 59, 0, 0);
    }

    const diff = nextSunday.getTime() - mexicoTime.getTime();

    // Support two UIs: a single #countdown element or a segmented #countdownDisplay with #days/#hours/#minutes/#seconds
    const single = document.getElementById('countdown');
    const segmented = document.getElementById('countdownDisplay');

    if (diff > 0) {
      const d = Math.floor(diff / (24*60*60*1000));
      const h = Math.floor((diff % (24*60*60*1000)) / (60*60*1000));
      const m = Math.floor((diff % (60*60*1000)) / (60*1000));
      const s = Math.floor((diff % (60*1000)) / 1000);

      if (single) single.textContent = `${d}d ${h}h ${m}m ${s}s`;
      if (segmented) {
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = String(val).padStart(2, '0'); };
        set('days', d);
        set('hours', h);
        set('minutes', m);
        set('seconds', s);
      }
    } else {
      if (single) single.textContent = 'Cycle ended';
      if (segmented) ['days','hours','minutes','seconds'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '00'; });
    }
  } catch (e) {
    console.error('Countdown error', e);
  }
}

function updateWeekProgress() {
  try {
    const cycle = window.__weekCycles?.current;
    if (!cycle) return;
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
    const total = cycle.end.getTime() - cycle.start.getTime();
    const elapsed = Math.max(0, Math.min(total, now.getTime() - cycle.start.getTime()));
    const pct = total > 0 ? Math.floor((elapsed / total) * 100) : 0;
    const bar = document.getElementById('weekProgress');
    const label = document.getElementById('progressPercentage');
    if (bar) bar.style.width = `${pct}%`;
    if (label) label.textContent = `${pct}%`;
  } catch (e) { console.error('Week progress error', e); }
}

// ===== 7) MAGIC CURSOR (lightweight) =====
function initMagicCursor() {
  if ('ontouchstart' in window) return; // avoid on touch devices
  if (document.querySelector('.magic-cursor')) return;
  const dot = document.createElement('div');
  dot.className = 'magic-cursor';
  Object.assign(dot.style, {
    position: 'fixed', left: '0px', top: '0px', width: '14px', height: '14px',
    borderRadius: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none',
    zIndex: 9999, background: 'rgba(255,255,255,0.6)', boxShadow: '0 0 12px rgba(255,255,255,0.6)'
  });
  document.body.appendChild(dot);
  window.addEventListener('mousemove', (e) => {
    dot.style.left = e.clientX + 'px';
    dot.style.top  = e.clientY + 'px';
  }, { passive: true });
}

// ===== 8) TABS =====
function showTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  const tab = document.getElementById(`${tabName}-tab`);
  if (tab) tab.classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset?.tab === tabName || btn.textContent?.trim()?.includes(tabName)));
  document.querySelectorAll('.leaderboard-only').forEach(el => { el.style.display = (tabName === 'leaderboard') ? '' : 'none'; });
  if (tabName === 'leaderboard') loadCurrentWeek();
  if (tabName === 'lastweek') loadLastWeek();
}

// ===== 9) BOOT =====
document.addEventListener('DOMContentLoaded', () => {
  window.__weekCycles = calculateWeekCycles();
  updateCountdown();
  updateWeekProgress();
  setInterval(() => { updateCountdown(); updateWeekProgress(); }, 1000);
  initMagicCursor();
  // default tab
  showTab('leaderboard');
});
>>>>>>> origin/main
