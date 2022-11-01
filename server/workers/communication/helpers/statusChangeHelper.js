/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import { isAnonymousEmail } from '../../../helpers/mails';
import {
  getPersonToPersonCommunicationByMessageId,
  getPersonToPersonCommunicationByForwardMessageId,
  updatePersonToPersonMessages,
} from '../../../../roommates/server/services/person-to-person-communication';
import { updateMessages, getCommunicationByMessageId, loadMessageById as getCommunicationById, saveUnreadCommunication } from '../../../dal/communicationRepo';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { now } from '../../../../common/helpers/moment-utils';
import { getForwardedCommunicationByMessageId, updateForwardedMessages } from '../../../dal/forwardedCommunicationsRepo';

const getPersonToPersonCommunication = async (ctx, messageId) => {
  const communication = await getPersonToPersonCommunicationByMessageId(ctx, messageId);
  return communication || (await getPersonToPersonCommunicationByForwardMessageId(ctx, messageId));
};

const getStatusForUpdate = ({ isSms, messageId, recipients, newStatus, newStatusDate, errorCode }) =>
  recipients.map(address => ({
    status: newStatus,
    statusDate: newStatusDate,
    address,
    ...(isSms && { messageId, errorCode }),
  }));

const searchCommunicationByMessageId = async (ctx, messageId) => {
  let communication = await getForwardedCommunicationByMessageId(ctx, messageId);
  let comm = { isForwardedCommunication: true, ...communication };
  if (!communication) {
    communication = await getCommunicationByMessageId(ctx, messageId);
    comm = { isForwardedCommunication: false, ...communication };
  }
  return comm;
};

const getCommunication = async (ctx, { anonymousEmail, messageId, commId }) =>
  commId
    ? await getCommunicationById(ctx, commId)
    : await (anonymousEmail ? getPersonToPersonCommunication(ctx, messageId) : searchCommunicationByMessageId(ctx, messageId));

const updateCommunication = async (ctx, commId, messageDelta, isForwardedComm) => {
  if (isForwardedComm) {
    const forwardedCommUpdate = await updateForwardedMessages(ctx, commId, messageDelta.status);
    return { ...forwardedCommUpdate, isForwardedComm: true };
  }
  return await updateMessages(ctx, { id: commId }, messageDelta);
};

// for SMS: recipients list will contains only one item
// for email: recipients list may contains multiple items
export const handleMessageStatusChange = async (ctx, { messageId, commId, newStatus, email, recipients, errorCode }) => {
  const anonymousEmail = email && isAnonymousEmail(email);

  const comm = await getCommunication(ctx, { anonymousEmail, messageId, commId });
  if (!comm.status) throw new Error(`Expected status in communication but got ${comm.status}`);
  const isSms = comm.type === DALTypes.CommunicationMessageType.SMS;
  const updatedStatuses = getStatusForUpdate({ isSms, messageId, recipients, newStatus, newStatusDate: now().toISOString(), errorCode });
  const notUpdatedStatuses = comm?.status?.status?.filter?.(dbStatus => !updatedStatuses.some(updatedStatus => updatedStatus.address === dbStatus.address));

  const messageDelta = {
    status: { status: [...notUpdatedStatuses, ...updatedStatuses] },
    ...((newStatus === DALTypes.CommunicationStatus.BOUNCED ||
      newStatus === DALTypes.CommunicationStatus.FAILED ||
      newStatus === DALTypes.CommunicationStatus.UNDELIVERED) && { unread: true }),
  };

  const updatedComms = await (anonymousEmail
    ? updatePersonToPersonMessages(ctx, { id: comm.id }, messageDelta)
    : updateCommunication(ctx, comm.id, messageDelta, comm.isForwardedCommunication));

  if (messageDelta.unread) {
    await mapSeries(updatedComms, async updatedComm => {
      await mapSeries(updatedComm.parties, async partyId => await saveUnreadCommunication(ctx, partyId, updatedComm));
    });
  }
  return updatedComms;
};
