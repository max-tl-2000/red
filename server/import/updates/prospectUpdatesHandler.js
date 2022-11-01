/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getUUID from 'uuid/v4';
import loggerModule from '../../../common/helpers/logger';
import { DATE_US_FORMAT, YEAR_MONTH_DAY_FORMAT, DATE_ONLY_FORMAT, TIME_MERIDIEM_FORMAT } from '../../../common/date-constants';
import { convertToFloat } from '../../../common/money-formatter';
import { DALTypes } from '../../../common/enums/DALTypes';
import { NUMBER, EMAIL_FROM_PROSPECT } from '../../../common/regex';
import { getPropertyByName } from '../../dal/propertyRepo';
import { getUserAndTeamsForProspectImport } from '../../dal/usersRepo';
import { getSourceAndTeamPropertyProgramId } from '../../dal/sourcesRepo';
import { createPerson, updatePerson } from '../../dal/personRepo';
import { createParty } from '../../services/party';
import { addCommunication } from '../../services/communication';
import { enhanceContactInfoWithSmsInfo } from '../../services/telephony/twilio';
import { formatPhoneNumberForDb } from '../../helpers/phoneUtils';

import {
  createPartyMember,
  getPartyMemberByEmailAddress,
  getPartyMemberByPersonId,
  updateParty,
  updatePartyMember,
  getPrimaryTenantByExternalIds,
  getPartyMemberByPartyAndExternalIds,
  getPartyMemberByPartyAndEmail,
} from '../../dal/partyRepo';
import { loadAppointmentsForUserAndDays } from '../../dal/appointmentRepo';
import { saveAppointment } from '../../services/appointments';

import { enhance } from '../../../common/helpers/contactInfoUtils';
import { getRankedUnits } from '../../dal/searchRepo';
import { formatMoment, now, toMoment, parseAsInTimezone } from '../../../common/helpers/moment-utils';
import { execConcurrent } from '../../../common/helpers/exec-concurrent';
import { getPropertyByNameIndex, getRowsProperties } from './updatesHelper';
import { propertyHeaderMapping } from './propertyHeaderMapping';
import { getPropertyTimezone } from '../../services/properties';
import { getActiveExternalInfo, insertExternalInfo, updateExternalInfo } from '../../dal/exportRepo';
import { DIFF_ACTION_TAG, getDifferences, mapDifferences, mapEntity } from './daff-helpers';
import { getMoveInTimeQuestionFromDate } from '../../../common/helpers/filters';
import { existsEmailContactInfo } from '../../dal/contactInfoRepo';

const logger = loggerModule.child({ subType: 'prospectsUpdatesHandler' });

const mapValues = (key, value, timezone) => {
  let parsedValue;
  switch (key) {
    case 'firstContactedOn':
    case 'moveInDate':
      parsedValue = value ? parseAsInTimezone(value, { format: DATE_US_FORMAT, timezone }) : undefined;
      break;
    case 'dateShow':
      parsedValue = value ? parseAsInTimezone(value, { format: DATE_US_FORMAT, timezone }) : undefined;
      break;
    case 'marketRent':
      parsedValue = value ? convertToFloat(value) : undefined;
      break;
    case 'numBedrooms':
      parsedValue = value ? parseInt(value, 10) : undefined;
      break;
    default:
      parsedValue = value;
      break;
  }
  return [key, parsedValue];
};

const isProspectValid = (data = {}) => !!data.state;

const reduceDiffHandler = (ctx, { headers, action = DIFF_ACTION_TAG.insert, properties, propertyNameIndex } = {}) => (acc, row) => {
  switch (action) {
    case DIFF_ACTION_TAG.update:
    case DIFF_ACTION_TAG.insert: {
      const { timezone = '' } = getPropertyByNameIndex(ctx, { headers, headerName: 'property', propertyNameIndex, properties, row });
      const data = mapEntity(headers, row, (key, value) => mapValues(key, value, timezone));
      if (isProspectValid(data)) acc.push(data);
      break;
    }
    default:
      break;
  }
  return acc;
};

const getUpdatedProspects = async (ctx, actual, previous, headers, entityType) => {
  logger.debug({ ctx, rows: actual && actual.length }, 'prospect updates');

  const propertyHeaderName = propertyHeaderMapping[entityType];
  const propertyNameIndex = headers.indexOf(propertyHeaderName);

  let properties;

  if (!previous || !previous.length) {
    properties = await getRowsProperties(ctx, { entityType, rows: actual, propertyNameIndex });
    return actual.reduce(reduceDiffHandler(ctx, { headers, propertyNameIndex, properties }), []);
  }

  const diff = getDifferences(headers, previous, actual);
  logger.debug({ diff }, 'prospect updates - diff');
  if (!(diff && diff.data && diff.data.length)) return [];

  properties = await getRowsProperties(ctx, { entityType, rows: diff.data, propertyNameIndex: propertyNameIndex + 1 });

  return mapDifferences(diff.data, action => reduceDiffHandler(ctx, { headers, action, propertyNameIndex, properties }));
};

const getFirstContactChannel = contactType => {
  switch (contactType.toLowerCase()) {
    case DALTypes.ContactEventTypes.CALL.toLowerCase():
      return DALTypes.ContactEventTypes.CALL;
    case DALTypes.ContactEventTypes.EMAIL.toLowerCase():
      return DALTypes.ContactEventTypes.EMAIL;
    case DALTypes.ContactEventTypes.WALKIN.toLowerCase():
      return DALTypes.ContactEventTypes.WALKIN;
    case DALTypes.ContactEventTypes.WEB.toLowerCase():
      return DALTypes.ContactEventTypes.WEB;
    default:
      return DALTypes.ContactEventTypes.OTHER;
  }
};

const getFirstContactedDate = (firstContactedOn, timezone) => {
  const firstContactedDate = firstContactedOn || now({ timezone }).startOf('day');
  return toMoment(firstContactedDate, { timezone });
};

export const parsePersonFromProspect = ({ fullName, preferredName, email, homePhone, officePhone, cellPhone, fax }) => {
  const person = {
    fullName,
    preferredName,
    contactInfo: [],
  };

  const phoneSet = new Set([cellPhone, homePhone, officePhone, fax].filter(phone => NUMBER.test(phone)).map(phone => phone.trim()));
  const phones = Array.from(phoneSet);
  if (phones.length) {
    person.contactInfo.push(
      ...phones.map(phone => ({
        type: DALTypes.ContactInfoType.PHONE,
        value: formatPhoneNumberForDb(phone.toLowerCase()),
      })),
    );
  }

  if (email && EMAIL_FROM_PROSPECT.test(email)) {
    person.contactInfo.push({
      type: DALTypes.ContactInfoType.EMAIL,
      value: email.toLowerCase(),
    });
  }

  return person;
};

const parsePartyMemberFromProspect = (prospect, timezone, isPrimary = false) => {
  const person = parsePersonFromProspect(prospect);
  return {
    ...person,
    isPrimary,
    memberType: DALTypes.MemberType.RESIDENT,
    memberState: prospect.state,
    prospectCode: prospect.prospectCode,
    startDate: getFirstContactedDate(prospect.firstContactedOn, timezone),
    externalInfo: {
      externalId: prospect.externalId || null,
      prospectId: prospect.prospectId || null,
      roommateId: prospect.roommateId || null,
    },
  };
};

const isMoreRecentContactInfo = (prospect1, prospect2) => {
  if (!prospect1.firstContactedOn) return true;
  if (!prospect2.firstContactedOn) return false;

  return toMoment(prospect1.firstContactedOn).isAfter(prospect2.firstContactedOn);
};

const getIndexToExclude = (prospects, i, j) => {
  if (prospects[i].fullName === prospects[j].fullName) {
    return isMoreRecentContactInfo(prospects[i], prospects[j]) ? i : j;
  }

  return j;
};

const hasSameEmail = (source, target) => {
  if (!source || !target) return false;
  const emailRegexp = new RegExp(`^${source}$`, 'i');
  return emailRegexp.test(target);
};

const isAssociatedWithPrimaryTenant = (parentCode, prospectId) => parentCode && parentCode === prospectId;

// only remove collisions at primary tenant level at least you pass the checkAll flag
const checkForContactInfoCollision = (ctx, prospects, { checkAll = false, thirdPartySystem } = {}) => {
  for (let i = prospects.length - 1; i >= 0; i--) {
    const primaryTenant = prospects[i] || {};
    if (!checkAll && primaryTenant.member) continue; // eslint-disable-line
    for (let j = i - 1; j >= 0; j--) {
      const prospect = prospects[j] || {};
      if (!checkAll && isAssociatedWithPrimaryTenant(prospect.member, thirdPartySystem === DALTypes.BackendMode.YARDI ? primaryTenant.prospectId : primaryTenant.externalId)) continue; // eslint-disable-line

      if (hasSameEmail(primaryTenant.email, prospect.email) && prospect.property === primaryTenant.property) {
        const prospectToExclude = prospects.splice(getIndexToExclude(prospects, i, j), 1);
        i--;
        logger.debug({ tenantId: ctx.tenantId, prospectToExclude }, 'Excluding repeated prospect');
      }
    }
  }
  return prospects;
};

// The first call is for the primary tenant and the second call to parsePartyMemberFromProspect add the roommates
const getPartyMembersFromProspect = (prospect, timezone) => {
  const members = [parsePartyMemberFromProspect(prospect, timezone, true)];
  return members.concat(prospect.partyMembers.map(pm => parsePartyMemberFromProspect(pm, timezone)));
};

const parseContactEventProspect = prospect => {
  const { dateApplied, prospectCode } = prospect;
  return dateApplied ? { dateApplied, prospectCode } : undefined;
};

const parseOtherContactEventProspect = prospect => {
  const { prospectCode, firstContactedOn, numBedrooms, marketRent, moveInDate } = prospect;
  return firstContactedOn ? { prospectCode, firstContactedOn, numBedrooms, marketRent, moveInDate } : undefined;
};

const getContactEventFromProspect = prospect => {
  const contactEvents = [parseContactEventProspect(prospect), parseOtherContactEventProspect(prospect)]
    .concat(prospect.partyMembers.map(parseContactEventProspect))
    .concat(prospect.partyMembers.map(parseOtherContactEventProspect));
  return contactEvents.filter(event => event);
};

const parseAppointmentProspect = (prospect, timezone) => {
  const { dateShow, showAgent, prospectCode } = prospect;
  return dateShow && dateShow < now({ timezone }) ? { dateShow, showAgent, prospectCode } : undefined;
};

const getAppointmentsFromProspect = (prospect, timezone) => {
  const appointments = [parseAppointmentProspect(prospect, timezone)].concat(prospect.partyMembers.map(pm => parseAppointmentProspect(pm, timezone)));
  return appointments.filter(appointment => appointment);
};

const getUserAndTeams = async (ctx, agent, propertyId) => {
  const { userId, teamIds } = (await getUserAndTeamsForProspectImport(ctx, agent, propertyId)) || {};

  return {
    userId,
    teams: teamIds,
    ownerTeam: teamIds && teamIds.length ? teamIds[0] : undefined,
  };
};

const getNumberOfBeds = numBedrooms => {
  if (!numBedrooms || numBedrooms <= 0) return [];
  if (numBedrooms === 1) return ['ONE_BED'];
  if (numBedrooms === 2) return ['TWO_BEDS'];
  if (numBedrooms === 3) return ['THREE_BEDS'];
  return ['FOUR_PLUS_BEDS'];
};

const sortNumber = (a, b) => a - b;

const getPriceRange = units => {
  const rentValues = units.map(unit => unit.inventoryObject.marketRent);
  const sortedPrices = Array.from(new Set(rentValues))
    .filter(number => number)
    .sort(sortNumber);
  if (sortedPrices.length < 2) {
    return { isValid: false };
  }
  return {
    isValid: true,
    min: parseFloat(sortedPrices[0]),
    max: parseFloat(sortedPrices[sortedPrices.length - 1]),
  };
};

const getRentRange = async (ctx, { numBedrooms, rent, userId, moveInDate, prospectCode, timezone, propertyId }) => {
  const filters = {
    numBedrooms: getNumberOfBeds(numBedrooms),
    highValueAmenities: [],
    marketRent: {},
    surfaceArea: { min: null, max: null },
    floor: [],
    moveInDate: {
      min: (moveInDate && toMoment(moveInDate, { timezone }).toJSON()) || '',
      max: '',
    },
    propertyIds: [propertyId],
    withoutLimit: true,
  };
  const units = await getRankedUnits(ctx, filters, userId);
  const range = getPriceRange(units);

  logger.debug({ ctx, rent, range, prospectCode }, 'getting rent range');
  const result = { min: null, max: null };

  if (range.isValid && rent > range.min && rent < range.max) {
    const newMax = rent + 500;
    result.min = range.min;
    result.max = newMax < range.max ? newMax : rent;
  }

  return result;
};

const getPartyMetadata = (prospect, timezone) => ({
  firstContactChannel: getFirstContactChannel(prospect.firstContactType),
  firstContactedDate: getFirstContactedDate(prospect.firstContactedOn, timezone),
  creationType: DALTypes.PartyCreationTypes.IMPORT,
});

const getQualificationQuestions = (prospect, timezone) => {
  const numBedrooms = getNumberOfBeds(prospect.numBedrooms);
  if (!numBedrooms.length && !prospect.moveInDate) return {};

  return {
    numBedrooms,
    moveInTime: getMoveInTimeQuestionFromDate(prospect.moveInDate, { timezone, defaultAnswer: DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS }),
    groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
    cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.UNKNOWN,
  };
};

const getPartyFromProspect = async (ctx, prospect) => {
  const { state, agent, property: propertyName, numBedrooms, moveInDate, marketRent: rent, prospectCode } = prospect;
  const property = (propertyName && (await getPropertyByName(ctx, propertyName))) || {};
  if (!property || !property.id) return {};
  const { userId, teams, ownerTeam } = await getUserAndTeams(ctx, agent, property.id);
  if (!userId) return {};

  const { timezone } = property;

  const marketRent = await getRentRange(ctx, {
    numBedrooms,
    rent,
    userId,
    moveInDate,
    prospectCode,
    timezone,
    propertyId: property.id,
  });

  return {
    timezone,
    state,
    assignedPropertyId: property.id,
    userId,
    teams,
    ownerTeam,
    storedUnitsFilters: {
      numBedrooms: getNumberOfBeds(numBedrooms),
      moveInDate: {
        min: (moveInDate && toMoment(moveInDate, { timezone }).format(YEAR_MONTH_DAY_FORMAT)) || '',
        max: '',
      },
      marketRent,
    },
    qualificationQuestions: getQualificationQuestions(prospect, timezone),
    startDate: getFirstContactedDate(prospect.firstContactedOn, timezone),
    metadata: getPartyMetadata(prospect, timezone),
    partyMembers: getPartyMembersFromProspect(prospect, timezone),
    contactEvents: getContactEventFromProspect(prospect),
    appointments: getAppointmentsFromProspect(prospect, timezone),
  };
};

const getPartyMemberByPersonIdOrEmailAddress = async (ctx, personId, contactInfo) => {
  if (personId) return await getPartyMemberByPersonId(ctx, personId);

  return contactInfo.defaultEmail && (await getPartyMemberByEmailAddress(ctx, contactInfo.defaultEmail));
};

const addSuffixToEmails = conactInfos =>
  conactInfos.map(it => {
    if (it.type !== DALTypes.ContactInfoType.EMAIL) return it;

    return {
      ...it,
      value: `${it.value}.dup`,
    };
  });

const isEmailAssociatedToResidents = (conactInfos, email) => conactInfos.some(it => it.type === DALTypes.ContactInfoType.EMAIL && it.value === email);

const handleUpdatePerson = async (ctx, prospect, personId, wasFoundByEmail) => {
  let contactInfo = enhance(prospect.contactInfo);
  contactInfo.all = await enhanceContactInfoWithSmsInfo(ctx, contactInfo.all);
  const partyMember = await getPartyMemberByPersonIdOrEmailAddress(ctx, personId, contactInfo);
  const { fullName, preferredName } = prospect;
  const delta = { fullName, preferredName, contactInfo };
  if (partyMember && partyMember.id) {
    const shouldAppendSuffix = !personId || wasFoundByEmail;
    const hasSameFullName = prospect.fullName.toLowerCase() === partyMember.fullName.toLowerCase();
    if (shouldAppendSuffix && !hasSameFullName) {
      delta.contactInfo = enhance(addSuffixToEmails(contactInfo.all));
    } else {
      const hasADupEmail = !hasSameFullName && isEmailAssociatedToResidents(partyMember.contactInfo.all, `${contactInfo.defaultEmail}.dup`);
      if (
        hasADupEmail ||
        (!isEmailAssociatedToResidents(partyMember.contactInfo.all, contactInfo.defaultEmail) && (await existsEmailContactInfo(ctx, contactInfo.defaultEmail)))
      ) {
        contactInfo = enhance(addSuffixToEmails(contactInfo.all));
      }
      if (prospect.fullName.toLowerCase() !== partyMember.fullName.toLowerCase()) {
        logger.error(
          {
            ctx,
            currentName: partyMember.fullName,
            prospectName: prospect.fullName,
          },
          'Error the incoming person name is different to the current name',
        );
      }

      const newContactInfo = contactInfo.all.filter(
        contact => !partyMember.contactInfo.all.some(ci => ci.type === contact.type && ci.value.toLowerCase() === contact.value.toLowerCase()),
      );

      const person = { ...delta, contactInfo: enhance(partyMember.contactInfo.all.concat(newContactInfo)) };
      await updatePerson(ctx, partyMember.personId, person);
      return partyMember.personId;
    }
  }

  const person = await createPerson(ctx, delta, true);
  return person.id;
};

const existsPartyMember = (primaryTenantInfo, memberInfo) => {
  const { externalId, externalProspectId } = primaryTenantInfo;

  return externalId === memberInfo.externalId || externalProspectId === memberInfo.prospectId;
};

const getExistingPartyMember = async (ctx, member, partyId, primaryTenant, external) => {
  if (primaryTenant) {
    const primaryTenantInfo = (await getActiveExternalInfo(ctx, primaryTenant.id)) || {};

    if (primaryTenant.partyId === partyId && existsPartyMember(primaryTenantInfo, external)) {
      return { partyMember: primaryTenant };
    }
  }

  let partyMember =
    (external.externalId || external.roommateId) &&
    (await getPartyMemberByPartyAndExternalIds(ctx, partyId, external.externalId || '', external.roommateId || ''));
  if (partyMember) return { partyMember };

  const { defaultEmail } = enhance(member.contactInfo);
  partyMember = defaultEmail && (await getPartyMemberByPartyAndEmail(ctx, partyId, defaultEmail));
  return { wasFoundByEmail: !!partyMember, partyMember };
};

const handleUpdatePartyMember = async (ctx, member, partyId, primaryTenant, isNewParty, external, propertyId) => {
  const { contactInfo, isPrimary, ...delta } = member;

  let { wasFoundByEmail = false, partyMember = {} } = (!isNewParty && (await getExistingPartyMember(ctx, member, partyId, primaryTenant, external))) || {};
  const personId = await handleUpdatePerson(ctx, member, partyMember.personId, wasFoundByEmail);

  if (!(partyMember && partyMember.id)) {
    partyMember = await createPartyMember(ctx, { ...delta, personId }, partyId);

    await insertExternalInfo(ctx, {
      id: getUUID(),
      partyId,
      isPrimary,
      propertyId,
      partyMemberId: partyMember.id,
      externalId: external.externalId,
      externalProspectId: external.prospectId,
      externalRoommateId: external.roommateId,
    });
  } else {
    partyMember = await updatePartyMember(ctx, partyMember.id, {
      ...partyMember,
      ...delta,
    });

    const externalInfo = await getActiveExternalInfo(ctx, partyMember.id);
    await updateExternalInfo(ctx, {
      id: externalInfo.id,
      partyId,
      isPrimary,
      propertyId,
      partyMemberId: partyMember.id,
      externalId: external.externalId,
      externalProspectId: external.prospectId,
      externalRoommateId: external.roommateId,
    });
  }

  return partyMember;
};

const createCommunicationRequest = async ({
  tenantId,
  userId,
  partyId,
  personId,
  text,
  date,
  time,
  contactEventType = DALTypes.ContactEventTypes.OTHER,
  names,
  source,
  timezone,
}) => {
  const message = {
    text,
    type: contactEventType,
    eventDateTime: parseAsInTimezone(`${date} ${time}`, { format: `${YEAR_MONTH_DAY_FORMAT} ${TIME_MERIDIEM_FORMAT}`, timezone }),
  };
  source && source.name && Object.assign(message, { programData: { source: source.name } });
  return {
    body: {
      type: DALTypes.CommunicationMessageType.CONTACTEVENT,
      recipients: [personId],
      partyId,
      message,
      contactEventType,
      names,
    },
    tenantId,
    authUser: {
      id: userId,
    },
  };
};

const handleUpdateContactEvent = async ({
  tenantId,
  userId,
  partyId,
  personId,
  dateApplied,
  names,
  prospectCode,
  firstContactedOn,
  numBedrooms,
  marketRent,
  moveInDate,
  source,
  timezone,
  thirdPartySystem,
}) => {
  const contactEventData = {
    tenantId,
    userId,
    partyId,
    personId,
    names,
    source,
    timezone,
  };
  const thirdParty = `${thirdPartySystem.charAt(0).toUpperCase()}${thirdPartySystem.slice(1).toLowerCase()}`;
  if (dateApplied) {
    const text = `Applied in ${thirdParty} on\n${dateApplied}\n\nReference:\n${prospectCode}`;
    const time = '09:00 am';
    const contactEventRequest = await createCommunicationRequest({
      ...contactEventData,
      text,
      time,
      date: formatMoment(dateApplied, { format: YEAR_MONTH_DAY_FORMAT }),
    });
    await addCommunication(contactEventRequest);
  }
  if (firstContactedOn) {
    // MRI: let text = `Preferences set from MRI:\nBeds:${numBedrooms}\n\nPreferred move-in:\n${formatMoment(moveInDate, {
    const renderSection = (key, value, brakeLine = true) => value && `${key}:${brakeLine ? '\n' : ''}${value}`;
    const sections = [
      `Preferences set from ${thirdParty}:`,
      renderSection('Beds', numBedrooms, false),
      renderSection('\nPrice', marketRent),
      renderSection(
        '\nPreferred move-in',
        formatMoment(moveInDate, {
          format: DATE_US_FORMAT,
        }),
      ),
      renderSection('\nSource', (source || {}).displayName),
    ];
    const text = sections.filter(it => it).join('\n');
    const time = '09:30 am';
    const contactEventType = DALTypes.ContactEventTypes.OTHER;
    const otherContactEventRequest = await createCommunicationRequest({
      ...contactEventData,
      text,
      time,
      contactEventType,
      date: formatMoment(firstContactedOn, { format: YEAR_MONTH_DAY_FORMAT }),
    });
    await addCommunication(otherContactEventRequest);
  }
};

const getAvailableTimeSlot = (appointments, date, proposedStartTime, proposedEndTime, timezone) => {
  // moment instances here have already the timezone applied
  if (proposedEndTime.isAfter(date.endOf('day'))) return undefined;
  const notAvailable = appointments.some(appointment => {
    const { startDate, endDate } = appointment.metadata || {};
    const startDateFormatted = toMoment(startDate, { timezone });
    const endDateFormatted = toMoment(endDate, { timezone });
    return (
      proposedStartTime.isBetween(startDateFormatted, endDateFormatted, null, '[)') ||
      proposedEndTime.isBetween(startDateFormatted, endDateFormatted, null, '(]')
    );
  });
  if (notAvailable) {
    return getAvailableTimeSlot(appointments, date, toMoment(proposedEndTime, { timezone }), toMoment(proposedEndTime, { timezone }).add({ m: 30 }), timezone);
  }
  return { startDate: proposedStartTime, endDate: proposedEndTime };
};

const handleUpdateAppointment = async (ctx, { userId, partyId, partyMemberId, teams, dateShow }, timezone) => {
  logger.debug({ ctx, userId, partyId, partyMemberId, teams, dateShow }, 'handle update appointment');

  const formattedDay = toMoment(dateShow, { timezone }).format(DATE_ONLY_FORMAT);
  const appointments = await loadAppointmentsForUserAndDays(ctx, [userId], [formattedDay], { timezone });
  const proposedStartTime = toMoment(dateShow, { timezone }).add({ h: 9 });
  const proposedEndTime = toMoment(dateShow, { timezone }).add({
    h: 9,
    m: 30,
  });
  const { startDate, endDate } = getAvailableTimeSlot(appointments, dateShow, proposedStartTime, proposedEndTime, timezone) || {};
  if (!startDate) {
    logger.trace({ ctx, userId, partyId, partyMemberId, teams, dateShow }, 'timeslot not available');
  }

  const teamId = teams[0].id;

  const appointment = {
    partyId,
    salesPersonId: userId,
    state: DALTypes.TaskStates.COMPLETED,
    note: 'This appointment was backfilled by Reva admin using data export. The time selection may not be accurate.',
    startDate,
    endDate,
    partyMembers: [partyMemberId],
    tourType: DALTypes.TourTypes.IMPORTED_TOUR,
    teamId,
  };
  const appointmentRecord = await saveAppointment(ctx, appointment);
  logger.info({ appointmentRecord }, 'appointment saved');
};

const errorHandler = (message, object) => err => logger.error({ err, ...object }, message);

const handleAdditionalUpdates = async (
  ctx,
  { savedParty, partyMembersFromProspect, contactEvents = [], appointments = [], source = null, thirdPartySystem },
) => {
  const { id: partyId, userId, assignedPropertyId, teams } = savedParty;

  const prospectsWithPartyMember = partyMembersFromProspect
    .filter(item => item.partyMember)
    .map(item => ({
      partyMemberId: item.partyMember.id,
      prospectCode: item.prospectCode,
      personId: item.partyMember.personId,
      fullName: item.partyMember.fullName,
    }));

  const contactEventList = contactEvents
    .map(contactEvent => {
      const matchedPartyMember = prospectsWithPartyMember.find(prospect => prospect.prospectCode === contactEvent.prospectCode) || {};
      return {
        ...contactEvent,
        source,
        partyId,
        personId: matchedPartyMember.personId,
        names: matchedPartyMember.fullName,
      };
    })
    .filter(contactEvent => contactEvent.personId);

  const appointmentPromises = await execConcurrent(appointments, async appointment => {
    const matchedPartyMember = prospectsWithPartyMember.find(prospect => prospect.prospectCode === appointment.prospectCode) || {};
    const userAndTeams = appointment.showAgent ? await getUserAndTeams(ctx, appointment.showAgent, assignedPropertyId) : { userId, teams };

    return {
      partyId,
      partyMemberId: matchedPartyMember.partyMemberId,
      userId: userAndTeams.userId,
      teams: userAndTeams.teams,
      ...appointment,
    };
  });

  const appointmentList = appointmentPromises.filter(appointment => appointment.partyMemberId);
  const timezone = await getPropertyTimezone(ctx, assignedPropertyId);

  for (const contactEvent of contactEventList) {
    await handleUpdateContactEvent({ tenantId: ctx.tenantId, ...contactEvent, userId, timezone, thirdPartySystem }).catch(
      errorHandler('Error saving contactEvent', contactEvent),
    );
  }
  for (const appointment of appointmentList) {
    await handleUpdateAppointment(ctx, appointment, timezone).catch(errorHandler('Error saving contactEvent', appointment));
  }
};

// TODO: make this transactional.
const handleUpdateParty = async (ctx, prospect, thirdPartySystem) => {
  const party = await getPartyFromProspect(ctx, prospect);
  if (!party.assignedPropertyId) {
    logger.info({ ctx, party }, 'Missing primary property');
    return;
  }
  if (!party.userId) {
    logger.info({ ctx, party }, 'Missing user');
    return;
  }

  const hasExternalIds = prospect.externalId || prospect.prospectId;
  const { creationType, ...primaryTenant } =
    (hasExternalIds && (await getPrimaryTenantByExternalIds(ctx, prospect.externalId || '', prospect.prospectId || ''))) || {};
  if (primaryTenant && primaryTenant.partyId && creationType !== DALTypes.PartyCreationTypes.IMPORT) {
    logger.info({ ctx, party, creationType }, 'Skiping the record due to already exist in Reva and was not created during import');
    return;
  }
  let { partyId } = primaryTenant;
  const { partyMembers, contactEvents, appointments, metadata, timezone, ...delta } = party;

  const source =
    prospect.source &&
    (await getSourceAndTeamPropertyProgramId(ctx, { sourceName: prospect.source, propertyId: party.assignedPropertyId, teamId: party.ownerTeam }));

  let savedParty;
  const isNewParty = !partyId;
  source && source.sourceName && Object.assign(metadata, { source: source.sourceName });

  if (isNewParty) {
    savedParty = await createParty(
      { ...ctx, authUser: {} },
      {
        ...delta,
        teamPropertyProgramId: source && source.teamPropertyProgramId,
        metadata,
      },
    );
    partyId = savedParty.id;
  } else {
    savedParty = await updateParty(ctx, {
      id: partyId,
      ...delta,
      teamPropertyProgramId: source && source.teamPropertyProgramId,
      metadata,
    });
  }

  const savedPartyMembers = [];

  for (const member of party.partyMembers) {
    const { externalInfo, ...restMember } = member;
    const partyMember = await handleUpdatePartyMember(
      ctx,
      restMember,
      partyId,
      member.isPrimary ? primaryTenant : null,
      isNewParty,
      externalInfo,
      party.assignedPropertyId,
    ).catch(errorHandler('Error saving prospect party member', member));
    if (partyMember) {
      member.partyMember = partyMember;
      savedPartyMembers.push(partyMember);
    }
  }

  await handleAdditionalUpdates(ctx, {
    savedParty,
    savedPartyMembers,
    partyMembersFromProspect: partyMembers,
    contactEvents,
    appointments,
    source,
    thirdPartySystem,
  });
};

const getRoommates = (ctx, primaryTenant, members, thirdPartySystem) => {
  const roommates = members
    .filter(pm => pm.member === (thirdPartySystem === DALTypes.BackendMode.YARDI ? primaryTenant.prospectId : primaryTenant.externalId))
    .map(pm => ({
      ...pm,
      email: !hasSameEmail(primaryTenant.email, pm.email) ? pm.email : '',
    }));

  if (roommates.filter(r => r.email).length <= 1) return roommates;

  const uniqueRoommatesByEmail = checkForContactInfoCollision(ctx, [...roommates], { checkAll: true, thirdPartySystem });
  if (uniqueRoommatesByEmail.length === roommates.length) return uniqueRoommatesByEmail;

  const roommatesWithEmptyEmail = roommates
    .filter(
      r =>
        r.email &&
        uniqueRoommatesByEmail.some(ur => {
          if (!hasSameEmail(ur.email, r.email)) return false;
          return thirdPartySystem === DALTypes.BackendMode.YARDI ? ur.roommateId !== r.roommateId : ur.externalId !== r.externalId;
        }),
    )
    .map(pm => ({ ...pm, email: '' }));
  return uniqueRoommatesByEmail.concat(roommatesWithEmptyEmail);
};

export const prospectUpdates = async (ctx, actual, previous, headers, entityType, thirdPartySystem = DALTypes.BackendMode.NONE) => {
  let prospects = await getUpdatedProspects(ctx, actual, previous, headers, entityType);
  logger.debug({ ctx, rows: prospects && prospects.length }, 'updated prospects');

  if (!(prospects && prospects.length)) return;

  prospects = checkForContactInfoCollision(ctx, prospects, { thirdPartySystem });
  const prospectMembers = prospects.filter(prospect => prospect.member);
  const prospectParties = prospects.filter(prospect => !prospect.member);
  logger.debug(
    {
      ctx,
      rows: prospects && prospects.length,
      prospectMemberRows: prospectMembers && prospectMembers.length,
      prospectPartyRows: prospectParties && prospectParties.length,
    },
    'prospects after collision detection',
  );
  const parties = prospectParties.map(prospect => ({
    ...prospect,
    partyMembers: getRoommates(ctx, prospect, prospectMembers, thirdPartySystem),
  }));

  logger.debug({ ctx, rows: parties.length }, 'primary tenants to process');
  logger.debug(
    {
      ctx,
      membersWithParentCode: prospectMembers.length,
      partiesWithMembers: parties.filter(party => party.partyMembers.length).length,
    },
    'party members to process',
  );

  for (const party of parties) {
    await handleUpdateParty(ctx, party, thirdPartySystem).catch(errorHandler('Error saving prospect party', party));
  }
};
