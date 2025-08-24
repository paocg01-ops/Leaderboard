// ===== DYNAMIC TIMESTAMP FUNCTIONS =====

// Ensure Supabase client is initialized properly
function initializeSupabaseClient() {
    if (!window.sb && window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
        window.sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
        console.log('✅ Supabase client initialized in dynamic-timestamp.js');
    }
    return window.sb;
}
async function getLastUpdateTimestamp() {
    try {
        // Use the global Supabase client (sb) instead of creating a new one
        const supabaseClient = window.sb || initializeSupabaseClient();
        if (!supabaseClient) {
            console.error('❌ Supabase client not available for timestamp query');
            return null;
        }

        console.log('🔍 Querying raw_chests for latest timestamp...');
        
        // Try multiple column name variations to handle different schemas
        const possibleColumns = ['DATE', 'date', 'created_at', 'updated_at', 'timestamp'];
        let result = null;
        
        for (const column of possibleColumns) {
            try {
                const { data, error } = await supabaseClient
                    .from('raw_chests')
                    .select(column)
                    .order(column, { ascending: false })
                    .limit(1);
                
                if (!error && data && data.length > 0) {
                    console.log(`✅ Found timestamp using column: ${column}`, data[0]);
                    result = { data, column };
                    break;
                } else if (error) {
                    console.log(`⚠️ Column '${column}' failed:`, error.message);
                }
            } catch (colError) {
                console.log(`⚠️ Column '${column}' caused error:`, colError.message);
                continue;
            }
        }
        
        if (!result) {
            console.error('❌ No valid date column found in raw_chests table');
            // Let's also try to get table schema info
            const { data: schemaData } = await supabaseClient
                .from('raw_chests')
                .select('*')
                .limit(1);
            console.log('📊 Available columns:', schemaData ? Object.keys(schemaData[0] || {}) : 'Unable to fetch');
            return null;
        }
        
        const dateValue = result.data[0][result.column];
        const timestamp = new Date(dateValue);
        
        if (isNaN(timestamp.getTime())) {
            console.error('❌ Invalid date format:', dateValue);
            return null;
        }
        
        console.log('✅ Successfully parsed timestamp:', timestamp);
        return timestamp;
        
    } catch (e) {
        console.error('❌ Error querying last update:', e);
        return null;
    }
}

function formatTimestampInUserTimezone(utcDate) {
    if (!utcDate) return 'Unknown';
    
    try {
        // Get user's timezone using Intl.DateTimeFormat
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        // Get friendly timezone name
        const friendlyTimezone = getFriendlyTimezoneName(userTimezone, utcDate);
        
        // Check if the date is today, yesterday, or this week for more context
        const now = new Date();
        const isToday = isSameDay(utcDate, now, userTimezone);
        const isYesterday = isSameDay(utcDate, new Date(now.getTime() - 24 * 60 * 60 * 1000), userTimezone);
        const thisYear = now.getFullYear();
        const updateYear = utcDate.getFullYear();
        const isThisYear = thisYear === updateYear;
        
        if (isToday) {
            // Today: "Today at 2:30 PM"
            const timeStr = utcDate.toLocaleString('en-US', {
                timeZone: userTimezone,
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
            return `Today at ${timeStr}`;
            
        } else if (isYesterday) {
            // Yesterday: "Yesterday at 2:30 PM"  
            const timeStr = utcDate.toLocaleString('en-US', {
                timeZone: userTimezone,
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
            return `Yesterday at ${timeStr}`;
            
        } else if (isThisYear) {
            // This year: "Aug 23 at 2:30 PM"
            const dateTimeStr = utcDate.toLocaleString('en-US', {
                timeZone: userTimezone,
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
            
            // Split and rearrange: "Aug 23, 2:30 PM" -> "Aug 23 at 2:30 PM"
            const parts = dateTimeStr.split(', ');
            if (parts.length === 2) {
                return `${parts[0]} at ${parts[1]}`;
            }
            return dateTimeStr;
            
        } else {
            // Different year: "Aug 23, 2024 at 2:30 PM" 
            const dateTimeStr = utcDate.toLocaleString('en-US', {
                timeZone: userTimezone,
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
            
            // Rearrange to natural format
            const parts = dateTimeStr.split(', ');
            if (parts.length === 3) {
                // ["Aug 23", "2024", "2:30 PM"] -> "Aug 23, 2024 at 2:30 PM"
                return `${parts[0]}, ${parts[1]} at ${parts[2]}`;
            }
            return dateTimeStr;
        }
        
    } catch (e) {
        console.error('Error formatting timestamp:', e);
        return 'Formatting error';
    }
}

// Helper function to get friendly timezone names
function getFriendlyTimezoneName(timezone, date) {
    try {
        // Get the long timezone name which is usually more user-friendly
        const longName = date.toLocaleString('en-US', {
            timeZone: timezone,
            timeZoneName: 'long'
        }).split(' ').slice(-2).join(' '); // Get last two words (e.g., "Central Standard Time")
        
        // Map common long names to shorter friendly names
        const friendlyNames = {
            'Eastern Standard Time': 'Eastern Time',
            'Eastern Daylight Time': 'Eastern Time', 
            'Central Standard Time': 'Central Time',
            'Central Daylight Time': 'Central Time',
            'Mountain Standard Time': 'Mountain Time',
            'Mountain Daylight Time': 'Mountain Time',
            'Pacific Standard Time': 'Pacific Time',
            'Pacific Daylight Time': 'Pacific Time',
            'Greenwich Mean Time': 'GMT',
            'Coordinated Universal Time': 'UTC',
            'Central European Time': 'Central European Time',
            'Central European Summer Time': 'Central European Time'
        };
        
        return friendlyNames[longName] || longName;
        
    } catch (e) {
        // Fallback to short timezone name
        try {
            return date.toLocaleString('en-US', {
                timeZone: timezone,
                timeZoneName: 'short'
            }).split(' ').pop();
        } catch (e2) {
            return '';
        }
    }
}

// Helper function to check if two dates are on the same day in a specific timezone
function isSameDay(date1, date2, timezone) {
    const d1 = new Date(date1.toLocaleString('en-US', { timeZone: timezone }));
    const d2 = new Date(date2.toLocaleString('en-US', { timeZone: timezone }));
    
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
}

async function updateLastUpdatedTimestamp() {
    console.log('🕒 Updating last updated timestamp...');
    const timestampEl = document.getElementById('lastUpdatedTimestamp');
    if (!timestampEl) {
        console.error('❌ lastUpdatedTimestamp element not found');
        return;
    }
    
    // Show loading state
    timestampEl.textContent = 'Last Updated: Loading...';
    timestampEl.style.color = '#F5B642'; // Orange while loading
    
    try {
        const lastUpdate = await getLastUpdateTimestamp();
        
        if (lastUpdate) {
            const formattedTime = formatTimestampInUserTimezone(lastUpdate);
            timestampEl.textContent = `Last Updated: ${formattedTime}`;
            timestampEl.style.color = ''; // Reset color
            console.log('✅ Timestamp updated successfully:', formattedTime);
        } else {
            timestampEl.textContent = 'Last Updated: Unable to fetch';
            timestampEl.style.color = '#ff6b6b'; // Red for error
            console.error('❌ Failed to get timestamp - check console for details');
        }
    } catch (error) {
        console.error('❌ Error updating timestamp:', error);
        timestampEl.textContent = 'Last Updated: Error occurred';
        timestampEl.style.color = '#ff6b6b'; // Red for error
    }
}

// Manual refresh function for debugging
window.refreshTimestamp = function() {
    console.log('🔄 Manually refreshing timestamp...');
    updateLastUpdatedTimestamp();
};

// Auto-refresh every 30 seconds to catch new data
let timestampRefreshInterval;
function startTimestampAutoRefresh() {
    // Clear any existing interval
    if (timestampRefreshInterval) {
        clearInterval(timestampRefreshInterval);
    }
    
    // Refresh every 30 seconds
    timestampRefreshInterval = setInterval(() => {
        console.log('🔄 Auto-refreshing timestamp...');
        updateLastUpdatedTimestamp();
    }, 30000);
    
    console.log('✅ Timestamp auto-refresh started (every 30s)');
}

// Stop auto-refresh (useful for debugging)
window.stopTimestampRefresh = function() {
    if (timestampRefreshInterval) {
        clearInterval(timestampRefreshInterval);
        timestampRefreshInterval = null;
        console.log('⏹️ Timestamp auto-refresh stopped');
    }
};