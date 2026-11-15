import plistlib
from pathlib import Path
import shlex
import subprocess
import tempfile
import unittest
import zipfile
from unittest.mock import patch

from build import build, workflow
from install import install
from launch import terminal_command, main, APPLESCRIPT


class LaunchersTest(unittest.TestCase):
    def test_keywords_accept_optional_arguments(self):
        data = workflow()
        keywords = [obj for obj in data['objects'] if obj['type'].endswith('.keyword')]
        self.assertEqual([o['config']['keyword'] for o in keywords], ['pi', 'claude', 'opus', 'fable'])
        self.assertTrue(all(o['config']['argumenttype'] == 1 for o in keywords))
        self.assertEqual(len(data['connections']), 4)
        self.assertEqual([o['config']['text'] for o in keywords],
                         ['Pi', 'Claude in iTerm', 'Opus', 'Fable'])

    def test_arguments_are_literal_in_real_shell(self):
        with tempfile.TemporaryDirectory(prefix="agents ' ") as folder:
            command = terminal_command('pi', '''--model opus "hello world" '$(touch BAD)' ';' '*.py' ""''', folder)
            body = shlex.split(command)[2]
            # Replace CLI with a shell function, without loading the user's shell config.
            body = body.replace('; exec /bin/zsh -l', '')
            script = 'pi() { printf "<%s>\\n" "$@"; }; ' + body
            result = subprocess.run(['/bin/zsh', '-f', '-c', script], text=True, capture_output=True, check=True)
            self.assertEqual(result.stdout.splitlines(), ['<--model>', '<opus>', '<hello world>', '<$(touch BAD)>', '<;>', '<*.py>', '<>'])
            self.assertFalse((Path(folder) / 'BAD').exists())

    def test_empty_and_wrappers(self):
        for agent in ('pi', 'claude', 'opus', 'fable'):
            command = terminal_command(agent, '', tempfile.gettempdir())
            self.assertEqual(shlex.split(command)[:2], ['/bin/zsh', '-lic'])
            self.assertIn(agent, command)

    def test_invalid_input(self):
        for agent, query in [('bad', ''), ('pi', '"unclosed'), ('pi', '"a\nb"')]:
            with self.assertRaises(ValueError):
                terminal_command(agent, query)
        with self.assertRaises(ValueError):
            terminal_command('pi', '', '/nonexistent-agent-directory')

    def test_osascript_uses_argv_not_interpolation(self):
        with patch('sys.argv', ['launch.py', 'pi', '--help']), patch('launch.subprocess.run') as run:
            self.assertEqual(main(), 0)
            self.assertEqual(run.call_args.args[0][:2], ['/usr/bin/osascript', '-'])
            self.assertEqual(run.call_args.kwargs['input'], APPLESCRIPT)
            self.assertIn('create window with default profile command', APPLESCRIPT)

    def test_build_and_install(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            with zipfile.ZipFile(build(root / 'test.alfredworkflow')) as archive:
                icons = {'icon.png', 'pi-keyword.png', 'claude-keyword.png',
                         'opus-keyword.png', 'fable-keyword.png'}
                self.assertEqual(set(archive.namelist()), {'info.plist', 'launch.py', 'opus', 'fable'} | icons)
                for icon in icons:
                    self.assertTrue(archive.read(icon).startswith(b'\x89PNG\r\n\x1a\n'))
                plistlib.loads(archive.read('info.plist'))
                self.assertTrue((archive.getinfo('opus').external_attr >> 16) & 0o111)
            (root / 'workflows').mkdir()
            target = install(root)
            (target / 'prefs.plist').write_bytes(b'preserve preferences')
            install(root)
            self.assertEqual((target / 'prefs.plist').read_bytes(), b'preserve preferences')
            self.assertTrue((target / 'fable').stat().st_mode & 0o111)
            for icon in icons:
                self.assertTrue((target / icon).read_bytes().startswith(b'\x89PNG\r\n\x1a\n'))


if __name__ == '__main__':
    unittest.main()
