from __future__ import annotations

import importlib.util
import json
import os
import shutil
import sys
from typing import TYPE_CHECKING, Any, Dict, List

import numpy as np
from gams import transfer as gt

if TYPE_CHECKING:
    import pandas as pd


class GdxReader:
    """
    A class to read and interact with GAMS GDX files.

    This class encapsulates the logic for opening a GDX file, categorizing its
    symbols, and retrieving data for specific symbols.
    """

    def __init__(self, filepath: str):
        """
        Initializes the GdxReader.

        Args:
            filepath: The path to the GDX file.

        Raises:
            FileNotFoundError: If the specified GDX file does not exist.
            RuntimeError: If neither GAMS nor gamspy_base can be located.
        """
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"The file '{filepath}' does not exist.")

        self.filepath = filepath
        self._system_directory = self._find_gams_directory()
        self.container = gt.Container(
            self.filepath, system_directory=self._system_directory
        )

    def _find_gams_directory(self) -> str:
        """
        Locates the GAMS system directory.

        It first checks for a GAMS executable on the system PATH, then checks for
        the 'gamspy_base' package.

        Returns:
            The path to the GAMS system directory.

        Raises:
            RuntimeError: If a GAMS installation cannot be found.
        """
        gams_exec_path = shutil.which("gams")
        if gams_exec_path:
            return os.path.dirname(gams_exec_path)

        spec = importlib.util.find_spec("gamspy_base")
        if spec and spec.origin:
            return os.path.dirname(spec.origin)

        # This is a sanity check; prerequisite checks should happen upstream.
        raise RuntimeError(
            "Neither 'gams' nor 'gamspy_base' is available. "
            "Please ensure GAMS is installed and on your PATH."
        )

    def categorize_symbols(self) -> Dict[str, List[str]]:
        """
        Categorizes all symbols in the GDX container by their type.

        Returns:
            A dictionary mapping symbol types to a list of symbol names.
        """
        symbols = self.container.getSymbols()
        categorized = {
            "Sets": [],
            "Parameters": [],
            "Variables": [],
            "Equations": [],
            "Aliases": [],
        }

        for sym in symbols:
            if isinstance(sym, gt.Set):
                categorized["Sets"].append(sym.name)
            elif isinstance(sym, gt.Parameter):
                categorized["Parameters"].append(sym.name)
            elif isinstance(sym, gt.Variable):
                categorized["Variables"].append(sym.name)
            elif isinstance(sym, gt.Equation):
                categorized["Equations"].append(sym.name)
            elif isinstance(sym, gt.Alias):
                categorized["Aliases"].append(sym.name)

        return categorized

    def paginate_symbol_data(self, name: str, page: int = 1) -> List[Dict[str, Any]]:
        """
        Retrieves the records for a given symbol.

        Args:
            name: The name of the symbol to retrieve.
            page: The page index to return corresponding 100 rows.

        Returns:
            A list of dictionaries representing the symbol's records.
            Returns an empty list if the symbol has no records.

        Raises:
            KeyError: If the symbol does not exist in the GDX file.
        """
        if name not in self.container:
            raise KeyError(f"Symbol '{name}' does not exist in the GDX file.")

        symbol = self.container[name]
        if symbol.records is None:
            return [], 0

        start_index = (page - 1) * 100
        end_index = page * 100
        paginated_df: pd.DataFrame = symbol.records[start_index:end_index]
        paginated_df = paginated_df.replace([np.inf, -np.inf], [1e300, -1e300])

        return paginated_df.to_dict(orient="records"), len(symbol.records)


def main():
    """
    Main function to run the GDX data service.

    Parses command-line arguments to either list all symbol categories or enter
    an interactive mode to fetch data for specific symbols.
    """
    if len(sys.argv) < 2:
        print(
            "Usage: python gdx_service.py <path_to_gdx_file> [--interactive]",
            file=sys.stderr,
        )
        sys.exit(1)

    gdx_file_path = sys.argv[1]
    is_interactive = "--interactive" in sys.argv

    try:
        reader = GdxReader(gdx_file_path)

        if is_interactive:
            for line in sys.stdin:
                params = json.loads(line)
                symbol_name, page_number = params["symbolName"], params["page"]
                if not symbol_name:
                    continue

                try:
                    data, total_records = reader.paginate_symbol_data(
                        name=symbol_name, page=page_number
                    )
                    response = {"data": data, "total_records": total_records}
                    sys.stdout.write(f"{json.dumps(response)}\n")
                except KeyError as e:
                    sys.stdout.write(f"{str(e)}\n")
                sys.stdout.flush()
        else:
            categories = reader.categorize_symbols()
            sys.stdout.write(f"{json.dumps(categories)}\n")
            sys.stdout.flush()

    except (FileNotFoundError, RuntimeError, KeyError) as e:
        print(f"Error: {e}", file=sys.stderr, flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
