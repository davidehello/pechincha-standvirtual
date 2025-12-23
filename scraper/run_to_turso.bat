@echo off
REM Run scraper and save to Turso cloud database
set TURSO_DATABASE_URL=libsql://pechincha-standvirtual-davidehello.aws-eu-west-2.turso.io
set TURSO_AUTH_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3MzQ4NTI0NTUsImlkIjoiNmY4MmMwYjctZTRiNC00N2Y2LWE1NjgtM2U2MzE2MmIyMjVmIn0.e0ppSBFVjRNpOiXghuw7kNeNz9AWJRX1BKCK-fgSarCIYm0p6OLqhQxcFSBiI8WbBf3gsMqflkHD8pgqVgAA

echo Running scraper to Turso cloud database...
python main.py --parallel --concurrency 10

echo.
echo Done! Data is now in Turso cloud database.
pause
