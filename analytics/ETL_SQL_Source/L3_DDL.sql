CREATE TABLE "dstStarDB"."dstStarSchema"."s_LoadDependency"
(
  "tableName" text NOT NULL,
  "dependsOnTable" text NULL
);
CREATE TABLE "dstStarDB"."dstStarSchema"."s_LastLoadDate"
(
  "tableName" text NOT NULL PRIMARY KEY,
  "loadDate" timestamptz NOT NULL,
  "needToLoad" bool NOT NULL DEFAULT FALSE
);

CREATE TABLE "dstStarDB"."dstStarSchema"."d_Time"
(
  "timeKey" INTEGER NOT NULL PRIMARY KEY,
  "time" TIME NOT NULL,
  "hour" SMALLINT NOT NULL,
  "militaryHour" SMALLINT NOT NULL,
  "minute" SMALLINT NOT NULL,
  "meridian" VARCHAR(2) NOT NULL,
  "hourMinute" VARCHAR(5) NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "dstStarDB"."dstStarSchema"."d_Date"
(
  "dateKey" INTEGER NOT NULL PRIMARY KEY,
  "onlyDate" DATE NOT NULL,
  "fullDate" TIMESTAMPTZ NOT NULL,
  "year" SMALLINT NOT NULL,
  "quarter" SMALLINT NOT NULL,
  "quarterName" VARCHAR(16) NOT NULL,
  "month" SMALLINT NOT NULL,
  "monthName" VARCHAR(16) NOT NULL,
  "yearMonth" INTEGER NOT NULL,
  "week" SMALLINT NOT NULL,
  "weekName" VARCHAR(64) NOT NULL,
  "yearWeek" INTEGER NOT NULL,
  "dayOfYear" SMALLINT NOT NULL,
  "dayOfWeek" SMALLINT NOT NULL,
  "dayOfMonth" SMALLINT NOT NULL,
  "dayName" VARCHAR(16) NOT NULL,
  "firstDayOfMonth" DATE NOT NULL,
  "lastDayOfMonth" DATE NOT NULL,
  "firstDayOfWeek" DATE NOT NULL,
  "lastDayOfWeek" DATE NOT NULL,
  "isHoliday" VARCHAR(8) NOT NULL,
  "isWeekend" VARCHAR(8) NOT NULL,
  "holidayName" VARCHAR(64) NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "dstStarDB"."dstStarSchema"."d_ContactChannel"
(
  "contactChannelKey" SERIAL PRIMARY KEY,
  "channelName"	VARCHAR(64),
  "channelGroup" VARCHAR(64),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "dstStarDB"."dstStarSchema"."d_Property"
(
  "propertyKey" SERIAL PRIMARY KEY,
  "propertyId" UUID NOT NULL,
  "utcCreatedDate" TIMESTAMPTZ NOT NULL,
  "propertyName" VARCHAR(255) NOT NULL,
  "propertyLegalName" VARCHAR(255) NOT NULL,
  "propertyDisplayName" VARCHAR(255) NOT NULL,
  "propertyTimezone" TEXT NOT NULL,
  "propertyStartDate" TIMESTAMPTZ NOT NULL,
  "propertyEndDate" TIMESTAMPTZ NOT NULL,
  "APN" VARCHAR(40) NOT NULL,
  "MSANumber" SMALLINT NOT NULL,
  "addressLine1" VARCHAR(255) NOT NULL,
  "addressLine2" VARCHAR(255) NOT NULL,
  "city" VARCHAR(128) NOT NULL,
  "state" VARCHAR(2) NOT NULL,
  "postalCode" VARCHAR(10) NOT NULL,
  "isSameStore" VARCHAR(8) NOT NULL, -- changed manually
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "d_Property_propertyId_key" UNIQUE ("propertyId")
);

CREATE TABLE "dstStarDB"."dstStarSchema"."d_Party"
(
  "partyKey" SERIAL PRIMARY KEY,
  "partyId" UUID NOT NULL CONSTRAINT "d_Party_partyId_key" UNIQUE,
  "utcCreatedDate" TIMESTAMPTZ NOT NULL,
  "partyURL" TEXT NOT NULL,
  "utcFirstContactDate" TIMESTAMPTZ NOT NULL,
  "utcClosedDate" TIMESTAMPTZ NOT NULL,
  "utcSaleDate" TIMESTAMPTZ NOT NULL,
  "currentAssignedProperty" VARCHAR(255) NOT NULL,
  "closeReason" VARCHAR(128) NOT NULL,
  "currentState" VARCHAR(16) NOT NULL,
  "primaryAgentName" VARCHAR(255) NOT NULL,
  "sourceName" VARCHAR(255) NOT NULL,
  "sourceDisplayName" VARCHAR(255) NOT NULL,
  "programName" VARCHAR(255) NOT NULL,
  "programDisplayName" varchar(255) NOT NULL,
  "initialChannel" VARCHAR(16) NOT NULL,
  "leadScore" VARCHAR(16) NOT NULL,
  "daysToCloseSale" SMALLINT NOT NULL,
  "QQMoveIn" VARCHAR(255) NOT NULL,
  "QQBudget" VARCHAR(255) NOT NULL,
  "QQNumBedrooms" VARCHAR(255) NOT NULL,
  "QQGroupProfile" VARCHAR(255) NOT NULL,
  "creationType" VARCHAR(64) NOT NULL,
  "programProperty" VARCHAR(255) NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "reportingStatus" VARCHAR(16) NOT NULL,
  "hasGuarantor" VARCHAR(8) NOT NULL,
  "originalTeam" VARCHAR(255) NOT NULL,
  "originalParticipant" TEXT NOT NULL,
  "workflowName" VARCHAR(80) NOT NULL,
  "workflowState" VARCHAR(80) NOT NULL,
  "partyGroupId" UUID NOT NULL,
  "isTransferLease" VARCHAR(8) NOT NULL,
  "utcArchiveDate" TIMESTAMPTZ NOT NULL
);

CREATE TABLE "dstStarDB"."dstStarSchema"."d_Person"
(
  "personKey" SERIAL PRIMARY KEY,
  "personId" UUID NOT NULL,
  "SCD_startDate" TIMESTAMPTZ NOT NULL,
  "SCD_endDate" TIMESTAMPTZ NOT NULL,
  "SCD_changeReason" VARCHAR(255) NOT NULL,
  "SCD_isCurrent" VARCHAR(8) NOT NULL,
  "utcCreatedDate" TIMESTAMPTZ NOT NULL,
  "fullName" VARCHAR(255) NOT NULL,
  "preferredName" VARCHAR(255) NOT NULL,
  "mergedWith" VARCHAR(255) NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "dstStarDB"."dstStarSchema"."d_ContactInfo"
(
  "contactInfoKey" SERIAL PRIMARY KEY,
  "contactInfoId" UUID NOT NULL CONSTRAINT "d_ContactInfo_contactInfoId_key" UNIQUE,
  "personKey" INTEGER NOT NULL,--last image of the person
  "utcCreatedDate" TIMESTAMPTZ NOT NULL,
  "contactType" TEXT NOT NULL,
  "value" VARCHAR(128) NOT NULL,
  "isImported" VARCHAR(8) NOT NULL,
  "isPrimary" VARCHAR(8) NOT NULL,
  "isSMSCapable" VARCHAR(8) NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY ("personKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Person"("personKey")
);

CREATE TABLE "dstStarDB"."dstStarSchema"."d_PartyMember"--sort of a fact
(
	"partyMemberKey" SERIAL PRIMARY KEY,
	"partyMemberId" UUID NOT NULL CONSTRAINT "d_PartyMember_partyMemberId_key" UNIQUE,
	"partyKey" INTEGER NOT NULL,--last image
	"personKey" INTEGER NOT NULL,--last image
	"utcStartDate" TIMESTAMPTZ NOT NULL,
  "utcEndDate" TIMESTAMPTZ NOT NULL,
  "memberState" VARCHAR(255) NOT NULL,
 	"memberType" VARCHAR(255) NOT NULL,
  "externalPrimaryId" VARCHAR(255) NOT NULL,
  "externalSecondaryId" VARCHAR(255) NOT NULL,
  "guarantorFullName" VARCHAR(255) NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "isPrimary" VARCHAR(8) NOT NULL,
  FOREIGN KEY ("partyKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Party"("partyKey"),
  FOREIGN KEY ("personKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Person"("personKey")
);

CREATE TABLE "dstStarDB"."dstStarSchema"."d_Program"
(
	"programKey" SERIAL PRIMARY KEY,
	"programId" UUID NOT NULL CONSTRAINT "d_Program_programId_key" UNIQUE,
	"programName" VARCHAR(255) NOT NULL,
	"programDisplayName" VARCHAR(255) NOT NULL,
	"programDescription" TEXT NOT NULL,
	"directEmailIdentifier" VARCHAR(255) NOT NULL,
	"outsideDedicatedEmails" VARCHAR(255) NOT NULL,
	"displayEmail" VARCHAR(255) NOT NULL,
	"directPhoneIdentifier" VARCHAR(255) NOT NULL,
	"displayPhoneNumber" VARCHAR(255) NOT NULL,
	"utcCreatedDate" TIMESTAMPTZ NOT NULL,
  "sourceId" UUID NOT NULL,
  "sourceName" VARCHAR(255) NOT NULL,
	"sourceDisplayName" VARCHAR(255) NOT NULL,
	"sourceDescription" TEXT NOT NULL,
  "utcSourceCreatedDate" TIMESTAMPTZ NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "dstStarDB"."dstStarSchema"."d_User"
(
	"userKey" SERIAL PRIMARY KEY,
	"userId" UUID NOT NULL,
	"SCD_startDate" TIMESTAMPTZ NOT NULL,
	"SCD_endDate" TIMESTAMPTZ NOT NULL,
	"SCD_changeReason" VARCHAR(255) NOT NULL,
  "SCD_isCurrent" VARCHAR(8) NOT NULL,
	"utcCreatedDate" TIMESTAMPTZ NOT NULL,
	"fullName" VARCHAR(255) NOT NULL,
	"preferredName" VARCHAR(255) NOT NULL,
	"externalUniqueId" VARCHAR(255) NOT NULL,
	"businessTitle" VARCHAR(255) NOT NULL,
	"email" VARCHAR(255) NOT NULL,
	"displayPhoneNumber" VARCHAR(255) NOT NULL,
	"displayEmail" VARCHAR(255) NOT NULL,
	"isActive" VARCHAR(8) NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "dstStarDB"."dstStarSchema"."d_Team"
(
	"teamKey" SERIAL PRIMARY KEY,
	"teamId" UUID NOT NULL CONSTRAINT "d_Team_teamId_key" UNIQUE,
  "utcCreatedDate" TIMESTAMPTZ NOT NULL,
	"teamName" VARCHAR(255) NOT NULL,
	"teamDisplayName" VARCHAR(255) NOT NULL,
	"teamModule" TEXT NOT NULL,
	"teamDescription" VARCHAR(500) NOT NULL,
	"teamTimezone" TEXT NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "dstStarDB"."dstStarSchema"."d_TeamMember"
(
	"teamMemberKey" SERIAL PRIMARY KEY,
	"teamMemberId" UUID NOT NULL,
	"SCD_startDate" TIMESTAMPTZ NOT NULL,
	"SCD_endDate" TIMESTAMPTZ NOT NULL,
	"SCD_changeReason" VARCHAR(255) NOT NULL,
  "SCD_isCurrent" VARCHAR(8) NOT NULL,
	"utcCreatedDate" TIMESTAMPTZ NOT NULL,
	"userKey" INT NOT NULL,
	"teamKey" INT NOT NULL,
	"mainRoles" VARCHAR(500) NOT NULL,
	"functionalRoles" VARCHAR(500) NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY ("userKey") REFERENCES "dstStarDB"."dstStarSchema"."d_User"("userKey"),
  FOREIGN KEY ("teamKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Team"("teamKey")
);

CREATE TABLE "dstStarDB"."dstStarSchema"."d_Task"
(
	"taskKey" SERIAL PRIMARY KEY,
	"taskId" UUID NOT NULL CONSTRAINT "d_Task_taskId_key" UNIQUE,
	"utcCreatedDate" TIMESTAMPTZ NOT NULL,
	"utcDueDate" TIMESTAMPTZ NOT NULL,
	"utcCompletedDate" TIMESTAMPTZ NOT NULL,
	"utcCanceledDate" TIMESTAMPTZ NOT NULL,
	"taskName" VARCHAR(255) NOT NULL,
	"taskCategory" VARCHAR(255) NOT NULL,
	"currentState" TEXT NOT NULL,
	"taskOwners" VARCHAR(255) NOT NULL,
	"partyKey" INTEGER NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "utcStartDate" TIMESTAMPTZ NOT NULL,
  "utcEndDate" TIMESTAMPTZ NOT NULL,
  "appointmentResult" VARCHAR(80) NOT NULL,
  "originalPartyOwner" VARCHAR(255) NOT NULL,
  "taskCreatedBy" VARCHAR(255) NOT NULL,
  "taskCompletedBy" VARCHAR(255) NOT NULL,
  "originalAssignees" VARCHAR(255) NOT NULL,
  "notes" TEXT NOT NULL,
  "appointmentCreatedFrom" VARCHAR(255) NOT NULL,
  FOREIGN KEY ("partyKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Party"("partyKey")
);

CREATE TABLE "dstStarDB"."dstStarSchema"."d_Inventory" (
	"inventoryKey" SERIAL PRIMARY KEY,
	"inventoryId" UUID NOT NULL CONSTRAINT "d_Inventory_inventoryId_key" UNIQUE,
	"inventoryName" VARCHAR(255) NOT NULL,
	"inventoryType" VARCHAR(80) NOT NULL,
	"inventoryDescription" TEXT NOT NULL,
	"floor" INTEGER NOT NULL,
	"currentState" VARCHAR(255) NOT NULL,
	"externalId" VARCHAR(255) NOT NULL,
	"isOnHold" VARCHAR(8) NOT NULL,
	"holdReason" TEXT NOT NULL,
  "holdParty" VARCHAR(255) NOT NULL,
	"propertyHoldStartDate" TIMESTAMPTZ NOT NULL,
	"holdAgentFullName" VARCHAR(255) NOT NULL,
  "inventoryAddress" VARCHAR(255) NOT NULL,
  "inventoryGroupName" VARCHAR(255) NOT NULL,
	"inventoryGroupDisplayName" VARCHAR(255) NOT NULL,
	"isRentControl" VARCHAR(8) NOT NULL,
	"isAffordable" VARCHAR(8) NOT NULL,
	"layoutName" VARCHAR(255) NOT NULL,
	"layoutDisplayName" VARCHAR(255) NOT NULL,
  "layoutDescription" TEXT NOT NULL,
  "numBedrooms" NUMERIC(8,2) NOT NULL,
	"numBathrooms" NUMERIC(8,2) NOT NULL,
	"SQFT" NUMERIC(8,2) NOT NULL,
	"layoutFloorCount" INTEGER NOT NULL,
	"buildingName" VARCHAR(255) NOT NULL,
	"buildingDisplayName" VARCHAR(255) NOT NULL,
	"buildingType" VARCHAR(80) NOT NULL,
	"buildingDescription" TEXT NOT NULL,
	"buildingFloorCount" INTEGER NOT NULL,
	"buildingAddressLine1" VARCHAR(255) NOT NULL,
  "buildingAddressLine2" VARCHAR(255) NOT NULL,
  "city" VARCHAR(128) NOT NULL,
  "state" VARCHAR(2) NOT NULL,
  "postalCode" VARCHAR(10) NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "propertyKey" INTEGER NOT NULL,
  "stateStartDate" TIMESTAMPTZ NOT NULL,
  "availabilityDate" TIMESTAMPTZ NOT NULL,
  "inventoryAmenities" TEXT NOT NULL,
  "inventoryGroupAmenities" TEXT NOT NULL,
  "layoutAmenities" TEXT NOT NULL,
  "buildingAmenities" TEXT NOT NULL,
  "propertyAmenities" TEXT NOT NULL,
  FOREIGN KEY ("propertyKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Property"("propertyKey")
);


CREATE TABLE "dstStarDB"."dstStarSchema"."f_PaymentsAndRefunds"
(
  "paymentsAndRefundsKey" SERIAL PRIMARY KEY,
  "partyKey" INTEGER NOT NULL,
  "applicantPartyMemberKey" INTEGER NOT NULL,
  "primaryPartyMemberKey" INTEGER NOT NULL,
  "applicationPropertyKey" INTEGER NOT NULL,
  "utcDateKey" INTEGER NOT NULL,
  "utcTimeKey" INTEGER NOT NULL,
  "propertyDateKey" INTEGER NOT NULL,
  "propertyTimeKey" INTEGER NOT NULL,
  "paidBy"  VARCHAR(255) NOT NULL,
  "AptexxRef" VARCHAR(255) NOT NULL,
  "transactionType" VARCHAR(80) NOT NULL,
  "amount" NUMERIC(7,2) NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY ("partyKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Party"("partyKey"),
  FOREIGN KEY ("applicantPartyMemberKey") REFERENCES "dstStarDB"."dstStarSchema"."d_PartyMember"("partyMemberKey"),
  FOREIGN KEY ("utcDateKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Date"("dateKey"),
  FOREIGN KEY ("propertyDateKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Date"("dateKey"),
  FOREIGN KEY ("utcTimeKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Time"("timeKey"),
  FOREIGN KEY ("propertyTimeKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Time"("timeKey"),
  FOREIGN KEY ("primaryPartyMemberKey") REFERENCES "dstStarDB"."dstStarSchema"."d_PartyMember"("partyMemberKey"),
  FOREIGN KEY ("applicationPropertyKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Property"("propertyKey")
);

CREATE TABLE "dstStarDB"."dstStarSchema"."f_PartyConversion"
(
	"partyConversionKey" SERIAL PRIMARY KEY,
	"propertyKey" INTEGER NOT NULL,
	"partyKey" INTEGER NOT NULL,
	"programKey" INTEGER NOT NULL,
	"utcDateKey" INTEGER NOT NULL,
	"propertyDateKey" INTEGER NOT NULL,
	"utcTimeKey" INTEGER NOT NULL,
	"propertyTimeKey" INTEGER NOT NULL,
	"contactChannelKey" INTEGER NOT NULL,
  "agentKey" INTEGER NOT NULL,--userKey
  "newContacts" SMALLINT NOT NULL,
  "completedFirstTours" INTEGER NOT NULL,
	"completedTours" INTEGER NOT NULL,
	"completedApplications" INTEGER NOT NULL,
	"sales" INTEGER NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY ("propertyKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Property"("propertyKey"),
  FOREIGN KEY ("partyKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Party"("partyKey"),
  FOREIGN KEY ("programKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Program"("programKey"),
  FOREIGN KEY ("utcDateKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Date"("dateKey"),
  FOREIGN KEY ("propertyDateKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Date"("dateKey"),
  FOREIGN KEY ("utcTimeKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Time"("timeKey"),
  FOREIGN KEY ("propertyTimeKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Time"("timeKey"),
  FOREIGN KEY ("contactChannelKey") REFERENCES "dstStarDB"."dstStarSchema"."d_ContactChannel"("contactChannelKey"),
  FOREIGN KEY ("agentKey") REFERENCES "dstStarDB"."dstStarSchema"."d_User"("userKey")
);

ALTER TABLE "dstStarDB"."dstStarSchema"."f_PartyConversion"
      ADD CONSTRAINT "f_PartyConversion_partyKey_key" UNIQUE ("partyKey");

CREATE TABLE "dstStarDB"."dstStarSchema"."d_Communication"
(
  "communicationKey" SERIAL PRIMARY KEY,
  "communicationId" UUID NOT NULL CONSTRAINT "d_Communication_communicationId_key" UNIQUE,
  "utcCreatedDate" TIMESTAMPTZ NOT NULL,
  "threadId" TEXT NOT NULL,
  "orderInThread" INTEGER NOT NULL,
  "commType" VARCHAR(255) NOT NULL,
  "direction" VARCHAR(255) NOT NULL,
  "from" TEXT NOT NULL,
  "to" TEXT NOT NULL,
  "category" VARCHAR(255) NOT NULL,
  "commSource" TEXT NOT NULL,
  "commProgram" TEXT NOT NULL,
  "unread" varchar(8) NOT NULL,
  "readDate" TEXT NULL,
  "commCampaignSource" VARCHAR(255) NOT NULL,
  "commCampaign" VARCHAR(255) NOT NULL,
  "messageText" TEXT NOT NULL,
  "messageType" VARCHAR(255) NOT NULL,
  "commMarketingSessionId" VARCHAR(255) NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "dstStarDB"."dstStarSchema"."b_Communication_Team"
(
  "communicationTeamKey" SERIAL PRIMARY KEY,
  "communicationKey" INTEGER NOT NULL,
  "teamKey" INTEGER NOT NULL,
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY ("communicationKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Communication"("communicationKey"),
  FOREIGN KEY ("teamKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Team"("teamKey")
);

ALTER TABLE "dstStarDB"."dstStarSchema"."b_Communication_Team"
ADD CONSTRAINT "b_Communication_Team_commKey_teamKey_key" UNIQUE ("communicationKey", "teamKey");

CREATE TABLE "dstStarDB"."dstStarSchema"."b_Communication_Person"
(
  "communicationPersonKey" SERIAL PRIMARY KEY,
  "communicationKey" INTEGER NOT NULL,
  "personKey" INTEGER NOT NULL,
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY ("communicationKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Communication"("communicationKey"),
  FOREIGN KEY ("personKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Person"("personKey")
);

ALTER TABLE "dstStarDB"."dstStarSchema"."b_Communication_Person"
ADD CONSTRAINT "b_Communication_Person_commKey_personKey_key" UNIQUE ("communicationKey", "personKey");

CREATE TABLE "dstStarDB"."dstStarSchema"."f_PartyCommunication"
(
  "partyCommunicationKey" SERIAL PRIMARY KEY,
  "communicationKey" INTEGER NOT NULL,
  "partyKey" INTEGER NOT NULL,
  "programKey" INTEGER NOT NULL,
  "programPropertyKey" INTEGER NOT NULL,
  "propDateKey" INTEGER NOT NULL,
  "propTimeKey" INTEGER NOT NULL,
  "agentKey" INTEGER NOT NULL,
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "partyPropertyKey" INTEGER NOT NULL,
  "commCount" SMALLINT NOT NULL DEFAULT 1,
  FOREIGN KEY ("communicationKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Communication"("communicationKey"),
  FOREIGN KEY ("programKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Program"("programKey"),
  FOREIGN KEY ("programPropertyKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Property"("propertyKey"),
  FOREIGN KEY ("propDateKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Date"("dateKey"),
  FOREIGN KEY ("propTimeKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Time"("timeKey"),
  FOREIGN KEY ("agentKey") REFERENCES "dstStarDB"."dstStarSchema"."d_User"("userKey"),
  FOREIGN KEY ("partyPropertyKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Property"("propertyKey"),
  CONSTRAINT "f_PartyCommunication_communicationKey_partyKey_key" UNIQUE ("communicationKey", "partyKey")
);

CREATE TABLE "dstStarDB"."dstStarSchema"."d_Call"
(
  "callKey" SERIAL PRIMARY KEY,
  "callId" UUID NOT NULL CONSTRAINT "d_Call_callId_key" UNIQUE,
  "userFullName" VARCHAR(255) NOT NULL,
  "direction" VARCHAR(255) NOT NULL,
  "fromNumber" TEXT NOT NULL,
  "toNumber" TEXT NOT NULL,
  "utcPickUpDate" timestamptz NOT NULL,
  "utcHangUpDate" timestamptz NOT NULL,
  "callDuration" TEXT NOT NULL,
  "callSeconds" INTEGER NOT NULL,
  "dialStatus" VARCHAR(64) NOT NULL,
  "isMissed" VARCHAR(8) NOT NULL,
  "isVoiceMail" VARCHAR(8) NOT NULL,
  "voiceMailDuration" TEXT NOT NULL,
  "voiceMailSeconds" INTEGER NOT NULL,
  "talkDuration" TEXT NOT NULL,
  "talkSeconds" INTEGER NOT NULL,
  "utcQueueEntryTime" timestamptz NOT NULL,
  "utcQueueExitTime" timestamptz NOT NULL,
  "queueAgentFullName" TEXT NOT NULL,
  "queueCallerRequestedAction" VARCHAR(255) NOT NULL,
  "queueCalledBack" VARCHAR(8) NOT NULL,
  "queueCallBackTime" timestamptz NOT NULL,
  "queueMinutesToCallBack" int NOT NULL,
  "queueCallbackCommunicationId" uuid NOT NULL,
  "queueHangUp" VARCHAR(8) NOT NULL,
  "queueTransferredToVoiceMail" VARCHAR(8) NOT NULL,
  "transferredFrom" uuid NOT NULL,
  "transferredTo" uuid NOT NULL,
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "communicationKey" INTEGER NOT NULL,
  "answeringTeam" VARCHAR(255) NOT NULL,
  "isRecorded" VARCHAR(8) NOT NULL,
  "messageIsDeclined" VARCHAR(255) NOT NULL,
  "messageNotes" TEXT NOT NULL
);

CREATE TABLE "dstStarDB"."dstStarSchema"."d_InventoryPrice"
(
  "inventoryPriceKey" SERIAL PRIMARY KEY,
  "inventoryKey" INTEGER NOT NULL,
  "SCD_startDate" TIMESTAMPTZ NOT NULL,
  "SCD_endDate" TIMESTAMPTZ NOT NULL,
  "SCD_changeReason" VARCHAR(255) NOT NULL,
  "SCD_isCurrent" VARCHAR(8) NOT NULL,
  "basePrice" NUMERIC(7,2) NOT NULL,
  "amenitiesTotalPrice" NUMERIC(7,2) NOT NULL,
  "totalPrice" NUMERIC(7,2) NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY ("inventoryKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Inventory"("inventoryKey")
);

CREATE TABLE "dstStarDB"."dstStarSchema"."d_InventoryRmsPrice"
(
  "inventoryRmsPriceKey" SERIAL PRIMARY KEY,
  "inventoryKey" INTEGER NOT NULL,
  "pricingType" VARCHAR(255) NOT NULL,
  "unitType" VARCHAR(255) NOT NULL,
  "LROUnitStatus" VARCHAR(255) NOT NULL,
  "availDate" DATE NOT NULL,
  "fileName" VARCHAR(255) NOT NULL,
  "rmsProvider" VARCHAR(255) NOT NULL,
  "LROAmenities" TEXT NOT NULL,
  "LROAmenityValue" NUMERIC(8,2) NOT NULL,
  "isRenewal" VARCHAR(8) NOT NULL,
  "renewalDate" DATE NOT NULL,
  "minRent" NUMERIC(8,2) NOT NULL,
  "minRentStartDate" TIMESTAMPTZ NOT NULL,
  "minRentEndDate" TIMESTAMPTZ NOT NULL,
  "minRentLeaseLength" SMALLINT NOT NULL,
  "standardLeaseLength" SMALLINT NOT NULL,
  "standardRent" NUMERIC(8,2) NOT NULL,
  "fileImportedDate" TIMESTAMPTZ NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY ("inventoryKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Inventory"("inventoryKey"),
  CONSTRAINT "d_InventoryRmsPrice_inventoryKey_pricingType_key" UNIQUE ("inventoryKey", "pricingType")
);

CREATE TABLE "dstStarDB"."dstStarSchema"."d_InventoryTerm"
(
  "inventoryTermKey" SERIAL PRIMARY KEY,
  "inventoryKey" INTEGER NOT NULL,
  "leaseTerm" SMALLINT NOT NULL,
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "rent" NUMERIC(8,2) NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY ("inventoryKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Inventory"("inventoryKey"),
  CONSTRAINT "d_InventoryTerm_multiple_key" UNIQUE ("inventoryKey", "leaseTerm", "startDate", "endDate")
);

CREATE TABLE "dstStarDB"."dstStarSchema"."h_RmsPricingHistory"
(
  "rmsPricingHistoryKey" SERIAL PRIMARY KEY,
  "inventoryId" uuid NOT NULL,
  "fileName" varchar(255) NOT NULL,
  "rmsProvider" varchar(255) NOT NULL,
  "minRent" numeric(8,2) NOT NULL,
  "minRentStartDate" timestamptz NOT NULL,
  "minRentEndDate" timestamptz NOT NULL,
  "minRentLeaseLength" int4 NOT NULL,
  "standardLeaseLength" int4 NULL,
  "standardRent" numeric(8,2) NULL,
  "availDate" timestamptz NULL,
  status varchar(255) NULL,
  "amenityValue" numeric(8,2) NULL,
  "rentMatrix" jsonb NULL,
  "renewalDate" timestamptz NULL,
  amenities text NULL,
  "propertyId" uuid NOT NULL,
  "type" varchar(80) NOT NULL,
  "pricingType" varchar(80) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "dstStarDB"."dstStarSchema"."b_Task_Inventory"
(
  "taskInventoryKey" SERIAL PRIMARY KEY,
  "taskKey" INTEGER NOT NULL,
  "inventoryKey" INTEGER NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY ("taskKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Task"("taskKey"),
  FOREIGN KEY ("inventoryKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Inventory"("inventoryKey")
);

ALTER TABLE "dstStarDB"."dstStarSchema"."b_Task_Inventory"
ADD CONSTRAINT "b_Task_Inventory_taskKey_inventoryKey_key" UNIQUE ("taskKey", "inventoryKey");

CREATE TABLE "dstStarDB"."dstStarSchema"."b_Task_PartyMember"
(
  "taskPartyMemberKey" SERIAL PRIMARY KEY,
  "taskKey" INTEGER NOT NULL,
  "partyMemberKey" INTEGER NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY ("taskKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Task"("taskKey"),
  FOREIGN KEY ("partyMemberKey") REFERENCES "dstStarDB"."dstStarSchema"."d_PartyMember"("partyMemberKey")
);

ALTER TABLE "dstStarDB"."dstStarSchema"."b_Task_PartyMember"
ADD CONSTRAINT "b_Task_PartyMember_taskKey_partyMemberKey_key" UNIQUE ("taskKey", "partyMemberKey");

CREATE TABLE "dstStarDB"."dstStarSchema"."b_Task_User" --OriginalAssignee
(
  "taskUserKey" SERIAL PRIMARY KEY,
  "taskKey" INTEGER NOT NULL,
  "userKey" INTEGER NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY ("taskKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Task"("taskKey"),
  FOREIGN KEY ("userKey") REFERENCES "dstStarDB"."dstStarSchema"."d_User"("userKey")
);

ALTER TABLE "dstStarDB"."dstStarSchema"."b_Task_User"
ADD CONSTRAINT "b_Task_User_taskKey_userKey_key" UNIQUE ("taskKey", "userKey");

CREATE TABLE "dstStarDB"."dstStarSchema"."f_CompletedTour"
(
  "completedTourKey" SERIAL PRIMARY KEY,
  "taskKey" INTEGER NOT NULL,
  "partyKey" INTEGER NOT NULL,
  "propertyKey" INTEGER NOT NULL,
  "programKey" INTEGER NOT NULL,
  "contactChannelKey" INTEGER NOT NULL,
  "utcCreatedDateKey" INTEGER NOT NULL,
  "utcCreatedTimeKey" INTEGER NOT NULL,
  "propertyCreatedDateKey" INTEGER NOT NULL,
  "propertyCreatedTimeKey" INTEGER NOT NULL,
  "utcTourDateKey" INTEGER NOT NULL,
  "utcTourTimeKey" INTEGER NOT NULL,
  "propertyTourDateKey" INTEGER NOT NULL,
  "propertyTourTimeKey" INTEGER NOT NULL,
  "isFirstCompletedTour" VARCHAR(8) NOT NULL,
  "isFirstScheduledTour" VARCHAR(8) NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "inventoryKey" INTEGER NOT NULL,
  FOREIGN KEY ("taskKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Task"("taskKey"),
  FOREIGN KEY ("partyKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Party"("partyKey"),
  FOREIGN KEY ("propertyKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Property"("propertyKey"),
  FOREIGN KEY ("programKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Program"("programKey"),
  FOREIGN KEY ("contactChannelKey") REFERENCES "dstStarDB"."dstStarSchema"."d_ContactChannel"("contactChannelKey"),
  FOREIGN KEY ("utcCreatedDateKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Date"("dateKey"),
  FOREIGN KEY ("propertyCreatedDateKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Date"("dateKey"),
  FOREIGN KEY ("utcCreatedTimeKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Time"("timeKey"),
  FOREIGN KEY ("propertyCreatedTimeKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Time"("timeKey"),
  FOREIGN KEY ("utcTourDateKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Date"("dateKey"),
  FOREIGN KEY ("propertyTourDateKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Date"("dateKey"),
  FOREIGN KEY ("utcTourTimeKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Time"("timeKey"),
  FOREIGN KEY ("propertyTourTimeKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Time"("timeKey"),
  FOREIGN KEY ("inventoryKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Inventory"("inventoryKey")
);

 ALTER TABLE "dstStarDB"."dstStarSchema"."f_CompletedTour"
      ADD CONSTRAINT "f_CompletedTour_taskKey_key" UNIQUE ("taskKey");


CREATE TABLE "dstStarDB"."dstStarSchema"."b_AgentCallSummary_Party"
(
  "partyGroupKey" INTEGER NOT NULL,
  "partyKey" INTEGER NOT NULL,
  "parties" VARCHAR(36)[] NOT NULL,
  "weightFactor" NUMERIC(8,2) NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY ("partyKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Party"("partyKey")
);

ALTER TABLE "dstStarDB"."dstStarSchema"."b_AgentCallSummary_Party"
ADD CONSTRAINT "b_AgentCallSummary_Party_partyGroupKey_partyKey_key" UNIQUE ("partyGroupKey", "partyKey");

CREATE TABLE "dstStarDB"."dstStarSchema"."f_AgentCallSummary"
(
  "agentCallSummaryKey" SERIAL PRIMARY KEY,
  "agentKey" INTEGER NOT NULL,
  "teamKey" INTEGER NOT NULL,
  "agentDateKey" INTEGER NOT NULL,
  "partyGroupKey" INTEGER NOT NULL,
  "totalCalls" INTEGER NOT NULL,
  "totalCallDuration" INTEGER NOT NULL,
  "avgCallDuration" NUMERIC(8,2) NOT NULL,
  "totalIncomingCalls" INTEGER NOT NULL,
  "totalIncomingCallDuration" INTEGER NOT NULL,
  "avgIncomingCallDuration" NUMERIC(8,2) NOT NULL,
  "totalOutgoingCalls" INTEGER NOT NULL,
  "totalOutgoingCallDuration" INTEGER NOT NULL,
  "avgOutgoingCallDuration" NUMERIC(8,2) NOT NULL,
  "totalHangUps" INTEGER NOT NULL,
  "totalVoicemails" INTEGER NOT NULL,
  "totalRequestedCallbacks" INTEGER NOT NULL,
  "totalCallbacks" INTEGER NOT NULL,
  "totalMinutesToCallback" INTEGER NOT NULL,
  "avgMinutesToCallback" NUMERIC(8,2) NOT NULL,
  "avgQueueDuration" NUMERIC(8,2) NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY ("agentKey") REFERENCES "dstStarDB"."dstStarSchema"."d_User"("userKey"),
  FOREIGN KEY ("teamKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Team"("teamKey"),
  FOREIGN KEY ("agentDateKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Date"("dateKey")
);

ALTER TABLE "dstStarDB"."dstStarSchema"."f_AgentCallSummary"
      ADD CONSTRAINT "f_AgentCallSummary_multiple_unique" UNIQUE ("agentKey", "teamKey", "agentDateKey", "partyGroupKey");

CREATE TABLE "dstStarDB"."dstStarSchema"."f_PropertyCallSummary"
(
  "propertyCallSummaryKey" SERIAL PRIMARY KEY,
  "propertyKey" INTEGER NOT NULL,
  "propertyDateKey" INTEGER NOT NULL,
  "totalCalls" INTEGER NOT NULL,
  "totalCallDuration" INTEGER NOT NULL,
  "avgCallDuration" NUMERIC(8,2) NOT NULL,
  "totalIncomingCalls" INTEGER NOT NULL,
  "totalIncomingCallDuration" INTEGER NOT NULL,
  "avgIncomingCallDuration" NUMERIC(8,2) NOT NULL,
  "totalOutgoingCalls" INTEGER NOT NULL,
  "totalOutgoingCallDuration" INTEGER NOT NULL,
  "avgOutgoingCallDuration" NUMERIC(8,2) NOT NULL,
  "totalHangUps" INTEGER NOT NULL,
  "totalVoicemails" INTEGER NOT NULL,
  "totalRequestedCallbacks" INTEGER NOT NULL,
  "totalCallbacks" INTEGER NOT NULL,
  "totalMinutesToCallback" INTEGER NOT NULL,
  "avgMinutesToCallback" NUMERIC(8,2) NOT NULL,
  "avgQueueDuration" NUMERIC(8,2) NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY ("propertyKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Property"("propertyKey"),
  FOREIGN KEY ("propertyDateKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Date"("dateKey")
);

ALTER TABLE "dstStarDB"."dstStarSchema"."f_PropertyCallSummary"
  ADD CONSTRAINT "f_PropertyCallSummary_propertyKey_propertyDateKey_unique" UNIQUE ("propertyKey", "propertyDateKey");

CREATE TABLE "dstStarDB"."dstStarSchema"."d_Lease"
(
  "leaseKey" SERIAL PRIMARY KEY,
  "leaseId" UUID NOT NULL CONSTRAINT "d_Lease_leaseId_uniq" UNIQUE,
  "utcCreatedDate" TIMESTAMPTZ NOT NULL,
  "status" TEXT NOT NULL,
  "leaseTerm" TEXT NOT NULL,
  "utcLeaseStartDate" TIMESTAMPTZ NOT NULL,
  "utcLeaseEndDate" TIMESTAMPTZ NOT NULL,
  "leaseBaseRent" NUMERIC(8,2) NOT NULL,
  "leaseAdditionalRent" NUMERIC(8,2) NOT NULL,
  "moveInDate" DATE NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "approverNotes" TEXT NOT NULL,
  "applicationDecision" VARCHAR(255) NOT NULL,
  "recommendations" TEXT NOT NULL,
  "additionalCharges" TEXT NOT NULL,
  "activeLeaseState" TEXT NOT NULL,
  "activeLeaseRolloverPeriod" TEXT NOT NULL,
  "activeLeaseIsExtension" VARCHAR(8) NOT NULL
);

CREATE TABLE "dstStarDB"."dstStarSchema"."f_Sale"
(
  "saleKey" SERIAL PRIMARY KEY,
  "leaseKey" INTEGER NOT NULL CONSTRAINT "f_Sale_leaseKey_uniq" UNIQUE,
  "propertyKey" INTEGER NOT NULL,
  "partyKey" INTEGER NOT NULL,
  "inventoryKey" INTEGER NOT NULL,
  "programKey" INTEGER NOT NULL,
  "contactChannelKey" INTEGER NOT NULL,
  "utcDateKey" INTEGER NOT NULL,
  "utcTimeKey" INTEGER NOT NULL,
  "propertyDateKey" INTEGER NOT NULL,
  "propertyTimeKey" INTEGER NOT NULL,
  "agentKey" INTEGER NOT NULL,
  "currentMarketRent" NUMERIC(8,2) NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "leaseTotalRent" NUMERIC(8,2) NOT NULL,
  "leaseUnitDeposit" NUMERIC(8,2) NOT NULL,
  "quoteOriginalBaseRent" NUMERIC(8,2) NOT NULL,
  "quoteOverwrittenBaseRent" NUMERIC(8,2) NOT NULL,
  "quoteUnitDeposit" NUMERIC(8,2) NOT NULL,
  "approvingAgentName" VARCHAR(255) NOT NULL,
  "isNonCompliant" INTEGER NOT NULL,
  FOREIGN KEY ("leaseKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Lease"("leaseKey"),
  FOREIGN KEY ("propertyKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Property"("propertyKey"),
  FOREIGN KEY ("partyKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Party"("partyKey"),
  FOREIGN KEY ("inventoryKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Inventory"("inventoryKey"),
  FOREIGN KEY ("programKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Program"("programKey"),
  FOREIGN KEY ("contactChannelKey") REFERENCES "dstStarDB"."dstStarSchema"."d_ContactChannel"("contactChannelKey"),
  FOREIGN KEY ("utcDateKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Date"("dateKey"),
  FOREIGN KEY ("utcTimeKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Time"("timeKey"),
  FOREIGN KEY ("propertyDateKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Date"("dateKey"),
  FOREIGN KEY ("propertyTimeKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Time"("timeKey"),
  FOREIGN KEY ("agentKey") REFERENCES "dstStarDB"."dstStarSchema"."d_User"("userKey")
);

CREATE TABLE "dstStarDB"."dstStarSchema"."b_Team_Property_Program"
(
  "teamPropertyProgramKey" SERIAL PRIMARY KEY,
  "teamPropertyProgramId" uuid NOT NULL CONSTRAINT "b_Team_Property_Program_teamPropertyProgramId_key" UNIQUE,
  "teamKey" INTEGER NOT NULL,
  "propertyKey" INTEGER NOT NULL,
  "programKey" INTEGER NOT NULL,
  "commDirection" VARCHAR(255) NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY ("teamKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Team"("teamKey"),
  FOREIGN KEY ("propertyKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Property"("propertyKey"),
  FOREIGN KEY ("programKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Program"("programKey")
);

CREATE TABLE "dstStarDB"."dstStarSchema"."d_InventoryState"
(
  "inventoryStateKey" SERIAL PRIMARY KEY,
  "inventoryKey" INTEGER NOT NULL,
  "SCD_startDate" TIMESTAMPTZ NOT NULL,
  "SCD_endDate" TIMESTAMPTZ NOT NULL,
  "SCD_changeReason" VARCHAR(255) NOT NULL,
  "SCD_isCurrent" VARCHAR(8) NOT NULL,
  "state" VARCHAR(255) NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY ("inventoryKey") REFERENCES "dstStarDB"."dstStarSchema"."d_Inventory"("inventoryKey")
);

-- d_Time -- static dimension - populated once
INSERT INTO "dstStarDB"."dstStarSchema"."d_Time"
  ("timeKey", "time", "hour", "militaryHour", "minute", "meridian", "hourMinute")
SELECT
    -1 AS "timeKey",
    '0:0:0' AS "time",
    -1 AS "hour",
    -1 AS "militaryHour",
    -1 AS "minute",
    'NA' AS "meridian",
    'N/A' AS "hourMinute";

INSERT INTO "dstStarDB"."dstStarSchema"."d_Time"
  ("timeKey", "time", "hour", "militaryHour", "minute", "meridian", "hourMinute")
SELECT
  to_char(datum, 'HH24MI')::int4 AS "timeKey",
  datum::time AS "time",
  to_char(datum, 'HH12')::int2 AS "hour",
  to_char(datum, 'HH24')::int2 AS "militaryHour",
  extract(minute FROM datum)::int2 AS "minute",
  to_char(datum, 'AM') AS "meridian",
  to_char(datum, 'HH24:MI') as "hourMinute"
FROM generate_series('2000-01-01 00:00:00'::timestamp, '2000-01-01 23:59:59'::timestamp, '1 minute') datum;

-- d_Date -- static dimension - populated once
INSERT INTO "dstStarDB"."dstStarSchema"."d_Date"
  ("dateKey", "onlyDate", "fullDate", "year", "quarter", "quarterName", "month", "monthName", "yearMonth", "week", "weekName", "yearWeek", "dayOfYear", "dayOfWeek", "dayOfMonth", "dayName", "firstDayOfMonth", "lastDayOfMonth", "firstDayOfWeek", "lastDayOfWeek", "isHoliday", "isWeekend", "holidayName")
VALUES(19000101, '1900-01-01', '1900-01-01 00:00:00', 1900, 1, '1900-Q1', 1, 'January', 190001, 1, 'Week 52', 189952, 1, 6, 1, 'Saturday', '1900-01-01', '1900-01-31', '1899-12-27', '1900-01-02', 'N/A', 'N/A', 'N/A');

INSERT INTO "dstStarDB"."dstStarSchema"."d_Date"
  ("dateKey", "onlyDate", "fullDate", "year", "quarter", "quarterName", "month", "monthName", "yearMonth", "week", "weekName", "yearWeek", "dayOfYear", "dayOfWeek", "dayOfMonth", "dayName", "firstDayOfMonth", "lastDayOfMonth", "firstDayOfWeek", "lastDayOfWeek", "isHoliday", "isWeekend", "holidayName")
SELECT
	to_char(datum, 'YYYYMMDD')::integer AS dateKey,
	datum AS onlyDate,
	datum::timestamptz AS fullDate,
	EXTRACT(YEAR FROM datum) AS year,
	EXTRACT(quarter FROM datum) AS quarter,
	EXTRACT(YEAR FROM datum)::text || '-Q' || EXTRACT(quarter FROM datum)::text AS quarterName,
	EXTRACT(MONTH FROM datum) AS month,
	to_char(datum, 'TMMonth') AS monthName,
	to_char(datum, 'yyyymm')::integer AS yearMonth,
	EXTRACT(week FROM datum) AS week,
	'Week ' || EXTRACT(week FROM datum)::text AS weekName,
	to_char(datum, 'iyyyIW')::int4 AS yearWeek,
	EXTRACT(doy FROM datum) AS DayOfYear,
	EXTRACT(dow FROM datum) AS dayOfWeek,
	date_part('day', datum) AS dayOfMonth,
	to_char(datum, 'TMDay') AS dayName,
	datum + (1 - EXTRACT(DAY FROM datum))::INTEGER AS MonthStart,
	(datum + (1 - EXTRACT(DAY FROM datum))::INTEGER + '1 month'::INTERVAL)::DATE - '1 day'::INTERVAL AS MonthEnd,
	datum + (1 - EXTRACT(isodow FROM datum))::INTEGER AS CWStart,
	datum + (7 - EXTRACT(isodow FROM datum))::INTEGER AS CWEnd,
	'No' AS isHoliday,
	CASE WHEN EXTRACT(isodow FROM datum) IN (6, 7) THEN 'Weekend' ELSE 'Weekday' END AS Weekend,
	'Holiday Name'
FROM (
	-- There are 3 leap years in this range, so calculate 365 * 10 + 3 records - total 10 years
	SELECT '2000-01-01'::DATE + SEQUENCE.DAY AS datum
	FROM generate_series(0,8766) AS SEQUENCE(DAY)
	GROUP BY SEQUENCE.DAY
     ) DQ
ORDER BY 1;

INSERT INTO "dstStarDB"."dstStarSchema"."d_Date"
  ("dateKey", "onlyDate", "fullDate", "year", "quarter", "quarterName", "month", "monthName", "yearMonth", "week", "weekName", "yearWeek", "dayOfYear", "dayOfWeek", "dayOfMonth", "dayName", "firstDayOfMonth", "lastDayOfMonth", "firstDayOfWeek", "lastDayOfWeek", "isHoliday", "isWeekend", "holidayName")
VALUES(29991231, '2999-12-31', '2999-12-31 00:00:00', 2999, 4, '2999-Q4', 12, 'December', 299912, 1, 'Week 1', 300001, 365, 2, 31, 'Tuesday', '2999-12-01', '2999-12-31', '2999-12-30', '3000-01-05', 'N/A', 'N/A', 'N/A');

-- d_ContactChannel -- static dimension - populated once
INSERT INTO "dstStarDB"."dstStarSchema"."d_ContactChannel"
  (
    "contactChannelKey",
    "channelName",
    "channelGroup"
  )
SELECT -1, 'N/A', 'N/A' UNION ALL
SELECT 1, 'Call', 'Phone' UNION ALL
SELECT 2, 'Email', 'Digital' UNION ALL
SELECT 3, 'Web', 'Digital' UNION ALL
SELECT 4, 'Walk-in', 'Walk-In' UNION ALL
SELECT 5, 'Self-book', 'Digital' UNION ALL
SELECT 6, 'SMS', 'Phone' UNION ALL
SELECT 7, 'ContactEvent', 'Walk-In' UNION ALL
SELECT 8, 'Chat', 'Digital' UNION ALL
SELECT 9, 'Other', 'Other';

CREATE VIEW "dstStarDB"."dstStarSchema"."vw_d_Person"
AS
SELECT *,
	md5(ROW(
		TO_CHAR("utcCreatedDate", 'YYYY-MM-DD HH:MI:SS'),
		"fullName",
		"preferredName",
		"mergedWith"
	)::TEXT) AS "personHashKey"
FROM "dstStarDB"."dstStarSchema"."d_Person"
WHERE "SCD_isCurrent" = 'Yes';

CREATE VIEW "dstStarDB"."dstStarSchema"."vw_d_User"
AS
SELECT *,
  md5(ROW(
		TO_CHAR("utcCreatedDate", 'YYYY-MM-DD HH:MI:SS'),
		"fullName",
		"preferredName",
		"externalUniqueId",
		"businessTitle",
		"email",
		"displayPhoneNumber",
		"displayEmail",
		"isActive"
	)::TEXT) AS "userHashKey"
FROM "dstStarDB"."dstStarSchema"."d_User"
WHERE "SCD_isCurrent" = 'Yes';

CREATE VIEW "dstStarDB"."dstStarSchema"."vw_d_TeamMember"
AS
SELECT *,
  md5(ROW(
		TO_CHAR("utcCreatedDate", 'YYYY-MM-DD HH:MI:SS'),
		"userKey",
		"teamKey",
		"mainRoles",
		"functionalRoles"
	)::TEXT) AS "teamMemberHashKey"
FROM "dstStarDB"."dstStarSchema"."d_TeamMember"
WHERE "SCD_isCurrent" = 'Yes';

CREATE VIEW "dstStarDB"."dstStarSchema"."vw_d_InventoryPrice"
AS
SELECT *,
  md5(ROW(
    "inventoryKey",
    "basePrice",
    "amenitiesTotalPrice",
    "totalPrice"
  )::TEXT) AS "inventoryPriceHashKey"
FROM "dstStarDB"."dstStarSchema"."d_InventoryPrice"
WHERE "SCD_isCurrent" = 'Yes';

CREATE VIEW "dstStarDB"."dstStarSchema"."d_ApplicantPartyMember"
AS
SELECT pm."partyMemberKey", pm."externalPrimaryId", pm."externalSecondaryId", p."fullName"
FROM "dstStarDB"."dstStarSchema"."d_PartyMember" pm
  INNER JOIN "dstStarDB"."dstStarSchema"."d_Person" p ON pm."personKey" = p."personKey";

CREATE VIEW "dstStarDB"."dstStarSchema"."d_PrimaryPartyMember"
AS
SELECT pm."partyMemberKey", pm."externalPrimaryId", pm."externalSecondaryId", p."fullName"
FROM "dstStarDB"."dstStarSchema"."d_PartyMember" pm
  INNER JOIN "dstStarDB"."dstStarSchema"."d_Person" p ON pm."personKey" = p."personKey";

CREATE VIEW "dstStarDB"."dstStarSchema"."d_TaskDetails"
AS WITH inventories AS (
          SELECT bti."taskKey",
            bti."inventoryKey",
            dp_1."propertyName",
            di."externalId",
            di."inventoryGroupName",
            row_number() OVER (PARTITION BY bti."taskKey" ORDER BY bti."taskInventoryKey") AS ord
            FROM "dstStarDB"."dstStarSchema"."b_Task_Inventory" bti
              JOIN "dstStarDB"."dstStarSchema"."d_Inventory" di ON bti."inventoryKey" = di."inventoryKey" AND di."inventoryKey" <> '-1'::integer
              JOIN "dstStarDB"."dstStarSchema"."d_Property" dp_1 ON di."propertyKey" = dp_1."propertyKey"
        ), task_properties AS (
          SELECT i_1."taskKey",
            string_agg(DISTINCT i_1."externalId"::text, ' | '::text) AS inventories,
            string_agg(DISTINCT i_1."inventoryGroupName"::text, ' | '::text) AS "inventoryGroups",
            string_agg(DISTINCT i_1."propertyName"::text, ' | '::text) AS properties
            FROM inventories i_1
          GROUP BY i_1."taskKey"
        )
  SELECT t."taskKey",
    timezone(COALESCE(dpr."propertyTimezone", 'America/Los_Angeles'::text), t."utcCompletedDate") AS "propertyCompletedDate",
    timezone(COALESCE(dpr."propertyTimezone", 'America/Los_Angeles'::text), t."utcCreatedDate") AS "propertyCreatedDate",
    timezone(COALESCE(dpr."propertyTimezone", 'America/Los_Angeles'::text), t."utcStartDate") AS "propertyStartDate",
    COALESCE(i."inventoryKey", '-1'::integer) AS "inventoryKey",
    COALESCE(tp.properties, 'N/A'::text) AS properties,
    COALESCE(tp."inventoryGroups", 'N/A'::text) AS "inventoryGroups",
    COALESCE(tp.inventories, 'N/A'::text) AS inventories,
    CASE
      WHEN "taskName" IN ('APPOINTMENT','COMPLETE_CONTACT_INFO','COUNTERSIGN_LEASE','FOLLOWUP_PARTY','INTRODUCE_YOURSELF','MIGRATE_MOVE_IN_DOCUMENTS','NOTIFY_CONDITIONAL_APPROVAL','PROMOTE_APPLICATION','REVIEW_APPLICATION','SEND_CONTRACT','CALL_BACK') THEN "taskName"
      ELSE 'Manual Task'
    END AS "TaskType",
    CASE
      WHEN "appointmentResult" = 'N/A' THEN 'Scheduled'
      ELSE "appointmentResult"
    END "status",
    t."taskId",
    dp."partyKey"
  FROM "dstStarDB"."dstStarSchema"."d_Task" t
      JOIN "dstStarDB"."dstStarSchema"."d_Party" dp ON t."partyKey" = dp."partyKey"
      LEFT JOIN inventories i ON t."taskKey" = i."taskKey" AND i.ord = 1
      LEFT JOIN task_properties tp ON t."taskKey" = tp."taskKey"
      LEFT JOIN "dstStarDB"."dstStarSchema"."d_Property" dpr ON dp."currentAssignedProperty"::text = dpr."propertyName"::text;

CREATE VIEW "dstStarDB"."dstStarSchema"."d_PartyDetails"
AS WITH partymembers AS (
      SELECT dpm."partyKey",
          string_agg(dper."fullName"::text, ' , '::text) AS names
        FROM "dstStarDB"."dstStarSchema"."d_PartyMember" dpm
          JOIN "dstStarDB"."dstStarSchema"."d_Person" dper ON dpm."personKey" = dper."personKey"
        GROUP BY dpm."partyKey"
      )
SELECT dp."partyKey",
  COALESCE(wpm.names, 'N/A'::text) AS "partyMembers",
  COALESCE(ext."externalSecondaryId", 'N/A'::character varying) AS "pCode",
  timezone(COALESCE(dpr."propertyTimezone", 'America/Los_Angeles'::text), dp."utcClosedDate") AS "propertyClosedDate",
  timezone(COALESCE(dpr."propertyTimezone", 'America/Los_Angeles'::text), dp."utcSaleDate") AS "propertySaleDate",
  timezone(COALESCE(dpr."propertyTimezone", 'America/Los_Angeles'::text), dp."utcCreatedDate") AS "propertyCreatedDate",
  COALESCE(dpr."propertyDisplayName", 'N/A'::character varying) AS "propertyDisplayName",
  CASE
    WHEN "initialChannel" IN ('Self-book', 'Chat') THEN 'Website'
    WHEN "sourceDisplayName" = 'N/A' THEN 'Agent Entered'
    WHEN "sourceDisplayName" = 'apartmentlist.com' THEN 'ApartmentList.com'
    WHEN "sourceDisplayName" IN ('parkmerced.com', 'serenityatlarkspur.com', 'sharongreenapts.com', 'thecoveattiburon.com', 'woodchaseapartments.com', 'Parkmerced website', 'The Cove website', 'Serenity at Larkspur website', 'Sharon Green website', 'Woodchase Apartments website', 'South Shore website', 'Property website') THEN 'Website'
    ELSE "sourceDisplayName"
  END as "SourceCategory",
  CASE
    WHEN "leadScore" IN ('gold', 'silver', 'bronze') THEN 1
    ELSE 0
  END AS "isQualified",
  CASE
    WHEN "programDisplayName" IN ('Contact page on Parkmerced website', 'Contact Us', 'Parkmerced website', 'Property Website', 'Serenity at Larkspur website', 'Sharon Green website', 'The HUB team', 'South Shore website') THEN 'Website'
    WHEN "initialChannel" = 'Chat' THEN 'Chat'
    WHEN "initialChannel" = 'Self-book' THEN 'Self-Book'
    WHEN "sourceDisplayName" = 'N/A' THEN 'No Program'
    ELSE "programDisplayName"
  END AS "ProgramCategory",
  CASE
    WHEN "currentState" IN ('Contact', 'Prospect', 'Lead') THEN 0
    WHEN "currentState" IN ('Applicant', 'Lease', 'FutureResident', 'Resident') THEN 1
    ELSE 0
  END AS "hasApplied",
  CASE
    WHEN "currentState" IN ('Contact', 'Prospect', 'Lead') THEN 'No'
    WHEN "currentState" IN ('Applicant', 'Lease', 'FutureResident', 'Resident') THEN 'Yes'
    ELSE 'N/A'
  END AS "hasAppliedText",
  CASE
    WHEN "closeReason" = 'N/A' THEN 'Open'
    ELSE "closeReason"
  END AS "CloseReasonOrOpen",
  CASE
    WHEN "QQGroupProfile" IN ('N/A', 'NOT_YET_DETERMINED') THEN 'Agent Marked Not Determined'
    WHEN "QQGroupProfile" = 'message:' THEN 'No Lease Type Captured'
    ELSE "QQGroupProfile"
  END AS "LeaseType",
  CASE
    WHEN "initialChannel" = 'Self-book' THEN 30
    ELSE 60
  END AS SIP,
  CASE
    WHEN "currentState" = 'Contact' THEN '1-Prospect'
    WHEN "currentState" = 'Lead' THEN '2-Contacts'
    WHEN "currentState" = 'Prospect' THEN '3-Tour/Quoted'
    WHEN "currentState" = 'Applicant' THEN '4-Applicant'
    WHEN "currentState" = 'Lease' THEN '5-Leasing'
    WHEN "currentState" = 'FutureResident' THEN '6-Future Resident'
    WHEN "currentState" = 'Resident' THEN '7-Resident'
    ELSE 'N/A'
  END AS "StageSort",
  timezone(COALESCE(dpr."propertyTimezone", 'America/Los_Angeles'::text), now())::date - timezone(COALESCE(dpr."propertyTimezone", 'America/Los_Angeles'::text), dp."utcCreatedDate")::date as "partyAge",
  COALESCE(timezone(COALESCE(dpr."propertyTimezone", 'America/Los_Angeles'::text), fc."firstComm"), '1900-01-01 00:00:00') AS "propFirstComm",
  dp."partyId",
  hrc."hasCallRecorded"
FROM "dstStarDB"."dstStarSchema"."d_Party" dp
  LEFT JOIN "dstStarDB"."dstStarSchema"."d_Property" dpr ON dp."currentAssignedProperty"::text = dpr."propertyName"::text
  LEFT JOIN partymembers wpm ON dp."partyKey" = wpm."partyKey"
  LEFT JOIN ( SELECT pm."externalSecondaryId",
          pm."partyKey"
        FROM "dstStarDB"."dstStarSchema"."d_PartyMember" pm
        WHERE pm."isPrimary"::text = 'Yes'::text
        GROUP BY pm."partyKey", pm."externalSecondaryId") ext ON dp."partyKey" = ext."partyKey"
  LEFT JOIN (SELECT f."partyKey", min(comm."utcCreatedDate") AS "firstComm"
             FROM "dstStarDB"."dstStarSchema"."d_Communication" comm
               JOIN "dstStarDB"."dstStarSchema"."d_Call" call ON comm."communicationId" = call."callId"
               JOIN "dstStarDB"."dstStarSchema"."f_PartyCommunication" f ON comm."communicationKey" = f."communicationKey"
             WHERE comm."commType" = 'ContactEvent'
                 OR (comm."commType" = 'Call' AND comm.direction = 'out')
                 OR (comm."commType" = 'Call' AND comm.direction = 'in' AND call."isMissed" <> 'Yes' AND call."isVoiceMail" <> 'Yes')
                 OR (comm."commType" = 'Email' AND comm.direction = 'out')
                 OR (comm."commType" = 'Sms' AND comm.direction = 'out')
                 OR (comm."commType" = 'Web' AND comm.direction = 'out')
             GROUP BY f."partyKey"
             ) fc ON dp."partyKey" = fc."partyKey"
  LEFT JOIN (SELECT f."partyKey", max(call."isRecorded") AS "hasCallRecorded"
             FROM "dstStarDB"."dstStarSchema"."d_Call" call
               JOIN "dstStarDB"."dstStarSchema"."f_PartyCommunication" f ON call."communicationKey" = f."communicationKey"
             GROUP BY f."partyKey"
             ) hrc ON dp."partyKey" = hrc."partyKey";

CREATE VIEW "dstStarDB"."dstStarSchema"."d_PartyMemberDetails"
AS
SELECT
  dpm."partyKey",
  dpm."utcStartDate",
  dpm."utcEndDate",
  dpm."memberState",
  dpm."memberType",
  dp."fullName",
  dp."preferredName",
  dp."personId",
  dp."utcCreatedDate",
  COALESCE(SPLIT_PART(dp."fullName", ' ', 1), '') as "firstName",
  COALESCE(SPLIT_PART(dp."fullName", ' ', 2), '') as "secondName",
  COALESCE(SPLIT_PART(dp."fullName", ' ', 3), '') as "thirdName",
  COALESCE(dci_email.value, 'N/A') AS "email",
  COALESCE(dci_phone.value, 'N/A') AS "phone"
FROM "dstStarDB"."dstStarSchema"."d_PartyMember" AS dpm
  INNER JOIN "dstStarDB"."dstStarSchema"."d_Person" AS dp ON dpm."personKey" = dp."personKey"
  LEFT JOIN "dstStarDB"."dstStarSchema"."d_ContactInfo" AS dci_email
    ON dp."personKey" = dci_email."personKey" AND dci_email."isPrimary" = 'Yes' AND dci_email."contactType" = 'email'
  LEFT JOIN "dstStarDB"."dstStarSchema"."d_ContactInfo" AS dci_phone
    ON dp."personKey" = dci_phone."personKey" AND dci_phone."isPrimary" = 'Yes' AND dci_phone."contactType" = 'phone';

CREATE VIEW "dstStarDB"."dstStarSchema"."d_TeamMemberDetails"
AS
SELECT
	du."userKey",
	du."userId",
	du."fullName",
	du."preferredName",
	du.email,
	du."displayEmail",
	du."displayPhoneNumber",
	du."businessTitle",
	du."utcCreatedDate",
	dtm."mainRoles",
	dtm."functionalRoles",
	CASE WHEN dtm."mainRoles" LIKE '%LA%' THEN 'Yes' ELSE 'No' END AS "isAnLA",
	dt."teamName",
	dt."teamDisplayName",
  dt."teamTimezone",
	dt."teamModule"
FROM "dstStarDB"."dstStarSchema"."d_User" du
	JOIN "dstStarDB"."dstStarSchema"."d_TeamMember" dtm ON du."userKey" = dtm."userKey" AND dtm."SCD_isCurrent" = 'Yes'
	JOIN "dstStarDB"."dstStarSchema"."d_Team" dt ON dtm."teamKey" = dt."teamKey"
WHERE du."SCD_isCurrent" = 'Yes';

CREATE VIEW "dstStarDB"."dstStarSchema"."d_InventoryDetails"
AS
SELECT "inventoryKey",
  CASE
    WHEN "currentState" IN ('admin', 'down', 'excluded', 'model', 'vacantMakeReady', 'vacantMakeReadyReserved', 'vacantReady', 'vacantReadyReserved') THEN 'No'
    WHEN "currentState" IN ('occupied', 'occupiedNotice', 'occupiedNoticeReserved') THEN 'Yes'
    ELSE 'N/A'
  END AS "isCurrentlyOccupied",
  CASE
    WHEN "currentState" IN ('admin', 'down', 'excluded', 'model', 'vacantMakeReady', 'occupiedNotice', 'vacantReady') THEN 'No'
    WHEN "currentState" IN ('occupied', 'vacantMakeReadyReserved', 'occupiedNoticeReserved', 'vacantReadyReserved') THEN 'Yes'
    ELSE 'N/A'
  END AS "isOccupiedOrReserved",
  "numBedrooms" :: text || 'x' || "numBathrooms" :: text as "BedBath",
  CASE WHEN "numBedrooms" = 0 THEN 1 ELSE 0 END as "isBedsStudio",
  CASE WHEN "numBedrooms" = 1 THEN 1 ELSE 0 END as "isBedsOne",
  CASE WHEN "numBedrooms" = 2 THEN 1 ELSE 0 END as "isBedsTwo",
  CASE WHEN "numBedrooms" = 3 THEN 1 ELSE 0 END as "isBedsThree",
  CASE WHEN "numBedrooms" = 4 THEN 1 ELSE 0 END as "isBedsFour",
  CASE
    WHEN "propertyHoldStartDate"::date = '1900-01-01' THEN 'N/A'
    WHEN date_trunc('day', (current_date AT TIME ZONE dp."propertyTimezone" - "propertyHoldStartDate"))::text  = '00:00:00' THEN '0 days'
    ELSE date_trunc('day', (current_date AT TIME ZONE dp."propertyTimezone" - "propertyHoldStartDate"))::text
  END AS "numDaysOnHold",
  CASE
    WHEN date_part('year', di."availabilityDate") < 1990::double precision THEN 'N/A'
    ELSE to_char(di."availabilityDate", 'DD/MM/YYYY')
  END AS "availabilityDateText",
  CASE
    WHEN di."holdParty" <> 'N/A' THEN "right"(di."holdParty", 36)::uuid
    ELSE '00000000-0000-0000-0000-000000000000'::uuid
  END AS "holdPartyId"
FROM "dstStarDB"."dstStarSchema"."d_Inventory" AS di
  JOIN "dstStarDB"."dstStarSchema"."d_Property" AS dp ON di."propertyKey" = dp."propertyKey";

CREATE VIEW "dstStarDB"."dstStarSchema"."d_CallDetails"
AS
SELECT "callKey",
  CASE
  WHEN "isVoiceMail" = 'Yes' THEN 'voicemail' :: text
  WHEN "isMissed" = 'No'
          AND "isVoiceMail" = 'No'
          AND "callDuration" = '00:00:00'
          AND ( "dialStatus" = 'completed' :: text
              OR "dialStatus" = '' :: text )
        THEN 'hangedUp' :: text
    WHEN "isMissed" = 'Yes'
  AND "isVoiceMail" = 'No'
    AND "queueCallerRequestedAction" = 'N/A'
      THEN 'hangedUp' :: text
    WHEN "isMissed" = 'No'
    AND "isVoiceMail" = 'No'
    AND "callSeconds" > 0 :: double precision THEN 'completed' :: text
  WHEN "queueCallerRequestedAction" = 'call_back' :: text THEN 'callback' :: text
  ELSE 'N/A'
  END AS "endOfCallType",
  date_part('epoch', "utcQueueExitTime" - "utcQueueEntryTime") AS "inQueueDurationSec"
FROM "dstStarDB"."dstStarSchema"."d_Call";

INSERT INTO "dstStarDB"."dstStarSchema"."s_LoadDependency"
(
  "tableName",
  "dependsOnTable"
)
SELECT 'd_Party', NULL
UNION ALL SELECT 'd_Property', NULL
UNION ALL SELECT 'd_Person', NULL
UNION ALL SELECT 'd_ContactInfo', 'd_Person'
UNION ALL SELECT 'd_PartyMember', 'd_Person'
UNION ALL SELECT 'd_PartyMember', 'd_Party'
UNION ALL SELECT 'd_Program', NULL
UNION ALL SELECT 'd_User', NULL
UNION ALL SELECT 'd_Team', NULL
UNION ALL SELECT 'd_TeamMember', 'd_User'
UNION ALL SELECT 'd_TeamMember', 'd_Team'
UNION ALL SELECT 'd_Task', 'd_Party'
UNION ALL SELECT 'd_Inventory', NULL
UNION ALL SELECT 'f_PaymentsAndRefunds', 'd_Party'
UNION ALL SELECT 'f_PaymentsAndRefunds', 'd_PartyMember'
UNION ALL SELECT 'f_PaymentsAndRefunds', 'd_Property'
UNION ALL SELECT 'f_PartyConversion', 'd_Property'
UNION ALL SELECT 'f_PartyConversion', 'd_Party'
UNION ALL SELECT 'f_PartyConversion', 'd_Program'
UNION ALL SELECT 'f_PartyConversion', 'd_User'
UNION ALL SELECT 'd_Communication', NULL
UNION ALL SELECT 'b_Communication_Team', 'd_Communication'
UNION ALL SELECT 'b_Communication_Team', 'd_Team'
UNION ALL SELECT 'b_Communication_Person', 'd_Communication'
UNION ALL SELECT 'b_Communication_Person', 'd_Team'
UNION ALL SELECT 'f_PartyCommunication', 'd_Communication'
UNION ALL SELECT 'f_PartyCommunication', 'd_Program'
UNION ALL SELECT 'f_PartyCommunication', 'd_User'
UNION ALL SELECT 'f_PartyCommunication', 'd_Property'
UNION ALL SELECT 'f_PartyCommunication', 'd_Party'
UNION ALL SELECT 'd_Call', 'd_Communication'
UNION ALL SELECT 'd_InventoryPrice', 'd_Inventory'
UNION ALL SELECT 'b_Task_Inventory', 'd_Inventory'
UNION ALL SELECT 'b_Task_Inventory', 'd_Task'
UNION ALL SELECT 'b_Task_PartyMember', 'd_Task'
UNION ALL SELECT 'b_Task_PartyMember', 'd_PartyMember'
UNION ALL SELECT 'b_Task_User', 'd_Task'
UNION ALL SELECT 'b_Task_User', 'd_User'
UNION ALL SELECT 'f_CompletedTour', 'd_Task'
UNION ALL SELECT 'f_CompletedTour', 'd_Party'
UNION ALL SELECT 'f_CompletedTour', 'd_Property'
UNION ALL SELECT 'f_CompletedTour', 'd_Program'
UNION ALL SELECT 'f_AgentCallSummary', 'd_User'
UNION ALL SELECT 'f_AgentCallSummary', 'd_Team'
UNION ALL SELECT 'f_AgentCallSummary', 'b_AgentCallSummary_Party'
UNION ALL SELECT 'b_AgentCallSummary_Party', 'd_Party'
UNION ALL SELECT 'f_PropertyCallSummary', 'd_Property'
UNION ALL SELECT 'd_Lease', NULL
UNION ALL SELECT 'f_Sale', 'd_Property'
UNION ALL SELECT 'f_Sale', 'd_Party'
UNION ALL SELECT 'f_Sale', 'd_Lease'
UNION ALL SELECT 'f_Sale', 'd_Inventory'
UNION ALL SELECT 'f_Sale', 'd_Program'
UNION ALL SELECT 'f_Sale', 'd_ContactChannel'
UNION ALL SELECT 'f_Sale', 'd_User'
UNION ALL SELECT 'b_Team_Property_Program', 'd_Property'
UNION ALL SELECT 'b_Team_Property_Program', 'd_Team'
UNION ALL SELECT 'b_Team_Property_Program', 'd_Program'
UNION ALL SELECT 'd_Inventory', 'd_Property'
UNION ALL SELECT 'd_InventoryRmsPrice', 'd_Inventory'
UNION ALL SELECT 'd_InventoryTerm', 'd_Inventory'
UNION ALL SELECT 'd_InventoryState', 'd_Inventory'
UNION ALL SELECT 'h_RmsPricingHistory', NULL;

INSERT INTO "dstStarDB"."dstStarSchema"."s_LastLoadDate"
(
  "tableName",
  "loadDate"
)
SELECT 'd_Party', NOW() - INTERVAL '1 day'
UNION ALL SELECT 'd_Property', NOW() - INTERVAL '1 day'
UNION ALL SELECT 'd_Person', NOW() - INTERVAL '1 day'
UNION ALL SELECT 'd_ContactInfo', NOW() - INTERVAL '1 day'
UNION ALL SELECT 'd_PartyMember', NOW() - INTERVAL '1 day'
UNION ALL SELECT 'd_Program', NOW() - INTERVAL '1 day'
UNION ALL SELECT 'd_User', NOW() - INTERVAL '1 day'
UNION ALL SELECT 'd_Team', NOW() - INTERVAL '1 day'
UNION ALL SELECT 'd_TeamMember', NOW() - INTERVAL '1 day'
UNION ALL SELECT 'd_Task', NOW() - INTERVAL '1 day'
UNION ALL SELECT 'd_Inventory', NOW() - INTERVAL '1 day'
UNION ALL SELECT 'f_PaymentsAndRefunds', NOW() - INTERVAL '1 day'
UNION ALL SELECT 'f_PartyConversion', NOW() - INTERVAL '1 day'
UNION ALL SELECT 'd_Communication', NOW() - INTERVAL '1 day'
UNION ALL SELECT 'd_Call', NOW() - INTERVAL '1 day'
UNION ALL SELECT 'b_Communication_Team', NOW() - INTERVAL '1 day'
UNION ALL SELECT 'b_Communication_Person', NOW() - INTERVAL '1 day'
UNION ALL SELECT 'f_PartyCommunication', NOW() - INTERVAL '1 day'
UNION ALL SELECT 'd_InventoryPrice', NOW() - INTERVAL '1 day'
UNION ALL SELECT 'b_Task_Inventory', NOW() - INTERVAL '1 day'
UNION ALL SELECT 'b_Task_PartyMember', NOW() - INTERVAL '1 day'
UNION ALL SELECT 'f_CompletedTour', NOW() - INTERVAL '1 day'
UNION ALL SELECT 'b_Task_User', NOW() - INTERVAL '1 day'
UNION ALL SELECT 'b_AgentCallSummary_Party', NOW() - INTERVAL '1 day'
UNION ALL SELECT 'f_AgentCallSummary', NOW() - INTERVAL '1 day'
UNION ALL SELECT 'f_PropertyCallSummary', NOW() - INTERVAL '1 day'
UNION ALL SELECT 'd_Lease', NOW() - INTERVAL '1 day'
UNION ALL SELECT 'f_Sale', NOW() - INTERVAL '1 day'
UNION ALL SELECT 'b_Team_Property_Program', NOW() - INTERVAL '1 day'
UNION ALL SELECT 'd_InventoryRmsPrice', NOW() - INTERVAL '1 day'
UNION ALL SELECT 'd_InventoryTerm', NOW() - INTERVAL '1 day'
UNION ALL SELECT 'd_InventoryState', NOW() - INTERVAL '1 day'
UNION ALL SELECT 'h_RmsPricingHistory', NOW() - INTERVAL '1 day';

CREATE TRIGGER update_d_task_updated_at_trg BEFORE UPDATE ON "dstStarDB"."dstStarSchema"."d_Task" FOR EACH ROW EXECUTE PROCEDURE "dstStarDB"."dstStarSchema".update_updated_at_column();
CREATE TRIGGER update_f_paymentsandrefunds_updated_at_trg BEFORE UPDATE ON "dstStarDB"."dstStarSchema"."f_PaymentsAndRefunds" FOR EACH ROW EXECUTE PROCEDURE "dstStarDB"."dstStarSchema".update_updated_at_column();
CREATE TRIGGER update_d_partymember_updated_at_trg BEFORE UPDATE ON "dstStarDB"."dstStarSchema"."d_PartyMember" FOR EACH ROW EXECUTE PROCEDURE "dstStarDB"."dstStarSchema".update_updated_at_column();
CREATE TRIGGER update_d_party_updated_at_trg BEFORE UPDATE ON "dstStarDB"."dstStarSchema"."d_Party" FOR EACH ROW EXECUTE PROCEDURE "dstStarDB"."dstStarSchema".update_updated_at_column();
CREATE TRIGGER update_d_contactchannel_updated_at_trg BEFORE UPDATE ON "dstStarDB"."dstStarSchema"."d_ContactChannel" FOR EACH ROW EXECUTE PROCEDURE "dstStarDB"."dstStarSchema".update_updated_at_column();
CREATE TRIGGER update_f_partyconversion_updated_at_trg BEFORE UPDATE ON "dstStarDB"."dstStarSchema"."f_PartyConversion" FOR EACH ROW EXECUTE PROCEDURE "dstStarDB"."dstStarSchema".update_updated_at_column();
CREATE TRIGGER update_b_communication_person_updated_at_trg BEFORE UPDATE ON "dstStarDB"."dstStarSchema"."b_Communication_Person" FOR EACH ROW EXECUTE PROCEDURE "dstStarDB"."dstStarSchema".update_updated_at_column();
CREATE TRIGGER update_d_team_updated_at_trg BEFORE UPDATE ON "dstStarDB"."dstStarSchema"."d_Team" FOR EACH ROW EXECUTE PROCEDURE "dstStarDB"."dstStarSchema".update_updated_at_column();
CREATE TRIGGER update_b_communication_team_updated_at_trg BEFORE UPDATE ON "dstStarDB"."dstStarSchema"."b_Communication_Team" FOR EACH ROW EXECUTE PROCEDURE "dstStarDB"."dstStarSchema".update_updated_at_column();
CREATE TRIGGER update_d_person_updated_at_trg BEFORE UPDATE ON "dstStarDB"."dstStarSchema"."d_Person" FOR EACH ROW EXECUTE PROCEDURE "dstStarDB"."dstStarSchema".update_updated_at_column();
CREATE TRIGGER update_d_communication_updated_at_trg BEFORE UPDATE ON "dstStarDB"."dstStarSchema"."d_Communication" FOR EACH ROW EXECUTE PROCEDURE "dstStarDB"."dstStarSchema".update_updated_at_column();
CREATE TRIGGER update_d_program_updated_at_trg BEFORE UPDATE ON "dstStarDB"."dstStarSchema"."d_Program" FOR EACH ROW EXECUTE PROCEDURE "dstStarDB"."dstStarSchema".update_updated_at_column();
CREATE TRIGGER update_d_contactinfo_updated_at_trg BEFORE UPDATE ON "dstStarDB"."dstStarSchema"."d_ContactInfo" FOR EACH ROW EXECUTE PROCEDURE "dstStarDB"."dstStarSchema".update_updated_at_column();
CREATE TRIGGER update_d_property_updated_at_trg BEFORE UPDATE ON "dstStarDB"."dstStarSchema"."d_Property" FOR EACH ROW EXECUTE PROCEDURE "dstStarDB"."dstStarSchema".update_updated_at_column();
CREATE TRIGGER update_d_date_updated_at_trg BEFORE UPDATE ON "dstStarDB"."dstStarSchema"."d_Date" FOR EACH ROW EXECUTE PROCEDURE "dstStarDB"."dstStarSchema".update_updated_at_column();
CREATE TRIGGER update_d_time_updated_at_trg BEFORE UPDATE ON "dstStarDB"."dstStarSchema"."d_Time" FOR EACH ROW EXECUTE PROCEDURE "dstStarDB"."dstStarSchema".update_updated_at_column();
CREATE TRIGGER update_d_user_updated_at_trg BEFORE UPDATE ON "dstStarDB"."dstStarSchema"."d_User" FOR EACH ROW EXECUTE PROCEDURE "dstStarDB"."dstStarSchema".update_updated_at_column();
CREATE TRIGGER update_f_partycommunication_updated_at_trg BEFORE UPDATE ON "dstStarDB"."dstStarSchema"."f_PartyCommunication" FOR EACH ROW EXECUTE PROCEDURE "dstStarDB"."dstStarSchema".update_updated_at_column();
CREATE TRIGGER update_d_call_updated_at_trg BEFORE UPDATE ON "dstStarDB"."dstStarSchema"."d_Call" FOR EACH ROW EXECUTE PROCEDURE "dstStarDB"."dstStarSchema".update_updated_at_column();
CREATE TRIGGER update_d_teammember_updated_at_trg BEFORE UPDATE ON "dstStarDB"."dstStarSchema"."d_TeamMember" FOR EACH ROW EXECUTE PROCEDURE "dstStarDB"."dstStarSchema".update_updated_at_column();
CREATE TRIGGER update_d_inventory_updated_at_trg BEFORE UPDATE ON "dstStarDB"."dstStarSchema"."d_Inventory" FOR EACH ROW EXECUTE PROCEDURE "dstStarDB"."dstStarSchema".update_updated_at_column();
CREATE TRIGGER update_d_inventoryprice_updated_at_trg BEFORE UPDATE ON "dstStarDB"."dstStarSchema"."d_InventoryPrice" FOR EACH ROW EXECUTE PROCEDURE "dstStarDB"."dstStarSchema".update_updated_at_column();
CREATE TRIGGER update_b_task_inventory_updated_at_trg BEFORE UPDATE ON "dstStarDB"."dstStarSchema"."b_Task_Inventory" FOR EACH ROW EXECUTE PROCEDURE "dstStarDB"."dstStarSchema".update_updated_at_column();
CREATE TRIGGER update_b_task_partymember_updated_at_trg BEFORE UPDATE ON "dstStarDB"."dstStarSchema"."b_Task_PartyMember" FOR EACH ROW EXECUTE PROCEDURE "dstStarDB"."dstStarSchema".update_updated_at_column();
CREATE TRIGGER update_f_completedtour_updated_at_trg BEFORE UPDATE ON "dstStarDB"."dstStarSchema"."f_CompletedTour" FOR EACH ROW EXECUTE PROCEDURE "dstStarDB"."dstStarSchema".update_updated_at_column();
CREATE TRIGGER update_b_task_user_updated_at_trg BEFORE UPDATE ON "dstStarDB"."dstStarSchema"."b_Task_User" FOR EACH ROW EXECUTE PROCEDURE "dstStarDB"."dstStarSchema".update_updated_at_column();
CREATE TRIGGER update_b_agentcallsummary_party_updated_at_trg BEFORE UPDATE ON "dstStarDB"."dstStarSchema"."b_AgentCallSummary_Party" FOR EACH ROW EXECUTE PROCEDURE "dstStarDB"."dstStarSchema".update_updated_at_column();
CREATE TRIGGER update_f_agentcallsummary_updated_at_trg BEFORE UPDATE ON "dstStarDB"."dstStarSchema"."f_AgentCallSummary" FOR EACH ROW EXECUTE PROCEDURE "dstStarDB"."dstStarSchema".update_updated_at_column();
CREATE TRIGGER update_f_propertycallsummary_updated_at_trg BEFORE UPDATE ON "dstStarDB"."dstStarSchema"."f_PropertyCallSummary" FOR EACH ROW EXECUTE PROCEDURE "dstStarDB"."dstStarSchema".update_updated_at_column();
CREATE TRIGGER update_d_lease_updated_at_trg BEFORE UPDATE ON "dstStarDB"."dstStarSchema"."d_Lease" FOR EACH ROW EXECUTE PROCEDURE "dstStarDB"."dstStarSchema".update_updated_at_column();
CREATE TRIGGER update_f_sale_updated_at_trg BEFORE UPDATE ON "dstStarDB"."dstStarSchema"."f_Sale" FOR EACH ROW EXECUTE PROCEDURE "dstStarDB"."dstStarSchema".update_updated_at_column();
CREATE TRIGGER update_b_team_property_program_updated_at_trg BEFORE UPDATE ON "dstStarDB"."dstStarSchema"."b_Team_Property_Program" FOR EACH ROW EXECUTE PROCEDURE "dstStarDB"."dstStarSchema".update_updated_at_column();
CREATE TRIGGER update_d_inventoryrmsprice_updated_at_trg BEFORE UPDATE ON "dstStarDB"."dstStarSchema"."d_InventoryRmsPrice" FOR EACH ROW EXECUTE PROCEDURE "dstStarDB"."dstStarSchema".update_updated_at_column();
CREATE TRIGGER update_d_inventoryterm_updated_at_trg BEFORE UPDATE ON "dstStarDB"."dstStarSchema"."d_InventoryTerm" FOR EACH ROW EXECUTE PROCEDURE "dstStarDB"."dstStarSchema".update_updated_at_column();
CREATE TRIGGER update_d_inventorystate_updated_at_trg BEFORE UPDATE ON "dstStarDB"."dstStarSchema"."d_InventoryState" FOR EACH ROW EXECUTE PROCEDURE "dstStarDB"."dstStarSchema".update_updated_at_column();
CREATE TRIGGER update_h_rmspricinghistory_updated_at_trg BEFORE UPDATE ON "dstStarDB"."dstStarSchema"."h_RmsPricingHistory" FOR EACH ROW EXECUTE PROCEDURE "dstStarDB"."dstStarSchema".update_updated_at_column();