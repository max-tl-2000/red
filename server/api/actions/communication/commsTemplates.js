/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import * as commService from '../../../services/communication';
import { ServiceError } from '../../../common/errors';

export const sendCommunication = async req => {
  const throwError = token => {
    throw new ServiceError({ token, status: 412 });
  };
  const { partyId } = req.params;
  const { templateId, templateName, personIds, context, templateDataOverride, category: communicationCategory, templateArgs } = req.body;

  if (!templateId && !templateName) throwError('TEMPLATE_NOT_DEFINED');
  if (!partyId) throwError('PARTY_ID_NOT_DEFINED');
  if (!personIds) throwError('PERSON_IDS_NOT_DEFINED');

  return await commService.sendCommunication(req, {
    templateId,
    templateName,
    partyId,
    personIds,
    context,
    templateDataOverride,
    templateArgs,
    communicationCategory,
  });
};
