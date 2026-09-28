---
name: defuddle
description: Extract clean markdown content from web pages with Defuddle when it is available on the selected runtime and the user selects or needs that capability. Use an available host extraction tool otherwise. Do NOT use for URLs ending in .md — those are already markdown.
---

# Defuddle

Use Defuddle CLI when it resolves on the selected runtime and clean readable content from a standard web page is needed. If it is unavailable or the host's existing extraction tool is the selected path, use that tool. Defuddle removes navigation, ads, and clutter, reducing token usage.

Check whether defuddle resolves on the selected runtime. If absent, report it as unavailable and use an already available host extraction tool. The following install command is an explicit setup option only after the user authorizes installation for that target: npm install -g defuddle

## Usage

Always use `--md` for markdown output:

```bash
defuddle parse <url> --md
```

Save to file:

```bash
defuddle parse <url> --md -o content.md
```

Extract specific metadata:

```bash
defuddle parse <url> -p title
defuddle parse <url> -p description
defuddle parse <url> -p domain
```

## Output formats

| Flag | Format |
|------|--------|
| `--md` | Markdown (default choice) |
| `--json` | JSON with both HTML and markdown |
| (none) | HTML |
| `-p <name>` | Specific metadata property |
