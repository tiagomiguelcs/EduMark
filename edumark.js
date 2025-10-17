import express from "express";
import MarkdownIt from "markdown-it";
import mark from "markdown-it-mark";
import container from "markdown-it-container";
import anchor from "markdown-it-anchor";
import toc from "markdown-it-toc-done-right";
import dotenv from 'dotenv';

const app = express();
// Load variables from '.env'
dotenv.config();
// Serve static files like
app.use(express.static("public"));
const SERVER_PORT = process.env.SERVER_PORT || 3131;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO  = process.env.GITHUB_REPO;

// Initialize Markdown parser with HTML enabled and necessary plugins
const md = new MarkdownIt({ html: true, linkify: true, typographer: true })
  .use(mark)
  .use(anchor, {
    permalink: anchor.permalink.headerLink(),
    slugify: s => encodeURIComponent(String(s).trim().toLowerCase().replace(/\s+/g, "-")),
  })
  .use(toc, {
    listType: "ul",
    containerClass: "markdown-toc-list",
    containerId: "toc",
  });

/**
 * Register a markdown-it container plugin for custom containers (info, warning, ...)
 *
 * This adds support for custom fenced container blocks like
 * :::info ... ::: which are rendered as <div class="container info">...
 *
 * @param {string} name - The container name (e.g. 'info', 'warning').
 * @param {string} title - Human-readable title (not currently used in output) .
 */
function registerContainer(name, title) {
  md.use(container, name, {
    render(tokens, idx) {
      const token = tokens[idx];
      if (token.nesting === 1) {
        return `<div class="container ${name}">`;
      } else {
        return "</div>\n";
      }
    },
  });
}
registerContainer("info", "Info");
registerContainer("warning", "Warning");
registerContainer("danger", "Tip");
registerContainer("success", "Success");

// Homepage – list Markdown files
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>EduMark - Educational Markdown Viewer</title>
        <link rel="stylesheet" href="/style.css">
         <link rel="stylesheet" href="https://www.nerdfonts.com/assets/css/webfont.css">
      </head>
      <body>
        <div class="landing">
            <img src="/logo.png" width="128px"/>
            <span>EduMark</span>
            <div>
              <i class="nf nf-md-github" aria-hidden="true"></i>
              0.1 alpha
            </div>
        </div>
      </body>
    </html>
  `);
});


/**
 * GET /view
 * Retrieve a Markdown file from the configured GitHub repository and render it as HTML.
 *
 * Query parameters:
 *  - lecture {string} (required) : Lecture number (digits). Used to build repository path `Theoretical/Lecture-XX`.
 *  - filename {string} (required) : Base filename of the Markdown file (must end in .md). Directory traversal is disallowed.
 *  - branch {string} (optional)  : Git branch or ref to fetch from (defaults to 'main').
 *
 * Responses:
 *  - 200: HTML page containing rendered Markdown.
 *  - 400: Bad request (invalid lecture, filename, or branch).
 *  - 404: File not found in repository.
 *  - 500: Server misconfiguration (missing GitHub env vars) or internal error.
 *  - 502/504: GitHub API/network errors (bad gateway or timeout).
 */
app.get('/view', async (req, res) => {
  try {
    // Example: /sync?lecture=5&filename=VCD-Lecture-05.md&branch=main
    // NOTE: keep `base` without a leading slash so we don't introduce %2F at the start.
    const base = 'Theoretical/Lecture-0';
    const lecture = (req.query.lecture || '1').toString().trim(); // Lecture Number
    let filename = (req.query.filename || '').toString().trim();
    const branch = (req.query.branch || req.query.ref || 'main').toString().trim();

    // Basic validation
    if (!lecture.match(/^\d+$/)) return res.status(400).send('Invalid lecture number');
    if (!filename) return res.status(400).send('Filename is required');
    if (!branch) return res.status(400).send('Branch/ref is required');

    // Sanitize filename: disallow directory separators and traversal, require .md
    filename = filename.replace(/^\/+/, ''); // remove leading slashes
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\') || filename.includes('\0')) {
      return res.status(400).send('Invalid filename');
    }
    if (!/^[\w\-. ()]+\.md$/i.test(filename) || filename.length > 200) {
      return res.status(400).send('Filename must be a .md file with a safe name');
    }

    // Build repository path and guard again for traversal
    const repoPath = `${base}${lecture}/${filename}`;
    if (repoPath.includes('..')) return res.status(400).send('Invalid path');

    // Ensure GitHub configuration is present
    if (!GITHUB_OWNER || !GITHUB_REPO || !GITHUB_TOKEN) {
      console.error('GitHub environment variables missing');
      return res.status(500).send('Server not configured');
    }

    // Encode each path segment to keep slashes between segments
    const urlPath = repoPath.split('/').map(encodeURIComponent).join('/');
    const url = `https://api.github.com/repos/${encodeURIComponent(GITHUB_OWNER)}/${encodeURIComponent(GITHUB_REPO)}/contents/${urlPath}?ref=${encodeURIComponent(branch)}`;

    // Timeout support
    const controller = new AbortController();
    const timeoutMs = 10000; // 10s
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3.raw', // return raw file contents
          'User-Agent': 'docs-sync'
        }
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        return res.status(504).send('GitHub API request timed out');
      }
      console.error('Fetch error in /sync:', err);
      return res.status(502).send('Error fetching from GitHub');
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const msg = await response.text().catch(() => '');
      return res.status(response.status).send(`GitHub API error (${response.status}): ${msg}`);
    }
    const markdown = await response.text();
    const result = renderMarkdown(markdown);
    return res.status(200).send(result.body);
  } catch (err) {
    return res.status(500).send('Internal Server Error');
  }
});


/**
 * Render raw Markdown text into a full HTML page string.
 *
 * This function renders the provided Markdown using `markdown-it`,
 * extracts the generated table-of-contents (if present), and wraps
 * the result into the application's HTML layout.
 *
 * @param {string} markdownContent - Raw markdown source to render.
 * @returns {{status: number, body: string}} An object containing the HTTP status code
 * and the rendered HTML string suitable for sending as an Express response body.
 */
function renderMarkdown(markdownContent) {
  // Render Markdown Content
  const combinedHtml = md.render('[toc]\n' + markdownContent);
  let tocHtml = '';
  let htmlContent = combinedHtml;

  // Try several patterns to find the generated TOC container
  const patterns = [
    /<div[^>]*id=["']toc["'][^>]*>[\s\S]*?<\/div>/i,
    /<div[^>]*class=["']toc-list["'][^>]*>[\s\S]*?<\/div>/i,
    /<nav[^>]*class=["'][^"']*toc["'][^>]*>[\s\S]*?<\/nav>/i,
    /<nav[^>]*id=["']toc["'][^>]*>[\s\S]*?<\/nav>/i,
  ];

  for (const re of patterns) {
    const m = combinedHtml.match(re);
    if (m) {
      tocHtml = m[0];
      htmlContent = combinedHtml.replace(m[0], '');
      break;
    }
  }

  // Fallback: if no TOC found, render content without the [toc] marker
  if (!tocHtml) {
    tocHtml = '';
    htmlContent = md.render(markdownContent);
  }

  const body = `
    <html>
      <head>
        <meta charset="utf-8" />
        <title>EduMark - Educational Markdown Viewer</title>
        <link rel="stylesheet" href="/style.css">
        <link rel="stylesheet" href="https://www.nerdfonts.com/assets/css/webfont.css">
      </head>
      <body>
        <div class="layout">
        <div class="markdown-toc">
          <div class="markdown-toc-logo">
            <img src="/logo.png"/>
            <span>EduMark</span>
          </div>
          ${tocHtml}
        </div>
        <div class="markdown-body">${htmlContent}</div>
        <div class="markdown-gutter">&nbsp;</div>
        </div>
        <footer>
          <img src="/logo.png"/>
          <i class="nf nf-md-github" aria-hidden="true"></i>
          <span><b>EduMark</b> © 2025 | 0.1 alpha</span>
        </footer>
      </body>
    </html>
  `;
  return { status: 200, body };
}

app.listen(SERVER_PORT, () => {
  console.log(`EduMark Server running at http://localhost:${SERVER_PORT}`);
});

