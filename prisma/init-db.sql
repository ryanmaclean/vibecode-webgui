-- Initialize database with proper user
-- Usage: psql -v vibecode_password='<set-a-strong-password>' -f prisma/init-db.sql
\if :{?vibecode_password}
\else
  \echo 'ERROR: pass -v vibecode_password=... to psql'
  \quit
\endif
CREATE USER vibecode WITH PASSWORD :'vibecode_password';
GRANT ALL PRIVILEGES ON DATABASE vibecode TO vibecode;
ALTER USER vibecode CREATEDB;
