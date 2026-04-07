document.addEventListener('DOMContentLoaded', async () => {
    const API_BASE = 'https://openclaw-social-api.onrender.com';
    
    // UI Elements
    const settingsMenu = document.getElementById('settingsMenu');
    const tabNew = document.getElementById('tabNew');
    const tabReplies = document.getElementById('tabReplies');
    const newPostSection = document.getElementById('newPostSection');
    const repliesSection = document.getElementById('repliesSection');
    const resultsDiv = document.getElementById('results');
    const replyResultsDiv = document.getElementById('replyResults');

    // ==========================================
    // 1. SETTINGS & TABS
    // ==========================================
    document.getElementById('settingsIcon').onclick = () => {
        settingsMenu.style.display = settingsMenu.style.display === 'none' ? 'block' : 'none';
    };

    chrome.storage.local.get(['handle', 'app_password', 'niche', 'pendingDrafts'], (data) => {
        if (data.handle) document.getElementById('bskyHandle').value = data.handle;
        if (data.app_password) document.getElementById('bskyPassword').value = data.app_password;
        if (data.niche) document.getElementById('nicheInput').value = data.niche;
        if (data.pendingDrafts && data.pendingDrafts.length > 0) renderDrafts(data.pendingDrafts);
    });

    document.getElementById('saveCredsBtn').onclick = () => {
        const handle = document.getElementById('bskyHandle').value.trim();
        const appPassword = document.getElementById('bskyPassword').value.trim();
        chrome.storage.local.set({ handle: handle, app_password: appPassword }, () => {
            const msg = document.getElementById('saveMsg');
            msg.innerText = "Credentials Saved! ✅";
            setTimeout(() => msg.innerText = "", 2000);
        });
    };

    tabNew.onclick = () => {
        tabNew.classList.add('active');
        tabReplies.classList.remove('active');
        newPostSection.style.display = 'block';
        repliesSection.style.display = 'none';
    };

    tabReplies.onclick = () => {
        tabReplies.classList.add('active');
        tabNew.classList.remove('active');
        repliesSection.style.display = 'block';
        newPostSection.style.display = 'none';
    };

    // ==========================================
    // 2. NEW POST LOGIC
    // ==========================================
    document.getElementById('generateBtn').onclick = async () => {
        const niche = document.getElementById('nicheInput').value.trim();
        chrome.storage.local.set({ niche: niche }); 
        resultsDiv.innerHTML = `<i>${niche ? "AI is drafting..." : "Fetching Today's Top Story..."}</i>`;
        
        try {
            const response = await fetch(`${API_BASE}/generate-drafts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ niche: niche })
            });
            const data = await response.json();
            
            if (data.drafts) {
                await chrome.storage.local.set({ pendingDrafts: data.drafts });
                chrome.action.setBadgeText({ text: "3" }); 
                renderDrafts(data.drafts);
            } else {
                resultsDiv.innerText = "Error generating drafts.";
            }
        } catch (err) {
            resultsDiv.innerText = "Cannot connect to the backend.";
        }
    };

    document.getElementById('clearBtn').onclick = () => {
        chrome.storage.local.remove('pendingDrafts', () => {
            resultsDiv.innerHTML = "<b>Drafts cleared. Ready for the next batch!</b>";
            chrome.action.setBadgeText({ text: "" }); 
        });
    };

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
                chrome.storage.local.get(['handle', 'app_password'], async (creds) => {
                    if (!creds.handle || !creds.app_password) return alert("Save settings first!");
                    try {
                        const res = await fetch(`${API_BASE}/post-to-bluesky`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ handle: creds.handle, app_password: creds.app_password, text: draft })
                        });
                        const result = await res.json();
                        if (result.status === "success") {
                            btn.innerText = "Posted! ✅";
                            btn.style.background = "#28a745";
                            btn.disabled = true;
                        } else {
                            btn.innerText = "Error";
                        }
                    } catch (e) {
                        btn.innerText = "Connection Error";
                    }
                });
            };
            div.appendChild(btn);
            resultsDiv.appendChild(div);
        });
    }

    // ==========================================
    // 3. REPLIES LOGIC
    // ==========================================
    document.getElementById('fetchRepliesBtn').onclick = () => {
        replyResultsDiv.innerHTML = "<i>Checking for new replies...</i>";
        
        chrome.storage.local.get(['handle', 'app_password'], async (creds) => {
            if (!creds.handle || !creds.app_password) return alert("Please save your Handle and App Password first!");
            
            try {
                const res = await fetch(`${API_BASE}/get-unread-replies`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ handle: creds.handle, app_password: creds.app_password })
                });
                const data = await res.json();
                
                if (data.replies && data.replies.length > 0) {
                    renderComments(data.replies);
                } else {
                    replyResultsDiv.innerHTML = "<b>No new unread replies!</b>";
                }
            } catch (e) {
                replyResultsDiv.innerHTML = "Error fetching replies.";
            }
        });
    };

    function renderComments(comments) {
        replyResultsDiv.innerHTML = "";
        comments.forEach(comment => {
            const div = document.createElement('div');
            div.className = 'card comment-card';
            div.innerHTML = `<b>@${comment.author}</b><br><span style="font-size:13px;">"${comment.text}"</span>`;
            
            const genBtn = document.createElement('button');
            genBtn.innerText = "Generate AI Replies";
            genBtn.className = 'gen-btn';
            genBtn.style.marginTop = "10px";
            
            const optionsDiv = document.createElement('div');
            
            genBtn.onclick = async () => {
                genBtn.innerText = "Thinking...";
                try {
                    const res = await fetch(`${API_BASE}/generate-reply-drafts`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ comment_text: comment.text })
                    });
                    const data = await res.json();
                    
                    if (data.drafts) {
                        genBtn.style.display = 'none';
                        data.drafts.forEach(draft => {
                            const dDiv = document.createElement('div');
                            dDiv.style.borderTop = "1px dashed #ccc";
                            dDiv.style.paddingTop = "8px";
                            dDiv.style.marginTop = "8px";
                            dDiv.innerText = draft;
                            
                            const replyBtn = document.createElement('button');
                            replyBtn.innerText = "Send This Reply";
                            replyBtn.className = 'post-btn';
                            
                            replyBtn.onclick = async () => {
                                replyBtn.innerText = "Sending...";
                                chrome.storage.local.get(['handle', 'app_password'], async (creds) => {
                                    try {
                                        const rRes = await fetch(`${API_BASE}/send-reply`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                handle: creds.handle,
                                                app_password: creds.app_password,
                                                text: draft,
                                                parent_uri: comment.uri,
                                                parent_cid: comment.cid
                                            })
                                        });
                                        const rData = await rRes.json();
                                        if (rData.status === "success") {
                                            replyBtn.innerText = "Replied! ✅";
                                            replyBtn.style.background = "#28a745";
                                            optionsDiv.innerHTML = ""; // Clear other options
                                        } else {
                                            replyBtn.innerText = "Error";
                                        }
                                    } catch (e) {
                                        replyBtn.innerText = "Connection Error";
                                    }
                                });
                            };
                            dDiv.appendChild(replyBtn);
                            optionsDiv.appendChild(dDiv);
                        });
                    }
                } catch (e) {
                    genBtn.innerText = "Error generating drafts";
                }
            };
            
            div.appendChild(genBtn);
            div.appendChild(optionsDiv);
            replyResultsDiv.appendChild(div);
        });
    }
});