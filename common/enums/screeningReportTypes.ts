/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { IDictionaryHash } from '../types/base-types';

type IReportType = IDictionaryHash<string>;

export const ScreeningVersion: IDictionaryHash<string> = {
  V1: 'v1',
  V2: 'v2',
};

export const getScreeningVersionOrdinal = (screeningVersion: string): number => (screeningVersion && parseFloat(screeningVersion.replace(/^v/, ''))) || 1;

export const ApplicantReportNames: IReportType = {
  CREDIT: 'credit',
  CRIMINAL: 'criminal',
};

export const ApplicantReportStatus: IReportType = {
  COMPILING: 'compiling',
  COMPLETED: 'completed',
  ERROR: 'error',
  BLOCKED_CREDIT_FREEZE: 'blockedCreditFreeze',
  BLOCKED_ADDRESS: 'blockedAddress',
  BLOCKED_DISPUTE: 'blockedDispute',
  PENDING: 'pending',
  CANCELED: 'canceled',
};
