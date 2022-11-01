SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;
SET default_tablespace = '';
SET default_with_oids = false;

/******************************************************** FUNCTIONS *********************************************************/

CREATE FUNCTION db_namespace.rowcount_all(schema_name text default 'public')
RETURNS table(table_name text, cnt bigint) as
$$
declare
    table_name text;
begin
    for table_name in SELECT c.relname FROM pg_class c
        JOIN pg_namespace s ON (c.relnamespace=s.oid)
        WHERE c.relkind = 'r' AND s.nspname=schema_name
    LOOP
        RETURN QUERY EXECUTE format('select cast(%L as text),count(*) from %I.%I',
                table_name, schema_name, table_name);
    END LOOP;
end
$$ language plpgsql;

CREATE FUNCTION db_namespace.tenant_last_access()
RETURNS TABLE(tenant_name character varying, tenant_id character varying, is_training_tenant bool, last_login timestamp with time zone)
LANGUAGE plpgsql
AS $function$
DECLARE
    arrow record;
BEGIN
    FOR arrow IN (SELECT * FROM db_namespace."Tenant") LOOP
        select arrow.name into tenant_name;
        select arrow.id into tenant_id;
        select arrow."isTrainingTenant" into is_training_tenant;
        EXECUTE format('select max("lastLoginAttempt") from %I."Users";', arrow.id) into last_login;
        RETURN NEXT;
    END LOOP;
END
$function$;

/********************************************************** TABLES **********************************************************/

CREATE TABLE db_namespace."CreateSandboxJob" (
    id uuid NOT NULL,
    "userId" uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    email varchar(200) NOT NULL,
    status varchar(80) NOT NULL DEFAULT 'started'::character varying,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now(),
    host varchar(250) NULL
);

CREATE TABLE db_namespace."RecurringJobs" (
    id uuid NOT NULL,
    "name" text NOT NULL,
    "lastRunAt" timestamptz NULL,
    metadata jsonb NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NULL DEFAULT now(),
    updated_at timestamptz NULL DEFAULT now(),
    schedule text NOT NULL DEFAULT '0 0 * * * *'::text,
    timezone text NOT NULL DEFAULT 'America/Los_Angeles'::text,
    "startDate" timestamptz NULL,
    "endDate" timestamptz NULL,
    notes text NULL,
    status varchar(255) NOT NULL DEFAULT 'Idle'::character varying
);

CREATE TABLE db_namespace."Tenant" (
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    id uuid NOT NULL,
    name character varying(200) NOT NULL,
    migrations_path character varying(200),
    authorization_token character varying(50) NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    refreshed_at timestamp with time zone DEFAULT now(),
    settings jsonb DEFAULT '{}'::jsonb,
    "partySettings" jsonb NULL DEFAULT '{}'::jsonb,
	"isTrainingTenant" bool NULL DEFAULT false
);

CREATE TABLE db_namespace."Users" (
    created_at timestamptz NULL DEFAULT now(),
    updated_at timestamptz NULL DEFAULT now(),
    id uuid NOT NULL,
    "externalUniqueId" varchar(255) NOT NULL,
    "fullName" varchar(255) NOT NULL,
    "preferredName" varchar(255) NOT NULL,
    email varchar(255) NOT NULL,
    password varchar(255) NOT NULL,
    "employmentType" varchar(255) NOT NULL DEFAULT 'permanent'::character varying,
    "loginAttempts" int4 NOT NULL DEFAULT 0,
    metadata jsonb NULL DEFAULT '{}'::jsonb,
    inactive bool NULL DEFAULT false,
    "directEmailIdentifier" varchar(80) NULL,
    "directPhoneIdentifier" varchar(20) NULL,
    "displayPhoneNumber" varchar(20) NULL,
    "ringPhones" _varchar NULL,
    "outsideDedicatedEmails" _varchar NULL,
    "displayEmail" varchar(255) NULL,
    "lastLoginAttempt" timestamptz NULL,
    CONSTRAINT "Users_email_lowercase_check" CHECK (email = lower(email))
);

/******************************************************* PRIMARY KEYS *******************************************************/

ALTER TABLE ONLY db_namespace."Users" ADD CONSTRAINT "Users_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY db_namespace."CreateSandboxJob" ADD CONSTRAINT "CreateSandboxJob_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY db_namespace."RecurringJobs" ADD CONSTRAINT "RecurringJobs_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY db_namespace."Tenant" ADD CONSTRAINT "Tenant_pkey" PRIMARY KEY (id);

/******************************************************* UNIQUE KEYS ********************************************************/

ALTER TABLE ONLY db_namespace."Users" ADD CONSTRAINT "Users_email_key" UNIQUE (email);
ALTER TABLE ONLY db_namespace."Users" ADD CONSTRAINT "Users_externalUniqueId_key" UNIQUE ("externalUniqueId");
ALTER TABLE ONLY db_namespace."Users" ADD CONSTRAINT "Users_directEmailIdentifier_key" UNIQUE ("directEmailIdentifier");
ALTER TABLE ONLY db_namespace."Users" ADD CONSTRAINT "Users_directPhoneIdentifier_key" UNIQUE ("directPhoneIdentifier");
ALTER TABLE ONLY db_namespace."Tenant" ADD CONSTRAINT "Tenant_authorization_token_key" UNIQUE (authorization_token);
ALTER TABLE ONLY db_namespace."Tenant" ADD CONSTRAINT "Tenant_name_key" UNIQUE (name);

/****************************************************** FOREIGN KEYS ********************************************************/

ALTER TABLE ONLY db_namespace."CreateSandboxJob" ADD CONSTRAINT "CreateSandboxJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES db_namespace."Tenant"(id);
ALTER TABLE ONLY db_namespace."ResetTokens" ADD CONSTRAINT "ResetTokens_user_id_fkey" FOREIGN KEY (user_id) REFERENCES db_namespace."Users"(id);

/******************************************************* TRIGGERS ***********************************************************/

CREATE TRIGGER update_createsandboxjob_updated_at_trg BEFORE UPDATE ON db_namespace."CreateSandboxJob" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();
CREATE TRIGGER update_recurringjobs_updated_at_trg BEFORE UPDATE ON db_namespace."RecurringJobs" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();
CREATE TRIGGER update_tenant_updated_at_trg BEFORE UPDATE ON db_namespace."Tenant" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();
CREATE TRIGGER update_users_updated_at_trg BEFORE UPDATE ON db_namespace."Users" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();
