import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Isolated DB + upload dir for API tests; must be set before `app` is imported.
_tmp = tempfile.mkdtemp(prefix="ecotrack-test-")
os.environ["ECOTRACK_DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["ECOTRACK_UPLOAD_DIR"] = f"{_tmp}/uploads"
