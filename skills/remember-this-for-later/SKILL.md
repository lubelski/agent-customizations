---
name: remember-this-for-later
description: Capture a note about what just happened in this conversation, for later review, without stopping the task. Use when the user says "remember this for later", "note this for later", "log this", "this keeps coming up", or "we should make a rule for this" in the middle of other work. Also use with the argument "review" to go through the stored notes and turn them into rules. Do not use it to write a rule now.
---

# Remember this for later

The user corrected or steered you in the middle of a task. That correction can be a rule for future sessions. But the user does not want to write the rule now, because the task comes first.

This skill has two modes.

- Capture (default): write one note and continue the task. The procedure is below.
- Review: the argument is `review`, or the user asks to go through the notes. Read `references/review.md` and follow it.

Canonical source: `agent-customizations/skills/remember-this-for-later/`.

## Capture

Capture must cost the user no attention. Obey these rules.

- Do not ask questions. If the subject is not clear, record the most recent correction and say which one you recorded.
- Do not edit `AGENTS.md`, `CLAUDE.md`, a skill, or agent memory. Review does that later.
- Do not put secrets or credentials in a note.

### 1. Find the subject

If the user gave an argument, the argument is the subject. If not, the subject is the most recent correction or instruction that the user gave you.

### 2. Write the body

A different agent will read the note weeks later, with no access to this conversation. Write the facts that agent needs. Use these headings, and omit a heading that has no content.

```markdown
## Situation
What the task was, and what you did or were about to do. Two or three sentences.

## User said
The exact words of the user, quoted. Include each message that applies.

## Candidate rule
Your interpretation, in one or two sentences, written as an instruction to an agent.

## Evidence
Files with line numbers, commands, error text, ticket or PR links.

## Scope reasoning
Why the rule applies to this repository only, to several repositories, or everywhere.
```

Keep "User said" and "Candidate rule" separate. The first is a record. The second is your guess, and review can replace it.

### 3. Store the note

`scripts/notes.mjs` is in the directory of this skill. Run it from the working directory of the task, because it reads the repository, worktree, branch, and commit from there.

```bash
node <skill-directory>/scripts/notes.mjs add \
  --title "Short imperative title" \
  --scope repo \
  --tag testing <<'EOF'
## Situation
...
EOF
```

- `--scope` is your guess: `repo`, `several-repos`, `universal`, or `unknown`. Use `unknown` if you are not sure.
- `--tag` is optional and repeatable. Use one or two topic words.
- Outside Claude Code, add `--harness <name>`, and `--session <id>` if you know the session id.

The command prints the path of the note.

### 4. Continue

Tell the user the title and the path in one line. Then continue the task. In the remaining part of this conversation, obey the correction that you recorded.
