/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import pick from 'lodash/pick';
import { getApplicantData } from '../helpers/applicant';
import logger from '../../../../common/helpers/logger';

export const getFullStoryContent = async req => {
  let content = {};
  if (req.authUser && req.authUser.personId) {
    content = await getApplicantData(req);
  } else if (req.authUser) {
    content = pick(req.authUser, ['tenantId', 'userId', 'fullName', 'mainRoles', 'functionalRoles']);
  }
  logger.debug({ fullStoryContent: content });
  return content;
};
