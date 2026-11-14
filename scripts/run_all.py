"""Run every numbered pipeline script (NN_*.py) in order. Idempotent."""
import subprocess
import sys
from pathlib import Path

here = Path(__file__).parent
for script in sorted(here.glob("[0-9][0-9]_*.py")):
    print(f"--> {script.name}")
    subprocess.run([sys.executable, str(script)], check=True, cwd=here)
