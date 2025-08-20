// ================================
// STRIKE FOR CAKE - ENHANCED PRODUCTION JS
// Restored features from prototype + improved mobile UI
// ================================

// Supabase Configuration
const SUPABASE_URL = 'https://zeyksxqqhgnijvsdlltk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpleWtzeHFxaGduaWp2c2RsbHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ1NjEyODYsImV4cCI6MjA1MDEzNzI4Nn0.9lORN9YCkOy-HTuGRqJp5n9-P5Oc_1xRgKHAC7YTqJw';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Global state
let allPlayersData = [];
let currentTab = 'leaderboard';
let searchTerm = '';

// ================================
// INITIALIZATION
// ================================
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    setupEventListeners();
    initializeCursor();
    initializeTimers();
    
    try {
        await loadPlayersData();
        updateUI();
    } catch (error) {
        console.error('Failed to load data:', error);
        allPlayersData = [];
        updateUI();
    }
}

// ================================
// EVENT LISTENERS
// ================================
function setupEventListeners() {
    // Search functionality
    const searchInput = document.getElementById('nameSearch');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch(e);
            }
        });
    }

    // Clear search button
    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearSearch);
    }

    // Modal close functionality
    const playerModal = document.getElementById('playerModal');
    if (playerModal) {
        playerModal.addEventListener('click', function(e) {
            if (e.target === playerModal) {
                closePlayerModal();
            }
        });
        
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && playerModal.classList.contains('active')) {
                closePlayerModal();
            }
        });
    }

    // Mobile touch events for player names
    document.addEventListener('touchstart', function(e) {
        const playerName = e.target.closest('.clickable-name, .mobile-player-name');
        if (playerName) {
            playerName.classList.add('tapped');
            setTimeout(() => {
                playerName.classList.remove('tapped');
            }, 300);
        }
    });
}

// ================================
// DATA LOADING
// ================================
async function loadPlayersData() {
    try {
        console.log('Loading players data from Supabase...');
        
        const { data, error } = await supabase
            .from('players')
            .select('*')
            .order('total_score', { ascending: false });

        if (error) {
            console.error('Supabase error:', error);
            throw error;
        }

        if (!data || data.length === 0) {
            console.warn('No data found in database');
            allPlayersData = [];
            return;
        }

        console.log('Loaded', data.length, 'players from database');
        
        // Process the data
        allPlayersData = data.map((player, index) => ({
            name: player.name || 'Unknown Player',
            chests: parseInt(player.total_chests) || 0,
            score: parseInt(player.total_score) || 0,
            rank: index + 1,
            badges: calculateBadges(player)
        }));

        console.log('Processed player data:', allPlayersData);
        
    } catch (error) {
        console.error('Failed to load players data:', error);
        allPlayersData = [];
    }
}

function calculateBadges(player) {
    const badges = [];
    const chests = parseInt(player.total_chests) || 0;
    const score = parseInt(player.total_score) || 0;
    
    if (chests >= 100) {
        badges.push({ type: 'chest-hero', name: 'Chest Hero' });
    }
    if (score >= 2000) {
        badges.push({ type: 'score-legend', name: 'Legend' });
    }
    if (chests >= 70 && score >= 1000) {
        badges.push({ type: 'consistent-warrior', name: 'Consistent' });
    }
    
    return badges;
}

// ================================
// UI UPDATE FUNCTIONS
// ================================
function updateUI() {
    updateStats();
    updateLeaderboard();
    updateCurrentTab();
}

function updateStats() {
    if (allPlayersData.length === 0) {
        document.getElementById('totalWarriors').textContent = '0';
        document.getElementById('totalChests').textContent = '0';
        document.getElementById('totalScore').textContent = '0';
        return;
    }

    const totalWarriors = allPlayersData.length;
    const totalChests = allPlayersData.reduce((sum, player) => sum + player.chests, 0);
    const totalScore = allPlayersData.reduce((sum, player) => sum + player.score, 0);
    
    const avgChests = Math.round(totalChests / totalWarriors) || 0;
    const avgScore = Math.round(totalScore / totalWarriors) || 0;

    // Animate numbers
    animateNumber('totalWarriors', totalWarriors);
    animateNumber('totalChests', avgChests);
    animateNumber('totalScore', avgScore);
}

function animateNumber(elementId, targetValue) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const startValue = parseInt(element.textContent) || 0;
    const duration = 1000;
    const steps = 60;
    const increment = (targetValue - startValue) / steps;
    
    let current = startValue;
    let step = 0;
    
    const timer = setInterval(() => {
        step++;
        current += increment;
        
        if (step >= steps) {
            element.textContent = targetValue;
            clearInterval(timer);
        } else {
            element.textContent = Math.round(current);
        }
    }, duration / steps);
}

function updateLeaderboard() {
    const leaderboardContent = document.getElementById('leaderboardContent');
    if (!leaderboardContent) return;

    if (allPlayersData.length === 0) {
        leaderboardContent.innerHTML = `
            <div class="empty-state">
                <h3>🎯 Ready for Battle!</h3>
                <p>Waiting for player data to load...</p>
            </div>
        `;
        return;
    }

    let filteredPlayers = allPlayersData;
    
    // Apply search filter
    if (searchTerm.trim() !== '') {
        filteredPlayers = allPlayersData.filter(player => 
            player.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        updateSearchResults(filteredPlayers.length);
    } else {
        updateSearchResults(null);
    }

    // Generate leaderboard HTML
    const leaderboardHTML = filteredPlayers.map((player, index) => 
        generatePlayerRow(player, index)
    ).join('');

    leaderboardContent.innerHTML = leaderboardHTML || `
        <div class="empty-state">
            <h3>🔍 No Pancakes Found</h3>
            <p>No players match your search criteria.</p>
        </div>
    `;

    // Add click events to player names
    addPlayerClickEvents();
}

function generatePlayerRow(player, index) {
    const isTop3 = index < 3;
    const rankClass = `rank-${index + 1}`;
    
    // Generate badges HTML
    const badgesHTML = player.badges.map(badge => 
        `<span class="achievement-badge ${badge.type}">${badge.name}</span>`
    ).join('');
    
    // Highlight search matches
    const displayName = highlightSearchMatch(player.name);
    
    // Generate progress hint for mobile
    const progressHint = generateMobileProgressHint(player);
    
    return `
        <!-- Desktop Row -->
        <div class="player-row ${isTop3 ? 'top-3' : ''} ${searchTerm ? 'search-match' : ''}" 
             data-player-name="${player.name}">
            <div class="rank ${rankClass}">${player.rank}</div>
            <div class="player-name">
                <span class="clickable-name" onclick="openPlayerModal('${player.name}')" 
                      data-player="${player.name}">${displayName}</span>
                <span class="clan-emblem">🥞</span>
                ${badgesHTML}
                ${isTop3 && index === 0 ? '<span class="trophy">🏆</span>' : ''}
                ${isTop3 && index === 1 ? '<span class="trophy">🥈</span>' : ''}
                ${isTop3 && index === 2 ? '<span class="trophy">🥉</span>' : ''}
            </div>
            <div class="stat score">${player.score.toLocaleString()}</div>
            <div class="stat">${player.chests}</div>
        </div>

        <!-- Enhanced Mobile Card with 4-row layout -->
        <div class="mobile-card ${isTop3 ? 'top-3' : ''} ${searchTerm ? 'search-match' : ''}" 
             data-player-name="${player.name}" onclick="openPlayerModal('${player.name}')">
            
            <!-- Row 1: Rank + Name + Trophy -->
            <div class="mobile-row-1">
                <div class="mobile-rank ${rankClass}">${player.rank}</div>
                <div class="mobile-name-container">
                    <span class="mobile-player-name">${displayName} 🥞</span>
                    ${isTop3 && index === 0 ? '<span class="mobile-trophy">🏆</span>' : ''}
                    ${isTop3 && index === 1 ? '<span class="mobile-trophy">🥈</span>' : ''}
                    ${isTop3 && index === 2 ? '<span class="mobile-trophy">🥉</span>' : ''}
                </div>
            </div>
            
            <!-- Row 2: Points + Chests -->
            <div class="mobile-row-2">
                <div class="mobile-stats-container">
                    <div class="mobile-stat-item">
                        <span class="mobile-stat-value mobile-score">⭐ ${player.score.toLocaleString()}</span>
                    </div>
                    <div class="mobile-stat-item">
                        <span class="mobile-stat-value mobile-chests">🍪 ${player.chests}</span>
                    </div>
                </div>
            </div>
            
            <!-- Row 3: Badges -->
            <div class="mobile-row-3">
                <div class="mobile-badges-container">
                    ${badgesHTML || '<span class="mobile-no-badges">No badges yet</span>'}
                </div>
            </div>
            
            <!-- Row 4: Progress Hint -->
            <div class="mobile-row-4">
                <div class="mobile-progress-hint">
                    👆 Tap for goals • ${progressHint}
                </div>
            </div>
        </div>
    `;
}

function generateMobileProgressHint(player) {
    const hints = [];
    
    if (player.chests < 100) {
        hints.push(`${100 - player.chests} chests to Chest Hero`);
    }
    if (player.score < 2000) {
        hints.push(`${2000 - player.score} pts to Legend`);
    }
    if (player.chests < 70 || player.score < 1000) {
        const chestsNeeded = Math.max(0, 70 - player.chests);
        const pointsNeeded = Math.max(0, 1000 - player.score);
        if (chestsNeeded > 0 && pointsNeeded > 0) {
            hints.push(`${chestsNeeded} chests & ${pointsNeeded} pts to Consistent`);
        } else if (chestsNeeded > 0) {
            hints.push(`${chestsNeeded} chests to Consistent`);
        } else if (pointsNeeded > 0) {
            hints.push(`${pointsNeeded} pts to Consistent`);
        }
    }
    
    if (hints.length === 0) {
        return "All badges earned! 🎉";
    }
    
    // Return the most achievable goal (smallest number first)
    return hints.sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)[0]);
        const numB = parseInt(b.match(/\d+/)[0]);
        return numA - numB;
    })[0];
}

function highlightSearchMatch(text) {
    if (!searchTerm.trim()) return text;
    
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<span class="highlight-match">$1</span>');
}

function addPlayerClickEvents() {
    const clickableNames = document.querySelectorAll('.clickable-name');
    clickableNames.forEach(element => {
        const newElement = element.cloneNode(true);
        element.parentNode.replaceChild(newElement, element);
        
        newElement.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const playerName = this.getAttribute('data-player');
            if (playerName) {
                openPlayerModal(playerName);
            }
        });
    });
}

// ================================
// SEARCH FUNCTIONALITY
// ================================
function handleSearch(e) {
    searchTerm = e.target.value.trim();
    
    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) {
        clearBtn.style.display = searchTerm ? 'flex' : 'none';
    }
    
    updateLeaderboard();
}

function clearSearch() {
    const searchInput = document.getElementById('nameSearch');
    const clearBtn = document.getElementById('clearBtn');
    
    if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
    }
    
    if (clearBtn) {
        clearBtn.style.display = 'none';
    }
    
    searchTerm = '';
    updateLeaderboard();
}

function updateSearchResults(count) {
    const searchResults = document.getElementById('searchResults');
    if (!searchResults) return;
    
    if (count === null) {
        searchResults.textContent = '';
    } else if (count === 0) {
        searchResults.textContent = '🔍 No pancakes found matching your search';
        searchResults.style.color = '#ff6b6b';
    } else {
        searchResults.textContent = `🔍 Found ${count} pancake${count !== 1 ? 's' : ''}`;
        searchResults.style.color = '#4ecdc4';
    }
}

// ================================
// MODAL FUNCTIONALITY
// ================================
function openPlayerModal(playerName) {
    console.log('Opening modal for:', playerName);
    
    const player = allPlayersData.find(p => p.name === playerName);
    if (!player) {
        console.error('Player not found:', playerName);
        return;
    }
    
    const modal = document.getElementById('playerModal');
    if (!modal) return;
    
    // Populate modal content
    const modalRank = document.getElementById('modalRank');
    const modalPlayerName = document.getElementById('modalPlayerName');
    const modalScore = document.getElementById('modalScore');
    const modalChests = document.getElementById('modalChests');
    const modalBadges = document.getElementById('modalBadges');
    const modalProgress = document.getElementById('modalProgress');
    
    if (modalRank) {
        modalRank.textContent = `#${player.rank}`;
        modalRank.className = `modal-rank rank-${player.rank}`;
    }
    
    if (modalPlayerName) {
        modalPlayerName.textContent = player.name;
    }
    
    if (modalScore) {
        modalScore.textContent = player.score.toLocaleString();
    }
    
    if (modalChests) {
        modalChests.textContent = player.chests;
    }
    
    if (modalBadges) {
        const badgesHTML = player.badges.map(badge => 
            `<span class="achievement-badge ${badge.type}">${badge.name}</span>`
        ).join('');
        modalBadges.innerHTML = badgesHTML || '<span style="opacity: 0.7; font-style: italic;">No badges earned yet</span>';
    }
    
    if (modalProgress) {
        modalProgress.innerHTML = generateProgressInfo(player);
    }
    
    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closePlayerModal() {
    const modal = document.getElementById('playerModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function generateProgressInfo(player) {
    const progress = [];
    
    // Check badge progress
    const chestHeroProgress = Math.min(player.chests, 100);
    const legendProgress = Math.min(player.score, 2000);
    const consistentChests = Math.min(player.chests, 70);
    const consistentScore = Math.min(player.score, 1000);
    
    if (player.chests >= 100) {
        progress.push(`<div class="progress-item earned">✅ Chest Hero: ${player.chests}/100 chests (Earned!)</div>`);
    } else {
        progress.push(`<div class="progress-item needed">🍪 Chest Hero: ${player.chests}/100 chests (${100 - player.chests} more needed)</div>`);
    }
    
    if (player.score >= 2000) {
        progress.push(`<div class="progress-item earned">✅ Legend: ${player.score.toLocaleString()}/2000 points (Earned!)</div>`);
    } else {
        progress.push(`<div class="progress-item needed">⭐ Legend: ${player.score.toLocaleString()}/2000 points (${2000 - player.score} more needed)</div>`);
    }
    
    if (player.chests >= 70 && player.score >= 1000) {
        progress.push(`<div class="progress-item earned">✅ Consistent: ${player.chests}/70 chests & ${player.score.toLocaleString()}/1000 points (Earned!)</div>`);
    } else {
        const chestsNeeded = Math.max(0, 70 - player.chests);
        const pointsNeeded = Math.max(0, 1000 - player.score);
        progress.push(`<div class="progress-item needed">🎯 Consistent: Need ${chestsNeeded > 0 ? chestsNeeded + ' more chests' : 'no more chests'} ${chestsNeeded > 0 && pointsNeeded > 0 ? ' & ' : ''}${pointsNeeded > 0 ? pointsNeeded + ' more points' : ''}</div>`);
    }
    
    return `
        <h4>🎯 Badge Progress</h4>
        ${progress.join('')}
    `;
}

// ================================
// TAB FUNCTIONALITY
// ================================
function showTab(tabName) {
    currentTab = tabName;
    updateCurrentTab();
}

function updateCurrentTab() {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-tab') === currentTab) {
            btn.classList.add('active');
        }
    });
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    const activeTab = document.getElementById(`${currentTab}-tab`);
    if (activeTab) {
        activeTab.classList.add('active');
    }
    
    // Show/hide leaderboard-specific elements
    const leaderboardOnlyElements = document.querySelectorAll('.leaderboard-only');
    leaderboardOnlyElements.forEach(element => {
        element.style.display = currentTab === 'leaderboard' ? 'block' : 'none';
    });
}

// ================================
// RESTORED ANIMATION AND EFFECTS
// ================================
function createStatCardExplosion(element, type) {
    const emojiSets = {
        'pancakes': ['🥞', '👏', '🎉', '✨', '🌟', '💫', '🎊', '🙌', '👍', '🥳'],
        'treats': ['🍪', '🎁', '✨', '🌟', '👍', '🎀', '🧁', '🍰', '💫', '🎊'],
        'points': ['💪', '⭐', '🌟', '✨', '💫', '🏆', '🔥', '⚡', '💥', '🎯']
    };
    
    const colors = {
        'pancakes': '#F5B642',
        'treats': '#FF6F91', 
        'points': '#4ECDC4'
    };
    
    const emojiSet = emojiSets[type] || emojiSets['pancakes'];
    const color = colors[type] || colors['pancakes'];
    
    // Create explosion container
    const explosion = document.createElement('div');
    explosion.className = 'stat-explosion';
    element.appendChild(explosion);
    
    // Create multiple emoji particles with organic movement patterns
    for (let i = 0; i < 15; i++) {
        const particle = document.createElement('div');
        particle.className = 'stat-emoji-particle';
        particle.textContent = emojiSet[Math.floor(Math.random() * emojiSet.length)];
        particle.style.color = color;
        particle.style.textShadow = `0 0 15px ${color}`;
        
        // Create organic, flowing movement patterns
        const baseAngle = (i / 15) * 2 * Math.PI;
        const angleVariation = (Math.random() - 0.5) * 0.8;
        const angle = baseAngle + angleVariation;
        
        // Vary distances for more natural spread
        const baseDistance = 40 + (i % 3) * 20;
        const distanceVariation = Math.random() * 25;
        const distance = baseDistance + distanceVariation;
        
        // Create flowing, curved paths instead of straight lines
        const controlX1 = Math.cos(angle) * (distance * 0.3) + (Math.random() - 0.5) * 30;
        const controlY1 = Math.sin(angle) * (distance * 0.3) + (Math.random() - 0.5) * 20;
        const controlX2 = Math.cos(angle) * (distance * 0.7) + (Math.random() - 0.5) * 40;
        const controlY2 = Math.sin(angle) * (distance * 0.7) + (Math.random() - 0.5) * 30;
        const endX = Math.cos(angle) * distance + (Math.random() - 0.5) * 20;
        const endY = Math.sin(angle) * distance + (Math.random() - 0.5) * 15;
        
        // Add some upward bias for a more celebratory feel
        const upwardBias = -Math.abs(Math.sin(angle)) * 20;
        
        particle.style.left = '0px';
        particle.style.top = '0px';
        
        // Create unique organic animation for each particle
        const animationName = `organicExplode-${type}-${i}-${Date.now()}`;
        const duration = 2 + Math.random() * 1;
        particle.style.animation = `${animationName} ${duration}s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`;
        
        const style = document.createElement('style');
        style.textContent = `
            @keyframes ${animationName} {
                0% {
                    opacity: 1;
                    transform: translate(0px, 0px) scale(0) rotate(0deg);
                }
                15% {
                    opacity: 1;
                    transform: translate(${controlX1}px, ${controlY1 + upwardBias * 0.3}px) scale(0.8) rotate(${Math.random() * 180}deg);
                }
                35% {
                    opacity: 1;
                    transform: translate(${controlX2}px, ${controlY2 + upwardBias * 0.6}px) scale(1.2) rotate(${180 + Math.random() * 180}deg);
                }
                65% {
                    opacity: 0.9;
                    transform: translate(${endX * 0.8}px, ${endY * 0.8 + upwardBias * 0.8}px) scale(1.1) rotate(${270 + Math.random() * 180}deg);
                }
                85% {
                    opacity: 0.6;
                    transform: translate(${endX}px, ${endY + upwardBias}px) scale(0.9) rotate(${360 + Math.random() * 180}deg);
                }
                100% {
                    opacity: 0;
                    transform: translate(${endX + (Math.random() - 0.5) * 20}px, ${endY + upwardBias - 10}px) scale(0.3) rotate(${450 + Math.random() * 180}deg);
                }
            }
        `;
        document.head.appendChild(style);
        
        explosion.appendChild(particle);
        
        // Clean up after animation
        setTimeout(() => {
            if (particle.parentNode) {
                particle.parentNode.removeChild(particle);
            }
            if (style.parentNode) {
                style.parentNode.removeChild(style);
            }
        }, duration * 1000 + 100);
    }
    
    // Clean up explosion container
    setTimeout(() => {
        if (explosion.parentNode) {
            explosion.parentNode.removeChild(explosion);
        }
    }, 3500);
}

// ================================
// ENHANCED CURSOR EFFECTS (RESTORED)
// ================================
function initializeCursor() {
    // Create magical cursor
    const magicCursor = document.createElement('div');
    magicCursor.className = 'magic-cursor';
    document.body.appendChild(magicCursor);
    
    // Track mouse movement
    let mouseX = 0;
    let mouseY = 0;
    let cursorX = 0;
    let cursorY = 0;
    
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        
        // Create magical trail
        createMagicTrail(mouseX, mouseY);
    });
    
    // Smooth cursor following
    function animateCursor() {
        const dx = mouseX - cursorX;
        const dy = mouseY - cursorY;
        
        cursorX += dx * 0.1;
        cursorY += dy * 0.1;
        
        magicCursor.style.left = cursorX - 10 + 'px';
        magicCursor.style.top = cursorY - 10 + 'px';
        
        requestAnimationFrame(animateCursor);
    }
    animateCursor();
}

// Create magical trail particles (RESTORED)
function createMagicTrail(x, y) {
    const trail = document.createElement('div');
    trail.className = 'magic-trail';
    trail.style.left = x - 3 + 'px';
    trail.style.top = y - 3 + 'px';
    document.body.appendChild(trail);
    
    // Remove trail after animation
    setTimeout(() => {
        if (trail.parentNode) {
            trail.parentNode.removeChild(trail);
        }
    }, 800);
}

// ================================
// TIMER FUNCTIONS
// ================================
function initializeTimers() {
    updateCycleDates();
    updateCountdown();
    setInterval(updateCountdown, 1000);
}

function updateCycleDates() {
    const now = new Date();
    const mexicoTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Mexico_City"}));
    
    // Find current Monday (start of week in Mexico time)
    const currentMonday = new Date(mexicoTime);
    currentMonday.setDate(mexicoTime.getDate() - mexicoTime.getDay() + 1);
    currentMonday.setHours(0, 0, 0, 0);
    
    // Find next Monday (end of current week)
    const nextMonday = new Date(currentMonday);
    nextMonday.setDate(currentMonday.getDate() + 7);
    
    // Find previous Monday (start of last week)
    const previousMonday = new Date(currentMonday);
    previousMonday.setDate(currentMonday.getDate() - 7);
    
    const formatDate = (date) => {
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            timeZone: 'America/Mexico_City'
        });
    };
    
    // Update current cycle
    const currentCycleDates = document.getElementById('currentCycleDates');
    if (currentCycleDates) {
        currentCycleDates.textContent = `${formatDate(currentMonday)} - ${formatDate(new Date(nextMonday.getTime() - 24*60*60*1000))}`;
    }
    
    // Update last cycle
    const lastCycleDates = document.getElementById('lastCycleDates');
    if (lastCycleDates) {
        lastCycleDates.textContent = `${formatDate(previousMonday)} - ${formatDate(new Date(currentMonday.getTime() - 24*60*60*1000))}`;
    }
}

function updateCountdown() {
    const now = new Date();
    const mexicoTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Mexico_City"}));
    
    // Find next Monday at midnight Mexico time
    const nextMonday = new Date(mexicoTime);
    nextMonday.setDate(mexicoTime.getDate() + (8 - mexicoTime.getDay()) % 7);
    if (nextMonday.getDay() === 1 && nextMonday <= mexicoTime) {
        nextMonday.setDate(nextMonday.getDate() + 7);
    }
    nextMonday.setHours(0, 0, 0, 0);
    
    const timeDiff = nextMonday.getTime() - mexicoTime.getTime();
    
    if (timeDiff <= 0) {
        updateTimeDisplay(0, 0, 0, 0);
        updateWeekProgress(100);
        return;
    }
    
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
    
    updateTimeDisplay(days, hours, minutes, seconds);
    
    // Calculate week progress
    const weekStart = new Date(mexicoTime);
    weekStart.setDate(mexicoTime.getDate() - mexicoTime.getDay() + 1);
    weekStart.setHours(0, 0, 0, 0);
    
    const weekDuration = 7 * 24 * 60 * 60 * 1000;
    const weekProgress = ((mexicoTime.getTime() - weekStart.getTime()) / weekDuration) * 100;
    
    updateWeekProgress(Math.min(Math.max(weekProgress, 0), 100));
}

function updateTimeDisplay(days, hours, minutes, seconds) {
    const elements = {
        days: document.getElementById('days'),
        hours: document.getElementById('hours'),
        minutes: document.getElementById('minutes'),
        seconds: document.getElementById('seconds')
    };
    
    if (elements.days) elements.days.textContent = days;
    if (elements.hours) elements.hours.textContent = hours;
    if (elements.minutes) elements.minutes.textContent = minutes;
    if (elements.seconds) elements.seconds.textContent = seconds;
}

function updateWeekProgress(percentage) {
    const progressFill = document.getElementById('weekProgress');
    const progressText = document.getElementById('progressPercentage');
    
    if (progressFill) {
        progressFill.style.width = percentage + '%';
    }
    
    if (progressText) {
        progressText.textContent = Math.round(percentage) + '%';
    }
}

// ================================
// UTILITY FUNCTIONS
// ================================
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ================================
// ERROR HANDLING
// ================================
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled promise rejection:', e.reason);
});

// ================================
// EXPORT GLOBAL FUNCTIONS
// ================================
// Make functions available globally for HTML onclick events
window.showTab = showTab;
window.openPlayerModal = openPlayerModal;
window.closePlayerModal = closePlayerModal;
window.clearSearch = clearSearch;
window.createStatCardExplosion = createStatCardExplosion;