/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import orderBy from 'lodash/orderBy';
import { getOnlyDigitsFromPhoneNumber, looksLikeAPhoneNumber } from '../../../common/helpers/phone-utils';
import { APP_EXCHANGE, COMM_MESSAGE_TYPE } from '../../helpers/message-constants';
import { sendMessage } from '../../services/pubsub';
import { ServiceError } from '../../common/errors';
import { isEmailValid } from '../../../common/helpers/validations/email';
import { DALTypes } from '../../../common/enums/DALTypes';
import { loadProgramForIncomingCommByEmail, loadProgramByMarketingSessionId } from '../../dal/programsRepo';
import { getInventoryProps } from '../../dal/inventoryRepo';
import { getLeaseTermsByInventoryId } from '../../dal/leaseTermRepo';
import { getTeamCalendarSlotDuration, getProperty, getPropertySettings } from '../../dal/propertyRepo';
import { loadPartiesByPersonIds, loadPartyById } from '../../dal/partyRepo';
import { validateReferrer } from '../referrerAuth';
import loggerModule from '../../../common/helpers/logger';
import { toMoment, now } from '../../../common/helpers/moment-utils';
import { createSelfBookUserCalendarEvent, updateAppointmentFromSelfService as updateAppointment } from '../../services/appointments';
import { getAppointmentById, getAllAppointmentsForPartyMember } from '../../dal/appointmentRepo';
import * as validators from '../helpers/validators';
import * as selfService from '../../services/webInquiryService';
import { getProgramInformationForProperty } from '../../services/marketingPropertiesService';
import { tryDecodeJWTToken } from '../../../common/server/jwt-helpers';
import { getPersonIdFromWebInquiryContactInfos } from '../../services/routing/communicationContextProcessor';
import { checkForSpamContactInfoWebInquiry } from '../../services/blacklist';
import { getPartiesForComm } from '../../services/leads';
import { honeypotTrapCheck } from '../helpers/honeypot';
import { partyWfStatesSubset } from '../../../common/enums/partyTypes';

const logger = loggerModule.child({ subType: 'api/actions/webInquiry' });

const isMoveInTimeValid = moveInTime => Object.keys(DALTypes.QualificationQuestions.MoveInTime).includes(moveInTime);

const addMessage = async (req, params, programEmail) =>
  await sendMessage({
    exchange: APP_EXCHANGE,
    key: COMM_MESSAGE_TYPE.WEB_INQUIRY,
    message: {
      ctx: {
        tenantId: req.tenantId,
        tenantDomain: req.get('host'),
        tenantName: req.tenantName,
        reqId: req.reqId,
      },
      data: {
        ...params,
        programEmailIdentifier: programEmail,
      },
    },
    ctx: req,
  });

const validateQuoteTermLength = async (req, requestTermLength, inventoryId) => {
  const termLength = parseInt(requestTermLength, 10);

  const isZeroOrNegativeTermLength = termLength && termLength <= 0;
  if (!termLength || isZeroOrNegativeTermLength) throw new ServiceError({ token: 'INVALID_TERM_LENGTH', status: 400 });

  const inventoryLeaseTerms = (await getLeaseTermsByInventoryId(req, inventoryId)).filter(lt => !lt.inactive && lt.period === DALTypes.LeasePeriod.MONTH);
  const validTermLengths = inventoryLeaseTerms.map(lt => lt.termLength);
  if (!validTermLengths.includes(termLength)) throw new ServiceError({ token: 'INVALID_TERM_LENGTH_FOR_SELECTED_INVENTORY', status: 400 });
};

const validateQuoteRequest = async (req, timezone) => {
  const { requestQuote } = req.body;
  const { unitQualifiedName, moveInDate, petCount, termLength } = requestQuote;

  const inventory = await getInventoryProps(req, { unitQualifiedName });
  if (!inventory) throw new ServiceError({ token: 'INVALID_UNIT_QUALIFIED_NAME', status: 400 });
  if (inventory.pricingType !== DALTypes.LeaseState.NEW) throw new ServiceError({ token: 'MISSING_INVENTORY_PRICING', status: 404 });

  if (!moveInDate || !toMoment(moveInDate, { timezone }).isValid()) throw new ServiceError({ token: 'INVALID_MOVE_IN_DATE', status: 400 });

  const numberOfPets = parseInt(petCount, 10);
  const isPositive = (numberOfPets || numberOfPets === 0) && numberOfPets >= 0;
  if (!isPositive) throw new ServiceError({ token: 'INVALID_PET_COUNT', status: 400 });

  if (termLength) await validateQuoteTermLength(req, termLength, inventory.inventoryId);
};

const mandatoryValidations = async (req, timezone, shouldCreateOnError) => {
  const { phone, email, qualificationQuestions, requestAppointment, requestQuote } = req.body;
  if (!phone && !email) {
    throw new ServiceError({ token: 'PHONE_OR_EMAIL_REQUIRED', status: 400 });
  }

  if (!shouldCreateOnError && phone !== undefined && !looksLikeAPhoneNumber(getOnlyDigitsFromPhoneNumber(phone))) {
    throw new ServiceError({ token: 'INVALID_PHONE_NUMBER', status: 400 });
  }

  if (requestAppointment) {
    if (
      !requestAppointment.startDate ||
      !toMoment(requestAppointment.startDate, { timezone }).isValid() ||
      toMoment(requestAppointment.startDate, { timezone }).isBefore(now({ timezone }))
    ) {
      throw new ServiceError({ token: 'INCORRECT_DATE', status: 400 });
    }

    if (requestAppointment.inventoryId) {
      const inventory = await getInventoryProps(req, { inventoryId: requestAppointment.inventoryId });
      if (!inventory) throw new ServiceError({ token: 'INVENTORY_NOT_FOUND', status: 400 });
      if (inventory.pricingType !== DALTypes.LeaseState.NEW) throw new ServiceError({ token: 'MISSING_INVENTORY_PRICING', status: 404 });
    }
  }

  if (qualificationQuestions && qualificationQuestions.moveInTime && !isMoveInTimeValid(qualificationQuestions.moveInTime)) {
    throw new ServiceError({ token: 'INVALID_MOVE_IN_TIME', status: 400 });
  }

  if (requestQuote) await validateQuoteRequest(req, timezone);
};

const getAditionalValidations = (createOnError, phone, email) => {
  const validationMessages = [];
  if (phone && !looksLikeAPhoneNumber(phone)) {
    if (createOnError) {
      validationMessages.push(`Phone number supplied was invalid '${phone}'`);
    } else {
      throw new ServiceError({ token: 'INVALID_PHONE_NUMBER', status: 400 });
    }
  }

  if (email && !isEmailValid(email)) {
    if (createOnError) {
      validationMessages.push(`Email address supplied was invalid '${email}'`);
    } else {
      throw new ServiceError({ token: 'INVALID_EMAIL_ADDRESS', status: 400 });
    }
  }

  return validationMessages;
};

const validateStartDateAsSlotStart = (startDate, slotMinutes, timezone) => {
  const startOfDay = toMoment(startDate, { timezone }).clone().startOf('day');

  const msSinceStartOfDay = toMoment(startDate, { timezone }).diff(startOfDay, 'milliseconds');
  const isStartOfSlot = msSinceStartOfDay % (slotMinutes * 60 * 1000) === 0;

  if (!isStartOfSlot) throw new ServiceError({ token: 'INCORRECT_DATE', status: 400 });
};

const getProgram = async (req, { marketingSessionId, programEmail }) => {
  await validators.program(req, { programEmail, marketingSessionId });
  return marketingSessionId
    ? await loadProgramByMarketingSessionId(req, marketingSessionId)
    : await loadProgramForIncomingCommByEmail(req, programEmail, { includeInactive: true });
};

const getPersonIdsFromContactInfo = async (ctx, guestPhone, guestEmail) => {
  const guestContactInfo = selfService.getGuestContactInfo(guestPhone, guestEmail);
  const webInquiryContactInfos = selfService.getWebInquiryContactInfos(guestContactInfo);
  return await getPersonIdFromWebInquiryContactInfos(ctx, webInquiryContactInfos);
};

// match only new lease parties that are not archived
const getExistingPartyForGuest = async (ctx, personIds, propertyId) => {
  const allParties = await loadPartiesByPersonIds(ctx, personIds, partyWfStatesSubset.unarchived);
  const newLeaseParties = (allParties || []).filter(p => p.workflowName === DALTypes.WorkflowName.NEW_LEASE);
  const parties = await getPartiesForComm(ctx, { allParties: newLeaseParties, propertyId });

  return parties.length ? orderBy(parties, ['created_at'], ['desc'])[0] : [];
};

export const getProgramInfo = async (ctx, programIdentifiers) => {
  const { programEmail, marketingSessionId, requestPropertyId } = programIdentifiers;

  let program = await getProgram(ctx, { marketingSessionId, programEmail });

  if (requestPropertyId && program && program.propertyId !== requestPropertyId) {
    const property = await getProperty(ctx, requestPropertyId);
    const { directEmailIdentifier: matchingProgramEmail } = await getProgramInformationForProperty(ctx, property, program);
    const originalProgramEmail = program.directEmailIdentifier;
    program = await getProgram(ctx, { programEmail: matchingProgramEmail });

    logger.trace(`handleWebInquiry program matching. Received program email: ${originalProgramEmail}, matched to: ${matchingProgramEmail}`);
  }

  return program;
};

const updateOrRescheduleAppointment = async (
  req,
  { appointment, requestAppointment, timezone, slotDuration, preferredPartyOwnerId, preferredPartyCollaboratorIds, shouldUpdateUnits },
) => {
  const data = {
    appointment,
    startDate: requestAppointment.startDate,
    slotDuration,
    actionType: DALTypes.SelfServiceAppointmentActions.UPDATE,
    timezone,
    preferredCurrentOwnerId: appointment.userIds[0],
    preferredPartyOwnerId,
    preferredPartyCollaboratorIds,
  };

  if (shouldUpdateUnits) {
    const newInventories = [...appointment.metadata.inventories, requestAppointment.inventoryId];
    data.inventories = [...new Set(newInventories)];
  }
  const { slotNotAvailable } = await updateAppointment(req, data);
  if (slotNotAvailable) throw new ServiceError({ token: 'SLOT_NOT_AVAILABLE', status: 412 });
  return { message: 'Update appointment success', httpStatusCode: 202 };
};

const getPartyMemberForAppointment = (personIds, partyMembers) => partyMembers.find(pm => personIds.some(pId => pId === pm.personId));
const getAppointmentForSameSlot = (appointments, startDate) => appointments.find(pa => pa.metadata.startDate === startDate);
const getAppointmentForSameUnit = (appointments, inventoryId) => inventoryId && appointments.find(pa => pa.metadata.inventories.some(i => i === inventoryId));

const apptForSameSlotAndUnitExists = (appointmentForSameSlot, appointmentForSameUnit) =>
  appointmentForSameSlot && appointmentForSameUnit && appointmentForSameSlot.id === appointmentForSameUnit.id;

const apptForSameSlotAndWithoutUnitExists = (appointmentForSameSlot, appointmentForSameUnit, inventoryId) =>
  appointmentForSameSlot && !appointmentForSameUnit && !inventoryId;

const isDuplicateAppointment = (appointmentForSameSlot, appointmentForSameUnit, inventoryId) =>
  apptForSameSlotAndUnitExists(appointmentForSameSlot, appointmentForSameUnit) ||
  apptForSameSlotAndWithoutUnitExists(appointmentForSameSlot, appointmentForSameUnit, inventoryId);

const getPartyMemberAppointments = async (req, personIds, existingParty) => {
  const partyMember = getPartyMemberForAppointment(personIds, existingParty.partyMembers);
  return await getAllAppointmentsForPartyMember(req, partyMember.id);
};

const rescheduleAppointmentIfPossible = async (req, { personIds, existingParty, requestAppointment, program, slotDuration }) => {
  const appointmentsForPartyMember = await getPartyMemberAppointments(req, personIds, existingParty);

  const { userId: preferredPartyOwnerId, collaborators: preferredPartyCollaboratorIds } = existingParty;
  const appointmentForSameSlot = getAppointmentForSameSlot(appointmentsForPartyMember, requestAppointment.startDate);
  const appointmentForSameUnit = getAppointmentForSameUnit(appointmentsForPartyMember, requestAppointment.inventoryId);

  if (isDuplicateAppointment(appointmentForSameSlot, appointmentForSameUnit, requestAppointment.inventoryId)) {
    throw new ServiceError({ token: 'DUPLICATE_APPOINTMENT', status: 412 });
  }
  const appointment = appointmentForSameSlot || appointmentForSameUnit;
  if (appointment) {
    const shouldUpdateUnits = !!appointmentForSameSlot;
    return await updateOrRescheduleAppointment(req, {
      appointment,
      requestAppointment,
      timezone: program.timezone,
      slotDuration,
      preferredPartyOwnerId,
      preferredPartyCollaboratorIds,
      shouldUpdateUnits,
    });
  }
  return {};
};

const getParams = (validationMessages, enhancedReqBody) =>
  validationMessages.length ? { ...enhancedReqBody, validationMessages: validationMessages.join(' ') } : enhancedReqBody;

const handleRequestAppointment = async (req, { isRequestingAppointment, requestAppointment, program, phone, email }) => {
  const response = { enhancedBody: req.body, isUpdateAppointment: false, result: {} };
  if (!isRequestingAppointment) return response;

  if (requestAppointment.tourType) {
    const propertySettings = await getPropertySettings(req, program.propertyId);
    const tourTypesAvailable = propertySettings.appointment?.tourTypesAvailable;
    if (!tourTypesAvailable.includes(requestAppointment.tourType)) throw new ServiceError({ token: 'INCORRECT_TOUR_TYPE', status: 404 });
  }

  const slotDuration = await getTeamCalendarSlotDuration(req, program.propertyId);
  validateStartDateAsSlotStart(requestAppointment.startDate, slotDuration, program.timezone);

  const personIds = await getPersonIdsFromContactInfo(req, phone, email);
  const existingParty = await getExistingPartyForGuest(req, personIds, program.propertyId);

  if (existingParty) {
    const result = await rescheduleAppointmentIfPossible(req, { personIds, existingParty, requestAppointment, program, slotDuration });
    if (result.httpStatusCode) {
      return {
        ...response,
        isUpdateAppointment: true,
        result,
      };
    }
  }

  const { slotNotAvailable, agent, userCalendarEventId } = await createSelfBookUserCalendarEvent(req, {
    teamId: program.onSiteLeasingTeamId,
    timezone: program.timezone,
    startDate: requestAppointment.startDate,
    slotDuration,
    preferredPartyOwnerId: existingParty && existingParty.userId,
    preferredPartyCollaboratorIds: existingParty && existingParty.collaborators,
  });
  if (slotNotAvailable) throw new ServiceError({ token: 'SLOT_NOT_AVAILABLE', status: 412 });

  response.enhancedBody = {
    ...req.body,
    requestAppointment: {
      ...requestAppointment,
      ownerId: agent,
      userCalendarEventId,
    },
  };
  return response;
};

export const handleWebInquiry = async req => {
  const isRequestingAppointment = !!req.body.requestAppointment;
  const isRequestingQuote = !!req.body.requestQuote;
  logger.trace({ ctx: req, ...req.body, isRequestingAppointment, isRequestingQuote }, 'handleWebInquiry');
  validateReferrer(req);

  if (req.body?.phone) {
    req.body = {
      ...req.body,
      phone: getOnlyDigitsFromPhoneNumber(req.body.phone),
    };
  }

  const {
    phone,
    email,
    teamEmail,
    campaignEmail,
    programEmail: programEmailBody,
    marketingSessionId: marketingSessionIdBody,
    requestAppointment,
    createOnError,
  } = req.body;

  const {
    'x-reva-program-email': programEmailHdr,
    'x-reva-marketing-session-id': marketingSessionIdHdr,
    'x-reva-property-id': requestPropertyIdHdr,
  } = req.headers;

  const programEmail = programEmailHdr || programEmailBody;
  const marketingSessionId = marketingSessionIdHdr || marketingSessionIdBody;
  const requestPropertyId = requestPropertyIdHdr;

  const honeypotTrap = await honeypotTrapCheck(req, req.body, logger);

  if (honeypotTrap) return { httpStatusCode: 200 };

  const programEmailIdentifier = programEmail || campaignEmail || teamEmail;
  const program = await getProgramInfo(req, { programEmail: programEmailIdentifier, marketingSessionId, requestPropertyId });

  const shouldCreateOnError = !(createOnError === 'false' || req.body.createOnError === false);
  await mandatoryValidations(req, program?.timezone, shouldCreateOnError);
  const validationMessages = getAditionalValidations(shouldCreateOnError, phone, email);

  const { isSpam } = await checkForSpamContactInfoWebInquiry(req, { ...req.body, programEmailIdentifier });
  if (isSpam) return { httpStatusCode: 200 };

  if (!isRequestingAppointment && !isRequestingQuote && program?.metadata?.commsForwardingData.forwardingEnabled) {
    await selfService.handleWebInquiryForwarding(req, req.body, program);
    return { httpStatusCode: 202 };
  }

  const response = await handleRequestAppointment(req, { isRequestingAppointment, requestAppointment, program, phone, email });
  if (response.isUpdateAppointment) return response.result;

  const params = getParams(validationMessages, response.enhancedBody);

  await addMessage(req, params, program.directEmailIdentifier);
  return isRequestingAppointment ? { message: 'Scheduled appointment creation.', httpStatusCode: 202 } : { httpStatusCode: 202 };
};

export const getAvailableSlots = async req => {
  const { query, body } = req;
  const { from, noOfDays, campaignEmail: queryCampaignEmail, programEmail: queryProgramEmail, marketingSessionId: queryMarketingSessionId } = query;
  logger.trace({ ctx: req, queryCampaignEmail, queryProgramEmail, from, noOfDays }, 'getAvailableSlots action - input params');

  const { marketingSessionId: bodyMarketingSessionId } = body;

  const {
    'x-reva-program-email': programEmailHdr,
    'x-reva-marketing-session-id': marketingSessionIdHdr,
    'x-reva-property-id': requestPropertyIdHdr,
  } = req.headers;

  validateReferrer(req);

  validators.validDateOrDateTime(from, 'INCORRECT_FROM_DATE');

  const numberOfDays = parseInt(noOfDays, 10);

  if (!numberOfDays || numberOfDays < 1) throw new ServiceError({ token: 'INVALID_NUMBER_OF_DAYS', status: 400 });

  const programEmail = programEmailHdr || queryProgramEmail || queryCampaignEmail;
  const marketingSessionId = marketingSessionIdHdr || bodyMarketingSessionId || queryMarketingSessionId;
  const requestPropertyId = requestPropertyIdHdr;

  const program = await getProgramInfo(req, { programEmail, marketingSessionId, requestPropertyId });

  return await selfService.getSelfServiceAvailableSlots(req, { from, numberOfDays, program });
};

const validateActionType = actionType => {
  if (actionType !== DALTypes.SelfServiceAppointmentActions.UPDATE && actionType !== DALTypes.SelfServiceAppointmentActions.CANCEL) {
    throw new ServiceError({ token: 'INVALID_ACTION_TYPE', status: 400 });
  }
};

export const getAppointmentForSelfService = async req => {
  const { token } = req.params;
  const {
    successful,
    result: { appointmentId, tenantId },
  } = tryDecodeJWTToken(token);

  if (!successful || tenantId !== req.tenantId) throw new ServiceError({ token: 'UNAUTHORIZED', status: 401 });

  logger.trace({ ctx: req, appointmentId }, 'getAppointmentForSelfService action - input params');
  validators.uuid(appointmentId, 'INVALID_APPOINTMENT_ID');
  const appointment = await getAppointmentById(req, appointmentId);
  if (!appointment) throw new ServiceError({ token: 'APPOINTMENT_NOT_FOUND', status: 404 });

  return await selfService.getAppointmentForSelfService(req, appointment);
};

const invalidInformationCheck = (actionType, feedback, startDate) => {
  if (actionType === DALTypes.SelfServiceAppointmentActions.CANCEL && (feedback || startDate)) {
    throw new ServiceError({ token: 'INVALID_INFORMATION_FOR_ACTION', status: 412 });
  }

  const updateParamsMissing = !feedback && !startDate;
  if (actionType === DALTypes.SelfServiceAppointmentActions.UPDATE && updateParamsMissing) {
    throw new ServiceError({ token: 'INVALID_INFORMATION_FOR_ACTION', status: 412 });
  }
};

const invalidActionCheck = ({ appointment, startDate, actionType, feedback }) => {
  if (
    (startDate || actionType === DALTypes.SelfServiceAppointmentActions.CANCEL) &&
    (appointment.state === DALTypes.TaskStates.COMPLETED || appointment.state === DALTypes.TaskStates.CANCELED)
  ) {
    throw new ServiceError({ token: 'APPOINTMENT_COMPLETED_OR_CANCELLED', status: 412 });
  }

  if (appointment.state === DALTypes.TaskStates.ACTIVE && feedback) {
    throw new ServiceError({ token: 'FEEDBACK_NOT_ALLOWED_FOR_ACTIVE_APPOINTMENT', status: 412 });
  }
};

const getValidAppointment = async req => {
  const { token } = req.params;
  const {
    successful,
    result: { appointmentId, tenantId },
  } = tryDecodeJWTToken(token);

  const { actionType, startDate, feedback } = req.body;
  logger.trace({ ctx: req, appointmentId, actionType, startDate, feedback }, 'updateAppointmentFromSelfService action - input params');
  if (!successful || tenantId !== req.tenantId) throw new ServiceError({ token: 'UNAUTHORIZED', status: 401 });

  validators.uuid(appointmentId, 'INVALID_APPOINTMENT_ID');
  validateActionType(actionType);

  const appointment = await getAppointmentById(req, appointmentId);
  if (!appointment) throw new ServiceError({ token: 'APPOINTMENT_NOT_FOUND', status: 404 });

  invalidActionCheck({ appointment, startDate, actionType, feedback });
  invalidInformationCheck(actionType, feedback, startDate);

  if (actionType === DALTypes.SelfServiceAppointmentActions.UPDATE && startDate && appointment.metadata.startDate === startDate) {
    throw new ServiceError({ token: 'NO_CHANGES', status: 412 });
  }

  return appointment;
};

export const updateAppointmentFromSelfService = async req => {
  const appointment = await getValidAppointment(req);

  const { actionType, startDate, feedback } = req.body;

  const { selectedPropertyId: propertyId } = appointment.metadata;
  const { timezone } = await getProperty(req, propertyId);
  const slotDuration = await getTeamCalendarSlotDuration(req, propertyId);
  startDate && validateStartDateAsSlotStart(startDate, slotDuration, timezone);

  const { userId: preferredPartyOwnerId, collaborators: preferredPartyCollaboratorIds } = await loadPartyById(req, appointment.partyId);

  const { slotNotAvailable, updatedAppointment } = await updateAppointment(req, {
    appointment,
    startDate,
    slotDuration,
    actionType,
    feedback,
    timezone,
    preferredCurrentOwnerId: appointment.userIds[0],
    preferredPartyOwnerId,
    preferredPartyCollaboratorIds,
  });
  if (slotNotAvailable) throw new ServiceError({ token: 'SLOT_NOT_AVAILABLE', status: 412 });

  const { propertyTimeZone, id: appointmentId } = appointment;
  const { state, metadata } = updatedAppointment;
  logger.trace({ ctx: req, appointmentId, actionType, startDate }, 'updateAppointmentFromSelfService - done');
  return { propertyTimeZone, startDate: metadata.startDate, endDate: metadata.endDate, state, feedback: metadata.feedback };
};
