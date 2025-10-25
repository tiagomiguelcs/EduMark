import express from "express";
import MarkdownIt from "markdown-it";
import mark from "markdown-it-mark";
import container from "markdown-it-container";
import anchor from "markdown-it-anchor";
import toc from "markdown-it-toc-done-right";
import tm from "markdown-it-texmath";
import dotenv from 'dotenv';
import {createLandingPage, createViewPage, createErrorPage} from './templates.js';
import { readFile, stat } from 'fs/promises';
import { join, normalize } from 'path';
import hljs from 'highlight.js';
import dayjs from 'dayjs';

const app = express();
// Load variables from '.env'
dotenv.config();
// Serve static files like
app.use(express.static("public"));
app.use('/edumark', express.static("public"));
const SERVER_PORT = process.env.SERVER_PORT || 3131;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO  = process.env.GITHUB_REPO;
const PREVIEW      = process.env.PREVIEW;
const PREVIEW_FOLDER = process.env.PREVIEW_FOLDER; // Place markdown documents in this folder to preview them.

// Initialize Markdown parser with HTML enabled and necessary plugins
const md = new MarkdownIt({ 
  html: true, 
  linkify: true, 
  typographer: true,
  highlight: function (str, lang) {
    if (lang.indexOf("=") !== -1) lang = lang.replace("=", ""); // line numbers is not yet supported.
    if (lang && hljs.getLanguage(lang)) {
      try {
        return '<pre class="hljs"><code>' +
               hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
               '</code></pre>';
      } catch (__) {}
    }
    return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>';
  }
})
  .use(mark)
  .use(tm, {
    engine: (await import('katex')).default,
    delimiters: 'dollars',
    katexOptions: { macros: { "\\RR": "\\mathbb{R}" } }
  })
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
        if (name==="references")
          return `<div class="container ${name}"><span>Referências</span>`;
        else
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
registerContainer("references", "References");

// Homepage
app.get("/", (req, res) => {
  res.send(createLandingPage());
});

/**
 * GET /preview-check
 * Check the last modification time of a file for live reload functionality.
 * 
 * This endpoint returns the modification timestamp (mtimeMs) of a file in the PREVIEW_FOLDER.
 * Used by the live reload script in /preview to detect file changes without reloading.
 *
 * Query parameters:
 *  - filename {string} (required) : Name of the Markdown file to check (e.g., "lecture.md").
 *                                   Must end with .md and be located in PREVIEW_FOLDER.
 * Example:
 *  GET /preview-check?filename=lecture-01.md
 *  Response: { "mtime": 1729612345678.9 }
 */
app.get('/preview-check', async (req, res) => {
  try {
    const filename = (req.query.filename || '').toString().trim();
    if (!filename) return res.status(400).json({ error: 'Filename required' });
    
    const defaultBasePath = process.cwd() + PREVIEW_FOLDER;
    const fullPath = normalize(join(defaultBasePath, filename));
    
    if (!fullPath.startsWith(defaultBasePath) || !fullPath.endsWith('.md')) {
      return res.status(400).json({ error: 'Invalid file' });
    }
    
    const stats = await stat(fullPath);
    return res.json({ mtime: stats.mtimeMs });
  } catch (err) {
    return res.status(404).json({ error: 'File not found' });
  }
});

/**
 * GET /preview
 * Preview a local Markdown file from the PREVIEW_FOLDER directory with live reload support.
 * 
 * This endpoint renders local Markdown files with automatic refresh detection.
 *
 * Query parameters:
 *  - filename {string} (required) : Name of the Markdown file in PREVIEW_FOLDER (e.g., "lecture.md").
 *                                   Must end with .md and cannot contain path separators or traversal.
 *
 * Responses:
 *  - 200: HTML page containing rendered Markdown with live reload script.
 *  - 400: Bad request (missing filename, invalid characters, or path traversal attempt).
 *  - 404: File not found in PREVIEW_FOLDER.
 *  - 500: Internal server error (file read error or rendering failure).
 *
 * Example:
 *  GET /preview?filename=lecture-01.md
 */
app.get('/preview', async (req, res) => {
  if (PREVIEW == 0) return res.status(400).send(createErrorPage('Preview not available'));
  try {
    const filename = (req.query.filename || '').toString().trim();
    if (!filename) return res.status(400).send(createErrorPage('Filename is required'));
    
    // Resolve to absolute path and prevent directory traversal
    const defaultBasePath = process.cwd()+PREVIEW_FOLDER;
    // console.log(defaultBasePath);
    let fullPath = normalize(join(defaultBasePath, filename));

    if (!fullPath.startsWith(defaultBasePath)) return res.status(400).send(createErrorPage('Invalid file path'));
    if (!fullPath.endsWith('.md')) return res.status(400).send(createErrorPage('Only .md files allowed'));

    const markdown = await readFile(fullPath, 'utf-8');
    const result = renderMarkdown(markdown, undefined, filename); // Pass filename for live reload
    return res.status(200).send(result.body);

  }catch (err) {
    if (err.code === 'ENOENT') return res.status(404).send(createErrorPage('File not found'));
    console.error(err);
    return res.status(500).send(createErrorPage('Internal Server Error'));
  }
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
    if (!lecture.match(/^\d+$/)) return res.status(400).send(createErrorPage('Invalid lecture number'));
    if (!filename) return res.status(400).send(createErrorPage('Filename is required'));
    if (!branch) return res.status(400).send(createErrorPage('Branch/ref is required'));

    // Sanitize filename: disallow directory separators and traversal, require .md
    filename = filename.replace(/^\/+/, ''); // remove leading slashes
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\') || filename.includes('\0')) {
      return res.status(400).send(createErrorPage('Invalid filename'));
    }
    if (!/^[\w\-. ()]+\.md$/i.test(filename) || filename.length > 200) {
      return res.status(400).send(createErrorPage('Filename must be a .md file with a safe name'));
    }

    // Build repository path and guard again for traversal
    const repoPath = `${base}${lecture}/${filename}`;
    if (repoPath.includes('..')) return res.status(400).send(createErrorPage('Invalid path'));

    // Ensure GitHub configuration is present
    if (!GITHUB_OWNER || !GITHUB_REPO || !GITHUB_TOKEN) {
      // console.error('GitHub environment variables missing');
      return res.status(500).send(createErrorPage('Server not configured'));
    }

    // Encode each path segment to keep slashes between segments
    const urlPath = repoPath.split('/').map(encodeURIComponent).join('/');
    const url = `https://api.github.com/repos/${encodeURIComponent(GITHUB_OWNER)}/${encodeURIComponent(GITHUB_REPO)}/contents/${urlPath}?ref=${encodeURIComponent(branch)}`;
    
    // Timeout support
    const controller = new AbortController();
    const timeoutMs = 10000; // 10s
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let response, lastModifiedDateTime;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3.raw', // return raw file contents
          'User-Agent': 'docs-sync'
        }
      });
      
      lastModifiedDateTime = dayjs(response.headers.get('last-modified')).format("D MMM YYYY [at] HH:mm");
      // console.log("Last Modified:", lastModified.format("DD/MM/YYYY HH:mm:ss"));
    } catch (err) {
      if (err.name === 'AbortError') {
        return res.status(504).send(createErrorPage('GitHub API request timed out'));
      }
      console.error('Fetch error in /view:', err);
      return res.status(502).send(createErrorPage('Error fetching from GitHub'));
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      // const msg = await response.text().catch(() => '');
      // return res.status(response.status).send(`GitHub API error (${response.status}): ${msg}`);
      return res.status(response.status).send(createErrorPage('GitHub API error.'));
    }
    const markdown = await response.text();
    const result = renderMarkdown(markdown, lastModifiedDateTime);
    return res.status(200).send(result.body);
  } catch (err) {
    console.log(err);
    return res.status(500).send(createErrorPage('Internal Server Error'));
  }
});

// Handles 404
app.use((req, res, next) => {
  const message = "404 | You've taken a wrong turn.";
  res.status(402).send(createErrorPage(message));
})


function removeTags(markdownContent){
  const lines = markdownContent.match(/^.*((\r\n|\n|\r)|$)/gm);
  markdownContent = "";
    for(let i=0; i < lines.length; i++){
      const line = lines[i];
      if (line.includes(`tags`)) continue;
      markdownContent += line;
  }
  return(markdownContent);
}

function parseTags(markdownContent){
  const lines = markdownContent.match(/^.*((\r\n|\n|\r)|$)/gm);
  try {
    for(let i=0; i < lines.length; i++){
      const line = lines[i];
      if (line.includes(`tags`)){
        const ioff = line.indexOf(":")+1;
        if (ioff == -1) throw new Error();      
        let raw = line.substring(ioff);
        raw = raw.replaceAll("\n", "");
        if (raw.includes("`"))
          raw = raw.replaceAll("`", "");
        if (raw.includes("´")) 
          raw = raw.replaceAll("´", ""); 
        let dl = raw.includes(";") ? ";" : ",";
        const tags = raw.split(dl);
        // Remove white spaces
        for (let j=0; j < tags.length; j++)
          tags[j] = tags[j].trim();
        return(tags);
      }
    }
  } catch (error) {
    console.error("Unable to fetch tags, use syntax: tags: tag1, tag2, ...");
    return([]);
  }
  return([]);
}
/**
 * Render raw Markdown text into a full HTML page string.
 *
 * This function renders the provided Markdown using `markdown-it`,
 * extracts the generated table-of-contents (if present), and wraps
 * the result into the application's HTML layout.
 *
 * @param {string} markdownContent - Raw markdown source to render.
 * @param {string} filename - Optional filename for live reload (preview mode only).
 * @returns {{status: number, body: string}} An object containing the HTTP status code
 * and the rendered HTML string suitable for sending as an Express response body.
 */
function renderMarkdown(markdownContent, lastModifiedDatetime, filename = null) {
  // Find document tags and convert to html 
  const tags = parseTags(markdownContent);
  let tagsHtml = "";
  for (let tag of tags) tagsHtml += `<div>${tag}</div>`;
  // Remove tags from the markdown file, they will be placed somewhere else. 
  markdownContent = removeTags(markdownContent);
  
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
  
  // Add live reload script if filename provided (preview mode)
  const liveReloadScript = filename ? `
    <script>
      let lastMtime = null;
      const checkInterval = 2000; // Check every 2 seconds
      
      async function checkFileChange() {
        try {
          const response = await fetch('/preview-check?filename=${encodeURIComponent(filename)}');
          if (response.ok) {
            const data = await response.json();
            if (lastMtime === null) {
              lastMtime = data.mtime;
            } else if (data.mtime !== lastMtime) {
              console.log('File changed, reloading...');
              location.reload();
            }
          }
        } catch (err) {
          console.error('Check failed:', err);
        }
      }
      
      // Start checking
      checkFileChange();
      setInterval(checkFileChange, checkInterval);
    </script>
  ` : '';
  
  const body = createViewPage(`
        <div class="layout">
          <div class="toc">
            <div class="brand" onclick="location.replace(location.href.split('#')[0])" style="cursor:pointer">
              <img src="/edumark/logo.png"/>
              <span>EduMark</span>
            </div>
            ${tocHtml}
          </div>
          <div class="markdown">
            <div class="tags">${tagsHtml}</div>
            ${htmlContent}
            ${lastModifiedDatetime ? `<div class="datetime">
            <span class="nf nf-md-calendar_clock_outline"></span>Updated on ${lastModifiedDatetime}
            </div>` : ''}
          </div>
          <div class="gutter">&nbsp;</div>
        </div>
        ${liveReloadScript}
  `);
  return { status: 200, body };
}

app.listen(SERVER_PORT, () => {
  console.log(`EduMark Server running at http://localhost:${SERVER_PORT}/`);
});

