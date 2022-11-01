/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { sendPersonToPersonMail } from '../mails';
import { getCommonUserByPersonId } from '../../../auth/server/services/common-user';
import loggerModule from '../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'comms' });

export const processPersontoPersonEmailCommunication = async (ctx, commData) => {
  logger.trace({ ctx }, `Processing person to person email communication: ${JSON.stringify(commData, null, 2)}`);

  const { message, communicationContext } = commData;
  const { targetContext, senderContext, personToPersonThreadId } = communicationContext;

  const receiverUser = await getCommonUserByPersonId(ctx, targetContext.personId);

  const emailData = {
    from: {
      personId: senderContext.persons[0],
      contactReference: senderContext.from,
    },
    to: {
      personId: targetContext.personId,
      contactReference: { email: receiverUser.email },
    },
    subject: message.subject,
    content: message.rawMessage.html,
    messageId: message.messageId,
    personToPersonThreadId,
  };

  sendPersonToPersonMail(ctx, emailData);
  return { isPersonToPersonMessage: true };
};
