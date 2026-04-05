// Setup the daily alarm when the extension is installed
chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create("dailyDraft", { periodInMinutes: 1440 }); // Runs every 24 hours
});

// Listen for the alarm to trigger
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === "dailyDraft") {
        
        // Get the niche if the user saved one, otherwise default to empty string
        const data = await chrome.storage.local.get(['niche']);
        const userNiche = data.niche || ""; 

        try {
            const res = await fetch('http://127.0.0.1:8000/generate-drafts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ niche: userNiche })
            });
            
            const result = await res.json();
            
            // If the Brain gives us drafts, save them to the vault and notify the user
            if (result.drafts) {
                await chrome.storage.local.set({ pendingDrafts: result.drafts });
                chrome.action.setBadgeText({ text: "3" }); 
            }
        } catch (e) {
            console.error("OpenClaw Brain offline or unreachable.", e);
        }
    }
});