<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Autonomous Execution & Full Control
The user has granted full autonomous execution authority. Proactively execute all code modifications, terminal commands, builds, database operations, and verifications to completion without stopping for permission, unless explicitly instructed by the user.

## STRICT RULE: No Automatic Remote Pushes (Vercel Quota Protection)
- **NEVER** execute `git push` or push changes to GitHub or any remote repository autonomously under any circumstances.
- You are permitted to make local edits, run local builds/tests, and make local git commits if necessary, but you must **NEVER** push commits to GitHub (`origin`, etc.) unless the user explicitly gives a direct instruction in the prompt to do so (e.g., "push to github", "push live", "push now").
- Reason: Every push to GitHub triggers automated Vercel builds and deployments that exhaust the user's free tier limits and storage. This rule applies strictly and permanently to all conversations and tasks in this project.
