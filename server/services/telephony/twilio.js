/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getPhoneNumberSMSInfo } from '../../common/twillioHelper';
import loggerModule from '../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'telephony' });

export const enhanceContactInfoWithSmsInfo = async (ctx, contactInfos, performTwilioCheck = true) => {
  logger.trace({ ctx, contactInfos }, 'enhanceContactInfoWithSmsInfo');
  if (!contactInfos || !contactInfos.length) return [];

  return await Promise.all(
    contactInfos.map(async contactInfo => {
      const initialMetadata = contactInfo.metadata || {};
      if (contactInfo.type === 'phone' && !initialMetadata.sms && performTwilioCheck) {
        const phoneNoSMSInfo = await getPhoneNumberSMSInfo(ctx, contactInfo.value);
        return {
          ...contactInfo,
          metadata: { sms: phoneNoSMSInfo.smsEnabled, thirdPartyCallResult: phoneNoSMSInfo.serviceCallResult, ...initialMetadata },
        };
      }
      return { metadata: initialMetadata, ...contactInfo };
    }),
  );
};
