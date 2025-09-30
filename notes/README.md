# LCTAR - Notes / Diagrams

This folder contains PlantUML source files in `src/` and a small set of helper scripts to render diagrams.

Rendering
- Using PlantUML jar:
  java -jar plantuml.jar -verbose -o output src/*.puml
- Using Docker:
  docker run --rm -v "%CD%":/workspace plantuml/plantuml:plantuml -o output src/*.puml
- Or use the provided helpers:
  - render_all.bat (Windows)
  - render_all.sh  (Unix)

Layout
- src/  -> PlantUML sources (do not commit generated images)
- output/ -> Generated images (ignored by git)
