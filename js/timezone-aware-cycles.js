// ===== TIMEZONE-AWARE CYCLE CALCULATIONS =====

// Override the original calculateWeekCycles function with timezone-aware version
function calculateWeekCycles() {
    try {
        // Calculate cycle times in Mexico City timezone (the server logic)
        const now = new Date();
        const mexicoTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
        let currentWeekStart = new Date(mexicoTime);
        let currentWeekEnd = new Date(mexicoTime);
        const currentDay = mexicoTime.getDay();
        const currentHour = mexicoTime.getHours();

        // Calculate cycle boundaries in Mexico City timezone
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

        // Calculate last week cycle
        const lastWeekStart = new Date(currentWeekStart.getTime() - (7 * 24 * 60 * 60 * 1000));
        const lastWeekEnd = new Date(currentWeekStart.getTime() - 1);

        // Convert Mexico City times to UTC timestamps
        const currentStartUTC = convertMexicoToUTC(currentWeekStart);
        const currentEndUTC = convertMexicoToUTC(currentWeekEnd);
        const lastStartUTC = convertMexicoToUTC(lastWeekStart);
        const lastEndUTC = convertMexicoToUTC(lastWeekEnd);

        // Format cycle dates in user's local timezone
        const currentCycleText = formatCycleInUserTimezone(currentStartUTC, currentEndUTC);
        const lastCycleText = formatCycleInUserTimezone(lastStartUTC, lastEndUTC);

        // Update the DOM elements
        const currentCycleDates = document.getElementById('currentCycleDates');
        const lastCycleDates = document.getElementById('lastCycleDates');
        
        if (currentCycleDates) currentCycleDates.textContent = currentCycleText;
        if (lastCycleDates) lastCycleDates.textContent = lastCycleText;

        // Return the cycle objects (keeping the same structure for compatibility)
        return { 
            current: { start: currentStartUTC, end: currentEndUTC }, 
            last: { start: lastStartUTC, end: lastEndUTC } 
        };
        
    } catch (e) {
        console.error('Week cycle calculation error:', e);
        const currentCycleDates = document.getElementById('currentCycleDates');
        const lastCycleDates = document.getElementById('lastCycleDates');
        if (currentCycleDates) currentCycleDates.textContent = 'Error calculating current cycle';
        if (lastCycleDates) lastCycleDates.textContent = 'Error calculating last cycle';
        return null;
    }
}

// Convert Mexico City local time to UTC
function convertMexicoToUTC(mexicoTime) {
    // Create a date string in Mexico City timezone format
    const mexicoString = mexicoTime.toLocaleString("en-US", { 
        timeZone: "America/Mexico_City",
        year: 'numeric',
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    
    // Parse it back as a Mexico City time and convert to UTC
    const [datePart, timePart] = mexicoString.split(', ');
    const [month, day, year] = datePart.split('/');
    const [hour, minute, second] = timePart.split(':');
    
    // Create the date in Mexico City timezone
    const utcTime = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour}:${minute}:${second}-06:00`);
    
    return utcTime;
}

// Format cycle dates in user's local timezone
function formatCycleInUserTimezone(startUTC, endUTC) {
    try {
        // Get user's timezone
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        // Format options for cycle display
        const formatOptions = {
            timeZone: userTimezone,
            month: 'short',
            day: 'numeric', 
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        };
        
        // Format start and end times
        const startFormatted = startUTC.toLocaleString('en-US', formatOptions);
        const endFormatted = endUTC.toLocaleString('en-US', formatOptions);
        
        // Clean up the formatting (remove year, clean up commas)
        const startClean = startFormatted.replace(/,\s*\d{4}/, '').replace(/,\s*/, ' ');
        const endClean = endFormatted.replace(/,\s*\d{4}/, '').replace(/,\s*/, ' ');
        
        return `${startClean} - ${endClean}`;
        
    } catch (e) {
        console.error('Error formatting cycle in user timezone:', e);
        return 'Error formatting cycle times';
    }
}

// Enhanced countdown that works with UTC times but displays in user timezone
function updateCountdown() {
    try {
        // Get the current cycle end time in UTC
        const cycle = window.__weekCycles?.current;
        if (!cycle || !cycle.end) {
            // Fallback to original logic if cycle not available
            return updateCountdownFallback();
        }
        
        const now = new Date();
        const diff = cycle.end.getTime() - now.getTime();

        // Support both single countdown and segmented countdown displays
        const single = document.getElementById('countdown');
        const segmented = document.getElementById('countdownDisplay');

        if (diff > 0) {
            const d = Math.floor(diff / (24*60*60*1000));
            const h = Math.floor((diff % (24*60*60*1000)) / (60*60*1000));
            const m = Math.floor((diff % (60*60*1000)) / (60*1000));
            const s = Math.floor((diff % (60*1000)) / 1000);

            if (single) single.textContent = `${d}d ${h}h ${m}m ${s}s`;
            if (segmented) {
                const set = (id, val) => { 
                    const el = document.getElementById(id); 
                    if (el) el.textContent = String(val).padStart(2, '0'); 
                };
                set('days', d);
                set('hours', h);
                set('minutes', m);
                set('seconds', s);
            }
        } else {
            if (single) single.textContent = 'Cycle ended';
            if (segmented) {
                ['days','hours','minutes','seconds'].forEach(id => { 
                    const el = document.getElementById(id); 
                    if (el) el.textContent = '00'; 
                });
            }
        }
    } catch (e) {
        console.error('Enhanced countdown error', e);
        updateCountdownFallback();
    }
}

// Fallback countdown function (original logic)
function updateCountdownFallback() {
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
        
        const single = document.getElementById('countdown');
        const segmented = document.getElementById('countdownDisplay');

        if (diff > 0) {
            const d = Math.floor(diff / (24*60*60*1000));
            const h = Math.floor((diff % (24*60*60*1000)) / (60*60*1000));
            const m = Math.floor((diff % (60*60*1000)) / (60*1000));
            const s = Math.floor((diff % (60*1000)) / 1000);

            if (single) single.textContent = `${d}d ${h}h ${m}m ${s}s`;
            if (segmented) {
                const set = (id, val) => { 
                    const el = document.getElementById(id); 
                    if (el) el.textContent = String(val).padStart(2, '0'); 
                };
                set('days', d);
                set('hours', h);
                set('minutes', m);
                set('seconds', s);
            }
        } else {
            if (single) single.textContent = 'Cycle ended';
            if (segmented) {
                ['days','hours','minutes','seconds'].forEach(id => { 
                    const el = document.getElementById(id); 
                    if (el) el.textContent = '00'; 
                });
            }
        }
    } catch (e) {
        console.error('Fallback countdown error', e);
    }
}

console.log('🌍 Timezone-aware cycle calculations loaded!');