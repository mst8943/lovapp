"""Run with python scripts/test-handoff.py; no archive or credentials are read."""
import runpy
from pathlib import Path
from unittest.mock import patch, MagicMock

archive = MagicMock()
tree = [
    (".", ["build", "tmp", "artifacts", "apps"], ["package.json", ".env", ".env.example", "zip_project.py", "old.tgz"]),
    ("./artifacts", ["android-twa", "test-audit"], ["snap-tabs.js"]),
    ("./artifacts/android-twa", [], ["sign-release.ps1", "release.jks"]),
    ("./apps/mobile", ["build", ".dart_tool", "lib"], ["pubspec.yaml", "env.json"]),
    ("./apps/mobile/android", [], ["local.properties", "settings.gradle.kts"]),
]
with patch("os.walk", return_value=tree), patch("zipfile.ZipFile", return_value=archive):
    runpy.run_path(str(Path(__file__).resolve().parents[1] / "zip_project.py"))
included = {Path(call.args[1]).as_posix() for call in archive.write.call_args_list}
assert included == {
    "package.json", ".env.example", "zip_project.py", "artifacts/android-twa/sign-release.ps1",
    "apps/mobile/pubspec.yaml", "apps/mobile/android/settings.gradle.kts",
}, included
assert tree[0][1] == ["artifacts", "apps"]
assert tree[1][1] == ["android-twa"]
assert tree[3][1] == ["lib"]
print("Handoff excludes secrets/build output and retains release signing script.")
