# Web & Browser Tools Setup Guide

## Installation

After updating requirements.txt, install the new dependencies:

```bash
pip install playwright beautifulsoup4 duckduckgo-search
```

## Playwright Chrome Setup

Playwright needs to download the Chrome browser:

```bash
playwright install chrome
```

This will download Google Chrome for automation (separate from your regular Chrome installation).

## Available Web Tools

### 1. **WebSearchTool** (`web_search`)
Search the web using DuckDuckGo (no API key needed).

**Example commands:**
- "Search the web for latest AI news"
- "What's the weather in New York?"
- "Search for Python tutorials"

**Parameters:**
- `query` (required): Search query
- `max_results` (optional): Number of results (default: 5)

---

### 2. **WebScraperTool** (`web_scraper`)
Extract clean text content from any webpage.

**Example commands:**
- "Read the article at example.com"
- "What does this page say: github.com/..."
- "Scrape content from wikipedia.org/..."

**Parameters:**
- `url` (required): URL to scrape
- `max_length` (optional): Max characters (default: 2000)

**Security:** Only reads public content, no form submission or login.

---

### 3. **OpenURLTool** (`open_url`)
Open any URL in Google Chrome.

**Example commands:**
- "Open youtube.com"
- "Open github.com in Chrome"
- "Go to google.com"

**Parameters:**
- `url` (required): URL to open

**Security:** Requires user confirmation for untrusted domains.

---

### 4. **SearchGoogleTool** (`search_google`)
Quick Google search in Chrome.

**Example commands:**
- "Google search for Python programming"
- "Search Google for best restaurants near me"

**Parameters:**
- `query` (required): Search query

---

### 5. **SearchYouTubeTool** (`search_youtube`)
Search YouTube and open results in Chrome.

**Example commands:**
- "Search YouTube for coding tutorials"
- "Find music videos on YouTube"
- "YouTube search for funny cats"

**Parameters:**
- `query` (required): Search query

---

## Security Restrictions

All web tools respect JARVIS security policy:

✅ **Allowed:**
- Web searches (DuckDuckGo)
- Reading public webpage content
- Opening URLs in Chrome (with confirmation for untrusted sites)
- Searching Google/YouTube

❌ **Forbidden:**
- Downloading files
- Submitting forms
- Logging into websites
- Executing JavaScript
- Browser automation scripts
- Uploading files

⚠️ **High-Risk (Requires Confirmation):**
- Opening URLs not in trusted domain list
- Any action involving external communication

## Trusted Domains

Pre-approved domains that don't require confirmation:
- google.com
- youtube.com
- github.com
- stackoverflow.com
- wikipedia.org
- microsoft.com
- apple.com

## Usage Examples

### Search the web
```
User: "Search the web for latest Python news"
JARVIS: [Uses WebSearchTool]
JARVIS: "Found 5 results about Python news..."
```

### Open a website
```
User: "Open YouTube"
JARVIS: [Uses OpenURLTool]
JARVIS: "Opened youtube.com in Chrome"
```

### Search YouTube
```
User: "Search YouTube for lofi music"
JARVIS: [Uses SearchYouTubeTool]
JARVIS: "Searched YouTube for lofi music"
```

### Read webpage content
```
User: "What does this article say: example.com/article"
JARVIS: [Uses WebScraperTool]
JARVIS: "The article discusses..."
```

## Chrome vs Edge

All browser tools are configured to use **Google Chrome**, not Microsoft Edge:
- `OpenURLTool`: Uses Chrome path detection
- `BrowserControlTool`: Uses Playwright with `channel="chrome"`

## Troubleshooting

### Chrome not found
If Chrome isn't detected, the tool will fall back to the default browser. To fix:
1. Install Google Chrome
2. Ensure it's in a standard location:
   - `C:\Program Files\Google\Chrome\Application\chrome.exe`
   - `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`

### Playwright errors
If you get Playwright errors:
```bash
playwright install chrome
```

### DuckDuckGo search fails
The tool uses the free DuckDuckGo API. If it fails:
- Check internet connection
- Try again (rate limiting)
- Update library: `pip install -U duckduckgo-search`

## Performance Notes

- **WebSearchTool**: Fast, no browser needed
- **WebScraperTool**: Fast, lightweight HTTP request
- **Browser tools**: Slower, launches actual Chrome browser
- Use search/scraper for quick info, browser for visual interaction
