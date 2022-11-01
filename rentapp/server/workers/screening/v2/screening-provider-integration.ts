/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import get from 'lodash/get';
import logger from '../../../../../common/helpers/logger';
import { createFadvRequest } from './helpers/fadv-helper';
import { createFadvRawRequest, getFadvServiceOps } from '../screening-handler-request';
import { getTenantData } from '../../../../../server/dal/tenantsRepo';
import { DALTypes } from '../../../../../common/enums/DALTypes';
import { obscureApplicantProperties, obscureFadvRawRequestData } from '../../../helpers/screening-helper';
import { IFadvApplicantData, IRentData } from '../../../helpers/applicant-types';
import { IDbContext } from '../../../../../common/types/base-types';

const { ScreeningProviderMode } = DALTypes;

export const postToScreeningProvider = async (
  ctx: IDbContext,
  propertyId: string,
  rentData: IRentData,
  applicantData: IFadvApplicantData,
  options: any = { storeRequest: true },
) => {
  logger.info({ ctx, propertyId, rentData, ...obscureApplicantProperties(applicantData) }, 'call postToScreeningProvider v2');
  const tenant = await getTenantData(ctx);
  const screeningMode: string = get(tenant.metadata, 'screeningProviderMode', ScreeningProviderMode.FAKE);
  const { rawRequest, id: screeningRequestId } = await (options.storeRequest
    ? createFadvRequest(ctx, propertyId, rentData, applicantData, options)
    : createFadvRawRequest(ctx, propertyId, rentData, applicantData, options));

  const isFakeScenario = screeningMode === ScreeningProviderMode.FAKE;
  const payload = isFakeScenario
    ? {
        ctx,
        propertyId,
        rentData,
        applicantData: {
          ...applicantData,
          customRecords: { screeningRequestId, version: options.version },
        },
      }
    : rawRequest;

  logger.info(
    {
      ctx,
      screeningMode,
      screeningRequestId,
      ...(isFakeScenario ? obscureApplicantProperties({ fadvRequest: payload }) : { fadvRequestPayload: obscureFadvRawRequestData(payload) }),
    },
    'using postToFADV',
  );
  try {
    const postToFADV = getFadvServiceOps(screeningMode).postToFADV;
    const response = await postToFADV(ctx, payload, { screeningMode });
    return { response, screeningRequestId, screeningMode };
  } catch (err) {
    err.screeningRequestId = screeningRequestId;
    throw err;
  }
};
