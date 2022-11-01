SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;
SET default_tablespace = '';
SET default_with_oids = false;

/********************************************************** FUNCTIONS **********************************************************/

CREATE FUNCTION db_namespace.update_updated_at_column()
    RETURNS trigger
    LANGUAGE plpgsql
AS $function$
    BEGIN

    -- this is used to ignore updated_at from comparison (we need to check if any of the other columns has the value updated)
    -- updated_at will not be updated from the code anymore, it will be set only from this function
    -- if there are any scenarios where we need to manually set updated_at from the code level, we should create a separate column to store that value
    NEW.updated_at = OLD.updated_at;

    IF row(NEW.*) IS DISTINCT FROM row(OLD.*) THEN
        NEW.updated_at = now();
        END IF;

    RETURN NEW;
    END;
$function$;

/********************************************************** TABLES **********************************************************/

CREATE TABLE db_namespace."Tokens" (
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    id uuid NOT NULL,
    token character varying(255) NOT NULL,
    valid boolean DEFAULT true NOT NULL,
    expiry_date timestamp with time zone NOT NULL,
    "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "type" VARCHAR(50)
);

CREATE TABLE db_namespace."ResetTokens" (
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    user_id uuid NOT NULL,
    token_id uuid NOT NULL
);

CREATE TABLE db_namespace."UsersInvites" (
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    id uuid NOT NULL,
    email character varying(255) NOT NULL,
    sent_date timestamp with time zone NOT NULL,
    expiry_date timestamp with time zone NOT NULL,
    token character varying(255) NOT NULL,
    valid boolean DEFAULT true NOT NULL,
    "inviteData" jsonb
);

CREATE TABLE db_namespace.knex_migrations (
    id integer NOT NULL,
    name character varying(255),
    batch integer,
    migration_time timestamp with time zone
);

CREATE TABLE db_namespace.knex_migrations_lock (
    is_locked integer
);

/********************************************************** SEQUENCE **********************************************************/

CREATE SEQUENCE db_namespace.knex_migrations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE db_namespace.knex_migrations_id_seq OWNED BY db_namespace.knex_migrations.id;

/********************************************************** PRIMARY KEYS **********************************************************/

ALTER TABLE ONLY db_namespace."UsersInvites" ADD CONSTRAINT "UsersInvites_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."Tokens" ADD CONSTRAINT "Tokens_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."ResetTokens" ADD CONSTRAINT "ResetTokens_pkey" PRIMARY KEY (user_id, token_id);

ALTER TABLE ONLY db_namespace.knex_migrations ADD CONSTRAINT "knex_migrations_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace.knex_migrations ALTER COLUMN id SET DEFAULT nextval('db_namespace.knex_migrations_id_seq'::regclass);

/********************************************************** UNIQUE KEYS **********************************************************/

/********************************************************** FOREIGN KEYS **********************************************************/

ALTER TABLE ONLY db_namespace."ResetTokens" ADD CONSTRAINT "ResetTokens_token_id_fkey" FOREIGN KEY (token_id) REFERENCES db_namespace."Tokens"(id);

/********************************************************** TRIGGERS **********************************************************/

CREATE TRIGGER update_tokens_updated_at_trg BEFORE UPDATE ON db_namespace."Tokens" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_resettokens_updated_at_trg BEFORE UPDATE ON db_namespace."ResetTokens" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_usersinvites_updated_at_trg BEFORE UPDATE ON db_namespace."UsersInvites" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();
