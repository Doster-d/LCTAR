@echo off
REM Render all PlantUML files in src/ to output/ (Windows)

set SRC_DIR=%~dp0src
set OUT_DIR=%~dp0output

if not exist "%OUT_DIR%" mkdir "%OUT_DIR%"

REM Try plantuml.jar in current dir
if exist "%~dp0plantuml.jar" (
  java -jar "%~dp0plantuml.jar" -verbose -o "%OUT_DIR%" "%SRC_DIR%\*.puml"
  goto :eof
)

echo plantuml.jar not found in notes folder.
echo You can:
echo  - download plantuml.jar and place it next to this script
echo  - or run via Docker:
echo    docker run --rm -v "%CD%":/workspace plantuml/plantuml:plantuml -o output src/*.puml
