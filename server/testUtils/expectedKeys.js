/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const personKeys = [
  'id',
  'fullName',
  'contactInfo',
  'preferredName',
  'dob',
  'created_at',
  'updated_at',
  'idCountry',
  'idProvince',
  'idState',
  'idType',
  'idValue',
  'isSuspiciousContent',
  'mergedWith',
  'strongMatchCount',
  'modified_by',
];

export const commKeys = [
  'created_at',
  'updated_at',
  'id',
  'parties',
  'persons',
  'direction',
  'type',
  'userId',
  'messageId',
  'message',
  'unread',
  'status',
  'threadId',
  'teams',
  'category',
  'teamPropertyProgramId',
  'transferredFromCommId',
  'readBy',
  'readAt',
  'calledTeam',
  'partyOwner',
  'partyOwnerTeam',
  'fallbackTeamPropertyProgramId',
];

export const partyKeys = [
  'id',
  'state',
  'created_at',
  'updated_at',
  'storedUnitsFilters',
  'userId',
  'teams',
  'metadata',
  'score',
  'qualificationQuestions',
  'collaborators',
  'assignedPropertyId',
  'startDate',
  'endDate',
  'partyGroupId',
  'ownerTeam',
  'mergedWith',
  'emailIdentifier',
  'leaseType',
  'modified_by',
  'teamPropertyProgramId',
  'workflowName',
  'workflowState',
  'seedPartyId',
  'isTransferLease',
  'archiveDate',
  'createdFromCommId',
  'fallbackTeamPropertyProgramId',
];

export const partyMemberKeys = [
  'id',
  'partyId',
  'memberState',
  'memberType',
  'personId',
  'isSpam',
  'created_at',
  'updated_at',
  'fullName',
  'preferredName',
  'dob',
  'contactInfo',
  'startDate',
  'endDate',
  'guaranteedBy',
  'modified_by',
  'vacateDate',
  'companyId',
  'displayName',
];

export const commsTemplateKeys = ['id', 'name', 'displayName', 'description', 'emailSubject', 'emailTemplate', 'smsTemplate'];

export const templateShortCodeKeys = ['id', 'shortCode', 'templateId', 'propertyId', 'displayName', 'description'];

export const activeLeaseDataKeys = ['unitRent', 'leaseTerm', 'moveInDate', 'inventoryId', 'leaseEndDate', 'inventoryType', 'leaseStartDate'];

export const residentImportTrackingKeys = [
  'id',
  'rawData',
  'primaryExternalId',
  'propertyExternalId',
  'status',
  'importResult',
  'processed_at',
  'created_at',
  'updated_at',
  'lastSyncDate',
  'wasAddedToExceptionReport',
];
