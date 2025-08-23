// ===== EMOJI FIX FOR CORRUPTED CHARACTERS =====

// Override the corrupted functions with proper emoji versions
function trophyForRank(rank) {
  if (rank === 1) return '<span class="trophy gold">🏆</span>';
  if (rank === 2) return '<span class="trophy silver">🥈</span>';
  if (rank === 3) return '<span class="trophy bronze">🥉</span>';
  return '';
}

function fixCorruptedEmojis() {
    // Complete map of corrupted characters to proper emojis
    const emojiMap = {
        // Your specific reported corrupted characters
        'ƒºü': '🥞',   // clan emblem pancake (without leading chars)
        'ƒÑç': '🏆',   // gold trophy (without leading chars)
        'ÔjÉ': '⭐',   // star for points (your specific corruption)
        'ÔëÑ': '≥',    // greater than or equal
        'Ô£à': '✅',   // checkmark for earned
        'ƒì¬': '🍪',   // cookie for treats (without leading chars)
        'ƒÄ»': '🎯',   // target/ready for battle (without leading chars)
        
        // Original corrupted characters (with leading chars)
        '­ƒºü': '🥞', // clan emblem pancake
        '­ƒÑç': '🏆', // gold trophy
        '­ƒÑê': '🥈', // silver trophy  
        '­ƒÑë': '🥉', // bronze trophy
        '­ƒÄ»': '🎯', // target/ready for battle
        'Ô¡É': '⭐', // star for points
        '­ƒì¬': '🍪', // cookie for treats/chests
        '­ƒÿö': '🔍', // magnifying glass for search
        '­ƒöì': '🎯', // target for found results
        'ÔåÆ': '→', // arrow
        
        // Additional variations that might appear
        'Ã¢Â˜Â': '⭐', // another star variation
        'ðŸ': '🍪', // cookie variation
        'ðŸ¥ž': '🥞', // pancake variation
        'ðŸ†': '🏆', // trophy variation
    };
    
    // Get all text nodes in the document
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );
    
    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
        textNodes.push(node);
    }
    
    // Replace corrupted emojis in text nodes
    textNodes.forEach(textNode => {
        let text = textNode.textContent;
        let modified = false;
        
        for (const [corrupt, emoji] of Object.entries(emojiMap)) {
            if (text.includes(corrupt)) {
                text = text.replace(new RegExp(corrupt, 'g'), emoji);
                modified = true;
            }
        }
        
        if (modified) {
            textNode.textContent = text;
        }
    });
    
    // Also fix innerHTML content that might contain these characters
    document.querySelectorAll('*').forEach(element => {
        if (element.innerHTML && typeof element.innerHTML === 'string') {
            let html = element.innerHTML;
            let modified = false;
            
            for (const [corrupt, emoji] of Object.entries(emojiMap)) {
                if (html.includes(corrupt)) {
                    html = html.replace(new RegExp(corrupt, 'g'), emoji);
                    modified = true;
                }
            }
            
            if (modified && !element.querySelector('script')) { // Don't modify script tags
                element.innerHTML = html;
            }
        }
    });
    
    console.log('🔧 Fixed corrupted emoji characters!');
}

// Set up a mutation observer to fix emojis when new content is added
function setupEmojiObserver() {
    const observer = new MutationObserver((mutations) => {
        let shouldFix = false;
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // Check if any added nodes contain text or are elements
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE) {
                        shouldFix = true;
                    }
                });
            }
        });
        
        if (shouldFix) {
            setTimeout(fixCorruptedEmojis, 100); // Small delay to let content settle
        }
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    console.log('👀 Emoji observer set up to watch for dynamic content');
}

// Run fixes at different stages
document.addEventListener('DOMContentLoaded', () => {
    // Initial fix
    setTimeout(fixCorruptedEmojis, 500);
    
    // Set up observer for dynamic content
    setupEmojiObserver();
    
    // Additional fixes after potential data loads
    setTimeout(fixCorruptedEmojis, 2000);
    setTimeout(fixCorruptedEmojis, 5000);
    setTimeout(fixCorruptedEmojis, 10000);
});

// Also run fixes when specific events happen
document.addEventListener('click', () => {
    setTimeout(fixCorruptedEmojis, 200); // Fix after clicks (modals, etc.)
});

// Export functions for manual use
window.fixCorruptedEmojis = fixCorruptedEmojis;
window.setupEmojiObserver = setupEmojiObserver;

console.log('🎯 Enhanced emoji fix script loaded!');