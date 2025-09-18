from __future__ import annotations

import importlib.util
import os
import shutil
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import pandas as pd

import sys
import json
from gams import transfer as gt
import numpy as np


def get_symbol(m: gt.Container, name: str):
    try:
        m.getSymbols(name)
    except KeyError:
        return f"Symbol '{name}' does not exist in the GDX file.\n"

    if m[name].records is not None:
        df: pd.DataFrame = m[name].records
        df.replace(np.inf, 1e300, inplace=True)
        df.replace(-np.inf, -1e300, inplace=True)
        df = df.to_dict(orient="records")
    else:
        df = []

    return f"{json.dumps(df)}\n"


if __name__ == "__main__":
    is_interactive = "--interactive" in sys.argv
    gdx_file_path_arg = sys.argv[1] if len(sys.argv) > 1 else None
    if not gdx_file_path_arg:
        print("No file path provided.", file=sys.stderr, flush=True)
        sys.exit(1)

    filepath = sys.argv[1]

    gams_exec_path = shutil.which("gams")
    spec = importlib.util.find_spec("gamspy_base")
    if gams_exec_path:
        sys_dir = os.path.dirname(gams_exec_path)
    elif spec and spec.origin:
        sys_dir = os.path.dirname(spec.origin)
    else:
        ### This is a sanity check, the checkPrerequisites function in pythonUtils.ts must have already checked these requirements.
        print("Neither >gams< nor >gamspy_base< is available; try using the extension within the VS Code devcontainer.\n", file=sys.stderr, flush=True)
        sys.exit(1)

    m = gt.Container(filepath, system_directory=sys_dir)

    list_of_symbols = m.getSymbols()

    sym_names_by_category = {
        "Sets": [],
        "Parameters": [],
        "Variables": [],
        "Equations": [],
        "Aliases": [],
    }

    for sym in list_of_symbols:
        if isinstance(sym, gt.Set):
            sym_names_by_category["Sets"].append(sym.name)
        elif isinstance(sym, gt.Parameter):
            sym_names_by_category["Parameters"].append(sym.name)
        elif isinstance(sym, gt.Variable):
            sym_names_by_category["Variables"].append(sym.name)
        elif isinstance(sym, gt.Equation):
            sym_names_by_category["Equations"].append(sym.name)
        elif isinstance(sym, gt.Alias):
            sym_names_by_category["Aliases"].append(sym.name)

    if is_interactive:
        for line in sys.stdin:
            symbol_name = line.strip()
            if not symbol_name:
                continue
            sys.stdout.write(get_symbol(m, name=symbol_name))
            sys.stdout.flush()
    else:
        sys.stdout.write(f"{json.dumps(sym_names_by_category)}\n")
        sys.stdout.flush()
