#!/usr/bin/env sh
# Render all PlantUML files in src/ to output/ (Unix)

HERE="$(cd "$(dirname "$0")" >/dev/null 2>&1 && pwd)"
SRC_DIR="$HERE/src"
OUT_DIR="$HERE/output"

mkdir -p "$OUT_DIR"

if [ -f "$HERE/plantuml.jar" ]; then
  java -jar "$HERE/plantuml.jar" -verbose -o "$OUT_DIR" "$SRC_DIR"/*.puml
  exit 0
fi

echo "plantuml.jar not found in notes folder."
echo "You can:"
echo " - download plantuml.jar and place it next to this script"
echo " - or run via Docker:"
echo "   docker run --rm -v \"$HERE\":/workspace plantuml/plantuml:plantuml -o output src/*.puml"
