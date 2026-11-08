"""Savāc shaders/*.frag un common.glsl vienā ES modulī js/shaders.js (lai lapai nevajag ielādēt atsevišķus failus).
Palaid pēc katras šeidera izmaiņas:  python tools/bundle_shaders.py"""
import json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
out = {p.stem if p.suffix == ".frag" else "common": p.read_text(encoding="utf-8") for p in sorted((root / "shaders").glob("*")) if p.suffix in (".frag", ".glsl")}
(root / "js" / "shaders.js").write_text("// Ģenerēts ar tools/bundle_shaders.py no mapes shaders/. Nelabot ar roku.\nexport const SHADERS = " + json.dumps(out, ensure_ascii=False, indent=0) + ";\n", encoding="utf-8")
print(len(out), "šeideri")
