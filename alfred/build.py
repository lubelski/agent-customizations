"""Build a self-contained Alfred workflow (stdlib only)."""
from pathlib import Path
import argparse
import plistlib
import zipfile

ROOT = Path(__file__).resolve().parent
BUNDLE = "com.will.agent-customizations.launchers"


def workflow():
    data = dict(bundleid=BUNDLE, name="Agent Launchers", createdby="Will",
                description="Launch Pi or Claude in a new iTerm window", category="Productivity",
                version="1.1.1", disabled=False, objects=[], connections={}, uidata={},
                readme=(ROOT / "README.md").read_text(),
                variables={"AGENT_DIRECTORY": "~/dev"})
    for index, agent in enumerate(("pi", "claude", "opus", "fable")):
        keyword, action = agent + "-keyword", agent + "-action"
        data["objects"].extend([
            dict(uid=keyword, type="alfred.workflow.input.keyword", version=1,
                 config=dict(keyword=agent, argumenttype=1, withspace=True,
                             text="Claude in iTerm" if agent == "claude" else agent.title(),
                             subtext="New window · optional CLI arguments · ~/dev")),
            dict(uid=action, type="alfred.workflow.action.script", version=2,
                 config=dict(script='/usr/bin/python3 ./launch.py ' + agent + ' "$1"',
                             scriptargtype=1, type=0, escaping=0, concurrently=True, scriptfile=""))
        ])
        data["connections"][keyword] = [dict(destinationuid=action, modifiers=0, modifiersubtext="", vitoclose=False)]
        data["uidata"][keyword] = dict(xpos=50, ypos=50 + index * 140)
        data["uidata"][action] = dict(xpos=350, ypos=50 + index * 140)
    return data


def build(destination):
    with zipfile.ZipFile(destination, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("info.plist", plistlib.dumps(workflow()))
        archive.write(ROOT / "launch.py", "launch.py")
        for icon in sorted((ROOT / "icons").glob("*.png")):
            archive.write(icon, icon.name)
        for agent in ("opus", "fable"):
            archive.write(ROOT.parent / "claude" / "bin" / agent, agent)
    return destination


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, help="Destination .alfredworkflow file")
    print(build(parser.parse_args().output))
