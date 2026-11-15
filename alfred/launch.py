"""Launch an agent in a fresh iTerm window; never evaluate query shell syntax."""
import os
from pathlib import Path
import shlex
import subprocess
import sys

APPLESCRIPT = '''on run argv
    tell application "iTerm"
        activate
        create window with default profile command (item 1 of argv)
    end tell
end run
'''


def terminal_command(agent, query, directory=None):
    if agent not in ("pi", "claude", "opus", "fable"):
        raise ValueError("Unknown agent: " + agent)
    args = shlex.split(query)
    if any("\n" in arg or "\r" in arg or "\0" in arg for arg in args):
        raise ValueError("Arguments must not contain newlines or NUL characters")
    directory = Path(directory or os.environ.get("AGENT_DIRECTORY") or Path.home() / "dev").expanduser()
    if not directory.is_dir():
        raise ValueError("Starting directory does not exist: " + str(directory))
    executable = str(Path(__file__).resolve().parent / agent) if agent in ("opus", "fable") else agent
    # Login/interactive zsh loads the same CLI setup as a normal terminal.
    # Prepend standard user CLI locations without baking this machine's paths in.
    body = 'export PATH="$HOME/.pi/agent/bin:$HOME/.local/bin:/opt/homebrew/bin:$PATH"; '
    body += "cd -- " + shlex.quote(str(directory)) + " && " + shlex.join([executable, *args])
    body += '; exec /bin/zsh -l'
    return shlex.join(["/bin/zsh", "-lic", body])


def main():
    try:
        command = terminal_command(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "")
        subprocess.run(["/usr/bin/osascript", "-", command], input=APPLESCRIPT, text=True, check=True)
    except (ValueError, subprocess.CalledProcessError) as error:
        print(str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
