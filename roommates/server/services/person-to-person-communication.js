/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import * as dal from '../dal/person-to-person-communication-repo';

export const savePersonToPersonMessage = (ctx, communication) => dal.savePersonToPersonMessage(ctx, communication);

export const updatePersonToPersonMessages = (ctx, query, communication) => dal.updatePersonToPersonMessages(ctx, query, communication);

export const getPersonToPersonCommunicationByMessageId = (ctx, messageId) => dal.getPersonToPersonCommunicationByMessageId(ctx, messageId);

export const getPersonToPersonCommunicationByForwardMessageId = (ctx, forwardMessageId) =>
  dal.getPersonToPersonCommunicationByForwardMessageId(ctx, forwardMessageId);
