"""Exercise the shipped CLI bundle, not just unbundled component exports.

No credentials or model calls: isolated HOME/config/cwd, offline, MCP disabled.
Requires a POSIX host and Python 3 (available on the Linux/macOS CI runners).
"""
import errno
import fcntl
import json
import os
from pathlib import Path
import pty
import re
import select
import shutil
import signal
import struct
import subprocess
import tempfile
import termios
import time

REPO = Path(__file__).resolve().parents[1]
PI = Path(os.environ.get("PI_PACKAGE_ROOT", REPO / "node_modules/@earendil-works/pi-coding-agent")).resolve()
CLI = PI / "dist/bundle/cli.js"
# PI_BINARY exercises the standalone distribution, not its absent Node module tree.
COMMAND = [str(Path(os.environ["PI_BINARY"]).resolve())] if os.environ.get("PI_BINARY") else [shutil.which("node"), str(CLI)]
ANSI = re.compile(rb"\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)")


def smoke(mode, theme, presentation="ui", symlinked=False):
    with tempfile.TemporaryDirectory(prefix="pi-ui-ci-") as temporary:
        home = Path(temporary)
        agent = home / "agent"
        project = home / "project"
        project.mkdir()
        agent.mkdir()
        package = REPO
        if symlinked:
            package = home / "linked-package"
            package.symlink_to(REPO, target_is_directory=True)
        # Exercise the real package manifest, not a wildcard that loads deprecated entry points.
        resources = {"packages": [str(package)]} if presentation == "ui" else {
            "extensions": [str(package / "extensions" / f"{name}.ts") for name in (
                "assistant-background", "code-brackets", "half-bleed", "recessed-tools",
                "session-title-banner", "stable-input-layout", "session-rename")],
            "themes": [str(REPO / "themes" / "turquoise.json")],
        }
        (agent / "settings.json").write_text(json.dumps({
            **resources, "theme": theme, "tuiMode": mode, "quietStartup": True,
            "showHardwareCursor": True, "lastChangelogVersion": json.loads((PI / "package.json").read_text())["version"],
        }))
        env = {key: os.environ[key] for key in ("PATH", "TMPDIR", "SYSTEMROOT") if key in os.environ}
        env.update(HOME=str(home), PI_CODING_AGENT_DIR=str(agent), PI_OFFLINE="1",
                   PI_SKIP_VERSION_CHECK="1", PI_TELEMETRY="0", TERM="xterm-256color",
                   COLORTERM="truecolor", PI_IMAGE_PROTOCOL="none")
        master, slave = pty.openpty()
        fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 32, 120, 0, 0))
        process = subprocess.Popen(
            COMMAND + ["--offline", "--no-mcp", "--no-session",
             "--no-skills", "--no-prompt-templates", "--no-context-files", "--no-approve"],
            stdin=slave, stdout=slave, stderr=slave, cwd=project, env=env, start_new_session=True,
        )
        os.close(slave)
        output = bytearray()

        def read_output(timeout=0.1):
            if select.select([master], [], [], timeout)[0]:
                try:
                    output.extend(os.read(master, 65536))
                except OSError as error:
                    if error.errno != errno.EIO:
                        raise

        def expect(text, start=0, timeout=20):
            deadline = time.monotonic() + timeout
            while time.monotonic() < deadline:
                read_output()
                if text.encode() in ANSI.sub(b"", bytes(output[start:])):
                    return
                if process.poll() is not None:
                    raise AssertionError(f"Pi exited ({process.returncode}) waiting for {text!r}")
            raise AssertionError(f"Timed out waiting for {text!r}")

        try:
            expect("/inventory to expand")  # Proves the collapsed footer rendered.
            start = len(output)
            os.write(master, b"/inventory\r")  # Command expands the inventory.
            expect("/inventory to collapse", start)
            if presentation == "legacy":
                expect("assistant-bg")
                expect("half-bleed")
                expect("recessed-tools")
            else:
                expect(f"EXT: {package.name}")  # One package provider, not six renderer modules.
                assert "assistant-bg" not in ANSI.sub(b"", bytes(output)).decode(errors="replace")
            start = len(output)
            os.write(master, b"/inventory\r")
            expect("/inventory to expand", start)
            def toggle(name, label, state):
                nonlocal start
                start = len(output)
                os.write(master, f"/ui-toggle-{name}\r".encode())
                expect(f"{label} {state} (saved).", start)
            if presentation == "ui":
                toggle("compact-footer", "Compact footer", "on")
                toggle("font-compat", "Font compatibility", "on")
                toggle("compact-header", "Compact header", "on")
                assert json.loads((agent / "ui.json").read_text()) == {
                    "compactFooter": True, "fontCompat": True, "compactHeader": True,
                }
            for _ in range(2):
                start = len(output)
                os.write(master, b"/reload\r")
                expect("Reloaded keybindings", start)
                expect("/inventory to expand", start)
                if presentation == "ui":
                    # Toggling proves /reload read the persisted true value.
                    toggle("compact-header", "Compact header", "off")
                    toggle("compact-header", "Compact header", "on")
                    saved = json.loads((agent / "ui.json").read_text())
                    assert saved["compactFooter"] is True and saved["fontCompat"] is True
            if presentation == "ui":
                toggle("compact-footer", "Compact footer", "off")
                toggle("compact-footer", "Compact footer", "on")
            # Trigger autocomplete and render at narrow and wide sizes.
            start = len(output)
            os.write(master, b"/ren")
            expect("rename", start)
            os.write(master, b"\x1b")
            time.sleep(0.15)
            os.write(master, b"\x15")  # Clear unfinished input without submitting it.
            for rows, columns in ((16, 24), (24, 40), (32, 160)):
                fcntl.ioctl(master, termios.TIOCSWINSZ, struct.pack("HHHH", rows, columns, 0, 0))
                os.kill(process.pid, signal.SIGWINCH)
                until = time.monotonic() + 0.3
                while time.monotonic() < until:
                    read_output()
                assert process.poll() is None, "Pi crashed during resize"
            os.write(master, b"\x04")
            deadline = time.monotonic() + 10
            while process.poll() is None and time.monotonic() < deadline:
                read_output()
            assert process.poll() == 0, f"Unclean exit: {process.poll()}"
            read_output(0)
            plain = ANSI.sub(b"", bytes(output)).decode(errors="replace")
            for error in ("Failed to load extension", "[Extension issues]", "TypeError:", "ReferenceError:", "Unknown theme color"):
                assert error not in plain, error
            assert not re.search(r'Extension ".*?" error:', plain), "Extension handler failed"
            crashes = agent / "crashes.json"
            assert not crashes.exists() or not json.loads(crashes.read_text()), "Pi recorded a crash"
        except BaseException:
            artifacts = REPO / "test-artifacts"
            artifacts.mkdir(exist_ok=True)
            path = artifacts / f"{presentation}-{mode}-{theme}{'-symlink' if symlinked else ''}.log"
            path.write_bytes(output)
            print(f"FAIL {mode}/{theme}; terminal output: {path}", flush=True)
            print(ANSI.sub(b"", bytes(output[-5000:])).decode(errors="replace"), flush=True)
            raise
        finally:
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
            os.close(master)
        print(f"PASS {'standalone' if os.environ.get('PI_BINARY') else 'bundled'} CLI: {presentation}/{mode}/{theme}{'/symlink' if symlinked else ''} (startup, reload x2, autocomplete, resize, exit)", flush=True)


if __name__ == "__main__":
    for mode in ("fullscreen", "regular"):
        for theme in ("turquoise", "dark", "light"):
            smoke(mode, theme)
    smoke("fullscreen", "dark", "legacy")
    smoke("regular", "dark", "legacy")
    # Pi 1.5.2 includes upstream entry-point realpath handling (PR #8112).
    # Older pinned npm runtimes need not support this standalone regression case.
    if os.environ.get("PI_BINARY"):
        smoke("fullscreen", "dark", symlinked=True)
        smoke("fullscreen", "dark", "legacy", symlinked=True)
