/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const LOG_MESSAGE_MAX_LENGTH = 256;
export const NO_IMAGE_RESIZE = -1;
export const GLOBAL_SEARCH_QUERY_MAX_LENGTH = 255;
export const COMPANY_NAME_MAX_LENGTH = 255;

export const PhoneOwnerType = {
  TEAM: 'team',
  TEAM_MEMBER: 'team_member',
  USER: 'user',
  PROGRAM: 'program',
};

export const YardiResidentImportFiles = {
  ResTenants: 'ResTenants',
  ResRoommates: 'ResRoommates',
};

export const YardiUnitsImportFiles = {
  CommUnits: 'CommUnits',
};

export const RmsImportError = {
  FILE_NOT_RECOGNIZED_ERROR: 'FILE_NOT_RECOGNIZED',
  NO_FILES_ADDED_ERROR: 'NO_FILES_ADDED',
  PARSING_FAILED_ERROR: 'PARSING_FAILED',
  EMPTY_FILE_ERROR: 'EMPTY_FILE',
  FILE_NOT_FOUND_ERROR: 'FILE_NOT_FOUND',
  S3_UPLOAD_FAILED_ERROR: 'S3_UPLOAD_FAILED',
  DATABASE_SAVE_FAILED_ERROR: 'DATABASE_SAVE_FAILED',
  PROPERTY_NOT_FOUND_IN_DB_ERROR: 'PROPERTY_NOT_FOUND_IN_DB',
  INVENTORY_NOT_FOUND_IN_DB_ERROR: 'INVENTORY_NOT_FOUND_IN_DB',
  LEASE_TERM_MISMATCH_ERROR: 'LEASE_TERM_MISMATCH',
  PRICES_NOT_FOUND_IN_DB_ERROR: 'PRICES_NOT_FOUND_IN_DB',
};

export const RmsPricingEvents = {
  EXTERNAL_RMS_IMPORT: 'EXTERNAL_RMS_IMPORT',
  REVA_IMPORT: 'REVA_IMPORT',
  INVENTORY_STATE_CHANGE: 'INVENTORY_STATE_CHANGE',
};

export const ImportMappersEntityTypes = {
  UnitStatusMapper: 'inventory',
  RentableItemsMapper: 'inventory',
  UnitAmenitiesMapper: 'unitAmenities',
  ProspectsMapper: 'prospects',
  HistoricalCommunicationMapper: 'historicalCommunication',
  MriUnitMapper: 'inventory',
  MriUnitAmenitiesMapper: 'mriUnitAmenities',
  MriProperties: 'mriProperties',
  MriRentableItems: 'mriRentableItems',
  PartiesMapper: 'parties',
  PartyMembersMapper: 'partyMembers',
  CohortFile: 'cohortFile',
  CommUnitsMapper: 'commonUnits',
};

export const ResetPasswordTypes = {
  ADMIN: 'admin',
  USER_DEFAULT: 'user default',
  REVA_ADMIN: 'reva admin',
  SFTP: 'SFTP',
  LRO: 'LRO',
};

export const AppointmentEmailType = {
  CREATE: 'create',
  UPDATE: 'update',
  CANCEL: 'cancel',
};

export const LeaseEmailType = {
  SENT: 'sent',
  VOID: 'void',
  EXECUTE: 'execute',
};

export const AppointmentContextTypes = {
  MOST_RECENT: 'mostRecent',
  UPCOMING: 'upcoming',
};

export const StaticAssetType = {
  SWATCHES: 'swatches',
  MASKS: 'masks',
};

export const AssetTheme = {
  LIGHT: 'light',
  DARK: 'dark',
};

export const RetractedPostReasons = {
  INACCURATE_OR_MISLEADING_INFORMATION: 'INACCURATE_OR_MISLEADING_INFORMATION',
  NO_LONGER_APPLICABLE_OR_VALID: 'NO_LONGER_APPLICABLE_OR_VALID',
  MISSING_OR_INCOMPLETE_INFORMATION: 'MISSING_OR_INCOMPLETE_INFORMATION',
  SENT_TO_THE_WRONG_GROUP_OF_PEOPLE: 'SENT_TO_THE_WRONG_GROUP_OF_PEOPLE',
};

export const AssetThemeTypes = [AssetTheme.LIGHT, AssetTheme.DARK];

export const PaymentMethodCallbackResult = {
  SUCCESS: 'success',
  CANCEL: 'cancel',
};

export const LeaseProviderName = {
  FADV: 'FADV',
  BLUEMOON: 'BLUEMOON',
};

export const telephonyDisconnectedReasons = {
  USER_REFUSED_MIC_ACCESS: 'user refused mic access',
  NO_INTERNET_CONNECTION: 'no internet connection',
  OTHER: 'other',
};
