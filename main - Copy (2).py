import os
import requests
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq
from atproto import Client

# Load Keys from .env
load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
NEWS_API_KEY = os.getenv("NEWS_API_KEY")

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

# Data structures
class PostRequest(BaseModel):
    niche: str

class PostToBlueskyRequest(BaseModel):
    handle: str
    app_password: str
    text: str

@app.post("/generate-drafts")
async def generate_drafts(request: PostRequest):
    print(f"Generating drafts for niche: '{request.niche}'")
    
    news_context = ""
    try:
        if request.niche:
            # 1. LIVE NICHE NEWS: Sort strictly by the newest published articles
            news_url = f"https://newsapi.org/v2/everything?q={request.niche}&sortBy=publishedAt&language=en&apiKey={NEWS_API_KEY}"
            news_res = requests.get(news_url).json()
            articles = news_res.get("articles", [])
        else:
            # 2. LIVE GLOBAL NEWS: If blank, get the absolute newest breaking news
            news_url = f"https://newsapi.org/v2/everything?q='breaking news'&sortBy=publishedAt&language=en&apiKey={NEWS_API_KEY}"
            news_res = requests.get(news_url).json()
            articles = news_res.get("articles", [])
        
        if articles:
            # Feed the top 3 NEWEST headlines directly to the AI
            headlines = [a['title'] for a in articles[:3]]
            news_context = "LATEST BREAKING NEWS: " + " | ".join(headlines)
            print("Fetched Headlines:", news_context)
    except Exception as e:
        print(f"News API Error: {e}")

    # 3. Generate the 3 Viral Takes
    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system", 
                    "content": """You are a high-engagement viral strategist. 
                    NEVER write generic news. Use the provided context to create 3 punchy takes about the CURRENT top story:
                    1. THE ALARMIST: High urgency, 'What happens next?' focus.
                    2. THE STRATEGIST: Analysis of the power move behind the news.
                    3. THE PROVOCATEUR: A sharp, slightly controversial opinion.
                    
                    Max 280 chars, 1-2 emojis, 1 hashtag. Separate with |. No intro text."""
                },
                {
                    "role": "user", 
                    "content": f"Topic: {request.niche if request.niche else 'General Breaking News'}. {news_context}"
                }
            ]
        )
        raw_content = completion.choices[0].message.content
        drafts = [p.strip()[:290] for p in raw_content.split('|') if p.strip()]
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)