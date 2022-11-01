/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { IParsedResponse } from '../../../../helpers/applicant-types';
import { IDictionaryHash } from '../../../../../../common/types/base-types';
import { BlockedServiceErrors } from '../../../../services/helpers/party-application-helper';
import { ServiceNames, REVA_SERVICE_STATUS } from '../../../../../../common/enums/applicationTypes';
import { ApplicantReportNames } from '../../../../../../common/enums/screeningReportTypes';

const ADDRESS_ERROR_CODES = ['30011', '30017', '30022'];
const EXPIRED_ERROR_CODE = '30007';
export const DEFAULT_GRACE_PERIOD = 30;

export const isAddressError = (errorCode: string): boolean => ADDRESS_ERROR_CODES.includes(errorCode);
export const isExpiredError = (errorCode: string): boolean => errorCode === EXPIRED_ERROR_CODE;
export const isStatusBlocked = (status: string): boolean => status === REVA_SERVICE_STATUS.BLOCKED;
export const isCreditFreeze = (response: IParsedResponse | IDictionaryHash<any> = {}): boolean => {
  const { serviceStatus, BlockedStatus } = response;
  if (!serviceStatus || !BlockedStatus) return false;

  const isCreditStatusBlocked = serviceStatus[ServiceNames.CREDIT] ? isStatusBlocked(serviceStatus[ServiceNames.CREDIT].status) : false;
  return isCreditStatusBlocked && BlockedStatus.includes(BlockedServiceErrors.CREDIT_FREEZE);
};

export const GRACE_PERIOD_MAPPER = {
  [ApplicantReportNames.CREDIT]: 'creditReportValidForPeriod',
  [ApplicantReportNames.CRIMINAL]: 'criminalReportValidForPeriod',
};
