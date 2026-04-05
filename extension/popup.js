document.addEventListener('DOMContentLoaded', async () => {
    const resultsDiv = document.getElementById('results');
    const settingsMenu = document.getElementById('settingsMenu');
    
    // ==========================================
    // 1. INITIALIZATION & SETTINGS MENU
    // ==========================================

    // Toggle the settings menu open/closed
    document.getElementById('settingsIcon').onclick = () => {
        settingsMenu.style.display = settingsMenu.style.display === 'none' ? 'block' : 'none';
    };

    // Load existing credentials into the input boxes if they exist
    chrome.storage.local.get(['handle', 'app_password'], (data) => {
        if (data.handle) document.getElementById('bskyHandle').value = data.handle;
        if (data.app_password) document.getElementById('bskyPassword').value = data.app_password;
    });

    // Save Settings Button Logic
    document.getElementById('saveCredsBtn').onclick = () => {
        const handle = document.getElementById('bskyHandle').value.trim();
        const appPassword = document.getElementById('bskyPassword').value.trim();
        
        chrome.storage.local.set({ handle: handle, app_password: appPassword }, () => {
            const msg = document.getElementById('saveMsg');
            msg.innerText = "Credentials Saved! ✅";
            setTimeout(() => msg.innerText = "", 2000); // Clear success message after 2s
        });
    };

    // Load saved niche on open
    chrome.storage.local.get(['niche'], (data) => {
        if (data.niche) document.getElementById('nicheInput').value = data.niche;
    });

    // Load pending drafts if you have a notification badge
    chrome.storage.local.get(['pendingDrafts'], (data) => {
        if (data.pendingDrafts && data.pendingDrafts.length > 0) {
            renderDrafts(data.pendingDrafts);
        }
    });

    // ==========================================
    // 2. GENERATE & REJECT LOGIC
    // ==========================================

    // Generate Button Click
    document.getElementById('generateBtn').onclick = async () => {
        const niche = document.getElementById('nicheInput').value.trim();
        chrome.storage.local.set({ niche: niche }); 
        
        resultsDiv.innerHTML = `<i>${niche ? "AI is drafting..." : "Fetching Today's Top Story..."}</i>`;
        
        try {
            // Note: Update this URL once you deploy to Render!
            const response = await fetch('http://127.0.0.1:8000/generate-drafts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ niche: niche })
            });
            const data = await response.json();
            
            if (data.drafts) {
                await chrome.storage.local.set({ pendingDrafts: data.drafts });
                chrome.action.setBadgeText({ text: "3" }); // Show the notification badge
                renderDrafts(data.drafts);
            } else {
                resultsDiv.innerText = "Error generating drafts.";
            }
        } catch (err) {
            resultsDiv.innerText = "Cannot connect to the Python Brain. Is the server running?";
        }
    };

    // Reject All Button Click
    document.getElementById('clearBtn').onclick = () => {
        chrome.storage.local.remove('pendingDrafts', () => {
            resultsDiv.innerHTML = "<b>Drafts cleared. Ready for the next batch!</b>";
            chrome.action.setBadgeText({ text: "" }); // Remove the notification badge
        });
    };

    // ==========================================
    // 3. RENDER UI & POST TO BLUESKY
    // ==========================================

    // Render the cards
    function renderDrafts(drafts) {
        resultsDiv.innerHTML = "";
        drafts.forEach((draft) => {
            const div = document.createElement('div');
            div.className = 'card';
            div.innerText = draft;
            
            const btn = document.createElement('button');
            btn.innerText = "Post Now";
            btn.className = 'post-btn';
            
            btn.onclick = async () => {
                btn.innerText = "Posting...";
                
                // Fetch secure credentials from the local browser vault
                chrome.storage.local.get(['handle', 'app_password'], async (creds) => {
                    if (!creds.handle || !creds.app_password) {
                        alert("Please save your Handle and App Password in the ⚙️ settings first!");
                        btn.innerText = "Post Now";
                        return;
                    }
                    
                    try {
                        // Note: Update this URL once you deploy to Render!
                        const res = await fetch('http://127.0.0.1:8000/post-to-bluesky', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                handle: creds.handle,
                                app_password: creds.app_password,
                                text: draft
                            })
                        });
                        const result = await res.json();
                        
                        if (result.status === "success") {
                            btn.innerText = "Posted! ✅";
                            btn.style.background = "#28a745";
                            btn.disabled = true;
                        } else {
                            btn.innerText = "Error";
                            alert("Error: " + result.message);
                        }
                    } catch (e) {
                        btn.innerText = "Error Connecting";
                    }
                });
            };
            
            div.appendChild(btn);
            resultsDiv.appendChild(div);
        });
    }
});