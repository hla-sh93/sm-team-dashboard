# Shared project continuity

Before doing any work in this repository, read `CLAUDE_HANDOFF.md` completely. It is the canonical cross-agent record of user decisions, evidence, local-versus-live state, unresolved risks, and exact next actions.

After any meaningful investigation, code change, data mutation, deployment, or user decision:

1. Update the affected current-state section in `CLAUDE_HANDOFF.md`.
2. Preserve explicit user decisions and distinguish verified facts from inferences.
3. Append a dated entry to its session continuation log.
4. State whether the result is local-only or verified live on Vercel.

Never invent business rules or overwrite existing application values to match examples. If live data, Telegram, Instagram, files, and the handoff conflict, show the discrepancy to the user before changing it.

