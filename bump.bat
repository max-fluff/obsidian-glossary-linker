@echo off
cd /d "%~dp0"

if not "%~1"=="" (
  node src/shared/version-bump.mjs %*
  echo.
  pause
  exit /b
)

echo Bump which part?
echo    [1] patch   [2] minor   [3] major
echo    or type a version like 1.5.0  ^(Enter = patch^)
set "choice="
set /p "choice=> "
if "%choice%"=="1" set "choice=patch"
if "%choice%"=="2" set "choice=minor"
if "%choice%"=="3" set "choice=major"

node src/shared/version-bump.mjs %choice%
echo.
pause
