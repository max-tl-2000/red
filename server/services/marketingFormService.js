/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import omit from 'lodash/omit';
import loggerModule from '../../common/helpers/logger';
import { COMPONENT_TYPES, ACTIVITY_TYPES } from '../../common/enums/activityLogTypes';
import { saveActivityLog } from '../dal/activityLogRepo';
import { sendMarketingFormEmail } from './mails';
import config from '../config';

const logger = loggerModule.child({ subType: 'marketingForm' });

export const logMarketingFormMessage = async (ctx, { formId, data, marketingSessionId, isValidRequest }) => {
  const activityLog = {
    type: isValidRequest ? ACTIVITY_TYPES.NEW : ACTIVITY_TYPES.REJECTED,
    component: COMPONENT_TYPES.MARKETING_FORM,
    details: omit(data, ['_userName_', '_name_']),
    context: {
      marketingSessionId,
      marketingFormId: formId,
    },
  };

  return await saveActivityLog(ctx, activityLog);
};

export const sendMarketingFormMessage = async (ctx, { formId, message }) => {
  logger.trace({ ctx, formId }, 'sendMarketingFormMessage');

  const targetEmail = config.isProdEnv ? message.to : 'qatest+marketingform@reva.tech';
  await sendMarketingFormEmail(ctx, {
    ...message,
    to: targetEmail,
  });
};
