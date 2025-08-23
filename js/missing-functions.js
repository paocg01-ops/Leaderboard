// ===== MISSING FUNCTIONS FOR LOCAL TESTING =====

// Function to create stat card explosion animation
function createStatCardExplosion(element, type) {
    const emojiSets = {
        'pancakes': ['🥞', '👏', '🎉', '✨', '🌟', '💫', '🎊', '🙌', '👏', '🥳'],
        'treats': ['🍪', '🎁', '✨', '🌟', '💝', '🎀', '🧁', '🍰', '💫', '🎊'],
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
    explosion.style.position = 'absolute';
    explosion.style.top = '50%';
    explosion.style.left = '50%';
    explosion.style.pointerEvents = 'none';
    explosion.style.zIndex = '1000';
    element.appendChild(explosion);
    
    // Create multiple emoji particles
    for (let i = 0; i < 15; i++) {
        const particle = document.createElement('div');
        particle.className = 'stat-emoji-particle';
        particle.textContent = emojiSet[Math.floor(Math.random() * emojiSet.length)];
        particle.style.position = 'absolute';
        particle.style.fontSize = '1.5rem';
        particle.style.color = color;
        particle.style.textShadow = `0 0 15px ${color}`;
        particle.style.pointerEvents = 'none';
        
        // Random position around the element
        const angle = (i / 15) * 2 * Math.PI + (Math.random() * 0.5 - 0.25);
        const distance = 40 + Math.random() * 40;
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;
        
        particle.style.left = '0px';
        particle.style.top = '0px';
        particle.style.transform = `translate(-50%, -50%)`;
        
        // Create unique keyframe for each particle
        const animationName = `statExplode-${type}-${i}-${Date.now()}`;
        particle.style.animation = `${animationName} 2s ease-out forwards`;
        
        // Create and inject the keyframe animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes ${animationName} {
                0% {
                    opacity: 1;
                    transform: translate(-50%, -50%) scale(0) rotate(0deg);
                }
                30% {
                    opacity: 1;
                    transform: translate(-50%, -50%) scale(1) rotate(180deg) translate(${x * 0.3}px, ${y * 0.3}px);
                }
                100% {
                    opacity: 0;
                    transform: translate(-50%, -50%) scale(0.3) rotate(360deg) translate(${x}px, ${y}px);
                }
            }
        `;
        document.head.appendChild(style);
        
        explosion.appendChild(particle);
        
        // Clean up after animation
        setTimeout(() => {
            style.remove();
        }, 2000);
    }
    
    // Remove explosion container after animation
    setTimeout(() => {
        explosion.remove();
    }, 2000);
}

// Add CSS for explosion animation if it doesn't exist
if (!document.querySelector('#explosion-styles')) {
    const explosionStyles = document.createElement('style');
    explosionStyles.id = 'explosion-styles';
    explosionStyles.textContent = `
        .stat-explosion {
            position: absolute;
            pointer-events: none;
            z-index: 1000;
        }
        
        .stat-emoji-particle {
            position: absolute;
            font-size: 1.5rem;
            font-weight: bold;
            pointer-events: none;
            user-select: none;
        }
        
        .stat-card {
            position: relative;
            overflow: visible;
        }
    `;
    document.head.appendChild(explosionStyles);
}

// Placeholder for players_live if it doesn't exist
if (typeof players_live === 'undefined') {
    window.players_live = [];
}

console.log('Missing functions loaded successfully!');