CREATE TABLE "dstNormDB"."dstNormSchema"."n_ActivityLog" (
	"activitylogId"	uuid	NOT NULL PRIMARY KEY,
	"type"	varchar(255)	NOT NULL ,
	"component"	varchar(255)	NOT NULL ,
	"details"	json	NOT NULL ,
	"context"	jsonb	NOT NULL ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_Address" (
	"addressId"	uuid	NOT NULL PRIMARY KEY,
	"addressLine1"	varchar(256)	NOT NULL ,
	"addressLine2"	varchar(256)	 ,
	"city"	varchar(128)	NOT NULL ,
	"state"	varchar(2)	 ,
	"postalCode"	varchar(10)	NOT NULL ,
	"startDate"	timestamptz	 ,
	"endDate"	timestamptz	 ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_Amenity" (
	"amenityId"	uuid	NOT NULL PRIMARY KEY,
	"name"	varchar(200)	NOT NULL ,
	"category"	varchar(80)	NOT NULL ,
	"subCategory"	varchar(80)	NOT NULL ,
	"description"	text	 ,
	"hidden"	bool	 ,
	"propertyId"	uuid	 ,
	"displayName"	varchar(200)	NOT NULL ,
	"highValue"	bool	 ,
	"relativePrice"	numeric	 ,
	"absolutePrice"	numeric	 ,
	"targetUnit"	bool	 ,
	"infographicName"	varchar(200)	 ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_AnalyticsLog" (
	"analyticslogId"	uuid	NOT NULL PRIMARY KEY,
	"type"	varchar(255)	NOT NULL ,
	"component"	varchar(255)	NOT NULL ,
	"activityDetails"	jsonb	NOT NULL ,
	"entity"	jsonb	NOT NULL ,
	"context"	jsonb	NOT NULL ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_Assets" (
	"assetId"	uuid	NOT NULL PRIMARY KEY,
	"path"	varchar(255)	 ,
	"entity"	jsonb	 ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_Building" (
	"buildingId"	uuid	NOT NULL PRIMARY KEY,
	"name"	varchar(200)	NOT NULL ,
	"displayName"	varchar(200)	NOT NULL ,
	"type"	varchar(80)	NOT NULL ,
	"propertyId"	uuid	NOT NULL ,
	"description"	text	 ,
	"addressId"	uuid	NOT NULL ,
	"startDate"	timestamptz	 ,
	"endDate"	timestamptz	 ,
	"floorCount"	int4	 ,
	"surfaceArea"	numeric	 ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_Building_Amenity" (
	"building_amenityId"	uuid	NOT NULL PRIMARY KEY,
	"buildingId"	uuid	NOT NULL ,
	"amenityId"	uuid	NOT NULL ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_BusinessEntity" (
	"businessentityId"	uuid	NOT NULL PRIMARY KEY,
	"name"	varchar(200)	NOT NULL ,
	"type"	varchar(80)	NOT NULL ,
	"expertise"	varchar(200)	 ,
	"description"	text	 ,
	"addressId"	uuid	NOT NULL ,
	"website"	varchar(200)	 ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_Communication" (
	"communicationId"	uuid	NOT NULL PRIMARY KEY,
	"parties"	_uuid	 ,
	"persons"	_uuid	 ,
	"direction"	varchar(255)	 ,
	"type"	varchar(255)	 ,
	"userId"	uuid	 ,
	"messageId"	varchar(255)	 ,
	"message"	json	 ,
	"status"	json	 ,
	"threadId"	text	 ,
	"teams"	_uuid	NOT NULL ,
	"category"	varchar(255)	 ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_CommunicationSpam" (
	"communicationspamId"	uuid	NOT NULL PRIMARY KEY,
	"from"	varchar(255)	NOT NULL ,
	"type"	text	NOT NULL ,
	"message"	jsonb	NOT NULL ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_Concession" (
	"concessionId"	uuid	NOT NULL PRIMARY KEY,
	"name"	varchar(200)	NOT NULL ,
	"propertyId"	uuid	NOT NULL ,
	"description"	text	 ,
	"relativeAdjustment"	numeric	 ,
	"absoluteAdjustment"	numeric	 ,
	"exclusive"	bool	 ,
	"variableAdjustment"	bool	 ,
	"optional"	bool	 ,
	"recurring"	bool	 ,
	"recurringCount"	int4	 ,
	"nonRecurringAppliedAt"	varchar(200)	 ,
	"matchingCriteria"	text	 ,
	"leaseState"	varchar(80)	 ,
	"startDate"	timestamptz	 ,
	"endDate"	timestamptz	 ,
	"account"	int4	 ,
	"subAccount"	int4	 ,
	"taxable"	bool	 ,
	"hideInSelfService"	bool	 ,
	"displayName"	varchar(200)	NOT NULL ,
	"excludeFromRentFlag"	bool	NOT NULL ,
	"externalChargeCode"	varchar(255)	 ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_Concession_Fee" (
	"concession_feeId"	uuid	NOT NULL PRIMARY KEY,
	"concessionId"	uuid	NOT NULL ,
	"feeId"	uuid	NOT NULL ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_ContactInfo" (
	"contactinfoId"	uuid	NOT NULL PRIMARY KEY,
	"description"	text	 ,
	"type"	text	NOT NULL ,
	"value"	varchar(100)	NOT NULL ,
	"imported"	bool	 ,
	"metadata"	jsonb	NOT NULL ,
	"personId"	uuid	NOT NULL ,
	"isSpam"	bool	 ,
	"markedAsSpamBy"	uuid	 ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_Disclosure" (
	"disclosureId"	uuid	NOT NULL PRIMARY KEY,
	"name"	varchar(255)	NOT NULL ,
	"displayName"	varchar(255)	NOT NULL ,
	"displayOrder"	int4	 ,
	"displayHelp"	varchar(255)	 ,
	"descriptionHelper"	varchar(255)	NOT NULL ,
	"requireApplicationReview"	bool	 ,
	"showInApplication"	bool	 ,
	"showInParty"	bool	 ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_Documents" (
	"documentId"	uuid	NOT NULL PRIMARY KEY,
	"accessType"	varchar(255)	 ,
	"metadata"	jsonb	 ,
	"context"	text	 ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_Fee" (
	"feeId"	uuid	NOT NULL PRIMARY KEY,
	"name"	varchar(200)	NOT NULL ,
	"propertyId"	uuid	NOT NULL ,
	"displayName"	varchar(200)	NOT NULL ,
	"description"	text	 ,
	"feeType"	varchar(80)	NOT NULL ,
	"quoteSectionName"	varchar(80)	 ,
	"maxQuantityInQuote"	int4	 ,
	"servicePeriod"	varchar(80)	 ,
	"variableAdjustment"	bool	 ,
	"estimated"	bool	 ,
	"relativePrice"	numeric	 ,
	"absolutePrice"	numeric	 ,
	"depositInterest"	bool	NOT NULL ,
	"externalChargeCode"	varchar(255)	 ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_Inventory" (
	"inventoryId"	uuid	NOT NULL PRIMARY KEY,
	"name"	varchar(200)	NOT NULL ,
	"propertyId"	uuid	NOT NULL ,
	"multipleItemTotal"	int4	 ,
	"description"	text	 ,
	"type"	varchar(80)	NOT NULL ,
	"floor"	int4	 ,
	"layoutId"	uuid	 ,
	"inventoryGroupId"	uuid	NOT NULL ,
	"buildingId"	uuid	 ,
	"parentInventory"	uuid	 ,
	"state"	varchar(255)	NOT NULL ,
	"stateStartDate"	timestamptz	NOT NULL ,
	"externalId"	varchar(255)	 ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_Inventory_Amenity" (
	"inventory_amenityId"	uuid	NOT NULL PRIMARY KEY,
	"inventoryId"	uuid	NOT NULL ,
	"amenityId"	uuid	NOT NULL ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_InventoryGroup" (
	"inventorygroupId"	uuid	NOT NULL PRIMARY KEY,
	"name"	varchar(200)	NOT NULL ,
	"propertyId"	uuid	NOT NULL ,
	"displayName"	varchar(200)	NOT NULL ,
	"description"	text	 ,
	"leaseNameId"	uuid	 ,
	"basePriceMonthly"	numeric	 ,
	"basePriceWeekly"	numeric	 ,
	"basePriceDaily"	numeric	 ,
	"basePriceHourly"	numeric	 ,
	"primaryRentable"	bool	 ,
	"economicStatus"	varchar(80)	 ,
	"rentControl"	bool	 ,
	"affordable"	bool	 ,
	"feeId"	uuid	 ,
	"inventoryType"	varchar(255)	NOT NULL ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_InventoryGroup_Amenity" (
	"inventorygroup_amenityId"	uuid	NOT NULL PRIMARY KEY,
	"inventoryGroupId"	uuid	NOT NULL ,
	"amenityId"	uuid	NOT NULL ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_Layout" (
	"layoutId"	uuid	NOT NULL PRIMARY KEY,
	"name"	varchar(200)	NOT NULL ,
	"description"	text	 ,
	"propertyId"	uuid	NOT NULL ,
	"numBedrooms"	numeric	NOT NULL ,
	"numBathrooms"	numeric	NOT NULL ,
	"surfaceArea"	numeric	 ,
	"displayName"	varchar(200)	NOT NULL ,
	"floorCount"	int4	 ,
	"inventoryType"	varchar(255)	NOT NULL ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_Layout_Amenity" (
	"layout_amenityId"	uuid	NOT NULL PRIMARY KEY,
	"layoutId"	uuid	NOT NULL ,
	"amenityId"	uuid	NOT NULL ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_Lease" (
	"leaseId"	uuid	NOT NULL PRIMARY KEY,
	"partyId"	uuid	NOT NULL ,
	"quoteId"	uuid	NOT NULL ,
	"leaseTermId"	uuid	NOT NULL ,
	"leaseTemplateId"	uuid	NOT NULL ,
	"leaseData"	jsonb	NOT NULL ,
	"versions"	jsonb	 ,
	"status"	varchar(255)	 ,
	"baselineData"	jsonb	 ,
	"signDate"	timestamptz	 ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_LeaseName" (
	"leasenameId"	uuid	NOT NULL PRIMARY KEY,
	"name"	varchar(200)	NOT NULL ,
	"propertyId"	uuid	NOT NULL ,
	"description"	text	 ,
	"inventoryType"	varchar(255)	NOT NULL ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_LeaseSignatureStatus" (
	"leasesignaturestatuId"	uuid	NOT NULL PRIMARY KEY,
	"leaseId"	uuid	NOT NULL ,
	"partyMemberId"	uuid	 ,
	"userId"	uuid	 ,
	"status"	varchar(255)	 ,
	"metadata"	jsonb	 ,
	"envelopeId"	text	NOT NULL ,
	"signUrl"	text	 ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_LeaseTemplate" (
	"leasetemplateId"	uuid	NOT NULL PRIMARY KEY,
	"propertyId"	uuid	NOT NULL ,
	"templateData"	jsonb	NOT NULL ,
	"request"	text	NOT NULL ,
	"response"	text	 ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_LeaseTerm" (
	"leasetermId"	uuid	NOT NULL PRIMARY KEY,
	"termLength"	int4	NOT NULL ,
	"showOnQuote"	bool	 ,
	"leaseNameId"	uuid	NOT NULL ,
	"period"	varchar(20)	 ,
	"variableTermLength"	bool	 ,
	"relativeAdjustment"	numeric	 ,
	"absoluteAdjustment"	numeric	 ,
	"state"	varchar(80)	 ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_Party" (
	"partyId"	uuid	NOT NULL PRIMARY KEY,
	"state"	varchar(255)	NOT NULL ,
	"storedUnitsFilters"	json	 ,
	"userId"	uuid	 ,
	"metadata"	jsonb	NOT NULL ,
	"score"	varchar(255)	 ,
	"qualificationQuestions"	jsonb	NOT NULL ,
	"teams"	_uuid	 ,
	"collaborators"	_uuid	NOT NULL ,
	"assignedPropertyId"	uuid	 ,
	"startDate"	timestamptz	NOT NULL ,
	"endDate"	timestamptz	 ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_Party_AdditionalInfo" (
	"party_additionalinfoId"	uuid	NOT NULL PRIMARY KEY,
	"partyId"	uuid	NOT NULL ,
	"type"	varchar(255)	 ,
	"info"	jsonb	 ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_PartyMember" (
	"partymemberId"	uuid	NOT NULL PRIMARY KEY,
	"partyId"	uuid	 ,
	"memberState"	varchar(255)	NOT NULL ,
	"memberType"	varchar(255)	NOT NULL ,
	"personId"	uuid	NOT NULL ,
	"isSpam"	bool	NOT NULL ,
	"externalId"	varchar(255)	 ,
	"guaranteedBy"	uuid	 ,
	"endDate"	timestamptz	 ,
	"startDate"	timestamptz	NOT NULL ,
	"externalProspectCode"	varchar(255)	 ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_PartyQuotePromotions" (
	"partyquotepromotionId"	uuid	NOT NULL PRIMARY KEY,
	"partyId"	uuid	NOT NULL ,
	"quoteId"	uuid	NOT NULL ,
	"leaseTermId"	uuid	NOT NULL ,
	"promotionStatus"	text	 ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_Person" (
	"personId"	uuid	NOT NULL PRIMARY KEY,
	"fullName"	varchar(255)	 ,
	"preferredName"	varchar(255)	 ,
	"dob"	timestamptz	 ,
	"idType"	varchar(255)	NOT NULL ,
	"idValue"	varchar(255)	 ,
	"idState"	varchar(255)	 ,
	"idProvince"	varchar(255)	 ,
	"idCountry"	varchar(255)	 ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_Property" (
	"propertyId"	uuid	NOT NULL PRIMARY KEY,
	"name"	varchar(200)	NOT NULL ,
	"propertyLegalName"	varchar(200)	NOT NULL ,
	"owner"	uuid	 ,
	"operator"	uuid	 ,
	"propertyGroupId"	uuid	 ,
	"addressId"	uuid	NOT NULL ,
	"startDate"	timestamptz	 ,
	"endDate"	timestamptz	 ,
	"APN"	varchar(40)	 ,
	"MSANumber"	int2	 ,
	"MSAName"	varchar(60)	 ,
	"description"	text	 ,
	"website"	varchar(200)	 ,
	"displayName"	varchar(200)	NOT NULL ,
	"timezone"	text	 ,
	"settings"	jsonb	 ,
	"paymentProvider"	jsonb	 ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_PropertyGroup" (
	"propertygroupId"	uuid	NOT NULL PRIMARY KEY,
	"name"	varchar(200)	NOT NULL ,
	"description"	text	 ,
	"owner"	uuid	 ,
	"operator"	uuid	 ,
	"parentGroup"	uuid	 ,
	"displayName"	varchar(200)	NOT NULL ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_Quote" (
	"quoteId"	uuid	NOT NULL PRIMARY KEY,
	"inventoryId"	uuid	NOT NULL ,
	"partyId"	uuid	NOT NULL ,
	"publishDate"	timestamptz	 ,
	"expirationDate"	timestamptz	 ,
	"leaseStartDate"	timestamptz	 ,
	"selections"	jsonb	 ,
	"confirmationNumber"	uuid	 ,
	"publishedQuoteData"	jsonb	 ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_rentapp_ApplicationInvoices" (
	"rentapp_applicationinvoiceId"	uuid	NOT NULL PRIMARY KEY,
	"applicationFeeId"	uuid	NOT NULL ,
	"applicationFeeAmount"	numeric	NOT NULL ,
	"holdDepositFeeId"	uuid	 ,
	"holdDepositFeeIdAmount"	numeric	 ,
	"paymentCompleted"	bool	 ,
	"receiptPayload"	jsonb	 ,
	"partyApplicationId"	uuid	 ,
	"personApplicationId"	uuid	 ,
	"quoteId"	uuid	 ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_rentapp_ApplicationTransactions" (
	"rentapp_applicationtransactionId"	uuid	NOT NULL PRIMARY KEY,
	"invoiceId"	uuid	NOT NULL ,
	"transactionType"	varchar(80)	NOT NULL ,
	"transactionData"	jsonb	NOT NULL ,
	"externalId"	varchar(255)	NOT NULL ,
	"targetId"	varchar(255)	 ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_rentapp_PartyApplication" (
	"rentapp_partyapplicationId"	uuid	NOT NULL PRIMARY KEY,
	"partyId"	uuid	NOT NULL ,
	"applicationData"	jsonb	 ,
	"maxApprovedAt"	numeric	 ,
	"minDeniedAt"	numeric	 ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_rentapp_partyApplicationDocuments" (
	"rentapp_partyapplicationdocumentId"	uuid	NOT NULL PRIMARY KEY,
	"partyApplicationId"	uuid	NOT NULL ,
	"metadata"	jsonb	 ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_rentapp_PersonApplication" (
	"rentapp_personapplicationId"	uuid	NOT NULL PRIMARY KEY,
	"personId"	uuid	NOT NULL ,
	"partyId"	uuid	NOT NULL ,
	"partyApplicationId"	uuid	NOT NULL ,
	"paymentCompleted"	bool	NOT NULL ,
	"applicationData"	jsonb	 ,
	"applicationStatus"	varchar(255)	 ,
	"additionalData"	jsonb	 ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_rentapp_personApplicationDocuments" (
	"rentapp_personapplicationdocumentId"	uuid	NOT NULL PRIMARY KEY,
	"personApplicationId"	uuid	NOT NULL ,
	"metadata"	jsonb	 ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_rentapp_SubmissionRequest" (
	"rentapp_submissionrequestId"	uuid	NOT NULL PRIMARY KEY,
	"partyApplicationId"	uuid	NOT NULL ,
	"propertyId"	uuid	NOT NULL ,
	"rentData"	jsonb	NOT NULL ,
	"applicantData"	jsonb	NOT NULL ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_rentapp_SubmissionResponse" (
	"rentapp_submissionresponseId"	uuid	NOT NULL PRIMARY KEY,
	"submissionRequestId"	uuid	NOT NULL ,
	"applicationDecision"	varchar(255)	 ,
	"applicantDecision"	_jsonb	 ,
	"recommendations"	_jsonb	 ,
	"externalId"	varchar(255)	NOT NULL ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_Sources" (
	"sourceName"	varchar(200)	NOT NULL PRIMARY KEY,
	"displayName"	varchar(200)	NOT NULL ,
	"description"	varchar(500)	 ,
	"medium"	text	 ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_Tasks" (
	"taskId"	uuid	NOT NULL PRIMARY KEY,
	"name"	varchar(255)	 ,
	"partyId"	uuid	NOT NULL ,
	"state"	text	 ,
	"userIds"	_uuid	NOT NULL ,
	"dueDate"	timestamptz	 ,
	"category"	varchar(255)	 ,
	"metadata"	jsonb	NOT NULL ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_TeamMembers" (
	"teammemberId"	uuid	NOT NULL PRIMARY KEY,
	"teamId"	uuid	NOT NULL ,
	"userId"	uuid	NOT NULL ,
	"inactive"	bool	 ,
	"mainRoles"	_varchar	 ,
	"functionalRoles"	_varchar	 ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_TeamMemberSalesTargets" (
	"teammembersalestargetId"	uuid	NOT NULL PRIMARY KEY,
	"teamId"	uuid	NOT NULL ,
	"userId"	uuid	NOT NULL ,
	"month"	int4	NOT NULL ,
	"year"	int4	NOT NULL ,
	"salesTarget"	int4	 ,
	"contactsToSalesConv"	numeric	 ,
	"leadsToSalesConv"	numeric	 ,
	"prospectsToSalesConv"	numeric	 ,
	"applicantsToSalesConv"	numeric	 ,
	"leasesToSalesConv"	numeric	 ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_Teams" (
	"teamId"	uuid	NOT NULL PRIMARY KEY,
	"name"	varchar(200)	NOT NULL ,
	"displayName"	varchar(200)	NOT NULL ,
	"module"	text	NOT NULL ,
	"description"	varchar(500)	 ,
	"metadata"	jsonb	NOT NULL ,
	"timeZone"	text	NOT NULL ,
	"afterHoursVoiceMessage"	text	 ,
	"unavailableVoiceMessage"	text	NOT NULL ,
	"officeHours"	jsonb	 ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_TeamSalesTargets" (
	"teamsalestargetId"	uuid	NOT NULL PRIMARY KEY,
	"teamId"	uuid	NOT NULL ,
	"month"	int4	NOT NULL ,
	"year"	int4	NOT NULL ,
	"salesTarget"	int4	 ,
	"salesCycleDays"	int4	 ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstNormDB"."dstNormSchema"."n_Users" (
	"userId"	uuid	NOT NULL PRIMARY KEY,
	"externalUniqueId"	varchar(255)	NOT NULL ,
	"fullName"	varchar(255)	NOT NULL ,
	"preferredName"	varchar(255)	NOT NULL ,
	"email"	varchar(255)	NOT NULL ,
	"password"	varchar(255)	NOT NULL ,
	"employmentType"	varchar(255)	NOT NULL ,
	"loginAttempts"	int4	NOT NULL ,
	"metadata"	jsonb	 ,
	"inactive"	bool	 ,
	"ringPhones"	_varchar	 ,
	"lastLoginAttempt"	timestamptz	 ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);
