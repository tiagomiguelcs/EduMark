# EduMark
<p align="center">
  <img style="width:148px; height:auto" src="public/logo.png"/><br/>
  <b>EduMark - Educational Markdown Viewer</b>
</p>

EduMark is a small Markdown viewer for educational environments that can render Markdown files hosted in a GitHub repository and present them with a table-of-contents and a simple layout.

**Features:**
- **Render Markdown** with `markdown-it` and useful plugins (anchors, TOC, marks, containers).
- **Fetch Markdown files** directly from a GitHub repo (by filename and branch).
- **Live preview mode** for local Markdown files with auto-reload on file changes.
- **Syntax highlightin**g for code blocks (via highlight.js).
- **Custom containers** (info, warning, danger, success, and references).
- Lightweight, single-file server (`edumark.js`).

## Quick Start
Prerequisites
- Node.js 18+ recommended.
- GitHub personal access token (if you plan to fetch files from a private repo).

1. Clone and install dependencies
```bash
git clone <repo-url> && cd EduMark && npm install
```
2. Create a .env file (example)
Create a `.env` file in the project root with these variables:
```env
GITHUB_TOKEN=ghp_...        # GitHub personal access token (optional for public repos, required for private)
GITHUB_OWNER=your-org-or-username
GITHUB_REPO=your-repo-name
PREVIEW_FOLDER=/path/to/your/local/markdown/files  # Optional: for local preview mode
```
3. Run the server for development or production deployment
```bash
# To test or develop:
npm run dev
# To deploy:
npm run deploy
```

## Usage

### 1. View Markdown from GitHub Repository
Render Markdown files stored in your GitHub repository:
```
GET /view?filename=<file.md>&branch=<branch>
```
- `filename` must be a safe base filename (no path separators, must end with `.md`).
- `branch` defaults to `main` if omitted.
- The server expects `GITHUB_OWNER`, `GITHUB_REPO` and (for private repos) `GITHUB_TOKEN` to be set in environment.

**Example:**
```
http://localhost:3131/view?filename=LP-Lecture-01.md&branch=main
```

### 2. Preview Local Markdown Files (with Live Reload)
Preview Markdown files from your local filesystem with automatic reload when the file changes:
```
GET /preview?filename=<file.md>
```
**Example:**
```
http://localhost:3131/preview?filename=lecture-notes.md
```

**Setup:**
1. Set `PREVIEW_FOLDER` in your `.env` file to the directory containing your Markdown files:
   ```env
   PREVIEW_FOLDER=/Users/yourname/Documents/lectures
   ```
2. Place your Markdown files in that folder.
3. Open the preview URL in your browser.
4. Edit and save your Markdown file.

**Notes:**
- `filename` must be just the filename (no paths), ending with `.md`.
- The file must exist in the `PREVIEW_FOLDER` directory.
- Live reload checks for file changes every 2 seconds.
- Perfect for writing and previewing lecture notes in real-time before a push to a repo.
