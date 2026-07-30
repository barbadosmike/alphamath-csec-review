# Keep PostgreSQL behind a secured evidence API

The GitHub Pages interface remains a static, offline-capable client, while all database reads and writes pass through a separately deployed Node API. This prevents PostgreSQL credentials from reaching the browser, preserves local drafts when the API is unavailable, and gives validation and human-review rules one enforceable server boundary.
