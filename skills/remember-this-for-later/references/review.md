# Review the notes

Review turns open notes into rules, or drops them. The user is present for review and makes each decision. `notes.mjs` is in `scripts/` in the directory of this skill.

## 1. Read the open notes

```bash
node <skill-directory>/scripts/notes.mjs list
node <skill-directory>/scripts/notes.mjs show <id>
```

`list` groups the notes by the repository where each note was written. `list --json` gives all metadata. Read each open note in full before you propose anything.

## 2. Group the notes by lesson

Put notes that teach the same lesson together, also when they come from different repositories. The number of notes in a group is the evidence that the lesson repeats. A lesson with one note is weaker than a lesson with three.

## 3. Decide the scope of each lesson

The origin of a note is a fact. The scope of a rule is a decision. `scope_guess` is the guess of the agent that wrote the note, and it has no authority.

| Evidence | Scope | Destination |
|---|---|---|
| The lesson names a path, tool, or convention of one repository | One repository | `AGENTS.md` of that repository, or of the applicable folder |
| Notes from 2 or more repositories teach the lesson, and those repositories share a tool or team | Several repositories | A shared skill, or the instruction file that those repositories share |
| The lesson is about how the user wants agents to work, and names nothing specific to a repository | Universal | The global instruction file of the user |

When the evidence is one note from one repository, select the one-repository scope. A rule can move to a wider scope later, when a second repository gives the same note.

## 4. Propose a disposition for each lesson

Show the user one lesson at a time: the notes, the quoted words of the user, the proposed rule text, and the destination. The dispositions are:

- Promote: write the rule at the destination.
- Dismiss: the correction was for one task only, or an existing rule already covers it.
- Keep open: the evidence is not sufficient yet. Do nothing.

Before you propose a new rule, read the destination file. If a rule there already covers the lesson and the agent did not obey it, the rule text is the problem. Propose a change to that rule.

## 5. Apply the decision

Obey the instructions of the destination for edits. If the instructions tell you to propose the text in chat, do that and do not edit the file. Edit a repository in a task worktree, not in the primary checkout.

Then resolve each note in the group. Say where the lesson went, or why it was dropped.

```bash
node <skill-directory>/scripts/notes.mjs resolve <id> --status promoted \
  --disposition "Added to mercury-web/src/pages/Budgets/CLAUDE.md, section Testing"
node <skill-directory>/scripts/notes.mjs resolve <id> --status dismissed \
  --disposition "One task only"
```

A resolved note stays in the store with its disposition. `list --status all` shows it.
