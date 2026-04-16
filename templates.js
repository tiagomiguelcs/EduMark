import pkg from './package.json' with { type: 'json' };
const YEAR = new Date().getFullYear();

export function createPage(content = '') {
    const page = `
    <!doctype html>
    <html>
        <head>
            <meta charset="utf-8" />
            <title>EduMark - Educational Markdown Viewer</title>
            <link rel="stylesheet" href="/edumark/style.css">
            <link rel="stylesheet" href="https://www.nerdfonts.com/assets/css/webfont.css">
            <link id="hljs-light" rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
            <link id="hljs-dark" rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css" disabled>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
            <script src="https://unpkg.com/darkreader/darkreader.js"></script>
            <script>
            function toggleDarkMode() {
                const isDark = DarkReader.isEnabled();
                const lightCSS = document.getElementById('hljs-light');
                const darkCSS = document.getElementById('hljs-dark');
                const darkModeIcon = document.getElementById('b-darkmode');
                if (isDark) {
                    // Go back to light mode
                    DarkReader.disable();
                    lightCSS.disabled = false;
                    darkCSS.disabled = true;
                    darkModeIcon.className = "nf nf-fa-moon"
                }else{
                    DarkReader.setFetchMethod(window.fetch);
                    // Activate dark mode
                    DarkReader.enable({
                        brightness: 100,
                        contrast: 90,
                        sepia: 10
                    });
                    darkModeIcon.className = "nf nf-oct-sun"
                    lightCSS.disabled = true;
                    darkCSS.disabled = false;
                }
            }
            </script>
        </head>
        <body>
        ${content}
        </body>
    </html>
    `
    return (page);
}

export function createLandingPage(body = '') {
    const landing = `
        <div class="landing">
            <img src="/edumark/logo.png" width="128px"/>
            <span>EduMark</span>
            <div>
              <a href="${pkg.repository.url}" target="_blank">
                <i class="nf nf-md-github" aria-hidden="true"></i>
              </a>
              ${pkg.version} ${pkg.designation}
            </div>
        </div>
    `;
    return (createPage(landing));
}

export function createErrorPage(message) {
    const error = `
    <div class="landing">
      <img src="/edumark/logo.png" width="126px"/>
      <span>EduMark</span>
      <span class="error">${message}</span>
      <div>
        <a href="${pkg.repository.url}" target="_blank"><i class="nf nf-md-github" aria-hidden="true"></i></a>
        ${pkg.version} ${pkg.designation}
      </div>
    </div>
    `;
    return (createPage(error))
}

export function createViewPage(body = '') {
    const view = `
    ${body}
    <footer>
        <img src="/edumark/logo.png"/>
        <a href="${pkg.repository.url}" target="_blank"><i class="nf nf-md-github" aria-hidden="true"></i></a>
        <span><b>EduMark</b> © ${YEAR} | ${pkg.version} ${pkg.designation}</span>
        <script>
            console.info("Roads? Where we're going, we don't need roads.");
        </script>
    </footer>
    `;
    return (createPage(view));
}
