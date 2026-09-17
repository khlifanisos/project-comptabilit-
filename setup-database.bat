@echo off
title Intelligence Comptabilite - Setup Base de Donnees
color 0E

echo ================================================
echo   Intelligence Comptabilite - Setup Database
echo ================================================
echo.
echo Ce script va :
echo  1. Creer la base de donnees comptabilite_db
echo  2. Executer toutes les migrations Laravel
echo  3. Inserer les donnees de demonstration
echo.
echo PREREQUIS : MySQL/phpMyAdmin doit etre actif (XAMPP/WAMP)
echo.
pause

cd /d "%~dp0backend"

echo.
echo [1/3] Execution des migrations...
php artisan migrate --force
if %errorlevel% neq 0 (
    echo ERREUR: La migration a echoue. Verifiez votre connexion MySQL.
    pause
    exit /b 1
)

echo.
echo [2/3] Insertion des donnees de demonstration...
php artisan db:seed --force
if %errorlevel% neq 0 (
    echo ERREUR: Le seeder a echoue.
    pause
    exit /b 1
)

echo.
echo [3/3] Nettoyage du cache...
php artisan cache:clear
php artisan config:clear

echo.
echo ================================================
echo   Base de donnees configuree avec succes !
echo ================================================
echo.
echo Comptes de demonstration :
echo   Admin   : admin@comptabilite.ma  / Admin123!
echo   Client  : client@exemple.ma      / Client123!
echo.
pause
