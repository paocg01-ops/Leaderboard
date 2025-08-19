/* File: prod_index.refactor.js
   Purpose: Clean, single-source JS that restores search + modal from prototype, 
   removes hard-coded data coupling, and works with Supabase.
   Drop this <script> after supabase-js and remove old duplicate inline scripts. */

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

// ===== 3) SEARCH (from prototype, decoupled) =====
function setupSearch(players) {
  const searchInput = $('nameSearch');
  const clearBtn = $('clearBtn');
  const searchResults = $('searchResults');
  if (!searchInput || !searchResults) return;

  function handle(term) {
    const t = term.trim().toLowerCase();
    if (t) {
      clearBtn && (clearBtn.style.display = 'flex');
      performSearch(t, players);
    } else {
      clearBtn && (clearBtn.style.display = 'none');
      clearSearch();
    }
  }

  // idempotent listeners
  searchInput.oninput = (e) => handle(e.target.value || '');
  searchInput.onkeypress = (e) => {
    if (e.key === 'Enter') handle(searchInput.value || '');
  };
  if (clearBtn) clearBtn.onclick = () => clearSearch();
}

function performSearch(searchTerm, players) {
  const searchResults = $('searchResults');
  const playerRows = document.querySelectorAll('.player-row');
  if (!searchResults || !playerRows.length) return;

  // store original row html once
  if (!window.originalRowHTML) {
    window.originalRowHTML = new Map();
    playerRows.forEach((row, idx) => {
      window.originalRowHTML.set(idx, row.querySelector('.player-name')?.innerHTML || '');
    });
  }
  // reset any highlights
  playerRows.forEach((row, idx) => {
    row.classList.remove('search-match');
    const nameEl = row.querySelector('.player-name');
    if (nameEl && window.originalRowHTML.has(idx)) nameEl.innerHTML = window.originalRowHTML.get(idx);
  });

  // compute matches
  const matches = [];
  playerRows.forEach((row, idx) => {
    const nameEl = row.querySelector('.player-name');
    if (!nameEl) return;
    const text = nameEl.textContent || '';
    const afterEmoji = text.replace('🧁', '').trim();
    const p = players.find(x => afterEmoji.includes(x.name));
    if (p && p.name.toLowerCase().includes(searchTerm)) {
      matches.push({ row, playerName: p.name, index: idx });
      row.classList.add('search-match');
      const regex = new RegExp(`(${searchTerm})`, 'gi');
      const highlighted = p.name.replace(regex, '<span class="highlight-match">$1</span>');
      const currentHTML = nameEl.innerHTML;
      nameEl.innerHTML = currentHTML.replace(p.name, highlighted);
    }
  });

  if (matches.length) {
    if (matches.length === 1) {
      const rank = matches[0].index + 1;
      searchResults.innerHTML = `🎯 Found "${matches[0].playerName}" at rank #${rank}!`;
      setTimeout(() => matches[0].row.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    } else {
      searchResults.innerHTML = `🔍 Found ${matches.length} pancakes matching "${searchTerm}"`;
    }
  } else {
    searchResults.innerHTML = `😔 No pancakes found matching "${searchTerm}"`;
  }
}

function clearSearch() {
  const searchInput = $('nameSearch');
  const clearBtn = $('clearBtn');
  const searchResults = $('searchResults');
  const playerRows = document.querySelectorAll('.player-row');
  if (searchInput) searchInput.value = '';
  if (clearBtn) clearBtn.style.display = 'none';
  if (searchResults) searchResults.innerHTML = '';
  playerRows.forEach((row, idx) => {
    row.classList.remove('search-match');
    const nameEl = row.querySelector('.player-name');
    if (nameEl && window.originalRowHTML && window.originalRowHTML.has(idx)) {
      nameEl.innerHTML = window.originalRowHTML.get(idx);
    }
  });
}

// ===== 4) CLICK HANDLERS + MODAL =====
function setupMobileCardHandlers() {
  document.querySelectorAll('.mobile-card').forEach(card => {
    // avoid duplicate listeners
    card.onclick = () => {
      const rank = Number(card.getAttribute('data-rank'));
      const name = card.getAttribute('data-name') || '';
      const score = Number(card.getAttribute('data-score')) || 0;
      const chests = Number(card.getAttribute('data-chests')) || 0;
      const badges = card.getAttribute('data-badges') || '';
      const badgeProgress = card.getAttribute('data-badge-progress') || '';
      showPlayerModal(rank, name, score, chests, badges, badgeProgress);
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
      showPlayerModal(rank, name, score, chests, badges, badgeProgress);
    };
  });
}

function showPlayerModal(rank, playerName, score, chests, badges, badgeProgress) {
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

  // Detailed badge progress (same rules as prototype)
  let progressHTML = '<h4>🎯 Badge Progress</h4>';
  const hasChestHero = (badges || '').includes('Chest Hero');
  const hasLegend = (badges || '').includes('Legend');
  const hasConsistent = (badges || '').includes('Consistent');

  if (hasChestHero) {
    progressHTML += '<div class="progress-item earned">🍪 <strong>Chest Hero</strong> - ✅ Earned! (100+ chests)</div>';
  } else {
    const need = Math.max(0, 100 - chests);
    progressHTML += need === 0
      ? '<div class="progress-item earned">🍪 <strong>Chest Hero</strong> - ✅ Ready to earn!</div>'
      : `<div class="progress-item needed">🍪 <strong>Chest Hero</strong> - Need ${need} more chests (currently ${fmt(chests)}/100)</div>`;
  }

  if (hasLegend) {
    progressHTML += '<div class="progress-item earned">⭐ <strong>Legend</strong> - ✅ Earned! (2000+ points)</div>';
  } else {
    const need = Math.max(0, 2000 - score);
    progressHTML += need === 0
      ? '<div class="progress-item earned">⭐ <strong>Legend</strong> - ✅ Ready to earn!</div>'
      : `<div class="progress-item needed">⭐ <strong>Legend</strong> - Need ${need} more points (currently ${fmt(score)}/2000)</div>`;
  }

  if (hasConsistent) {
    progressHTML += '<div class="progress-item earned">🎯 <strong>Consistent</strong> - ✅ Earned! (≥70 chests & ≥1000 points)</div>';
  } else {
    const chN = Math.max(0, 70 - chests);
    const ptN = Math.max(0, 1000 - score);
    if (chN === 0 && ptN === 0) {
      progressHTML += '<div class="progress-item earned">🎯 <strong>Consistent</strong> - ✅ Ready to earn!</div>';
    } else if (chN === 0) {
      progressHTML += `<div class="progress-item needed">🎯 <strong>Consistent</strong> - Need ${ptN} more points (chests: ✅ ${fmt(chests)}/70, points: ${fmt(score)}/1000)</div>`;
    } else if (ptN === 0) {
      progressHTML += `<div class="progress-item needed">🎯 <strong>Consistent</strong> - Need ${chN} more chests (chests: ${fmt(chests)}/70, points: ✅ ${fmt(score)}/1000)</div>`;
    } else {
      progressHTML += `<div class="progress-item needed">🎯 <strong>Consistent</strong> - Need ${chN} chests AND ${ptN} points (currently ${fmt(chests)}/70, ${fmt(score)}/1000)</div>`;
    }
  }
  if (modalProgress) modalProgress.innerHTML = progressHTML;

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
  const rows = data || [];

  // KPIs
  const total = rows.length;
  const avgTreats = total ? Math.round(rows.reduce((a,b)=>a+(b.treats||0),0)/total) : 0;
  const avgScore  = total ? Math.round(rows.reduce((a,b)=>a+(b.score||0),0)/total)  : 0;
  setText('totalWarriors', total);
  setText('totalChests',  avgTreats);
  setText('totalScore',   avgScore);

  // optional: decorate simple trophies for top 3
  rows.sort((a,b)=> (b.score||0) - (a.score||0))
      .forEach((p, idx) => { p.rank = idx + 1; p.trophyHTML = trophyForRank(p.rank); });

  renderLeaderboard(rows, 'leaderboardContent');
}

async function loadLastWeek() {
  const { data, error } = await sb
    .from('players_last')
    .select('name, score, treats, rank')
    .order('score', { ascending: false });
  if (error) { console.error('players_last error', error); return; }
  const rows = data || [];

  // Decorate badges like the prototype (derived client-side)
  rows.forEach(p => {
    const earned = [];
    let badges = '';
    if ((p.treats||0) >= 100) { badges += '<span class="achievement-badge chest-hero">Chest Hero</span>'; earned.push('chest-hero'); }
    if ((p.score||0)  >= 2000) { badges += '<span class="achievement-badge score-legend">Legend</span>'; earned.push('legend'); }
    if ((p.treats||0) >= 70 && (p.score||0) >= 1000) { badges += '<span class="achievement-badge consistent-warrior">Consistent</span>'; earned.push('consistent'); }

    // progress text when not all badges earned
    let badgeProgress = '';
    if (earned.length === 0) {
      const toChest = Math.max(0, 100 - (p.treats||0));
      const toLegend = Math.max(0, 2000 - (p.score||0));
      const toConsCh = Math.max(0, 70 - (p.treats||0));
      const toConsPt = Math.max(0, 1000 - (p.score||0));
      // pick closest path
      if (toChest <= toLegend && toChest <= Math.max(toConsCh, toConsPt)) {
        badgeProgress = `🍪 Only ${toChest} more chests to earn the hero badge!`;
      } else if (toLegend <= Math.max(toConsCh, toConsPt)) {
        badgeProgress = `⭐ Only ${toLegend} more points to become a legend!`;
      } else {
        badgeProgress = toConsCh > 0 && toConsPt > 0
          ? `🎯 Only ${toConsCh} chests & ${toConsPt} points to earn consistent badge!`
          : (toConsCh > 0 ? `🎯 Only ${toConsCh} more chests to earn consistent badge!`
                          : `🎯 Only ${toConsPt} more points to earn consistent badge!`);
      }
    }
    p.badgesHTML = badges;
    p.badgeProgress = badgeProgress;
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

// ===== 6) WEEK CYCLES + COUNTDOWN (unchanged logic) =====
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
    const el = $('countdown');
    if (!el) return;

    if (diff > 0) {
      const d = Math.floor(diff / (24*60*60*1000));
      const h = Math.floor((diff % (24*60*60*1000)) / (60*60*1000));
      const m = Math.floor((diff % (60*60*1000)) / (60*1000));
      const s = Math.floor((diff % (60*1000)) / 1000);
      el.textContent = `${d}d ${h}h ${m}m ${s}s`;
    } else {
      el.textContent = 'Cycle ended';
    }
  } catch (e) {
    console.error('Countdown error', e);
  }
}

// ===== 7) TABS =====
function showTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  const tab = document.getElementById(`${tabName}-tab`);
  if (tab) tab.classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset?.tab === tabName || btn.textContent?.trim()?.includes(tabName)));
  document.querySelectorAll('.leaderboard-only').forEach(el => { el.style.display = (tabName === 'leaderboard') ? '' : 'none'; });
  if (tabName === 'leaderboard') loadCurrentWeek();
  if (tabName === 'lastweek') loadLastWeek();
}

// ===== 8) BOOT =====
document.addEventListener('DOMContentLoaded', () => {
  calculateWeekCycles();
  setInterval(updateCountdown, 1000);
  // default tab
  showTab('leaderboard');
});
