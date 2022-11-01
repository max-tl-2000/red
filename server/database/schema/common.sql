SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;
SET default_with_oids = false;

/********************************************************** SEQUENCES **********************************************************/

CREATE SEQUENCE db_namespace.knex_migrations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

/********************************************************** TABLES **********************************************************/

CREATE TABLE db_namespace.knex_migrations (
    id integer NOT NULL DEFAULT nextval('db_namespace.knex_migrations_id_seq'::regclass),
    name character varying(255),
    batch integer,
    migration_time timestamp with time zone
);

ALTER SEQUENCE db_namespace.knex_migrations_id_seq OWNED BY db_namespace.knex_migrations.id;

CREATE TABLE db_namespace.knex_migrations_lock (
    is_locked integer
);

CREATE TABLE db_namespace."AccessedProperties" (
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "commonUserId" uuid NOT NULL,
    "lastAccessed" timestamptz NOT NULL
);

CREATE TABLE db_namespace."CommsTemplate" (
    id uuid NOT NULL,
    "name" varchar(255) NOT NULL,
    "displayName" varchar(255) NOT NULL,
    description text NULL,
    "emailSubject" text NULL,
    "emailTemplate" text NOT NULL,
    "smsTemplate" text NOT NULL,
    created_at timestamptz NULL DEFAULT now(),
    updated_at timestamptz NULL DEFAULT now()
);

CREATE TABLE db_namespace."Devices" (
    created_at timestamptz NULL DEFAULT now(),
    updated_at timestamptz NULL DEFAULT now(),
    id uuid NOT NULL,
    "userId" uuid NULL,
    "pushToken" varchar(255) NULL,
    details jsonb NULL DEFAULT '{}'::jsonb
);


CREATE TABLE db_namespace."ProgramSources" (
    "created_at" timestamp NOT NULL DEFAULT now(),
    "updated_at" timestamp NOT NULL DEFAULT now(),
    "name" text NOT NULL,
    "type" text NOT NULL
);

CREATE TABLE db_namespace."ResetToken" (
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    id uuid NOT NULL,
    token VARCHAR(800) NOT NULL,
    valid boolean NOT NULL DEFAULT TRUE,
    "userId" uuid NOT NULL,
    "expiryDate" timestamp NOT NULL
);

CREATE TABLE db_namespace."ScheduledTransactionsInfo" (
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now(),
    id uuid NOT NULL,
    "transactionId" varchar(256) NOT NULL,
    "wasSeen" bool NOT NULL DEFAULT false
);

CREATE TABLE db_namespace."Users" (
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    id uuid NOT NULL,
    "fullName" character varying(255) NOT NULL,
    "preferredName" character varying(255) NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    "loginAttempts" integer DEFAULT 0 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    inactive boolean DEFAULT false NOT NULL,
    "lastLoginAttempt" timestamp with time zone,
    "roommateProfile" jsonb DEFAULT '{}'::jsonb,
    "anonymousEmailId" uuid,
    CONSTRAINT "Users_email_lowercase_check" CHECK (((email)::text = lower((email)::text)))
);

CREATE TABLE db_namespace."UserInvite" (
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    id uuid NOT NULL,
    email character varying(255) NOT NULL,
    "sentDate" timestamp with time zone NOT NULL,
    "expiryDate" timestamp with time zone NOT NULL,
    token character varying(255) NOT NULL,
    valid boolean NOT NULL,
    "inviteData" jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE db_namespace."UserPaymentMethod" (
    id uuid NOT NULL,
    "userId" uuid NULL,
    "channelType" varchar(255) NOT NULL,
    "lastFour" varchar(255) NOT NULL,
    "isDefault" bool NULL,
    "expirationMonth" varchar(255) NOT NULL,
    brand varchar(255) NOT NULL,
    created_at timestamptz NULL DEFAULT now(),
    updated_at timestamptz NULL DEFAULT now(),
    "externalId" varchar(500) NULL,
    "tenantId" uuid NOT NULL,
    "integrationId" varchar(500) NOT NULL
);

CREATE TABLE db_namespace."UserPerson" (
    "userId" uuid NOT NULL,
    "personId" uuid NOT NULL,
    "tenantId" uuid NOT NULL
);

/********************************************************** PRIMARY KEYS **********************************************************/

ALTER TABLE ONLY db_namespace.knex_migrations
    ADD CONSTRAINT "knex_migrations_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."AccessedProperties"
    ADD CONSTRAINT "AccessedProperties_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."CommsTemplate"
    ADD CONSTRAINT "CommsTemplate_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."Devices"
    ADD CONSTRAINT "Devices_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."ResetToken"
    ADD CONSTRAINT "ResetToken_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."ScheduledTransactionsInfo"
    ADD CONSTRAINT "ScheduledTransactionsInfo_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."UserInvite"
    ADD CONSTRAINT "UserInvite_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."UserPaymentMethod"
    ADD CONSTRAINT "UserPaymentMethod_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."Users"
    ADD CONSTRAINT "Users_pkey" PRIMARY KEY (id);

/********************************************************** UNIQUE KEYS **********************************************************/

ALTER TABLE ONLY db_namespace."AccessedProperties"
    ADD CONSTRAINT "AccessedProperties_tenantId_propertyId_commonUserId_key" UNIQUE ("tenantId", "propertyId", "commonUserId");

ALTER TABLE ONLY db_namespace."CommsTemplate"
    ADD CONSTRAINT "CommsTemplate_name_key" UNIQUE (name);

ALTER TABLE ONLY db_namespace."ProgramSources"
    ADD CONSTRAINT "ProgramSources_name_key" UNIQUE ("name");

ALTER TABLE ONLY db_namespace."ScheduledTransactionsInfo"
    ADD CONSTRAINT "ScheduledTransactionsInfo_transactionId_key" UNIQUE ("transactionId");

ALTER TABLE ONLY db_namespace."UserPaymentMethod"
    ADD CONSTRAINT "UserPaymentMethod_userId_channelType_lastFour_expirationMonth_integrationId_key" UNIQUE ("userId", "channelType", "lastFour", brand, "expirationMonth", "integrationId");

ALTER TABLE ONLY db_namespace."UserPerson"
    ADD CONSTRAINT "UserPerson_userId_personId_tenantId_key" UNIQUE ("userId", "personId", "tenantId");

ALTER TABLE ONLY db_namespace."UserPerson"
    ADD CONSTRAINT "UserPerson_userId_tenantId_key" UNIQUE ("userId", "tenantId");

ALTER TABLE ONLY db_namespace."Users"
    ADD CONSTRAINT "Users_email_key" UNIQUE ("email");

/********************************************************** FOREIGN KEYS **********************************************************/

ALTER TABLE ONLY db_namespace."AccessedProperties"
    ADD CONSTRAINT "AccessedProperties_commonUserId_fkey" FOREIGN KEY ("commonUserId") REFERENCES db_namespace."Users"(id) ON DELETE CASCADE;

ALTER TABLE ONLY db_namespace."AccessedProperties"
    ADD CONSTRAINT "AccessedProperties_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "admin"."Tenant"(id) ON DELETE CASCADE;

ALTER TABLE ONLY db_namespace."Devices"
    ADD CONSTRAINT "Devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES db_namespace."Users"(id) ON DELETE CASCADE;

ALTER TABLE ONLY db_namespace."ResetToken"
    ADD CONSTRAINT "ResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES db_namespace."Users"(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE ONLY db_namespace."UserPerson"
    ADD CONSTRAINT "UserPerson_userId_fkey" FOREIGN KEY ("userId") REFERENCES db_namespace."Users"(id);

ALTER TABLE ONLY db_namespace."UserPaymentMethod"
    ADD CONSTRAINT "UserPaymentMethod_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "admin"."Tenant"(id) ON DELETE CASCADE;

ALTER TABLE ONLY db_namespace."UserPaymentMethod"
    ADD CONSTRAINT "UserPaymentMethod_userId_fkey" FOREIGN KEY ("userId") REFERENCES db_namespace."Users"(id) ON DELETE CASCADE;
