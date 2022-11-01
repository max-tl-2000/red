SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;
SET default_tablespace = '';
SET default_with_oids = false;

/********************************************************** TABLES **********************************************************/

CREATE TABLE db_namespace."rentapp_PartyApplication" (
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    "id" uuid NOT NULL,
    /* note - partyId is NOT a FKEY;  the assumption is that this table could exist in a completely different database. */
    "partyId" uuid NOT NULL,
    "applicationData" jsonb DEFAULT '{}'::jsonb,
    "maxApprovedAt" numeric(7,2),
    "minDeniedAt" numeric(7,2),
    "isHeld" bool DEFAULT false,
	"holdReason" text,
    "overrideNewCountChecks" bool NULL,
	"screeningVersion" int4 NULL,
    CONSTRAINT "rentapp_PartyApplication_isHeld_holdReason_check" CHECK (NOT "isHeld" AND (coalesce("holdReason", '') = '') OR "isHeld" AND (coalesce("holdReason", '') <> ''))
);

CREATE TABLE db_namespace."rentapp_PersonApplication" (
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    id uuid NOT NULL,
    "personId" uuid NOT NULL,
    "partyId" uuid NOT NULL,
    "partyApplicationId" uuid NOT NULL,
    "paymentCompleted" boolean DEFAULT false NOT NULL,
    "applicationData" jsonb DEFAULT '{}'::jsonb,
    "applicationStatus" character varying(255),
    "additionalData" jsonb DEFAULT '{}'::jsonb,
    "applicantId" character varying(255) NULL,
	ssn character varying(255) NULL,
	itin character varying(255) NULL,
	"isFeeWaived" bool NOT NULL DEFAULT false,
	"endedAsMergedAt" timestamptz NULL,
    "sendSsnEnabled" bool NULL DEFAULT false,
    "feeWaiverReason" text NULL,
    "tosEvents" jsonb,
    "paymentLink" varchar(2000) NULL,
    "createdFromCommId" UUID NULL,
    "applicationCompleted" timestamptz,
    "copiedFrom" UUID DEFAULT NULL
);

CREATE TABLE db_namespace."rentapp_SubmissionRequest" (
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    id uuid NOT NULL,
    "partyApplicationId" uuid NOT NULL,
    "rawRequest" text NOT NULL,
    "propertyId" uuid NOT NULL,
    "rentData" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "applicantData" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "transactionNumber" character varying(255),
	"quoteId" uuid,
	"isAlerted" bool DEFAULT false,
	"isObsolete" bool DEFAULT false,
	"requestType" character varying(255),
	"requestEndedAt" timestamptz,
	"requestResult" jsonb,
    "completeSubmissionResponseId" uuid,
	"parentSubmissionRequestId" uuid,
	"origin" character varying(255),
	"requestDataDiff" jsonb
);

CREATE TABLE db_namespace."rentapp_SubmissionResponse" (
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    id uuid NOT NULL,
    "submissionRequestId" uuid NOT NULL,
    "rawResponse" text NOT NULL,
    "applicationDecision" character varying(255),
    "applicantDecision" jsonb[],
    "criteriaResult" jsonb,
    "backgroundReport" text,
    recommendations jsonb[],
    "externalId" character varying(255) DEFAULT ''::character varying NOT NULL,
    status character varying(255) NULL,
	"serviceStatus" jsonb NULL,
    "origin" VARCHAR(80) DEFAULT 'http',
    CONSTRAINT "rentapp_SubmissionResponse_origin_check" CHECK (origin = 'http' OR origin = 'push' OR origin = 'poll')
);

CREATE TABLE db_namespace."rentapp_ApplicationInvoices" (
    id uuid NOT NULL,
    "applicationFeeId" uuid NOT NULL,
    "applicationFeeAmount" numeric(7,2) NOT NULL,
    "holdDepositFeeId" uuid,
    "holdDepositFeeIdAmount" numeric(7,2),
    "paymentCompleted" boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    "receiptPayload" jsonb DEFAULT '{}'::jsonb,
    "partyApplicationId" uuid,
    "personApplicationId" uuid,
    "quoteId" uuid,
    "applicationFeeWaiverAmount" numeric(7,2) NULL,
	"propertyId" uuid NULL,
    "appFeeTransactionId" varchar NULL,
    "holdDepositTransactionId" varchar NULL
);

CREATE TABLE db_namespace."rentapp_partyApplicationDocuments" (
    id uuid NOT NULL,
    "partyApplicationId" uuid NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE db_namespace."rentapp_personApplicationDocuments" (
    id uuid NOT NULL,
    "personApplicationId" uuid NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE db_namespace."rentapp_ApplicationTransactions" (
    id uuid NOT NULL,
    "invoiceId" uuid NOT NULL,
    "transactionType" character varying(80) NOT NULL,
    "transactionData" jsonb DEFAULT '{}'::jsonb NOT NULL,
	created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    "externalId" character varying(255) NOT NULL,
    "targetId" character varying(255)
);

/********************************************************** PRIMARY KEYS **********************************************************/

ALTER TABLE ONLY db_namespace."rentapp_PartyApplication"
    ADD CONSTRAINT "rentapp_PartyApplication_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."rentapp_PersonApplication"
    ADD CONSTRAINT "rentapp_PersonApplication_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."rentapp_SubmissionRequest"
    ADD CONSTRAINT "rentapp_SubmissionRequest_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."rentapp_SubmissionResponse"
    ADD CONSTRAINT "rentapp_SubmissionResponse_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."rentapp_ApplicationInvoices"
    ADD CONSTRAINT "rentapp_ApplicationInvoices_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."rentapp_partyApplicationDocuments"
    ADD CONSTRAINT "rentapp_partyApplicationDocuments_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."rentapp_personApplicationDocuments"
    ADD CONSTRAINT "rentapp_personApplicationDocuments_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."rentapp_ApplicationTransactions"
    ADD CONSTRAINT "rentapp_ApplicationTransactions_pkey" PRIMARY KEY (id);

/********************************************************** UNIQUE KEYS **********************************************************/

ALTER TABLE ONLY db_namespace."rentapp_PartyApplication"
    ADD CONSTRAINT "rentapp_PartyApplication_partyId_key" UNIQUE ("partyId");

ALTER TABLE db_namespace."rentapp_ApplicationTransactions"
    ADD CONSTRAINT "rentapp_ApplicationTransactions_invoiceId_transactionType_e_key" UNIQUE ("invoiceId", "transactionType", "externalId");

/********************************************************** FOREIGN KEYS **********************************************************/

ALTER TABLE ONLY db_namespace."ApplicantDataNotCommitted"
    ADD CONSTRAINT "ApplicantDataNotCommitted_partyApplicationId_fkey" FOREIGN KEY ("partyApplicationId") REFERENCES db_namespace."rentapp_PartyApplication"(id);

ALTER TABLE ONLY db_namespace."rentapp_ApplicationInvoices"
   ADD CONSTRAINT "rentapp_ApplicationInvoices_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES db_namespace."Quote"(id);

ALTER TABLE ONLY db_namespace."rentapp_PersonApplication"
	ADD CONSTRAINT "rentapp_PersonApplication_createdFromCommId_fkey" FOREIGN KEY ("createdFromCommId") REFERENCES db_namespace."Communication"(id);

ALTER TABLE ONLY db_namespace."rentapp_PersonApplication"
    ADD CONSTRAINT "rentapp_PersonApplication_partyApplicationId_fkey" FOREIGN KEY ("partyApplicationId") REFERENCES db_namespace."rentapp_PartyApplication"(id);

ALTER TABLE ONLY db_namespace."rentapp_PersonApplication"
    ADD CONSTRAINT "rentapp_PersonApplication_copiedFrom_fkey" FOREIGN KEY ("copiedFrom") REFERENCES db_namespace."rentapp_PersonApplication"(id);

ALTER TABLE ONLY db_namespace."rentapp_SubmissionRequest"
    ADD CONSTRAINT "rentapp_SubmissionRequest_partyApplicationId_fkey" FOREIGN KEY ("partyApplicationId") REFERENCES db_namespace."rentapp_PartyApplication"(id) ON DELETE CASCADE;

ALTER TABLE ONLY db_namespace."rentapp_SubmissionRequest"
    ADD CONSTRAINT "rentapp_SubmissionRequest_completeSubmissionResponseId_fkey" FOREIGN KEY ("completeSubmissionResponseId") REFERENCES db_namespace."rentapp_SubmissionResponse"(id);

ALTER TABLE ONLY db_namespace."rentapp_SubmissionRequest"
    ADD CONSTRAINT "rentapp_SubmissionRequest_parentSubmissionRequestId_fkey" FOREIGN KEY ("parentSubmissionRequestId") REFERENCES db_namespace."rentapp_SubmissionRequest"(id);

ALTER TABLE ONLY db_namespace."rentapp_SubmissionResponse"
    ADD CONSTRAINT "rentapp_SubmissionResponse_submissionRequestId_fkey" FOREIGN KEY ("submissionRequestId") REFERENCES db_namespace."rentapp_SubmissionRequest"(id);

ALTER TABLE ONLY db_namespace."rentapp_ApplicationInvoices"
    ADD CONSTRAINT "rentapp_ApplicationInvoices_partyApplicationId_fkey" FOREIGN KEY ("partyApplicationId") REFERENCES db_namespace."rentapp_PartyApplication"(id);

ALTER TABLE ONLY db_namespace."rentapp_ApplicationInvoices"
    ADD CONSTRAINT "rentapp_ApplicationInvoices_personApplicationId_fkey" FOREIGN KEY ("personApplicationId") REFERENCES db_namespace."rentapp_PersonApplication"(id);

ALTER TABLE ONLY db_namespace."rentapp_partyApplicationDocuments"
    ADD CONSTRAINT "rentapp_partyApplicationDocuments_partyApplicationId_fkey" FOREIGN KEY ("partyApplicationId") REFERENCES db_namespace."rentapp_PartyApplication"(id);

ALTER TABLE ONLY db_namespace."rentapp_personApplicationDocuments"
    ADD CONSTRAINT "rentapp_personApplicationDocuments_personApplicationId_fkey" FOREIGN KEY ("personApplicationId") REFERENCES db_namespace."rentapp_PersonApplication"(id);

ALTER TABLE ONLY db_namespace."rentapp_ApplicationTransactions"
    ADD CONSTRAINT "rentapp_ApplicationTransactions_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES db_namespace."rentapp_ApplicationInvoices"(id);

/********************************************************** TRIGGERS **********************************************************/

CREATE TRIGGER update_rentapp_partyapplication_updated_at_trg BEFORE UPDATE ON db_namespace."rentapp_PartyApplication" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();
CREATE TRIGGER update_rentapp_personapplication_updated_at_trg BEFORE UPDATE ON db_namespace."rentapp_PersonApplication" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();
CREATE TRIGGER update_rentapp_submissionrequest_updated_at_trg BEFORE UPDATE ON db_namespace."rentapp_SubmissionRequest" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();
CREATE TRIGGER update_rentapp_submissionresponse_updated_at_trg BEFORE UPDATE ON db_namespace."rentapp_SubmissionResponse" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();
CREATE TRIGGER update_rentapp_applicationinvoices_updated_at_trg BEFORE UPDATE ON db_namespace."rentapp_ApplicationInvoices" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();
CREATE TRIGGER update_rentapp_partyapplicationdocuments_updated_at_trg BEFORE UPDATE ON db_namespace."rentapp_partyApplicationDocuments" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();
CREATE TRIGGER update_rentapp_personapplicationdocuments_updated_at_trg BEFORE UPDATE ON db_namespace."rentapp_personApplicationDocuments" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();
CREATE TRIGGER update_rentapp_applicationtransactions_updated_at_trg BEFORE UPDATE ON db_namespace."rentapp_ApplicationTransactions" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

/********************************************************** INDEXES **********************************************************/

CREATE INDEX "rentapp_ApplicationInvoices_partyApplicationId_idx" ON db_namespace."rentapp_ApplicationInvoices" USING btree ("partyApplicationId");
CREATE INDEX "rentapp_SubmissionResponse_submissionRequestId_idx" ON db_namespace."rentapp_SubmissionResponse" USING btree ("submissionRequestId");
CREATE INDEX "rentapp_ApplicationTransactions_invoiceId_idx" ON db_namespace."rentapp_ApplicationTransactions" USING btree ("invoiceId");
CREATE INDEX "rentapp_SubmissionRequest_partyApplicationId_idx" ON db_namespace."rentapp_SubmissionRequest" USING btree ("partyApplicationId");
CREATE INDEX "rentapp_PersonApplication_personId_idx" ON db_namespace."rentapp_PersonApplication" USING btree ("personId");
CREATE INDEX "rentapp_PersonApplication_partyApplicationId_idx" ON db_namespace."rentapp_PersonApplication" USING btree ("partyApplicationId");
CREATE INDEX "rentapp_PersonApplication_partyId_idx" ON db_namespace."rentapp_PersonApplication" USING btree ("partyId");
CREATE UNIQUE INDEX "rentapp_PersonApplication_personId_partyId_idx" ON db_namespace."rentapp_PersonApplication" USING btree ("personId", "partyId") WHERE "endedAsMergedAt" IS NULL;
