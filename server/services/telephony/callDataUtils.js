/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import omit from 'lodash/omit';
import { getCommunicationByMessageId } from '../../dal/communicationRepo';

export const getUpdatedRawData = async (ctx, callData) => {
  const getRawData = async () => {
    if (!callData.CallUUID) return {};

    const comm = await getCommunicationByMessageId(ctx, callData.CallUUID);
    return (comm && comm.message && comm.message.rawMessage) || {};
  };

  return omit({ ...(await getRawData()), ...callData }, ['env', 'tenant', 'token', 'commId', 'partyId']);
};
