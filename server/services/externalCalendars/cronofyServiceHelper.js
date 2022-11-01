/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import flatten from 'lodash/flatten';
import sortBy from 'lodash/sortBy';
import { mapSeries } from 'bluebird';
import { getUserById, updateUser } from '../../dal/usersRepo';
import { getTeamById, updateTeam, getTeamsUsingCalendarAccount } from '../../dal/teamsRepo';
import { getQuotesByPartyId } from '../../dal/quoteRepo';
import { CalendarTargetType } from '../../../common/enums/calendarTypes';
import { getTenantData } from '../../dal/tenantsRepo';
import { fillExternalCalendarEventTemplate } from '../../../common/helpers/render-externalCalendarEvent-tpl';
import config from '../../config';
import { getPersonsByPartyMemberIds } from '../../dal/personRepo';
import { getPartyMembersById } from '../../dal/partyRepo';
import { getCompletedTasksForPartyByCategory } from '../../dal/tasksRepo';
import { partyStatesOrder } from '../../helpers/party';
import { DALTypes } from '../../../common/enums/DALTypes';
import { getPartyById } from '../party';
import { getInventoriesOnHoldByParty, getInventoriesByIds } from '../../dal/inventoryRepo';
import { getLeaseSignatureStatuses, getLeasesThatDoNotMatchStatus } from '../../dal/leaseRepo';
import { getAllScreeningResultsForParty } from '../../../rentapp/server/dal/fadv-submission-repo';
import { sendUrltoShortener } from '../urlShortener';
import { getPartyApplicationByPartyId } from '../../../rentapp/server/dal/party-application-repo';
import { getPersonApplicationsByPartyId } from '../../../rentapp/server/dal/person-application-repo';
import { toMoment } from '../../../common/helpers/moment-utils';
import { getPartyMembersDisplayName } from '../../../common/helpers/party-utils';
import { isSignatureStatusSigned } from '../../../common/helpers/lease';

const OTHER = 'other';
const OTHERS = 'others';
const NOTES = 'Notes';
const PRIMARY_AGENT = 'Primary agent';
const PREVIOUSLY_VISITED = 'Previously visited';
const VISITING = 'Visiting';
const UNITS_QUOTED = 'Units quoted';
const UNITS_HELD = 'Units held';
const SIGNATURE_STATUS = 'Signature status';
const LEASE_CREATED = 'created';
const LEASE_EXECUTED = 'executed';
const APPLICATION_SCREENING_ON_HOLD = 'Application screening on hold.';

import loggerModule from '../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'cronofyServiceHelper' });

// we need to support the scenario when multiple teams are using the same account
const saveTokensForTeams = async (ctx, calendarAccount, tokenData) => {
  const teamsUsingSameAccount = await getTeamsUsingCalendarAccount(ctx, calendarAccount);

  logger.trace({ ctx, calendarAccount, teams: teamsUsingSameAccount.map(t => t.id) }, 'save tokens for teams');

  await mapSeries(teamsUsingSameAccount, async team => {
    logger.trace({ ctx, calendarAccount, teamId: team.id }, 'save tokens for team');
    const externalCalendars = { ...team.externalCalendars, ...tokenData };
    await updateTeam(ctx, team.id, { externalCalendars });
    logger.trace({ ctx, calendarAccount, teamId: team.id }, 'save tokens for team - done');
  });

  logger.trace({ ctx, calendarAccount, teams: teamsUsingSameAccount.map(t => t.id) }, 'save tokens for teams - done');
};

export const saveAccessToken = async (ctx, target, tokenData) => {
  logger.trace({ ctx, target }, 'saving the tokens');

  if (target.type === CalendarTargetType.USER) {
    const { externalCalendars } = await getUserById(ctx, target.id);
    const delta = { ...externalCalendars, ...tokenData };
    await updateUser(ctx, target.id, { externalCalendars: delta });
  } else {
    const {
      externalCalendars: { calendarAccount },
    } = await getTeamById(ctx, target.id);

    await saveTokensForTeams(ctx, calendarAccount, tokenData);
  }
};

export const getExternalCalendarData = async (ctx, target) => {
  const { externalCalendars } = target.type === CalendarTargetType.USER ? await getUserById(ctx, target.id) : await getTeamById(ctx, target.id);
  return externalCalendars;
};

export const getCalendarSummary = async (ctx, appointment) => {
  const { partyMembers: partyMemberIds } = appointment.metadata;
  const persons = await getPartyMembersById(ctx, partyMemberIds);
  const displayNames = getPartyMembersDisplayName(persons);
  return `(${partyMemberIds.length}) ${displayNames}`;
};

export const getExistingCalendar = (calendarNames, calendars) =>
  calendars.find(c => c.calendar_name === calendarNames.primary) ||
  calendars.find(c => c.calendar_name === calendarNames.secondary) ||
  calendars.find(c => c.calendar_name === calendarNames.tertiary);

const getPartyUrl = async (ctx, partyId) => {
  const { name: tenantName } = await getTenantData(ctx);
  return `https://${tenantName}.${config.domain}/party/${partyId}`;
};

const getInventoryNames = async (ctx, inventoriesIds) => (await getInventoriesByIds(ctx, inventoriesIds)).map(i => i.name);

const getPartyMemberNames = async (ctx, partyMemberIds) => (await getPersonsByPartyMemberIds(ctx, partyMemberIds)).map(p => p.preferredName || p.fullName);

const getPartyMembers = partyMembers => {
  const partyMembersLength = partyMembers.length;

  if (partyMembersLength > 1) {
    return partyMembersLength === 2 ? `${partyMembers[0]}, ${partyMembersLength - 1} ${OTHER}` : `${partyMembers[0]}, ${partyMembersLength - 1} ${OTHERS}`;
  }
  return partyMembers[0];
};

const getNotes = note => (note ? `${NOTES}:\n${note}\n\n` : '');

const getPartyOwner = async (ctx, partyOwnerId, appointmentOwnerId) => {
  if (partyOwnerId === appointmentOwnerId) return '';

  const partyOwner = partyOwnerId ? await getUserById(ctx, partyOwnerId) : '';
  return `${PRIMARY_AGENT}:\n${partyOwner.fullName}\n\n`;
};

const getPreviouslyVisitedUnits = async (ctx, party) => {
  const partyState = partyStatesOrder.indexOf(party.state) < partyStatesOrder.indexOf(DALTypes.PartyStateType.APPLICANT);
  if (!partyState) return '';

  const completedAppointments = await getCompletedTasksForPartyByCategory(ctx, party.id, DALTypes.TaskCategories.APPOINTMENT);
  const inventoryIds = flatten(completedAppointments.map(appt => appt.metadata.inventories || ''));
  const inventoryNames = inventoryIds.length ? await getInventoryNames(ctx, inventoryIds) : '';

  return inventoryNames.length ? `${PREVIOUSLY_VISITED}:\n${inventoryNames.join(', ')}\n\n` : '';
};

const getStatusForQuotes = (quotes, responses, personApplications) =>
  quotes.map(q => {
    const response = responses.find(r => q.id === r.quoteId);

    const [lastPersonApplication] = sortBy(personApplications, person => -toMoment(person.created_at));
    const lastApplicantDecision =
      lastPersonApplication && response?.applicantDecision?.find(applicant => applicant.applicantId === lastPersonApplication.applicantId);

    return {
      inventoryId: q.inventoryId,
      status: (lastApplicantDecision && lastApplicantDecision.result) || (response && response.applicationDecision) || '',
    };
  });

const getQuotesToDisplay = async (ctx, party) => {
  const quotes = await getQuotesByPartyId(ctx, party.id);
  const onHoldInventories = (await getInventoriesOnHoldByParty(ctx, party.id)).filter(i => !i.endDate);

  if (onHoldInventories.length) {
    const heldInventoryIds = onHoldInventories.map(inv => inv.inventoryId);
    const heldQuotes = quotes.filter(q => heldInventoryIds.includes(q.inventoryId));
    return { quoteTemplateTitleName: UNITS_HELD, quotes: heldQuotes };
  }
  return { quoteTemplateTitleName: UNITS_QUOTED, quotes };
};

const isEveryPersonsApplicationCompleted = personApplications =>
  personApplications.every(member => member.applicationStatus === DALTypes.PersonApplicationStatus.COMPLETED);

const getQuotedUnits = async (ctx, party) => {
  const partyState = partyStatesOrder.indexOf(party.state) === partyStatesOrder.indexOf(DALTypes.PartyStateType.APPLICANT);
  if (!partyState) return '';

  const { quoteTemplateTitleName, quotes } = await getQuotesToDisplay(ctx, party);
  const applicationScreenings = await getAllScreeningResultsForParty(ctx, party.id);
  const personApplications = await getPersonApplicationsByPartyId(ctx, party.id);

  if (applicationScreenings.length && isEveryPersonsApplicationCompleted(personApplications)) {
    const statusForQuotes = getStatusForQuotes(quotes, applicationScreenings, personApplications);

    const unitsQuoted = await mapSeries(statusForQuotes, async r => {
      const inventoryName = await getInventoryNames(ctx, [r.inventoryId]);
      return `${inventoryName} - ${r.status}`;
    });
    return `${quoteTemplateTitleName}:\n${unitsQuoted.join('\n')}\n\n`;
  }
  const partyApplication = await getPartyApplicationByPartyId(ctx, party.id);
  const partyApplicationScreeningStatus = partyApplication && partyApplication.isHeld ? `${APPLICATION_SCREENING_ON_HOLD}\n\n` : '';

  const inventoryIds = quotes.map(q => q.inventoryId);
  const inventoryNames = await getInventoryNames(ctx, inventoryIds);

  return inventoryNames.length ? `${partyApplicationScreeningStatus}${quoteTemplateTitleName}:\n${inventoryNames.join(', ')}\n\n` : '';
};

const getAppointmentPropertiesNames = async (ctx, inventories) => {
  const inventoryNames = await getInventoryNames(ctx, inventories);
  return inventoryNames.length ? `${VISITING}:\n${inventoryNames.join(', ')}\n\n` : '';
};

const getAdditionalInventoryNames = additionalCharges => {
  const additionalChargesKeys = Object.keys(additionalCharges);
  const additionalInventoryNames = additionalChargesKeys.map(ad => {
    if (Object.values(DALTypes.InventoryType).includes(additionalCharges[ad].quoteSectionName)) return additionalCharges[ad].name;
    return '';
  });
  return additionalInventoryNames.filter(names => !!names);
};

const getLeaseInformation = async (ctx, party) => {
  const [lease] = await getLeasesThatDoNotMatchStatus(ctx, party.id, DALTypes.LeaseStatus.VOIDED);
  // we are interested only in leases having status: DALTypes.LeaseStatus.SUBMITTED, DALTypes.LeaseStatus.EXECUTED
  if (!lease || lease.status === DALTypes.LeaseStatus.DRAFT) return '';

  const {
    baselineData: {
      quote: { leaseTerm, monthlyRate, unitName },
      publishedLease: { additionalCharges },
    },
  } = lease;
  const leaseStatusMessage = lease.status === DALTypes.LeaseStatus.SUBMITTED ? LEASE_CREATED : LEASE_EXECUTED;
  const leaseSignatureStatus = await getLeaseSignatureStatuses(ctx, lease.id);

  const missingSignatures = leaseSignatureStatus.filter(l => l.partyMemberId && !isSignatureStatusSigned(l.status));
  const missingSignaturesMessage = missingSignatures.length !== 0 ? `\n\n${SIGNATURE_STATUS}:\n${missingSignatures.length} signatures missing.` : '';

  const additionalInventoryNames = getAdditionalInventoryNames(additionalCharges);

  return `A ${leaseTerm} lease was ${leaseStatusMessage} at ${monthlyRate}/mo. This lease includes:\n${unitName}\n${additionalInventoryNames.join(
    '\n',
  )}${missingSignaturesMessage}\n\n`;
};

const getShorthenedPartyUrl = async (ctx, partyId) => {
  const partyUrl = await getPartyUrl(ctx, partyId);
  return (await sendUrltoShortener(ctx, [partyUrl]))[0];
};

export const getExternalCalendarEventDescription = async (ctx, appointment) => {
  const {
    metadata: { partyMembers: partyMemberIds, inventories, note },
    partyId,
  } = appointment;
  const partyMemberNames = await getPartyMemberNames(ctx, partyMemberIds);
  const party = await getPartyById(ctx, partyId);

  const templateData = {
    partyMembers: getPartyMembers(partyMemberNames),
    shortenedPartyUrl: await getShorthenedPartyUrl(ctx, partyId),
    inventoryNamesVisiting: await getAppointmentPropertiesNames(ctx, inventories),
    quotedUnits: await getQuotedUnits(ctx, party),
    leaseInformation: await getLeaseInformation(ctx, party),
    note: getNotes(note),
    previouslyVisited: await getPreviouslyVisitedUnits(ctx, party),
    partyOwner: await getPartyOwner(ctx, party.userId, appointment.userIds[0]),
  };
  return await fillExternalCalendarEventTemplate(templateData);
};

export const getRevaUserCalendarNames = () => ({ primary: 'Reva - Appointments', secondary: 'Reva - Tours', tertiary: 'Reva -- Tours' });
export const getRevaTeamCalendarNames = (teamName, calendarName) =>
  calendarName
    ? { primary: calendarName, secondary: calendarName, tertiary: calendarName }
    : { primary: `Reva - ${teamName} Calendar`, secondary: `Reva - ${teamName}`, tertiary: `Reva -- ${teamName}` };
