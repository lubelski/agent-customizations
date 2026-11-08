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
ANSI = re.compile(rb"\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)")


def smoke(mode, theme, presentation="ui"):
    with tempfile.TemporaryDirectory(prefix="pi-ui-ci-") as temporary:
        home = Path(temporary)
        agent = home / "agent"
        project = home / "project"
        project.mkdir()
        agent.mkdir()
        # Exercise the real package manifest, not a wildcard that loads deprecated entry points.
        resources = {"packages": [str(REPO)]} if presentation == "ui" else {
            "extensions": [str(REPO / "extensions" / f"{name}.ts") for name in (
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
            [shutil.which("node"), str(CLI), "--offline", "--no-mcp", "--no-session",
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
                expect("EXT: pi")  # One package provider, not six renderer modules.
                assert "assistant-bg" not in ANSI.sub(b"", bytes(output)).decode(errors="replace")
            start = len(output)
            os.write(master, b"/inventory\r")
            expect("/inventory to expand", start)
            if presentation == "ui":
                for command, message in (
                    (b"/ui-mobile\r", "UI mobile (saved)."),
                    (b"/ui-messages unicode\r", "Message layout unicode (saved)."),
                    (b"/ui-compact\r", "UI compact (saved)."),
                ):
                    start = len(output)
                    os.write(master, command)
                    expect(message, start)
                assert json.loads((agent / "ui.json").read_text())["messages"]["layout"] == "unicode"
                start = len(output)
                os.write(master, b"/ui-mobile\r")
                expect("UI mobile (saved).", start)
                assert json.loads((agent / "ui.json").read_text()) == {
                    "header": {"showTopBar": False}, "footer": {"compact": True}, "messages": {"layout": "compatible"},
                }
            if presentation == "ui" and mode == "fullscreen":
                start = len(output)
                os.write(master, b"/header-bar off\r")
                expect("Header top bar off (saved).", start)
                assert json.loads((agent / "ui.json").read_text())["header"]["showTopBar"] is False
            for _ in range(2):
                start = len(output)
                os.write(master, b"/reload\r")
                expect("Reloaded keybindings", start)
                expect("/inventory to expand", start)
                if presentation == "ui":
                    saved = json.loads((agent / "ui.json").read_text())
                    assert saved["footer"]["compact"] is True
                    assert saved["messages"]["layout"] == "compatible"
                if presentation == "ui" and mode == "fullscreen":
                    # Toggle proves /reload read the persisted false value (it must become true).
                    start = len(output)
                    os.write(master, b"/header-bar\r")
                    expect("Header top bar on (saved).", start)
                    assert json.loads((agent / "ui.json").read_text())["header"]["showTopBar"] is True
                    start = len(output)
                    os.write(master, b"/header-bar off\r")
                    expect("Header top bar off (saved).", start)
            if presentation == "ui":
                for command, message in (
                    (b"/ui-desktop\r", "UI desktop (saved)."),
                    (b"/ui-footer compact\r", "Footer compact (saved)."),
                    (b"/ui-footer full\r", "Footer full (saved)."),
                    (b"/ui-mobile\r", "UI mobile (saved)."),
                ):
                    start = len(output)
                    os.write(master, command)
                    expect(message, start)
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
            path = artifacts / f"{presentation}-{mode}-{theme}.log"
            path.write_bytes(output)
            print(f"FAIL {mode}/{theme}; terminal output: {path}", flush=True)
            print(ANSI.sub(b"", bytes(output[-5000:])).decode(errors="replace"), flush=True)
            raise
        finally:
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
            os.close(master)
        print(f"PASS bundled CLI: {presentation}/{mode}/{theme} (startup, reload x2, autocomplete, resize, exit)", flush=True)


if __name__ == "__main__":
    for mode in ("fullscreen", "regular"):
        for theme in ("turquoise", "dark", "light"):
            smoke(mode, theme)
    smoke("fullscreen", "dark", "legacy")
    smoke("regular", "dark", "legacy")
