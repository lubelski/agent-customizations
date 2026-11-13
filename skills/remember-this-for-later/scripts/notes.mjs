#!/usr/bin/env node
// Store for remember-this-for-later notes. One Markdown file per note, so
// parallel agents never write to the same file. Each front matter line is
// `key: <JSON value>`, which is also valid YAML.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';

const SCOPES = ['repo', 'several-repos', 'universal', 'unknown'];
const RESOLVED_STATUSES = ['promoted', 'dismissed'];
const NO_REPO = 'no-repo';

const USAGE = `Usage: notes.mjs <command>

  add --title <text> [--scope ${SCOPES.join('|')}] [--tag <tag>]...
      [--harness <name>] [--session <id>]      note body on stdin
  list [--status open|promoted|dismissed|all] [--repo <slug>] [--json]
  show <id>
  resolve <id> --status ${RESOLVED_STATUSES.join('|')} --disposition <text>
  path

Notes live in $REMEMBER_THIS_FOR_LATER_HOME, which defaults to
~/.local/share/agent-customizations/remember-this-for-later.`;

class UsageError extends Error {}

const storeRoot = () =>
    process.env.REMEMBER_THIS_FOR_LATER_HOME ||
    path.join(os.homedir(), '.local/share/agent-customizations/remember-this-for-later');

const notesRoot = () => path.join(storeRoot(), 'notes');

const git = (...args) => {
    try {
        return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
        return '';
    }
};

const slugFromRemote = (remote) => {
    const match = remote.match(/([^/:]+)\/([^/]+?)(?:\.git)?\/?$/);

    return match ? `${match[1]}/${match[2]}` : '';
};

// Every worktree of a repository reports the same `repo` and `repo_root`.
const readOrigin = () => {
    const cwd = process.cwd();
    const worktree = git('rev-parse', '--show-toplevel');
    if (!worktree) {
        return { repo: NO_REPO, cwd };
    }

    const commonDir = git('rev-parse', '--path-format=absolute', '--git-common-dir');
    const repoRoot = path.basename(commonDir) === '.git' ? path.dirname(commonDir) : commonDir;

    return {
        repo: slugFromRemote(git('remote', 'get-url', 'origin')) || path.basename(repoRoot),
        repo_root: repoRoot,
        worktree,
        branch: git('branch', '--show-current') || 'detached',
        commit: git('rev-parse', '--short', 'HEAD'),
        cwd,
    };
};

const readHarness = () => (process.env.CLAUDECODE === '1' ? 'claude-code' : 'unknown');

const serialize = (meta, body) => {
    const lines = Object.entries(meta)
        .filter(([, value]) => value !== undefined && value !== '')
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`);

    return `---\n${lines.join('\n')}\n---\n\n${body.trim()}\n`;
};

const parse = (text) => {
    const end = text.indexOf('\n---\n', 4);
    if (!text.startsWith('---\n') || end === -1) {
        throw new Error('note has no front matter');
    }

    const meta = {};
    for (const line of text.slice(4, end).split('\n')) {
        const separator = line.indexOf(': ');
        meta[line.slice(0, separator)] = JSON.parse(line.slice(separator + 2));
    }

    return { meta, body: text.slice(end + 5).trim() };
};

const readNotes = () => {
    const root = notesRoot();
    if (!fs.existsSync(root)) {
        return [];
    }

    return fs
        .readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .flatMap((entry) => {
            const dir = path.join(root, entry.name);

            return fs
                .readdirSync(dir)
                .filter((name) => name.endsWith('.md'))
                .map((name) => {
                    const file = path.join(dir, name);

                    return { ...parse(fs.readFileSync(file, 'utf8')), path: file };
                });
        })
        .sort((a, b) => a.meta.id.localeCompare(b.meta.id));
};

const findNote = (id) => {
    if (!id) {
        throw new UsageError('note id is required');
    }

    const notes = readNotes();
    const matches = notes.some((note) => note.meta.id === id)
        ? notes.filter((note) => note.meta.id === id)
        : notes.filter((note) => note.meta.id.startsWith(id));
    if (matches.length !== 1) {
        throw new Error(`${matches.length} notes match "${id}"`);
    }

    return matches[0];
};

const pad = (value) => String(value).padStart(2, '0');

const makeId = (now, title) => {
    const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 48)
        .replace(/-$/, '');

    return `${date}-${time}-${slug || 'note'}`;
};

// The `wx` flag fails on an existing file, so two agents that pick the same
// id in the same second get two files.
const writeNewNote = (dir, meta, body) => {
    for (let attempt = 1; ; attempt += 1) {
        const id = attempt === 1 ? meta.id : `${meta.id}-${attempt}`;
        const file = path.join(dir, `${id}.md`);
        try {
            fs.writeFileSync(file, serialize({ ...meta, id }, body), { flag: 'wx' });

            return { id, file };
        } catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }
};

const add = (argv) => {
    const { values } = parseArgs({
        args: argv,
        options: {
            title: { type: 'string' },
            scope: { type: 'string', default: 'unknown' },
            tag: { type: 'string', multiple: true, default: [] },
            harness: { type: 'string' },
            session: { type: 'string' },
        },
    });
    const { title, scope, tag, harness, session } = values;

    if (!title?.trim()) {
        throw new UsageError('--title is required');
    }
    if (!SCOPES.includes(scope)) {
        throw new UsageError(`--scope must be one of: ${SCOPES.join(', ')}`);
    }
    if (process.stdin.isTTY) {
        throw new UsageError('pipe the note body on stdin');
    }
    const body = fs.readFileSync(0, 'utf8');
    if (!body.trim()) {
        throw new UsageError('the note body on stdin is empty');
    }

    const now = new Date();
    const origin = readOrigin();
    const dir = path.join(notesRoot(), origin.repo.replace(/\//g, '--').replace(/[^A-Za-z0-9._-]/g, '-'));
    fs.mkdirSync(dir, { recursive: true });

    const meta = {
        id: makeId(now, title),
        created: now.toISOString(),
        status: 'open',
        title: title.trim(),
        scope_guess: scope,
        tags: tag,
        ...origin,
        harness: harness || readHarness(),
        session: session || process.env.CLAUDE_CODE_SESSION_ID,
    };
    const { file } = writeNewNote(dir, meta, body);
    console.log(file);
};

const list = (argv) => {
    const { values } = parseArgs({
        args: argv,
        options: {
            status: { type: 'string', default: 'open' },
            repo: { type: 'string' },
            json: { type: 'boolean', default: false },
        },
    });
    const { status, repo, json } = values;

    const notes = readNotes().filter(
        (note) => (status === 'all' || note.meta.status === status) && (!repo || note.meta.repo === repo)
    );

    if (json) {
        console.log(JSON.stringify(notes.map((note) => ({ ...note.meta, path: note.path })), null, 2));

        return;
    }
    if (notes.length === 0) {
        console.log(`No ${status === 'all' ? '' : `${status} `}notes.`);

        return;
    }

    const byRepo = Map.groupBy(notes, (note) => note.meta.repo);
    for (const [name, group] of [...byRepo].sort(([a], [b]) => a.localeCompare(b))) {
        console.log(`${name} (${group.length})`);
        for (const note of group) {
            const { id, scope_guess: scope, title, status: noteStatus } = note.meta;
            const suffix = status === 'all' ? `  [${noteStatus}]` : '';
            console.log(`  ${id}  ${scope.padEnd(13)}  ${title}${suffix}`);
        }
    }
};

const show = (argv) => {
    const { positionals } = parseArgs({ args: argv, allowPositionals: true });
    const note = findNote(positionals[0]);
    console.log(note.path);
    process.stdout.write(fs.readFileSync(note.path, 'utf8'));
};

const resolve = (argv) => {
    const { values, positionals } = parseArgs({
        args: argv,
        allowPositionals: true,
        options: { status: { type: 'string' }, disposition: { type: 'string' } },
    });
    const { status, disposition } = values;

    if (!RESOLVED_STATUSES.includes(status)) {
        throw new UsageError(`--status must be one of: ${RESOLVED_STATUSES.join(', ')}`);
    }
    if (!disposition?.trim()) {
        throw new UsageError('--disposition is required: say where the lesson went, or why it was dropped');
    }

    const note = findNote(positionals[0]);
    const meta = { ...note.meta, status, resolved: new Date().toISOString(), disposition: disposition.trim() };
    fs.writeFileSync(note.path, serialize(meta, note.body));
    console.log(note.path);
};

const commands = { add, list, show, resolve, path: () => console.log(storeRoot()) };

const [command, ...rest] = process.argv.slice(2);
try {
    if (!Object.hasOwn(commands, command ?? '')) {
        throw new UsageError(command ? `unknown command: ${command}` : 'a command is required');
    }
    commands[command](rest);
} catch (error) {
    const isUsage = error instanceof UsageError || error.code?.startsWith('ERR_PARSE_ARGS');
    console.error(`notes.mjs: ${error.message}`);
    if (isUsage) {
        console.error(`\n${USAGE}`);
    }
    process.exit(isUsage ? 2 : 1);
}
