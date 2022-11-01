/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import get from 'lodash/get';
import union from 'lodash/union';
import { enhanceContactInfoWithSmsInfo } from '../../services/telephony/twilio';
import { createRawLeadFromCommIfNeeded } from '../../services/leads';
import { createSelfServiceAppointment } from '../../services/appointments';
import { reopenParty } from '../../services/party';
import { performPartyStateTransition } from '../../services/partyStatesTransitions';
import { getCommunicationContext } from '../../services/routing/communicationContextProcessor';
import { shouldIgnoreProgram } from '../../services/routing/targetProcessorHelpers';
import { createQuote, updateQuoteById, sendQuoteMailEvent } from '../../services/quotes';
import { enhancePersonData } from '../../services/routing/incomingCommunicationProcessorHelper';
import { getPersonById, updatePerson } from '../../dal/personRepo';
import { getProperty } from '../../dal/propertyRepo';
import { saveContactInfo, unmarkAsPrimaryContactInfo } from '../../dal/contactInfoRepo';
import { formatPhoneToDisplay } from '../../helpers/phoneUtils';
import { updateNumBedroomsToFilters } from '../../../common/helpers/filters';
import {
  getSelectionsLeaseTermsAndConcessions,
  getFeesForSelectedTerm,
  setVisibleAndSelected,
  setDepositsRelativeAmount,
  setLeaseTermsEndDate,
  setQuantityAdditional,
  updateLeaseTermsWithMatrixRents,
} from '../../../common/helpers/quotes';
import { DALTypes } from '../../../common/enums/DALTypes';
import { addNewCommunication } from '../../services/communication';
import { getInventoryProps } from '../../dal/inventoryRepo';
import { getFullQualifiedNamesForInventories } from '../../helpers/inventory';
import { runInTransaction } from '../../database/factory';
import loggerModule from '../../../common/helpers/logger';
import { notifyCommunicationUpdate } from '../../helpers/notifications';
import { saveCommunicationReceivedEvent, saveCommunicationCompletedEvent, savePartyUpdatedEvent } from '../../services/partyEvent';
import { getGuestContactInfo, getGuestDefaultContactInfo, getWebInquiryContactInfos, handleWebInquiryForwarding } from '../../services/webInquiryService';
import { loadParty, updateParty } from '../../dal/partyRepo';
import { now, parseAsInTimezone } from '../../../common/helpers/moment-utils';
import { YEAR_MONTH_DAY_FORMAT } from '../../../common/date-constants';
import { sendSelfServiceApplicationEmail } from '../../services/mjmlEmails/applicationEmails';
import { isProgramForwarding } from './helpers/communicationForwardingHelper';
import { computeLeaseStartDateForQuote } from '../../helpers/quotes';

const logger = loggerModule.child({ subType: 'AMQP/webInquiryHandler' });
const DEFAULT_EXPIRATION_PERIOD = 2;

const storeMessage = async (ctx, data, leadInfo, commContext, communicationCategory) => {
  const { partyIds, personId, teamIds } = leadInfo;
  const party = (await loadParty(ctx, partyIds[0])) || {};
  let commEntry = {
    message: {
      source: data.source,
      text: data.message,
      validationMessages: data.validationMessages,
      requestApplication: data.requestApplication,
      rawMessageData: data,
    },
    unread: true,
    parties: partyIds,
    persons: [personId],
    threadId: newId(),
    teams: teamIds,
    type: DALTypes.CommunicationMessageType.WEB,
    messageId: newId(),
    direction: DALTypes.CommunicationDirection.IN,
    category: communicationCategory,
    partyOwner: party.userId,
    partyOwnerTeam: party.ownerTeam,
  };

  const program = commContext.targetContext.program;
  commEntry = program ? { ...commEntry, teamPropertyProgramId: program.teamPropertyProgramId } : commEntry;

  const originalProgram = commContext.targetContext.originalProgram;
  commEntry = originalProgram
    ? { ...commEntry, teamPropertyProgramId: originalProgram.teamPropertyProgramId, fallbackTeamPropertyProgramId: program.teamPropertyProgramId }
    : commEntry;

  return await addNewCommunication(ctx, commEntry);
};

const updateQualificationQuestionsIfNeeded = async (ctx, personData, partyId) => {
  const { qualificationQuestions, storedUnitsFilters } = await loadParty(ctx, partyId);

  const noOfBedrooms = union(qualificationQuestions.numBedrooms, personData.qualificationQuestions.numBedrooms);
  const updatedStoredUnitsFilters = personData.qualificationQuestions.numBedrooms && updateNumBedroomsToFilters(noOfBedrooms, storedUnitsFilters);

  await updateParty(ctx, {
    id: partyId,
    qualificationQuestions: {
      moveInTime: qualificationQuestions.moveInTime || personData.qualificationQuestions.moveInTime,
      numBedrooms: noOfBedrooms.length ? noOfBedrooms : undefined,
      groupProfile: qualificationQuestions.groupProfile || personData.qualificationQuestions.groupProfile,
      cashAvailable: qualificationQuestions.cashAvailable || personData.qualificationQuestions.cashAvailable,
    },
    storedUnitsFilters: updatedStoredUnitsFilters,
  });
};

const updatePersonDataIfNeeded = async (ctx, result, personData) => {
  const person = await getPersonById(ctx, result.personId);
  if (
    person.contactInfo.phones &&
    personData.contactInfo.defaultPhone &&
    !person.contactInfo.phones.some(p => p.value === personData.contactInfo.defaultPhone)
  ) {
    await unmarkAsPrimaryContactInfo(ctx, person.id, DALTypes.ContactInfoType.PHONE);
    const enhancedContactInfos = await enhanceContactInfoWithSmsInfo(ctx, personData.contactInfo.phones, true);
    await saveContactInfo(ctx, enhancedContactInfos, person.id);
  }

  const legalName =
    person.contactInfo.emails.some(e => e.value === person.fullName) || person.contactInfo.phones.some(p => formatPhoneToDisplay(p.value) === person.fullName)
      ? personData.fullName
      : person.fullName;
  if (legalName && person.fullName !== legalName) {
    await updatePerson(ctx, person.id, { fullName: legalName });
  }
};

const getPreferredPartyOwner = (targetContext, requestAppointment) => {
  if (!requestAppointment || !requestAppointment.ownerId) return {};

  const program = targetContext.program;
  if (!program) return {};
  if (program.teamId !== program.onSiteLeasingTeamId) return {};

  return { preferredPartyOwnerId: requestAppointment.ownerId };
};

const getChargesWithMarketingQuestionsFees = (ctx, { marketingQuestionsResponses, additionalAndOneTimeCharges, leaseTerms }) => {
  if (!marketingQuestionsResponses || !marketingQuestionsResponses.length) return additionalAndOneTimeCharges;
  const { fees: monthlyAdditionalAndOneTimeChanges } = additionalAndOneTimeCharges.find(c => c.name === 'month');
  let result = additionalAndOneTimeCharges;
  marketingQuestionsResponses.forEach(mq => {
    const fee = monthlyAdditionalAndOneTimeChanges.find(c => c.id === mq.feeId);
    if (!fee) {
      logger.error({ ctx, marketingQuestionFee: mq }, 'No corresponding fee was found');
      return;
    }
    const period = leaseTerms[0]?.period || 'month';
    const fees = setVisibleAndSelected(result, period, true, fee);
    result = setQuantityAdditional(fees, period, mq.count, fee);
  });
  return result;
};

const getChargesWithPetFee = (petCount, additionalAndOneTimeCharges, leaseTerms) => {
  const { fees: monthlyAdditionalAndOneTimeChanges } = additionalAndOneTimeCharges.find(c => c.name === 'month');
  const petFee = monthlyAdditionalAndOneTimeChanges.find(c => c.name === DALTypes.FeeName.PET_RENT);

  if (!petCount || (petCount && !petFee)) return additionalAndOneTimeCharges;

  const period = leaseTerms[0]?.period || 'month';
  const fees = setVisibleAndSelected(additionalAndOneTimeCharges, period, true, petFee);
  return setQuantityAdditional(fees, period, petCount, petFee);
};

const getWebInquiryCommunicationCategory = data => {
  const { requestQuote, requestApplication, requestAppointment } = data;
  if (requestQuote) {
    return DALTypes.CommunicationCategory.WEB_QUOTE;
  }
  if (requestApplication) {
    return DALTypes.CommunicationCategory.WEB_APPLICATION;
  }
  if (requestAppointment) {
    return DALTypes.CommunicationCategory.WEB_APPOINTMENT;
  }
  return DALTypes.CommunicationCategory.WEB_CONTACT;
};

const createAndPublishQuote = async (ctx, data) => {
  const { unitQualifiedName, partyId, moveInDate, marketingQuestionsResponses, createdFromCommId } = data;
  const petCount = data.petCount && parseInt(data.petCount, 10);

  const requestedTerms = Array.isArray(data.termLength) ? data.termLength : [data.termLength || '12'];
  const requestedTermLengths = requestedTerms.map(t => parseInt(t, 10) || 12);

  const inventory = await getInventoryProps(ctx, { unitQualifiedName });

  if (!inventory) throw new Error(`Could not find inventory matching name: "${unitQualifiedName}"`);

  const { propertyId, inventoryId, inventoryName } = inventory;

  const property = await getProperty(ctx, propertyId);
  const { timezone, settings: propertySettings } = property;

  const draftQuote = await createQuote(ctx, { partyId, inventoryId, createdFromCommId });
  const { leaseTerms: terms, additionalAndOneTimeCharges: draftAdditionalAndOneTimeCharges } = draftQuote;

  const moveInDateTime = parseAsInTimezone(moveInDate, { format: YEAR_MONTH_DAY_FORMAT, timezone });
  const leaseStartDateTime = computeLeaseStartDateForQuote(moveInDateTime, { propertySettings, inventory });

  const leaseStartDate = leaseStartDateTime.toJSON();

  const leaseTerms = setLeaseTermsEndDate(terms, leaseStartDate, timezone);

  const selectedLeaseTerms = leaseTerms.filter(lt => requestedTermLengths.includes(lt.termLength));
  const selectedLeaseTermIds = selectedLeaseTerms.map(s => s.id);
  const prorationStrategy = get(property, 'settings.quote.prorationStrategy', '');
  const expirationPeriod = get(property, 'settings.quote.expirationPeriod', DEFAULT_EXPIRATION_PERIOD);

  // "additionalAndOneTimeCharges" is computed taking into account where the request comes from
  // the existing widget that only allows pets, which means we will have petCount -> getChargesWithPetFee
  // the new website, we will have an array of responses -> getChargesWithMarketingQuestionsFees
  const additionalAndOneTimeCharges = petCount
    ? getChargesWithPetFee(petCount, draftAdditionalAndOneTimeCharges, selectedLeaseTerms)
    : getChargesWithMarketingQuestionsFees(ctx, {
        marketingQuestionsResponses,
        additionalAndOneTimeCharges: draftAdditionalAndOneTimeCharges,
        leaseTerms: selectedLeaseTerms,
      });

  const depositAdditionalAndOneTimeCharges = setDepositsRelativeAmount({
    additionalOneTimeFees: additionalAndOneTimeCharges,
    leaseTermsIds: selectedLeaseTermIds,
  });

  const { rentMatrix } = draftQuote;
  const leaseTermsWithRmsPricing = updateLeaseTermsWithMatrixRents({ selectedLeaseTermIds, leaseStartDate, rentMatrix }, leaseTerms, timezone);

  let selections = getSelectionsLeaseTermsAndConcessions({
    selectedLeaseTermIds,
    leaseTerms: leaseTermsWithRmsPricing,
    leaseStartDate,
    additionalAndOneTimeCharges: depositAdditionalAndOneTimeCharges,
    prorationStrategy,
    timezone,
  });

  const isSelfServe = true;
  const selectedAdditionalAndOneTimeCharges = getFeesForSelectedTerm(
    selectedLeaseTermIds,
    leaseTermsWithRmsPricing,
    depositAdditionalAndOneTimeCharges,
    isSelfServe,
  );

  selections = { ...selections, selectedAdditionalAndOneTimeCharges };

  return await updateQuoteById(ctx, draftQuote.id, {
    selections,
    leaseStartDate,
    expirationPeriod,
    propertyTimezone: timezone,
    inventoryName,
    unitShortHand: unitQualifiedName,
    publishDate: now({ timezone }).toISOString(),
  });
};

const createExtraEntities = async (ctx, { requestData, communicationContext, createRawLeadResult, createdFromCommId }) => {
  const { requestAppointment, requestQuote } = requestData;
  const { targetPartyId: partyId, isCloseParty, senderPartyMemberId } = createRawLeadResult;

  if (isCloseParty) await reopenParty(ctx, partyId);

  if (requestAppointment) {
    const {
      targetContext: { program },
    } = communicationContext;

    await createSelfServiceAppointment(ctx, {
      partyId,
      onSiteLeasingTeamId: program?.onSiteLeasingTeamId,
      programEmailIdentifier: program?.directEmailIdentifier,
      senderPartyMemberId,
      createAppointment: requestAppointment,
      createdFromCommId,
    });
  }

  if (requestQuote) {
    const quote = await createAndPublishQuote(ctx, { ...requestQuote, partyId, createdFromCommId });
    await sendQuoteMailEvent(ctx, { quoteId: quote.id, partyId });
  }
};

const processWebInquiry = async (ctx, data) => {
  logger.trace({ ctx, ...data }, 'processWebInquiry');
  const { name, phone, email, programEmailIdentifier, requestApplication, requestQuote } = data;
  const contactInfo = getGuestContactInfo(phone, email);
  const contextData = {
    messageData: {
      to: [programEmailIdentifier],
      from: getGuestDefaultContactInfo(contactInfo),
      webInquiryContactInfos: getWebInquiryContactInfos(contactInfo),
    },
    channel: DALTypes.CommunicationMessageType.WEB,
  };

  const fullName = name || formatPhoneToDisplay(phone) || email;
  const personData = { fullName, preferredName: '', contactInfo };
  personData.qualificationQuestions = data.qualificationQuestions || {};

  return await runInTransaction(async trx => {
    const newCtx = { ...ctx, trx };

    const communicationContext = await getCommunicationContext(newCtx, contextData);

    if (shouldIgnoreProgram({ communicationContext })) return {};

    // Enhance communication context with the flag that indicates whether a new party should be creatd on the same property
    // if one is not already existing on the targetted team
    if (data.uniquePartyPerPropertyAndTeam === true) communicationContext.uniquePartyPerPropertyAndTeam = true;

    const result = await createRawLeadFromCommIfNeeded(newCtx, {
      communicationContext,
      personData,
      avoidAssigningToDispatcher: true,
      ...getPreferredPartyOwner(communicationContext.targetContext, data.requestAppointment),
    });

    const communicationCategory = getWebInquiryCommunicationCategory(data);

    if (communicationCategory === DALTypes.CommunicationCategory.WEB_APPOINTMENT) {
      const inventoryId = data.requestAppointment?.inventoryId || '';
      const [inventoryDetails] = inventoryId ? await getFullQualifiedNamesForInventories(ctx, [inventoryId]) : '';
      data.requestAppointment.inventoryFullQualifiedName = inventoryDetails?.fullQualifiedName;
    }

    const message = await storeMessage(newCtx, data, result, communicationContext, communicationCategory);
    const createdFromCommId = message.id;
    if (result.lead) {
      const { lead } = result;
      await enhancePersonData(newCtx, lead, personData.contactInfo.defaultPhone);
      await updateParty(newCtx, { id: lead.id, createdFromCommId });
    } else {
      await updatePersonDataIfNeeded(newCtx, result, personData);
      await savePartyUpdatedEvent(newCtx, { partyId: result.targetPartyId, userId: message.userId });
    }

    const partyId = result.targetPartyId;

    await createExtraEntities(newCtx, { requestData: data, communicationContext, createRawLeadResult: result, createdFromCommId });

    if (result.lead) {
      await saveCommunicationReceivedEvent(newCtx, { partyId: result.lead.id, metadata: { communicationId: message.id, isLeadCreated: !!result.lead } });
      await saveCommunicationCompletedEvent(newCtx, {
        partyId: result.lead.id,
        userId: message.userId || result.lead.userId,
        metadata: { communicationId: message.id, isLeadCreated: !!result.lead },
      });
    } else {
      await updateQualificationQuestionsIfNeeded(newCtx, personData, partyId);
      await performPartyStateTransition(newCtx, partyId);
    }

    await notifyCommunicationUpdate(ctx, message);

    if (!requestQuote && requestApplication) await sendSelfServiceApplicationEmail(newCtx, { partyId, personIds: [result.personId], createdFromCommId });
    if (communicationContext.targetContext.program && isProgramForwarding(communicationContext)) {
      await handleWebInquiryForwarding(ctx, { ...data, partyId }, communicationContext.targetContext.program);
    }

    return { savedMessage: message, lead: result.lead };
  }, ctx);
};

export const handleWebInquiry = async ({ ctx, data }) => {
  try {
    await processWebInquiry(ctx, data);
    return { processed: true };
  } catch (error) {
    logger.error({ ctx, error, data }, 'handleWebInquiry error');
    return { processed: false };
  }
};
