DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles WHERE rolname = 'billuser') THEN
      CREATE ROLE billuser WITH LOGIN PASSWORD 'secretpassword8888' CREATEDB;
   ELSE
      ALTER ROLE billuser WITH LOGIN PASSWORD 'secretpassword8888' CREATEDB;
   END IF;
END
$do$;
