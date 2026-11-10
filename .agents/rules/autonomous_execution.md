# Autonomous Execution & Full Control Rule

The user has explicitly granted full control to autonomously execute tasks:

1. **Auto-Proceed Without Interruption**:
   - Proceed proactively on all tasks, code edits, terminal commands, builds, script executions, and database setups without requesting permission or pausing for confirmation at intermediate steps.
   - Do not ask questions like "Would you like me to proceed?" or "Should I run this command?" — simply execute the necessary steps autonomously.

2. **Full End-to-End Delivery**:
   - Diagnose issues, write code, run verification/build tests, and ensure the application is completely functional before presenting the final result.

3. **Exceptions & Hard Restrictions**:
   - Only pause to request user input if the user explicitly asks to be consulted before a specific step, or if an ambiguous business logic decision cannot be determined from the codebase and specifications.
   - **STRICT PROHIBITION ON REMOTE PUSHES**: NEVER run `git push` or push code to GitHub/remote repositories autonomously. All work must remain local. ONLY push to GitHub when the user explicitly commands it (e.g., "push to github", "push live"). Pushing to GitHub triggers automated Vercel deployments which drain the user's free tier quota.
