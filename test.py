#!/usr/bin/env python3
import os
import sys
from pathlib import Path

import django
from django.conf import settings
from django.test.utils import get_runner


def main() -> int:
    sys.argv.insert(1, "test")
    repo_root = Path(__file__).resolve().parent
    sys.path.insert(0, str(repo_root / "arb"))
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "arb.settings")

    django.setup()
    TestRunner = get_runner(settings)
    test_runner = TestRunner(verbosity=2, interactive=False)
    failures = test_runner.run_tests(["arb"])  # discovers arb/arb/tests.py
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
