import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq
from atproto import Client

# Load environment variables
load_dotenv()

app = FastAPI()

# Allow the browser extension to talk to this server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Groq Client
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

class PostRequest(BaseModel):
    niche: str

class BlueskyPost(BaseModel):
    text: str

@app.post("/generate-drafts")
async def generate_drafts(request: PostRequest):
    print(f"Drafting for niche: {request.niche}")
    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a social media expert. Write 3 punchy posts for Bluesky. Each post must be under 280 characters. Separate posts with the | symbol. No intro text."},
                {"role": "user", "content": f"Topic: {request.niche}"}
            ]
        )
        # Split by | and truncate to 290 characters just in case
        raw_content = completion.choices[0].message.content
        drafts = [p.strip()[:290] for p in raw_content.split('|') if p.strip()]
        return {"drafts": drafts}
    except Exception as e:
        return {"error": str(e)}

@app.post("/post-to-bluesky")
async def post_to_bluesky(request: BlueskyPost):
    handle = os.getenv("BSKY_HANDLE")
    password = os.getenv("BSKY_PASSWORD")
    
    # Debug print to make sure keys are loading
    print(f"DEBUG: Using handle {handle}") 
    
    try:
        client = Client()
        client.login(handle, password)
        client.send_post(request.text)
        return {"status": "success"}
    except Exception as e:
        print(f"BLUESKY ERROR: {e}") # This prints the REAL error in your terminal
        return {"status": "error", "message": str(e)}
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)