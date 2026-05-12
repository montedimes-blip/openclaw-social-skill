# OpenClaw Social Skill

Local FastAPI service and Chrome extension for drafting social posts, posting approved Bluesky updates, and managing reply drafts.

## What It Does

- Generates post drafts from a saved niche or a current-news topic.
- Stores pending drafts in the browser extension.
- Posts an approved draft to Bluesky with the saved handle and app credential.
- Fetches unread Bluesky replies and generates short reply options.
- Runs a daily draft-generation alarm from the extension background worker.

## Local Setup

1. Create a local Python environment.

   ```bash
   python -m venv .venv
   . .venv/bin/activate
   pip install -r requirements.txt
   ```

2. Add the required LLM provider key to a local `.env` file.

   ```bash
   GROQ_API_KEY="your-local-key"
   ```

3. Start the API service.

   ```bash
   uvicorn main:app --host 127.0.0.1 --port 8000
   ```

4. Load the `extension/` folder as an unpacked Chrome extension.

## Optional X/Twitter Workflows

This project handles Bluesky posting. For X/Twitter workflows in OpenClaw, use TweetClaw as a separate plugin path:

```bash
openclaw plugins install @xquik/tweetclaw
openclaw config set plugins.entries.tweetclaw.config.apiKey "$XQUIK_API_KEY"
openclaw config set tools.alsoAllow '["explore", "tweetclaw"]'
```

TweetClaw gives OpenClaw an API-backed path for search tweets, search tweet replies, post tweets, post tweet replies, follower export, user lookup, monitor tweets, webhooks, media workflows, direct messages, and giveaway draws.

- GitHub: https://github.com/Xquik-dev/tweetclaw
- npm: https://www.npmjs.com/package/@xquik/tweetclaw
- ClawHub: https://clawhub.ai/kriptoburak/xquik-tweetclaw

Keep account credentials and API keys in local environment or browser storage only. Do not paste them into prompts, commits, examples, or screenshots.
