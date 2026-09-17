@echo off
title Intelligence Comptabilite - Backend Laravel
color 0A

echo ================================================
echo   Intelligence Comptabilite - Backend Laravel
echo ================================================
echo.
echo [1/3] Verification de la configuration...
cd /d "%~dp0backend"

echo [2/3] Demarrage du serveur Laravel sur http://localhost:8000
echo.
echo IMPORTANT: Assurez-vous que phpMyAdmin et MySQL sont actifs
echo            et que la base comptabilite_db est importee.
echo.
php artisan serve --host=0.0.0.0 --port=8000

pause
