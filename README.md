# EduMark
<p align="center">
  <img style="width:148px; height:auto" src="public/logo.png"/><br/>
  <b>EduMark - Educational Markdown Viewer</b>
</p>

**EduMark** is a lightweight Markdown viewer designed for educational settings. It renders Markdown files directly from GitHub repositories and presents them with a clean layout and an interactive table of contents, perfect for teaching, lectures, and note-based presentations.

**Features:**
- **Render Markdown** with `markdown-it` and useful plugins (anchors, TOC, marks, containers).
- **Fetch Markdown files** directly from a GitHub repo (by filename and branch).
- **Live preview mode** for local Markdown files with automatic reload on changes, ideal for writing and previewing lecture notes in real time before pushing them to a repository.
- **Syntax highlightin**g for code blocks (via highlight.js).
- **Custom containers** (info, warning, danger, success, and references).
- **Lightweight** and easily deployable as a single-file server.

## Quick Start
Prerequisites
- Node.js 18+ recommended.
- GitHub personal access token (if you plan to fetch files from a private repo).

1. Clone and install dependencies
```bash
git clone <repo-url> && cd EduMark && npm install
```
2. Create a `.env` file in the project root, or copy `.env.example` to `.env`, then update the following variables:
```env
GITHUB_TOKEN=ghp_... # GitHub personal access token (optional for public repos, required for private)
GITHUB_OWNER=your-org-or-username
GITHUB_REPO=your-repo-name
PREVIEW=0
PREVIEW_FOLDER=/path/to/your/local/markdown/files  # Optional: for local preview mode when PREVIEW set to 1
```
3. Deploy the server for development or production:
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
http://localhost:3131/view?filename=<file.md>&branch=<branch>
```
- `filename` must be a safe base filename (no path separators, must end with `.md`).
- `branch` defaults to `main` if omitted.
- The server expects `GITHUB_OWNER`, `GITHUB_REPO` and (for private repos) `GITHUB_TOKEN` to be set in environment.

**Example:** `http://localhost:3131/view?filename=LP-Lecture-01.md&branch=master`

### 2. Preview Local Markdown Files (with Live Reload)
Preview Markdown files from your local filesystem with automatic reload when the file changes, the file needs to exist in the directory defined in the env. variable `PREVIEW_FOLDER`:
```
http://localhost:3131/preview?filename=<file.md>
```
- `filename` must be just the filename (no paths), ending with `.md`.
- The file must exist in the `PREVIEW_FOLDER` directory.
- Live reload checks for file changes every 2 seconds.

**Example:** `http://localhost:3131/preview?filename=LP-Lecture-02.md`
