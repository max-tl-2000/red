/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newUUID from 'uuid/v4';
import path from 'path';
import omit from 'lodash/omit';
import { mapSeries } from 'bluebird';
import sharp from 'sharp';
import { DALTypes } from '../../../common/enums/DALTypes';
import { createRawLeadFromCommIfNeeded } from '../leads';
import { getProperty } from '../../dal/propertyRepo';
import { addNewCommunication, computeSmsThreadId, updateCommunicationEntryById, getLastCommunicationInThread } from '../communication';
import { getCalledTeamIdByPhone } from '../../dal/teamsRepo';
import { constructPersonDataFromMessage, enhancePersonData, constructCommEntry } from './incomingCommunicationProcessorHelper';
import { write } from '../../../common/helpers/xfs';
import { isSpamCommunication, saveSpamCommunication } from '../blacklist';
import { uploadDocuments } from '../documents';
import { getPartyById } from '../party';
import config from '../../config';
import { processPersontoPersonEmailCommunication } from './incomingPersonToPersonCommunicationProcessor';
import loggerModule from '../../../common/helpers/logger';
import { obscureObject } from '../../../common/helpers/logger-utils';
import { runInTransaction } from '../../database/factory';
import { notifyCommunicationUpdate } from '../../helpers/notifications';
import * as eventService from '../partyEvent';
import { enhanceContactInfoWithSmsInfo } from '../telephony/twilio';
import { updateParty, loadPartyById } from '../../dal/partyRepo';
import { filterPartyMemberPersons } from '../../dal/personRepo';
import { BASE_64_IMAGE, BASE_64_CONTENT, BASE_64_CONTENT_TYPE } from '../../../common/regex';
import { now } from '../../../common/helpers/moment-utils';

const logger = loggerModule.child({ subType: 'comms' });

const getPersonsForComm = async (ctx, commContext, leadCreationResult) => {
  if (leadCreationResult.lead || leadCreationResult.newPartyMember) return [leadCreationResult.personId];
  return await filterPartyMemberPersons(ctx, {
    personIds: commContext.senderContext.persons,
    partyIds: leadCreationResult.partyIds,
  });
};

const saveIncomingComm = async (ctx, commContext, message, leadCreationResult) => {
  const partiesForComm = leadCreationResult.partyIds;
  const personsForComm = await getPersonsForComm(ctx, commContext, leadCreationResult);
  const party = (await getPartyById(ctx, leadCreationResult.partyIds[0])) || {};
  let calledTeam;
  if (commContext.commType === DALTypes.CommunicationMessageType.CALL) {
    const phoneNumber = message.rawMessage.To || message.to[0] || message.toNumber;
    calledTeam = phoneNumber && (await getCalledTeamIdByPhone(ctx, phoneNumber));
  }
  const partyOwner = party.userId;
  const partyOwnerTeam = party.ownerTeam;
  const commEntry = constructCommEntry(
    { ...commContext, calledTeam, partyOwner, partyOwnerTeam },
    message,
    personsForComm,
    partiesForComm,
    leadCreationResult.teamIds,
  );
  return await addNewCommunication(ctx, commEntry);
};

const isSupportedFile = attachment => {
  const { filename, contentType } = attachment;
  const { supportedFileTypes, supportedFileFormats } = config.mail.attachments;
  const extension = filename && path.extname(filename).slice(1).toLowerCase();
  const contentTypeLower = contentType.toLowerCase();
  return extension && supportedFileTypes.some(ct => ct === contentTypeLower) && supportedFileFormats.some(e => e === extension);
};

export const saveAttachments = async (ctx, attachments, moduleContext) => {
  const files = [];

  await Promise.all(
    attachments.map(async attachment => {
      if (isSupportedFile(attachment)) {
        const filepath = path.join(path.resolve(config.aws.efsRootFolder), ctx.tenantId, 'documents', newUUID());
        if (!attachment.content) {
          logger.warn({ ctx }, 'Empty email attachment found (size=0).', attachment);
          return;
        }
        await write(filepath, attachment.content, 'binary');
        files.push({
          originalName: attachment.filename,
          path: filepath,
        });
      } else {
        logger.warn({ ctx }, 'Unsupported email attachment found.', omit(attachment, ['content']));
      }
    }),
  );

  if (!files || !files.length) return [];

  ctx.files = files;
  return await uploadDocuments(ctx, {
    context: moduleContext,
  });
};

export const resizeInlineImage = async inlineImage => {
  const contents = inlineImage.match(BASE_64_CONTENT);
  const buff = Buffer.from(contents[1], 'base64');

  const imageSize = config.mail.attachments.inlineImageSize;
  const resizedContent = (await sharp(buff).resize(imageSize, imageSize, { withoutEnlargement: true, fit: sharp.fit.inside }).toBuffer()).toString('base64');

  const restContent = inlineImage.split(contents[1]);
  return [restContent[0], resizedContent, restContent[1]].join('');
};

export const processInlineImages = async (ctx, messageId, baseHtml, attachments) => {
  let newBaseHtml = baseHtml;
  const newInlineAttachments = [];

  const inlineImageOccurences = (baseHtml && baseHtml.match(BASE_64_IMAGE)) || [];
  if (inlineImageOccurences.length === 0) return { newBaseHtml, newInlineAttachments };

  await mapSeries(inlineImageOccurences, async image => {
    const contents = image.match(BASE_64_CONTENT);
    if (!contents) {
      logger.warn({ ctx, messageId }, 'Error while resizing inline image: image base64 could not be decoded');
      return;
    }
    const buff = Buffer.from(contents[1], 'base64');

    const matchingAttachmentByBuffer = attachments.find(a => a?.content?.equals(buff));
    if (!matchingAttachmentByBuffer) {
      const contentTypes = image.match(BASE_64_CONTENT_TYPE);
      const contentType = contentTypes[1].toLowerCase();

      newInlineAttachments.push({
        filename: `image-${inlineImageOccurences.indexOf(image)}-${now().toISOString()}.${contentType.split('/')[1]}`,
        content: buff,
        contentType,
      });
    }

    try {
      const resizedImage = await resizeInlineImage(image);
      newBaseHtml = newBaseHtml.replace(image, resizedImage);
    } catch (error) {
      logger.error({ ctx, error, messageId }, 'Error while resizing inline image');
    }
  });

  return { newBaseHtml, newInlineAttachments };
};

const getDataForCommunicationCompletedEvent = ({ metadata, savedMessage, party }) => ({
  partyId: party.id,
  metadata,
  userId: savedMessage.userId || party.userId,
});

// TODO first pass. Maybe we need to move per channel actions in different modules
// based on moduleContext (leasing/residentservices..etc)
// there is a pipe operator proposal for ES7....soon.
const processEmailCommunication = async (ctx, commData) => {
  const { communicationContext, message, attachments } = commData;
  const logData = {
    communicationContext,
    messageId: message.messageId,
    attachments: (attachments || []).map(a => ({
      ...a,
      content: '[removed]',
    })),
    unread: commData.unread,
  };

  logger.trace({ ctx, logData }, 'Processing email communication');

  const personData = constructPersonDataFromMessage(
    communicationContext.channel,
    communicationContext.senderContext,
    message.rawMessage,
    communicationContext.leadInformation,
  );

  let baseHtml = message.rawMessage.html;

  const { newBaseHtml, newInlineAttachments } = await processInlineImages(ctx, message.messageId, baseHtml, attachments);
  baseHtml = newBaseHtml;

  const allAttachments = [...(attachments || []), ...newInlineAttachments];

  if (allAttachments.length) {
    const uploadedAttachments = await saveAttachments(ctx, allAttachments, communicationContext.moduleContext);
    if (uploadedAttachments && uploadedAttachments.length) {
      message.files = uploadedAttachments;
    }
  }

  const newRawMessage = { ...message.rawMessage, html: baseHtml };
  const messageForComm = { ...message, rawMessage: newRawMessage };

  const leadCreationResult = await createRawLeadFromCommIfNeeded(ctx, { communicationContext, personData });
  const savedMessage = await saveIncomingComm(ctx, communicationContext, messageForComm, leadCreationResult);
  const isLeadCreated = !!(leadCreationResult && leadCreationResult.lead);
  let party;

  const partyId = leadCreationResult.partyIds && leadCreationResult.partyIds[0];

  if (isLeadCreated) {
    party = await updateParty(ctx, { id: leadCreationResult.lead.id, createdFromCommId: savedMessage.id });
  } else {
    party = await loadPartyById(ctx, partyId);
  }

  const metadata = { communicationId: savedMessage.id, isLeadCreated };
  const communicationCompletedData = getDataForCommunicationCompletedEvent({
    metadata,
    savedMessage,
    party,
  });
  await eventService.saveCommunicationCompletedEvent(ctx, communicationCompletedData);

  return {
    communication: savedMessage,
    partyId,
    personId: leadCreationResult.personId,
    isLeadCreated,
  };
};

const getSavedCommunication = async ({ ctx, commData, commType, leadCreationResult, personIds }) => {
  const { communicationContext, message } = commData;

  const threadId = commType === DALTypes.CommunicationMessageType.SMS ? await computeSmsThreadId(ctx, personIds) : communicationContext.threadId;

  const redialAttemptNo = commData.message.rawMessage?.redialAttemptNo;
  if (!redialAttemptNo || communicationContext.transferredFromCommId || communicationContext.inReplyTo) {
    return await saveIncomingComm(ctx, { ...communicationContext, threadId, commType }, message, leadCreationResult);
  }

  logger.trace({ ctx, commData: obscureObject(commData), commType, redialAttemptNo }, 'Redial attempt - updating existing comm');
  const { id, message: oldMessage } = await getLastCommunicationInThread(ctx, threadId);
  oldMessage.rawMessage.redialAttemptNo = redialAttemptNo;
  return await updateCommunicationEntryById({ ctx, id, delta: { message: oldMessage } });
};

const processPhoneNumberCommunication = async ({ ctx, commData, commType }) => {
  logger.debug({ ctx, commData: obscureObject(commData), commType }, 'processing phone communication');
  const { communicationContext, message } = commData;

  const personData = constructPersonDataFromMessage(communicationContext.channel, communicationContext.senderContext, message.rawMessage);
  if (personData.contactInfo) {
    personData.contactInfo.all = await enhanceContactInfoWithSmsInfo(ctx, personData.contactInfo.all, false);
  }

  const leadCreationResult = await createRawLeadFromCommIfNeeded(ctx, { communicationContext, personData });

  const isLeadCreated = !!leadCreationResult.lead;
  if (isLeadCreated) {
    logger.debug({ ctx, lead: leadCreationResult.lead, commType }, 'Created lead from incoming phone communication');
    await enhancePersonData(ctx, leadCreationResult.lead, message.from);
  }

  const personIds = await getPersonsForComm(ctx, communicationContext, leadCreationResult);
  const savedMessage = await getSavedCommunication({ ctx, commData, commType, leadCreationResult, personIds });

  const partyId = leadCreationResult.partyIds && leadCreationResult.partyIds[0];
  const { teamIds } = leadCreationResult;

  let party;
  if (isLeadCreated) {
    party = await updateParty(ctx, { id: leadCreationResult.lead.id, createdFromCommId: savedMessage.id });
  } else {
    party = await loadPartyById(ctx, partyId);
  }

  let propertyDisplayName = null;
  const { tenantName } = ctx;
  if (tenantName && tenantName.startsWith('demo')) {
    const { assignedPropertyId } = party;
    const { displayName } = (await getProperty(ctx, assignedPropertyId)) || {};
    propertyDisplayName = displayName;
  }
  // For calls the event will be saved in server/services/telephony/hangup.js
  if (commType === DALTypes.CommunicationMessageType.SMS) {
    const { enableBotResponseOnCommunications, id: programId, teamPropertyProgramId } = communicationContext.targetContext?.program || {};
    const metadata = {
      communicationId: savedMessage.id,
      isLeadCreated,
      personIds,
      teamIds,
      teamPropertyProgramId: teamPropertyProgramId || null,
      propertyDisplayName,
      enableBotResponseOnCommunications: enableBotResponseOnCommunications || null,
      programId: programId || null,
      tenantName: ctx.tenantName,
    };
    const communicationCompletedData = getDataForCommunicationCompletedEvent({
      metadata,
      savedMessage,
      party,
    });
    await eventService.saveCommunicationCompletedEvent(ctx, communicationCompletedData);
  }

  return {
    communication: savedMessage,
    partyId,
    personId: leadCreationResult.personId,
    partyIds: leadCreationResult.partyIds,
    isLeadCreated,
  };
};

const processLeasingCommunication = async (ctx, commContext) => {
  const { communicationContext } = commContext;

  switch (communicationContext.channel) {
    case DALTypes.CommunicationMessageType.EMAIL:
      return await processEmailCommunication(ctx, commContext);
    case DALTypes.CommunicationMessageType.SMS:
      return await processPhoneNumberCommunication({
        ctx,
        commData: commContext,
        commType: DALTypes.CommunicationMessageType.SMS,
      });
    case DALTypes.CommunicationMessageType.CALL:
      return await processPhoneNumberCommunication({
        ctx,
        commData: commContext,
        commType: DALTypes.CommunicationMessageType.CALL,
      });
    default:
      throw new Error(`Communication channel ${commContext.channel} is not yet implemented`);
  }
};

/* contextData
   communicationContext: object containg all context available for this comm (result of a call to the communicationContextProcessor module)
   message: object containg all the information related to the communication message we just received
     message.rawMessage -> the original message
*/
export const processIncomingCommunication = async (ctx, contextData) => {
  if (await isSpamCommunication(ctx, contextData)) {
    await saveSpamCommunication(ctx, contextData);
    return { isSpam: true };
  }

  const { communicationContext } = contextData;
  if (communicationContext.isPersonToPersonCommunication) {
    return await processPersontoPersonEmailCommunication(ctx, contextData);
  }

  return await runInTransaction(async trx => {
    const newCtx = { ...ctx, trx };
    const res = await processLeasingCommunication(newCtx, contextData);
    const { partyId, communication } = res;
    const { isLeadCreated } = res;

    try {
      await notifyCommunicationUpdate(newCtx, communication);
    } catch (ex) {
      logger.warn({ ctx, ex }, 'ProcessIncomingCommunication -> unable to notify clients');
    }

    await eventService.saveCommunicationReceivedEvent(newCtx, { partyId, metadata: { communicationId: communication.id, isLeadCreated } });
    return res;
  }, ctx);
};
