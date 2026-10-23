@echo off
title Intelligence Comptabilite - Backend Laravel
color 0A

echo ================================================
echo   Intelligence Comptabilite - Backend Laravel
echo ================================================
echo.
echo [1/3] Verification de la configuration...
cd /d "%~dp0backend"

rem Ce projet exige PHP 8.3+ (Laravel 13). On prend C:\php84 s'il existe, sinon le PHP de XAMPP (8.3).
if not defined PHP_BIN if exist "C:\php84\php.exe" set "PHP_BIN=C:\php84\php.exe"
if not defined PHP_BIN set "PHP_BIN=C:\xampp\php\php.exe"
if not exist "%PHP_BIN%" (
    echo ERREUR: PHP 8.3+ introuvable a "%PHP_BIN%".
    echo Installez PHP 8.4 dans C:\php84, ou definissez PHP_BIN vers votre php.exe.
    pause
    exit /b 1
)

echo [2/3] Demarrage du serveur Laravel sur http://localhost:8000
echo.
echo IMPORTANT: Assurez-vous que phpMyAdmin et MySQL sont actifs
echo            et que la base comptabilite_db est importee.
echo.
"%PHP_BIN%" artisan serve --host=127.0.0.1 --port=8000

pause
