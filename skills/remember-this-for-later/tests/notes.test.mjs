import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../scripts/notes.mjs', import.meta.url));

let tmp;
let store;

beforeEach(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'rtfl-')));
    store = path.join(tmp, 'store');
});

const notes = (args, { cwd = tmp, input = '' } = {}) =>
    spawnSync('node', [CLI, ...args], {
        cwd,
        input,
        encoding: 'utf8',
        env: {
            PATH: process.env.PATH,
            HOME: tmp,
            REMEMBER_THIS_FOR_LATER_HOME: store,
            CLAUDECODE: '1',
            CLAUDE_CODE_SESSION_ID: 'session-1',
        },
    });

const listJson = (...args) => JSON.parse(notes(['list', '--json', ...args]).stdout);

const makeRepo = (name, remote) => {
    const repo = path.join(tmp, name);
    const git = (...args) =>
        execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], {
            cwd: repo,
            stdio: 'ignore',
        });
    fs.mkdirSync(repo);
    git('init', '-b', 'main');
    git('commit', '--allow-empty', '-m', 'init');
    if (remote) {
        git('remote', 'add', 'origin', remote);
    }

    return { repo, git };
};

test('a note from a worktree records the repository, not the worktree, as its origin', () => {
    const { repo, git } = makeRepo('widgets', 'git@github.com:acme/widgets.git');
    const worktree = path.join(repo, '.wt', 'fix-table');
    git('worktree', 'add', worktree, '-b', 'fix-table');

    const added = notes(['add', '--title', 'Use the table helper!', '--scope', 'repo', '--tag', 'tables'], {
        cwd: worktree,
        input: '## User said\n\n"use the helper"\n',
    });
    assert.equal(added.status, 0, added.stderr);

    const [{ id, created, commit, ...note }] = listJson();
    assert.match(id, /^\d{8}-\d{6}-use-the-table-helper$/);
    assert.deepEqual(note, {
        status: 'open',
        title: 'Use the table helper!',
        scope_guess: 'repo',
        tags: ['tables'],
        repo: 'acme/widgets',
        repo_root: repo,
        worktree,
        branch: 'fix-table',
        cwd: worktree,
        harness: 'claude-code',
        session: 'session-1',
        path: path.join(store, 'notes', 'acme--widgets', `${id}.md`),
    });
    assert.equal(added.stdout.trim(), note.path);
    assert.match(fs.readFileSync(note.path, 'utf8'), /\n---\n\n## User said\n\n"use the helper"\n$/);
});

test('origin falls back to the folder name with no remote, and to no-repo outside git', () => {
    const { repo } = makeRepo('scratch');
    notes(['add', '--title', 'a'], { cwd: repo, input: 'body' });
    notes(['add', '--title', 'b'], { input: 'body' });

    assert.deepEqual(listJson().map(({ repo: origin }) => origin).sort(), ['no-repo', 'scratch']);
});

test('two notes with the same title in the same second get two files', () => {
    notes(['add', '--title', 'same'], { input: 'one' });
    notes(['add', '--title', 'same'], { input: 'two' });

    assert.equal(listJson().length, 2);
});

test('resolve records where the lesson went and removes the note from the open list', () => {
    notes(['add', '--title', 'keep'], { input: 'body' });
    notes(['add', '--title', 'drop'], { input: 'body' });
    const dropped = listJson().find(({ title }) => title === 'drop');

    const resolved = notes(['resolve', dropped.id, '--status', 'dismissed', '--disposition', 'one-off']);
    assert.equal(resolved.status, 0, resolved.stderr);

    assert.deepEqual(listJson().map(({ title }) => title), ['keep']);
    const [{ status, disposition }] = listJson('--status', 'dismissed');
    assert.deepEqual({ status, disposition }, { status: 'dismissed', disposition: 'one-off' });
    assert.match(notes(['show', dropped.id]).stdout, /\n---\n\nbody\n$/);
});

test('list groups open notes by repository', () => {
    const { repo } = makeRepo('widgets', 'https://github.com/acme/widgets');
    notes(['add', '--title', 'in repo', '--scope', 'universal'], { cwd: repo, input: 'body' });
    notes(['add', '--title', 'elsewhere'], { input: 'body' });

    const lines = notes(['list']).stdout.replace(/\d{8}-\d{6}-/g, '');
    assert.equal(
        lines,
        ['acme/widgets (1)', '  in-repo  universal      in repo', 'no-repo (1)', '  elsewhere  unknown        elsewhere', ''].join('\n')
    );
});

test('add refuses an empty body and an unknown scope', () => {
    assert.equal(notes(['add', '--title', 'x'], { input: '  \n' }).status, 2);
    assert.equal(notes(['add', '--title', 'x', '--scope', 'global'], { input: 'body' }).status, 2);
    assert.equal(notes(['resolve', 'x', '--status', 'promoted']).status, 2);
    assert.deepEqual(listJson(), []);
});
