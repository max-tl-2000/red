/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { createJWTToken } from '../../../../common/server/jwt-helpers';
import { badRequestErrorIfNotAvailable } from '../../../../common/helpers/validators';
import { DALTypes } from '../../../common/enums/dal-types';

export const generateRegisterToken = async req => {
  const { tenantId, tenantName, propertyId, propertyName } = req.body.propertyConfig;
  const confirmUrl = req.body.confirmUrl;
  const roommateProfileRequiredFields = req.body.roommateProfileRequiredFields;

  badRequestErrorIfNotAvailable([
    { property: tenantId, message: 'MISSING_TENANT_ID' },
    { property: tenantName, message: 'MISSING_TENANT_NAME' },
    { property: propertyId, message: 'MISSING_PROPERTY_ID' },
    { property: propertyName, message: 'MISSING_PROPERTY_NAME' },
    { property: confirmUrl, message: 'MISSING_CONFIRM_URL' },
    {
      property: roommateProfileRequiredFields,
      message: 'MISSING_ROOMMATES_PROFILE_REQ_FIELDS',
    },
  ]);

  return createJWTToken({
    tenantId,
    tenantName,
    propertyId,
    propertyName,
    confirmUrl,
    applicationId: DALTypes.AppId,
    roommateProfileRequiredFields,
  });
};
