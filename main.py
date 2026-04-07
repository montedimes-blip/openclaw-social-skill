import os
import requests
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq
from atproto import Client, models

# Load Keys from .env
load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

app = FastAPI()

# Allow the browser extension to talk to this server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Groq Client
groq_client = Groq(api_key=GROQ_API_KEY)

# ==========================================
# DATA STRUCTURES
# ==========================================
class PostRequest(BaseModel):
    niche: str

class PostToBlueskyRequest(BaseModel):
    handle: str
    app_password: str
    text: str

class AuthRequest(BaseModel):
    handle: str
    app_password: str

class ReplyDraftRequest(BaseModel):
    comment_text: str

class SendReplyRequest(BaseModel):
    handle: str
    app_password: str
    text: str
    parent_uri: str
    parent_cid: str


# ==========================================
# 1. CORE GENERATION & POSTING
# ==========================================
@app.post("/generate-drafts")
async def generate_drafts(request: PostRequest):
    print(f"Generating drafts for niche: '{request.niche}'")
    
    news_context = ""
    try:
        # Use Google News RSS for live, smart search results
        query = request.niche if request.niche else "Top US News"
        encoded_query = urllib.parse.quote(query)
        rss_url = f"https://news.google.com/rss/search?q={encoded_query}&hl=en-US&gl=US&ceid=US:en"
        
        res = requests.get(rss_url)
        root = ET.fromstring(res.content)
        
        # Grab the top 3 articles from the feed
        items = root.findall('./channel/item')[:3]
        
        if items:
            headlines = [item.find('title').text for item in items]
            news_context = "LATEST BREAKING NEWS: " + " | ".join(headlines)
            print("Fetched Google Headlines:", news_context)
        else:
            return {"drafts": [f"Error: Even Google couldn't find breaking news for '{request.niche}'. Try a different search term."]}
            
    except Exception as e:
        print(f"Google News Fetch Error: {e}")
        return {"drafts": ["Error: Could not fetch live news from Google."]}

    # Get today's date to ground the AI
    current_date = datetime.now().strftime("%A, %B %d, %Y")

    # Generate the 3 Viral Takes
    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system", 
                    "content": f"""You are a high-engagement viral social media strategist based in the United States. 
                    Today's date is {current_date}.
                    
                    CRITICAL RULES:
                    - STRICT FACTUAL GROUNDING: You MUST ONLY write about the exact events, people, and organizations mentioned in the LATEST BREAKING NEWS context. DO NOT invent, assume, or hallucinate fake details.
                    - TONE & LANGUAGE: You MUST write in native, conversational American English. Use strictly United States terminology, slang, and spelling (e.g., use "gas station" never "servo", "truck" never "lorry").
                    - LENGTH & DEPTH (CRITICAL): Write detailed, meaty posts. You MUST use the available space. Each post MUST be between 240 and 290 characters long. Expand on the facts, add sharp analysis, or ask a provocative question to increase the length. DO NOT write short, one-sentence posts.
                    - Write highly engaging, opinionated, viral-style commentary about the news context. DO NOT just write generic templates.
                    - Use the actual, specific names of the entities involved.
                    - If the news context is empty or irrelevant, you MUST output exactly: "Error: No specific news facts found for this topic.|Error: Try a different search term.|Error: News feed returned no factual events."
                    - Do not include bullet points, titles, or persona labels.
                    - Max 2 emojis and 1 hashtag per post.
                    - Only give me the exact text to post.
                    - Separate each post with a | character. No intro or outro text."""
                },
                {
                    "role": "user", 
                    "content": f"Topic: {request.niche if request.niche else 'General Breaking News'}. {news_context}"
                }
            ]
        )
        raw_content = completion.choices[0].message.content
        drafts = [p.strip()[:300] for p in raw_content.split('|') if p.strip()]
        return {"drafts": drafts}
    except Exception as e:
        print(f"AI Error: {e}")
        return {"error": str(e)}

@app.post("/post-to-bluesky")
async def post_to_bluesky(request: PostToBlueskyRequest):
    print(f"Attempting post for user: {request.handle}")
    try:
        client = Client()
        client.login(request.handle, request.app_password)
        client.send_post(request.text)
        return {"status": "success"}
    except Exception as e:
        print(f"Post error: {e}")
        return {"status": "error", "message": str(e)}


# ==========================================
# 2. REPLY & ENGAGEMENT PIPELINE
# ==========================================
@app.post("/generate-reply-drafts")
async def generate_reply_drafts(request: ReplyDraftRequest):
    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system", 
                    "content": """You are a witty, engaging social media manager based in the US.
                    You are replying to a user's comment on your post.
                    
                    CRITICAL RULES:
                    - Keep it short, punchy, and conversational (under 150 characters).
                    - Match the vibe of the user (if they are joking, joke back. If they ask a question, answer it).
                    - Use native American English slang if appropriate.
                    - Do NOT be defensive or rude.
                    - Max 1 emoji.
                    - Only output the exact text of the reply. 
                    - Separate 3 draft options with a | character. No intro or outro text."""
                },
                {
                    "role": "user", 
                    "content": f"User's comment to reply to: {request.comment_text}"
                }
            ]
        )
        raw_content = completion.choices[0].message.content
        drafts = [p.strip()[:150] for p in raw_content.split('|') if p.strip()]
        return {"drafts": drafts}
    except Exception as e:
        print(f"AI Reply Error: {e}")
        return {"error": str(e)}

@app.post("/get-unread-replies")
async def get_unread_replies(request: AuthRequest):
    try:
        client = Client()
        client.login(request.handle, request.app_password)
        
        # Fetch recent notifications
        response = client.app.bsky.notification.list_notifications()
        
        replies = []
        for notif in response.notifications:
            # Grabs recent replies even if you already saw them on the Bluesky app.
            if notif.reason == 'reply':
                replies.append({
                    "text": notif.record.text,
                    "author": notif.author.handle,
                    "uri": notif.uri,
                    "cid": notif.cid
                })
                
        # Return only the 5 most recent replies so the extension UI stays clean
        return {"replies": replies[:5]}
    except Exception as e:
        print(f"Fetch replies error: {e}")
        return {"error": str(e)}

# THIS IS THE MISSING ROUTE THAT FIXES THE 404 ERROR
@app.post("/send-reply")
async def send_reply(request: SendReplyRequest):
    print(f"Attempting to reply to CID: {request.parent_cid}")
    try:
        client = Client()
        client.login(request.handle, request.app_password)
        
        # Bluesky requires a "ReplyRef" to thread conversations together
        reply_ref = models.AppBskyFeedPost.ReplyRef(
            parent=models.ComAtprotoRepoStrongRef.Main(
                cid=request.parent_cid, 
                uri=request.parent_uri
            ),
            root=models.ComAtprotoRepoStrongRef.Main(
                cid=request.parent_cid, 
                uri=request.parent_uri
            )
        )
        
        # Send the post attached to the specific comment
        client.send_post(
            text=request.text,
            reply_to=reply_ref
        )
        return {"status": "success", "message": "Reply posted!"}
    except Exception as e:
        print(f"Reply error: {e}")
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)