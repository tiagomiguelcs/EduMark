// EduMark 
import express from "express";
import fs from "fs";
import path from "path";
import MarkdownIt from "markdown-it";
import mark from "markdown-it-mark";
import container from "markdown-it-container";
import anchor from "markdown-it-anchor";
import toc from "markdown-it-toc-done-right";

const app = express();
const PORT = process.env.PORT || 3000;
const markdownDir = path.resolve("./docs")

// Serve static files like CSS
app.use(express.static("public"));

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

// Helper for custom containers (info, warning, tip)
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
  const files = fs.readdirSync(markdownDir).filter(f => f.endsWith(".md"));
  const links = files.map(f => `<li><a href="/view/${f}">${f}</a></li>`).join("");
  res.send(`
    <html>
      <head>
        <title>Markdown Viewer</title>
        <link rel="stylesheet" href="/style.css">
      </head>
      <body>
        <main class="content">
          <h1>📄 Available Markdown Files</h1>
          <ul>${links}</ul>
        </main>
      </body>
    </html>
  `);
});

// Markdown render route
app.get("/view/:filename", (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(markdownDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send("File not found");
  }

  const markdownContent = fs.readFileSync(filePath, "utf-8");

  // Render TOC from this file's content by rendering `[toc]` + content, then extract the TOC block
  const combinedHtml = md.render("[toc]\n" + markdownContent);
  let tocHtml = "";
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
      htmlContent = combinedHtml.replace(m[0], "");
      break;
    }
  }

  // Fallback: if no TOC found, render content without the [toc] marker
  if (!tocHtml) {
    tocHtml = "";
    htmlContent = md.render(markdownContent);
  }
// <a href="/">← Back</a>
        
  res.send(`
    <html>
      <head>
        <meta charset="utf-8" />
        <title>EduMark</title>
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
        <footer><img src="/logo.png"/><i class="nf nf-md-github" aria-hidden="true"></i>
<span><b>EduMark</b> © 2025 | 0.1 alpha</span></footer>
      </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});

