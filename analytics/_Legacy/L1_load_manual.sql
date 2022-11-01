TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_TeamProperties";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_TeamProperties" (
	"teamId",
	"propertyId",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"teamId",
		"propertyId",
		"created_at",
		"updated_at"
	FROM "srcDB"."srcSchema"."TeamProperties"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."TeamProperties") || ''''
) AS (
	"teamId" uuid,
	"propertyId" uuid,
	"created_at" timestamptz,
	"updated_at" timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."TeamProperties" (
	"teamId",
	"propertyId",
	"created_at",
	"updated_at"
)
SELECT
	"teamId",
	"propertyId",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_TeamProperties"
ON CONFLICT ("teamId", "propertyId")
	DO UPDATE
	SET
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";


TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_Associated_Fee";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_Associated_Fee" (
	"primaryFee",
	"associatedFee",
	"isAdditional",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"primaryFee",
		"associatedFee",
		"isAdditional",
		"created_at",
		"updated_at"
	FROM "srcDB"."srcSchema"."Associated_Fee"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."Associated_Fee") || ''''
) AS (
	"primaryFee" uuid,
	"associatedFee" uuid,
	"isAdditional" bool,
	"created_at" timestamptz,
	"updated_at" timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."Associated_Fee" (
	"primaryFee",
	"associatedFee",
	"isAdditional",
	"created_at",
	"updated_at"
)
SELECT
	"primaryFee",
	"associatedFee",
	"isAdditional",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_Associated_Fee"
ON CONFLICT ("primaryFee", "associatedFee")
	DO UPDATE
	SET
		"isAdditional" = EXCLUDED."isAdditional",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_ProgramReferences";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_ProgramReferences" (
	"parentProgramId",
	"referenceProgramId",
	"referenceProgramPropertyId",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"parentProgramId",
		"referenceProgramId",
		"referenceProgramPropertyId",
		"created_at",
		"updated_at"
	FROM "srcDB"."srcSchema"."ProgramReferences"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."ProgramReferences") || ''''
) AS (
	"parentProgramId" uuid,
	"referenceProgramId" uuid,
	"referenceProgramPropertyId" uuid,
	"created_at" timestamptz,
	"updated_at" timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."ProgramReferences" (
	"parentProgramId",
	"referenceProgramId",
	"referenceProgramPropertyId",
	"created_at",
	"updated_at"
)
SELECT
	"parentProgramId",
	"referenceProgramId",
	"referenceProgramPropertyId",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_ProgramReferences"
ON CONFLICT ("parentProgramId", "referenceProgramPropertyId")
	DO UPDATE
	SET
		"referenceProgramId" = EXCLUDED."referenceProgramId",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";


TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_RmsPricing";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_RmsPricing" (
  "id",
  "inventoryId",
  "fileName",
  "rmsProvider",
  "minRent",
  "minRentStartDate",
  "minRentEndDate",
  "minRentLeaseLength",
  "standardLeaseLength",
  "standardRent",
  "availDate",
  "status",
  "amenityValue",
  "rentMatrix",
  "created_at",
  "updated_at",
  "amenities",
  "renewalDate",
  "propertyId",
  "type",
  "pricingType"
)
SELECT * FROM public.dblink('tenantName',
  'SELECT
     "id",
	 "inventoryId",
	 "fileName",
	 "rmsProvider",
	 "minRent",
	 "minRentStartDate",
	 "minRentEndDate",
	 "minRentLeaseLength",
	 "standardLeaseLength",
	 "standardRent",
	 "availDate",
  	 "status",
  	 "amenityValue",
	 "rentMatrix",
	 "created_at",
	 "updated_at",
	 "amenities",
	 "renewalDate",
	 "propertyId",
  	 "type",
  	 "pricingType"
  FROM "srcDB"."srcSchema"."RmsPricing"
  WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."RmsPricing") || ''''

) AS (
  "id" uuid,
  "inventoryId" uuid,
  "fileName" varchar(255),
  "rmsProvider" varchar(255),
  "minRent" numeric,
  "minRentStartDate" timestamptz,
  "minRentEndDate" timestamptz,
  "minRentLeaseLength" int4,
  "standardLeaseLength" int4,
  "standardRent" numeric,
  "availDate" timestamptz,
  "status" varchar(255),
  "amenityValue" numeric,
  "rentMatrix" jsonb,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "amenities" text,
  "renewalDate" timestamptz,
  "propertyId" uuid,
  "type" varchar(80),
  "pricingType" varchar(80)
);

INSERT INTO "dstNormDB"."dstNormSchema"."RmsPricing" (
  "id",
  "inventoryId",
  "fileName",
  "rmsProvider",
  "minRent",
  "minRentStartDate",
  "minRentEndDate",
  "minRentLeaseLength",
  "standardLeaseLength",
  "standardRent",
  "availDate",
  "status",
  "amenityValue",
  "rentMatrix",
  "created_at",
  "updated_at",
  "amenities",
  "renewalDate",
  "propertyId",
  "type",
  "pricingType"
)
SELECT
  "id",
  "inventoryId",
  "fileName",
  "rmsProvider",
  "minRent",
  "minRentStartDate",
  "minRentEndDate",
  "minRentLeaseLength",
  "standardLeaseLength",
  "standardRent",
  "availDate",
  "status",
  "amenityValue",
  "rentMatrix",
  "created_at",
  "updated_at",
  "amenities",
  "renewalDate",
  "propertyId",
  "type",
  "pricingType"
FROM 	"tmpNormDB"."tmpNormSchema"."t_RmsPricing"
ON CONFLICT ("inventoryId", "pricingType")
  DO UPDATE
  SET
    "id" = EXCLUDED."id",
    "fileName" = EXCLUDED."fileName",
    "rmsProvider" = EXCLUDED."rmsProvider",
    "minRent" = EXCLUDED."minRent",
    "minRentStartDate" = EXCLUDED."minRentStartDate",
    "minRentEndDate" = EXCLUDED."minRentEndDate",
    "minRentLeaseLength" = EXCLUDED."minRentLeaseLength",
    "standardLeaseLength" = EXCLUDED."standardLeaseLength",
    "standardRent" = EXCLUDED."standardRent",
    "availDate" = EXCLUDED."availDate",
    "status" = EXCLUDED."status",
    "amenityValue" = EXCLUDED."amenityValue",
    "rentMatrix" = EXCLUDED."rentMatrix",
    "created_at" = EXCLUDED."created_at",
    "updated_at" = EXCLUDED."updated_at",
    "amenities" = EXCLUDED."amenities",
    "renewalDate" =  EXCLUDED."renewalDate",
	"propertyId" = EXCLUDED."propertyId",
	"type" = EXCLUDED."type";

