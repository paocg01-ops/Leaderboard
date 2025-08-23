// ===== PROPER SUPABASE INITIALIZATION =====

// Set the credentials globally so they're available
window.SUPABASE_URL = "https://dcxljettjctekbhxcyrw.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjeGxqZXR0amN0ZWtiaHhjeXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzMDYyOTgsImV4cCI6MjA3MDg4MjI5OH0.X7OWTobYUQqKJA41BlozsMqqqRd_ndO-uh9gxRv9s7U";

// Initialize Supabase client when the library is ready
function initSupabaseClient() {
    if (window.supabase && !window.sb) {
        try {
            window.sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
            console.log('✅ Supabase client initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Supabase client:', error);
            return false;
        }
    } else if (window.sb) {
        console.log('✅ Supabase client already initialized');
        return true;
    } else {
        console.warn('⚠️ Supabase library not yet loaded');
        return false;
    }
}

// Try to initialize immediately
initSupabaseClient();

// Also try when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for Supabase library to load
    setTimeout(() => {
        initSupabaseClient();
    }, 100);
});