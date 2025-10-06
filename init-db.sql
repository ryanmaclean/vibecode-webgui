-- Initialize database with proper user
CREATE USER vibecode WITH PASSWORD 'vibecode123';
GRANT ALL PRIVILEGES ON DATABASE vibecode TO vibecode;
ALTER USER vibecode CREATEDB;
