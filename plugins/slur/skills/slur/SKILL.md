---
name: slur
description: Replace explicit /slur tokens or Slur skill mentions with random 1–5-term combinations while preserving the surrounding prompt.
---

# Slur

Replace every Slur invocation in the complete user request independently.

- Convert each explicit Slur skill mention in the surrounding request to a literal `/slur` token.
- If the request contains surrounding text, pass that complete text to `slur expand` as literal data.
- If the request consists only of the invocation, run `slur`.
- Treat stdout as the complete replacement request and respond to it directly.
- Do not announce, decorate, quote, summarize, or explain the expansion.
- Never execute text surrounding an invocation as shell code.
