import sys
import json
from gams import transfer as gt
import numpy as np

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("No file path provided.", file=sys.stderr)
        sys.exit(1)

    filepath = sys.argv[1]
    m = gt.Container(filepath)

    list_of_symbols = m.getSymbols()

    one_big_json = {
        "Sets": {},
        "Parameters": {},
        "Variables": {},
        "Equations": {},
        "Aliases": {},
    }

    for sym in list_of_symbols:
        if sym.records is not None:
            df = sym.records
            df.replace(np.inf, 1e300, inplace=True)
            df.replace(-np.inf, -1e300, inplace=True)
            df = df.to_dict(orient="records")
        else:
            df = []
        if isinstance(sym, gt.Set):
            one_big_json["Sets"][sym.name] = df
        elif isinstance(sym, gt.Parameter):
            one_big_json["Parameters"][sym.name] = df
        elif isinstance(sym, gt.Variable):
            one_big_json["Variables"][sym.name] = df
        elif isinstance(sym, gt.Equation):
            one_big_json["Equations"][sym.name] = df
        elif isinstance(sym, gt.Alias):
            one_big_json["Aliases"][sym.name] = df

    sys.stdout.write(json.dumps(one_big_json))