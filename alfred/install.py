"""Install an independent copy into an explicitly selected Alfred preferences bundle."""
import argparse
from pathlib import Path
import plistlib
import shutil
from build import BUNDLE, ROOT, workflow


def install(preferences):
    workflows = preferences / "workflows"
    if not workflows.is_dir():
        raise ValueError("Not an Alfred preferences bundle: " + str(preferences))
    target = workflows / ("user.workflow." + BUNDLE)
    if target.exists():
        existing = plistlib.loads((target / "info.plist").read_bytes())
        if existing.get("bundleid") != BUNDLE:
            raise ValueError("Refusing to overwrite a different workflow")
    target.mkdir(exist_ok=True)
    for name in ("opus", "fable"):
        shutil.copy2(ROOT.parent / "claude" / "bin" / name, target / name)
        (target / name).chmod(0o755)
    shutil.copy2(ROOT / "launch.py", target / "launch.py")
    (target / "info.plist").write_bytes(plistlib.dumps(workflow()))
    return target


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("preferences", type=Path)
    print(install(parser.parse_args().preferences.expanduser()))
