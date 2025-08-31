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
// Use the global Supabase client initialized by supabase-init.js
const sb = window.sb || (window.supabase?.createClient?.(
    window.SUPABASE_URL || "https://dcxljettjctekbhxcyrw.supabase.co",
    window.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjeGxqZXR0amN0ZWtiaHhjeXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzMDYyOTgsImV4cCI6MjA3MDg4MjI5OH0.X7OWTobYUQqKJA41BlozsMqqqRd_ndO-uh9gxRv9s7U"
));

// ===== 1) HELPERS =====
const $ = (id) => document.getElementById(id);
const setText = (id, v) => { const el = $(id); if (el) el.textContent = v; };
function fmt(n) { return Number(n || 0).toLocaleString(); }

function trophyForRank(rank) {
  if (rank === 1) return '<span class="trophy gold">🏆</span>';
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

function populatePlayersInContainer(data, container, tabName) {
  if (!container || !data) return;

  const leaderboardBody = container.querySelector('.leaderboard tbody');
  if (!leaderboardBody) return;

  leaderboardBody.innerHTML = '';
  
  data.forEach((player, index) => {
    const rank = index + 1;
    const { badges } = deriveBadges(player);
    
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${trophyForRank(rank)}${rank}</td>
      <td class="player-name" data-player="${player.name}" data-tab="${tabName}">${player.name}</td>
      <td>${fmt(player.treats)}</td>
      <td>${fmt(player.score)}</td>
      <td class="badges">${badges}</td>
    `;
    leaderboardBody.appendChild(row);
  });
}

// ===== 2) SEARCH =====
function performSearch() {
  const query = document.getElementById('searchInput')?.value?.trim().toLowerCase();
  if (!query) {
    highlightResults([]);
    document.getElementById('searchResults').innerHTML = '';
    return;
  }

  const activeTab = document.querySelector('.tab-content.active');
  const tabName = activeTab?.id?.replace('-tab', '') || 'leaderboard';
  
  let dataToSearch = [];
  if (tabName === 'leaderboard' && window.currentWeekData) {
    dataToSearch = window.currentWeekData;
  } else if (tabName === 'lastweek' && window.lastWeekData) {
    dataToSearch = window.lastWeekData;
  }

  const results = dataToSearch.filter(player => 
    player.name.toLowerCase().includes(query)
  );

  displaySearchResults(results, tabName);
  highlightResults(results.map(p => p.name));
}

function displaySearchResults(results, tabName) {
  const searchResults = document.getElementById('searchResults');
  if (!searchResults) return;

  if (results.length === 0) {
    searchResults.innerHTML = '<p>No players found matching your search.</p>';
    return;
  }

  const isPlural = results.length !== 1;
  const playerWord = isPlural ? 'players' : 'player';
  
  searchResults.innerHTML = `
    <h3>Search Results (${results.length} ${playerWord} found)</h3>
    <table class="leaderboard">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Player</th>
          <th>Chests</th>
          <th>Score</th>
          <th>Badges</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  `;

  const tbody = searchResults.querySelector('tbody');
  results.forEach((player, index) => {
    const originalRank = (tabName === 'leaderboard' ? window.currentWeekData : window.lastWeekData)
      .findIndex(p => p.name === player.name) + 1;
    const { badges } = deriveBadges(player);
    
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${trophyForRank(originalRank)}${originalRank}</td>
      <td class="player-name" data-player="${player.name}" data-tab="${tabName}">${player.name}</td>
      <td>${fmt(player.treats)}</td>
      <td>${fmt(player.score)}</td>
      <td class="badges">${badges}</td>
    `;
    tbody.appendChild(row);
  });
}

function highlightResults(playerNames) {
  // Remove existing highlights
  document.querySelectorAll('.player-name').forEach(el => {
    el.classList.remove('search-highlight');
  });

  // Add highlights
  if (playerNames.length > 0) {
    document.querySelectorAll('.player-name').forEach(el => {
      if (playerNames.includes(el.textContent)) {
        el.classList.add('search-highlight');
      }
    });
  }
}

// ===== 3) MODAL =====
function showPlayerModal(playerName, tabName = 'leaderboard') {
  const modal = document.getElementById('playerModal');
  const modalPlayerName = document.getElementById('modalPlayerName');
  
  if (!modal || !modalPlayerName) return;
  
  modalPlayerName.textContent = playerName;
  
  let playerData;
  if (tabName === 'leaderboard' && window.currentWeekData) {
    playerData = window.currentWeekData.find(p => p.name === playerName);
  } else if (tabName === 'lastweek' && window.lastWeekData) {
    playerData = window.lastWeekData.find(p => p.name === playerName);
  }
  
  if (playerData) {
    const { badges, chestHero, legend, consistent } = deriveBadges(playerData);
    const rank = (tabName === 'leaderboard' ? window.currentWeekData : window.lastWeekData)
      .findIndex(p => p.name === playerName) + 1;
    
    document.getElementById('modalRank').textContent = rank;
    document.getElementById('modalChests').textContent = fmt(playerData.treats);
    document.getElementById('modalScore').textContent = fmt(playerData.score);
    document.getElementById('modalBadges').innerHTML = badges || 'No badges earned';
    
    // Load crypt breakdown for this player and current context
    const isCurrentWeek = tabName === 'leaderboard';
    loadCryptBreakdown(playerName, isCurrentWeek);
  }
  
  modal.style.display = 'block';
  document.body.classList.add('modal-open');
}

function closePlayerModal() {
  const modal = document.getElementById('playerModal');
  if (modal) {
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
    // Reset crypt breakdown collapse state
    const cryptHeader = document.getElementById('cryptBreakdownHeader');
    const cryptContent = document.getElementById('cryptBreakdownContent');
    if (cryptHeader && cryptContent) {
      cryptHeader.classList.remove('expanded');
      cryptContent.style.display = 'none';
    }
  }
}

function toggleCryptBreakdown() {
  const header = document.getElementById('cryptBreakdownHeader');
  const content = document.getElementById('cryptBreakdownContent');
  
  if (!header || !content) return;
  
  const isExpanded = header.classList.contains('expanded');
  
  if (isExpanded) {
    header.classList.remove('expanded');
    content.style.display = 'none';
  } else {
    header.classList.add('expanded');
    content.style.display = 'block';
  }
}

// ===== 4) CRYPT BREAKDOWN =====
async function loadCryptBreakdown(playerName, isCurrentWeek = true) {
  const content = document.getElementById('cryptBreakdownContent');
  if (!content) return;
  
  // Show loading state
  content.innerHTML = '<div class="crypt-breakdown-loading">Loading crypt data...</div>';
  
  try {
    // Get week date ranges - ensure weekCycles is properly initialized
    let weekCycles = window.__weekCycles;
    if (!weekCycles) {
      console.log('Debug - Calculating new week cycles...');
      weekCycles = calculateWeekCycles();
      window.__weekCycles = weekCycles;
      console.log('Debug - New week cycles calculated:', weekCycles);
    }
    
    console.log('Debug - weekCycles object:', weekCycles);
    console.log('Debug - weekCycles keys:', weekCycles ? Object.keys(weekCycles) : 'null/undefined');
    console.log('Debug - weekCycles.current:', weekCycles?.current);
    console.log('Debug - weekCycles.last:', weekCycles?.last);
    
    // If weekCycles is null (error in calculation), try once more
    if (!weekCycles) {
      console.log('Debug - Week cycles is null, trying to recalculate...');
      try {
        weekCycles = calculateWeekCycles();
        console.log('Debug - Recalculated week cycles:', weekCycles);
      } catch (error) {
        console.error('Debug - Error recalculating week cycles:', error);
      }
    }
    
    if (!weekCycles || !weekCycles.current || !weekCycles.current.start || !weekCycles.current.end) {
      console.error('Week cycles not properly initialized:', weekCycles);
      content.innerHTML = '<div class="crypt-breakdown-loading">Error: Week cycles not available</div>';
      return;
    }
    
    const dateRange = isCurrentWeek ? 
      { start: weekCycles.current.start, end: weekCycles.current.end } :
      { start: weekCycles.last.start, end: weekCycles.last.end };
    
    // Validate date range objects
    if (!dateRange.start || !dateRange.end || typeof dateRange.start.toISOString !== 'function') {
      console.error('Invalid date range:', dateRange);
      content.innerHTML = '<div class="crypt-breakdown-loading">Error: Invalid date range</div>';
      return;
    }

    // Query raw_chests table for this player's data in the date range
    const { data, error } = await sb
      .from('raw_chests')
      .select('SOURCE, CHEST')
      .eq('PLAYER', playerName)
      .gte('updated_at', dateRange.start.toISOString())
      .lte('updated_at', dateRange.end.toISOString())
      .order('SOURCE', { ascending: true });

    if (error) {
      console.error('Supabase query error:', error);
      content.innerHTML = '<div class="crypt-breakdown-loading">Error loading crypt data</div>';
      return;
    }

    // Process and group the data
    const cryptData = {};
    
    if (data && data.length > 0) {
      data.forEach(record => {
        const source = record.SOURCE || 'Unknown';
        if (!cryptData[source]) {
          cryptData[source] = {};
        }
        const chest = record.CHEST || 'Unknown';
        cryptData[source][chest] = (cryptData[source][chest] || 0) + 1;
      });
    }

    // Display the data
    if (Object.keys(cryptData).length === 0) {
      content.innerHTML = '<div class="crypt-breakdown-empty">No crypt data found for this period</div>';
    } else {
      let html = '<div class="crypt-breakdown-table-container"><table class="crypt-breakdown-table">';
      html += '<thead><tr><th>Source</th><th>Chests</th></tr></thead><tbody>';
      
      // Sort sources by total chest count (descending)
      const sortedSources = Object.entries(cryptData).sort((a, b) => {
        const aTotal = Object.values(a[1]).reduce((sum, count) => sum + count, 0);
        const bTotal = Object.values(b[1]).reduce((sum, count) => sum + count, 0);
        return bTotal - aTotal;
      });
      
      sortedSources.forEach(([source, chests]) => {
        const totalChests = Object.values(chests).reduce((sum, count) => sum + count, 0);
        html += `<tr><td>${source}</td><td>${totalChests}</td></tr>`;
      });
      
      html += '</tbody></table></div>';
      content.innerHTML = html;
    }

  } catch (error) {
    console.error('Error in loadCryptBreakdown:', error);
    content.innerHTML = '<div class="crypt-breakdown-loading">Error loading crypt data</div>';
  }
}

// ===== 5) DATA LOADING =====
async function loadCurrentWeek() {
  try {
    const { data, error } = await sb
      .from('leaderboard_current_week')
      .select('*')
      .order('rank', { ascending: true });

    if (error) throw error;

    window.currentWeekData = data || [];
    const container = document.getElementById('leaderboard-tab');
    populatePlayersInContainer(window.currentWeekData, container, 'leaderboard');

  } catch (error) {
    console.error('Error loading current week data:', error);
    const container = document.getElementById('leaderboard-tab');
    if (container) {
      const tbody = container.querySelector('.leaderboard tbody');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="5">Error loading leaderboard data</td></tr>';
      }
    }
  }
}

async function loadLastWeek() {
  try {
    const { data, error } = await sb
      .from('leaderboard_last_week')
      .select('*')
      .order('rank', { ascending: true });

    if (error) throw error;

    window.lastWeekData = data || [];
    const container = document.getElementById('lastweek-tab');
    populatePlayersInContainer(window.lastWeekData, container, 'lastweek');

    // Update badge stats
    updateLastWeekBadgeStats(window.lastWeekData);

  } catch (error) {
    console.error('Error loading last week data:', error);
    const container = document.getElementById('lastweek-tab');
    if (container) {
      const tbody = container.querySelector('.leaderboard tbody');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="5">Error loading last week data</td></tr>';
      }
    }
  }
}

function updateLastWeekBadgeStats(data) {
  const chestHeroes = data.filter(p => (p.treats || 0) >= 100).map(p => p.name);
  const legends = data.filter(p => (p.score || 0) >= 2000).map(p => p.name);
  const consistentWarriors = data.filter(p => (p.treats || 0) >= 70 && (p.score || 0) >= 1000).map(p => p.name);

  // Update Chest Heroes
  const chestHeroCount = chestHeroes.length;
  setText('lastWeekChestHeroes', `${chestHeroCount} ${chestHeroCount === 1 ? 'warrior' : 'warriors'}`);
  setText('lastWeekChestHeroNames', chestHeroes.length > 0 ? chestHeroes.join(', ') : 'No one earned this badge');

  // Update Legends
  const legendCount = legends.length;
  setText('lastWeekLegends', `${legendCount} ${legendCount === 1 ? 'warrior' : 'warriors'}`);
  setText('lastWeekLegendNames', legends.length > 0 ? legends.join(', ') : 'No one earned this badge');

  // Update Consistent Warriors
  const consistentCount = consistentWarriors.length;
  setText('lastWeekConsistent', `${consistentCount} ${consistentCount === 1 ? 'warrior' : 'warriors'}`);
  setText('lastWeekConsistentNames', consistentWarriors.length > 0 ? consistentWarriors.join(', ') : 'No one earned this badge');
}

// ===== 6) WEEK CYCLES + COUNTDOWN + PROGRESS =====
function calculateWeekCycles() {
  try {
    const now = new Date();
    
    // Calculate cycle boundaries in UTC time
    // Cycle: Sunday 5:00 PM UTC (17:00) - Next Sunday 4:59 PM UTC (16:59)
    let currentWeekStart = new Date(now);
    let currentWeekEnd = new Date(now);
    const currentUTCDay = now.getUTCDay();
    const currentUTCHour = now.getUTCHours();

    if (currentUTCDay === 0) { // Sunday in UTC
      if (currentUTCHour < 17) { // Before 5:00 PM UTC
        // We're in the previous week's cycle
        currentWeekStart.setUTCDate(currentWeekStart.getUTCDate() - 7);
        currentWeekStart.setUTCHours(17, 0, 0, 0);
        currentWeekEnd.setUTCHours(16, 59, 59, 999);
      } else { // After 5:00 PM UTC
        // New cycle starts today
        currentWeekStart.setUTCHours(17, 0, 0, 0);
        currentWeekEnd.setUTCDate(currentWeekEnd.getUTCDate() + 7);
        currentWeekEnd.setUTCHours(16, 59, 59, 999);
      }
    } else {
      // Not Sunday - find the most recent Sunday 5:00 PM UTC
      const daysFromLastSunday = currentUTCDay;
      currentWeekStart.setUTCDate(currentWeekStart.getUTCDate() - daysFromLastSunday);
      currentWeekStart.setUTCHours(17, 0, 0, 0);
      
      // End is next Sunday 4:59 PM UTC
      const daysUntilNextSunday = 7 - currentUTCDay;
      currentWeekEnd.setUTCDate(currentWeekEnd.getUTCDate() + daysUntilNextSunday);
      currentWeekEnd.setUTCHours(16, 59, 59, 999);
    }

    // Calculate last week's cycle
    const lastWeekStart = new Date(currentWeekStart.getTime() - (7 * 24 * 60 * 60 * 1000));
    const lastWeekEnd = new Date(currentWeekStart.getTime() - 1);

    // Get user's timezone for display (same approach as dynamic-timestamp.js)
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // Format dates in user's local timezone for display
    const fmtOpt = { 
      month: 'short', 
      day: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true, 
      timeZone: userTimezone 
    };
    
    const currentCycleText = `${currentWeekStart.toLocaleString('en-US', fmtOpt)} - ${currentWeekEnd.toLocaleString('en-US', fmtOpt)}`;
    const lastCycleText = `${lastWeekStart.toLocaleString('en-US', fmtOpt)} - ${lastWeekEnd.toLocaleString('en-US', fmtOpt)}`;

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
  const weekCycles = window.__weekCycles || calculateWeekCycles();
  if (!weekCycles?.current?.end) return;

  const now = new Date();
  const timeLeft = weekCycles.current.end.getTime() - now.getTime();

  if (timeLeft <= 0) {
    setText('countdownTimer', 'Week Ended');
    setText('daysLeft', '0');
    setText('hoursLeft', '0');
    setText('minutesLeft', '0');
    setText('secondsLeft', '0');
    return;
  }

  const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

  setText('countdownTimer', `${days}d ${hours}h ${minutes}m ${seconds}s`);
  setText('daysLeft', days.toString());
  setText('hoursLeft', hours.toString());
  setText('minutesLeft', minutes.toString());
  setText('secondsLeft', seconds.toString());
}

function updateWeekProgress() {
  const weekCycles = window.__weekCycles || calculateWeekCycles();
  if (!weekCycles?.current?.start || !weekCycles?.current?.end) return;

  const now = new Date();
  const start = weekCycles.current.start.getTime();
  const end = weekCycles.current.end.getTime();
  const current = now.getTime();

  const progress = Math.max(0, Math.min(100, ((current - start) / (end - start)) * 100));

  const progressBar = $('weekProgress');
  const progressPercentage = $('progressPercentage');
  
  if (progressBar) progressBar.style.width = `${progress}%`;
  if (progressPercentage) progressPercentage.textContent = `${progress.toFixed(1)}%`;
}

// ===== 7) EVENT LISTENERS =====
document.addEventListener('DOMContentLoaded', () => {
  // Search functionality
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', performSearch);
  }

  // Modal functionality
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('player-name')) {
      const playerName = e.target.getAttribute('data-player');
      const tabName = e.target.getAttribute('data-tab') || 'leaderboard';
      showPlayerModal(playerName, tabName);
    }
    
    if (e.target.classList.contains('modal-close') || e.target.id === 'playerModal') {
      if (e.target.id === 'playerModal' && e.target === e.currentTarget) {
        closePlayerModal();
      } else if (e.target.classList.contains('modal-close')) {
        closePlayerModal();
      }
    }
    
    if (e.target.id === 'cryptBreakdownHeader' || e.target.closest('#cryptBreakdownHeader')) {
      toggleCryptBreakdown();
    }
  });

  // ESC key to close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closePlayerModal();
    }
  });
});

// ===== 8) MAGIC CURSOR =====
function initMagicCursor() {
  const cursor = document.createElement('div');
  cursor.className = 'magic-cursor';
  document.body.appendChild(cursor);
  
  let mouseX = 0, mouseY = 0;
  let cursorX = 0, cursorY = 0;
  
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });
  
  const updateCursor = () => {
    const dx = mouseX - cursorX;
    const dy = mouseY - cursorY;
    cursorX += dx * 0.1;
    cursorY += dy * 0.1;
    cursor.style.left = cursorX + 'px';
    cursor.style.top = cursorY + 'px';
    requestAnimationFrame(updateCursor);
  };
  updateCursor();
}

// ===== 9) TABS =====
function showTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
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