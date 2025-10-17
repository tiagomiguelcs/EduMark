# EduMark

<p align="center">
  <img style="width:148px; height:auto" src="public/logo.png"/><br/>
  EduMark - Educational Markdown Viewer
</p>

EduMark is a small Markdown viewer for educational environments that can render Markdown files hosted in a GitHub repository and present them with a table-of-contents and a simple layout.

- Render Markdown with `markdown-it` and useful plugins (anchors, TOC, marks, containers).
- Fetch Markdown files directly from a GitHub repo (by lecture number / filename / branch).
- Lightweight, single-file server (`edumark.js`).

## Quick Start

Prerequisites
- Node.js 18+ recommended.
- GitHub personal access token (if you plan to fetch files from a private repo).

1. Clone and install dependencies

```bash
git clone <repo-url>
cd EduMark
npm install
```

2. Create a .env file (example)

Create a `.env` file in the project root with these variables:

```env
GITHUB_TOKEN=ghp_...        # GitHub personal access token (optional for public repos, required for private)
GITHUB_OWNER=your-org-or-username
GITHUB_REPO=your-repo-name
SERVER_PORT=3131            # optional, defaults to 3131
```

3. Run the server

```bash
node edumark.js
# or, during development with nodemon (if installed globally)
# nodemon edumark.js
```

## Usage / Examples

Render a markdown file for presentation that lives in the repository (server fetches from GitHub) as follows:

Example URL pattern:
```
GET /view?lecture=<number>&filename=<file.md>&branch=<branch>
```

Notes & Behavior
- `lecture` is expected to be digits (e.g. `1`, `04`). The server builds the repo path like `Theoretical/Lecture-XX/filename` internally.
- `filename` must be a safe base filename (no path separators, must end with `.md`). Directory traversal attempts are blocked.
- `branch` defaults to `main` if omitted.
- The server expects `GITHUB_OWNER`, `GITHUB_REPO` and (for private repos) `GITHUB_TOKEN` to be set in environment.
