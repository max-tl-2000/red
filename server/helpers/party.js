/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import omit from 'lodash/omit';
import get from 'lodash/get';
import uniq from 'lodash/uniq';
import { t } from 'i18next';
import { getPropertyById } from '../dal/propertyRepo';
import { getTeamProperties } from '../dal/teamsRepo';
import logger from '../../common/helpers/logger';
import { execConcurrent } from '../../common/helpers/exec-concurrent';
import { loadPartyAgent, loadParty, loadPartyMembers } from '../dal/partyRepo';
import { getUserTeams, loadUserById } from '../services/users';
import { getQuoteById } from '../dal/quoteRepo';
import { getDisclosureById } from '../dal/disclosureRepo';
import { getPersonById } from '../dal/personRepo';
import { getFeeById } from '../dal/feeRepo';
import { getPartyApplicationByPartyId } from '../../rentapp/server/services/party-application';
import { getApplicationInvoicesByFilter } from '../../rentapp/server/services/application-invoices';
import { getTenantData } from '../dal/tenantsRepo';
import { getUnitsByIds } from '../dal/inventoryRepo';
import { DALTypes } from '../../common/enums/DALTypes';
import { getOutProgramByTeamAndProperty } from '../dal/programsRepo';
import { getTenant } from '../services/tenantService';
import config from '../config';
import { loadPartyById } from '../services/party';
import { notify } from '../../common/server/notificationClient';
import EventTypes from '../../common/enums/eventTypes';
import { getApplicantName } from '../../common/helpers/applicants-utils';

const MEMBER_NAMES_MAX_LENGTH = 60; // limited to 60 chars - CPM-20296

// THE ORDER HERE IS IMPORTANT!!!!!!!
export const partyStatesOrder = [
  DALTypes.PartyStateType.CONTACT,
  DALTypes.PartyStateType.LEAD,
  DALTypes.PartyStateType.PROSPECT,
  DALTypes.PartyStateType.APPLICANT,
  DALTypes.PartyStateType.LEASE,
  DALTypes.PartyStateType.FUTURERESIDENT,
  DALTypes.PartyStateType.MOVINGOUT,
  DALTypes.PartyStateType.RESIDENT,
];

export const partyWorkFlowNameOrder = [DALTypes.WorkflowName.NEW_LEASE, DALTypes.WorkflowName.ACTIVE_LEASE, DALTypes.WorkflowName.RENEWAL];

export const shouldExcludePartyWhenProcessingIncomingComm = p => p.workflowState === DALTypes.WorkflowState.ARCHIVED;

export const partyCloseReasonsToExcludeForNewLead = [
  DALTypes.ClosePartyReasons.MARKED_AS_SPAM,
  DALTypes.ClosePartyReasons.REVA_TESTING,
  DALTypes.ClosePartyReasons.NO_MEMBERS,
  DALTypes.ClosePartyReasons.CLOSED_DURING_IMPORT,
  DALTypes.ClosePartyReasons.BLOCKED_CONTACT,
];

export const shouldExcludeForNewLeadProcessing = p => {
  const partyCloseReason = DALTypes.ClosePartyReasons[p.metadata.closeReasonId];
  return (
    (p.workflowState === DALTypes.WorkflowState.CLOSED && partyCloseReasonsToExcludeForNewLead.includes(partyCloseReason)) ||
    p.workflowState === DALTypes.WorkflowState.ARCHIVED
  );
};

export const getPropertyAssignedToParty = async (ctx, party) => {
  logger.debug({ ctx, partyId: party.id }, 'getPropertyAssignedToParty');
  if (party.assignedPropertyId) {
    return getPropertyById(ctx, party.assignedPropertyId);
  }

  const { propertyIds } = party.storedUnitsFilters || {};
  if (propertyIds && propertyIds.length) {
    return getPropertyById(ctx, propertyIds[0]);
  }

  const user = await loadPartyAgent(ctx, party.id);

  if (user) {
    logger.debug({ ctx, userId: user.id }, 'loaded party agent');
    // QUESTION: what is the use case for getting property from teams like this?
    const [userTeam] = await getUserTeams(ctx, user.id);
    if (userTeam) {
      const teamsProperties = await getTeamProperties(ctx);
      const userTeamPropertyId = teamsProperties.find(p => p.id === userTeam.id);
      if (userTeamPropertyId) {
        return getPropertyById(ctx, userTeamPropertyId.propertyIds[0]);
      }
    } else {
      logger.warn({ ctx }, 'No teams found for user');
    }
  } else {
    logger.error({ ctx, partyId: party.id }, 'no party agent found for');
  }

  logger.error({ ctx, partyId: party.id }, 'No user team properties');
  return { displayName: 'Unknown Property' };
};

export const getPropertyForRegistration = async (ctx, { propertyId, partyId, quoteId }) => {
  if (propertyId) return await getPropertyById(ctx, propertyId);

  if (!quoteId) {
    const party = await loadParty(ctx, partyId);
    return await getPropertyAssignedToParty(ctx, party);
  }

  const quote = await getQuoteById(ctx, quoteId);
  return await getPropertyById(ctx, quote.inventory.property.id);
};

const getInitial = name => (name ? name.charAt(0) : '');

const getMemberName = resident => {
  const { firstName, lastName, middleName } = getApplicantName(resident.fullName);
  return `${getInitial(firstName)} ${getInitial(middleName)} ${lastName}`;
};

export const getMemberNames = members => {
  const sortOrder = [DALTypes.MemberType.RESIDENT, DALTypes.MemberType.GUARANTOR, DALTypes.MemberType.OCCUPANT];
  const sortedMembers = uniq(members.sort((a, b) => sortOrder.indexOf(a.memberType) - sortOrder.indexOf(b.memberType)));

  if (sortedMembers.length <= 2) {
    const names = sortedMembers.map(member => getMemberName(member));
    return names.join(', ').substr(0, MEMBER_NAMES_MAX_LENGTH);
  }

  const firstTwoMembers = sortedMembers.slice(0, 2);
  const names = firstTwoMembers.map(member => getMemberName(member));
  return names.join(', ').substr(0, MEMBER_NAMES_MAX_LENGTH).concat(', ').concat(t('ET_AL'));
};

export const getPartyPersonApplicationsData = async (ctx, partyId) => {
  logger.debug({ ctx, partyId }, 'getPartyPersonApplicationsData');

  // eslint-disable-next-line global-require
  const { getPersonApplicationsByFilter } = require('../../rentapp/server/services/person-application');

  const personApplicationsByPartyId = await getPersonApplicationsByFilter(ctx, { partyId });
  const additionalDataList = [];
  const applicationDataList = [];

  await execConcurrent(personApplicationsByPartyId, async personApplication => {
    const person = await getPersonById(ctx, personApplication.personId);

    Object.keys(personApplication.additionalData).length &&
      additionalDataList.push({
        personId: person.id,
        fullName: person.fullName,
        ...personApplication.additionalData,
      });
    Object.keys(personApplication.applicationData).length &&
      applicationDataList.push({
        personId: person.id,
        fullName: person.fullName,
        lastEdited: personApplication.updated_at,
        ...personApplication.applicationData,
      });
  });

  return { additionalDataList, applicationDataList };
};

export const getAdditionalDataFlattenList = (list, propertyName) =>
  list.reduce((prev, curr) => {
    const property = curr[propertyName];
    if (Array.isArray(property)) {
      property.forEach(p => {
        p.personId = curr.personId;
        p.fullName = curr.fullName;
      });
      prev.push(...property);
    } else if (property) {
      property.personId = curr.personId;
      property.fullName = curr.fullName;
      prev.push(property);
    }
    return prev;
  }, []);

export const getIncomeSources = additionalDataList => getAdditionalDataFlattenList(additionalDataList, 'incomeSourceHistory');

export const getAddressHistory = additionalDataList => getAdditionalDataFlattenList(additionalDataList, 'addressHistory');

let disclosuresPool = [];
export const getDisclosureByIdFromPool = async (context, id) => {
  let disclosure = disclosuresPool.find(d => d.id === id);
  if (disclosure) return disclosure;

  disclosure = await getDisclosureById(context, id);
  disclosuresPool.push(disclosure);
  return disclosure;
};

export const getFormattedPartyDisclosures = (partyDisclosure, { personId, fullName }) =>
  Object.keys(partyDisclosure).map(key => ({
    id: key,
    comment: partyDisclosure[key],
    personId,
    fullName,
  }));

export const setDisclosuresDisplayName = async (context, formattedPartyDisclosures) => {
  const disclosures = await execConcurrent(formattedPartyDisclosures, async formattedPartyDisclosure => {
    const disclosure = await getDisclosureByIdFromPool(context, formattedPartyDisclosure.id);
    formattedPartyDisclosure.displayName = disclosure.displayName;
    return formattedPartyDisclosure;
  });

  disclosuresPool = [];
  return disclosures;
};

export const getDisclosures = async (context, additionalDataList) => {
  const partyDisclosures = getAdditionalDataFlattenList(additionalDataList, 'disclosures');
  if (!partyDisclosures) return [];

  const formattedPartyDisclosures = partyDisclosures.reduce((prev, curr) => {
    prev.push(
      ...getFormattedPartyDisclosures(omit(curr, ['personId', 'fullName']), {
        personId: curr.personId,
        fullName: curr.fullName,
      }),
    );
    return prev;
  }, []);

  return await setDisclosuresDisplayName(context, formattedPartyDisclosures);
};

let feePool = [];
export const getFeeByIdFromPool = async (context, id) => {
  let fee = feePool.find(f => f.id === id);
  if (fee) return fee;

  fee = await getFeeById(context, id);
  feePool.push(fee);
  return fee;
};

export const getFormattedApplicationFee = async (context, applicationInvoice) => {
  if (!applicationInvoice.applicationFeeId) return null;

  const applicationFee = await getFeeByIdFromPool(context, applicationInvoice.applicationFeeId);
  return {
    displayName: applicationFee.displayName,
    createdAt: applicationInvoice.created_at,
    amount: applicationInvoice.applicationFeeAmount,
  };
};

export const getFormattedHoldDepositFee = async (context, applicationInvoice) => {
  if (!applicationInvoice.holdDepositFeeId) return null;

  const holdDepositfee = await getFeeByIdFromPool(context, applicationInvoice.holdDepositFeeId);
  return {
    displayName: holdDepositfee.displayName,
    createdAt: applicationInvoice.created_at,
    amount: applicationInvoice.holdDepositFeeIdAmount,
  };
};

export const getFormattedPartyInvoices = async (ctx, tenantId, partyId) => {
  const partyApplication = await getPartyApplicationByPartyId(ctx, partyId);
  if (!partyApplication) return [];

  const applicationInvoices = await getApplicationInvoicesByFilter(ctx, {
    partyApplicationId: partyApplication.id,
    paymentCompleted: true,
  });

  // eslint-disable-next-line global-require
  const { getPersonApplication } = require('../../rentapp/server/services/person-application');

  const invoices = await applicationInvoices.reduce(async (acc, applicationInvoice) => {
    const personApplication = await getPersonApplication(ctx, applicationInvoice.personApplicationId);
    const person = await getPersonById(ctx, personApplication.personId);

    const resolvedAcc = await acc;
    const applicationfee = await getFormattedApplicationFee(ctx, applicationInvoice);
    if (applicationfee) {
      applicationfee.fullName = person.fullName;
      resolvedAcc.push(applicationfee);
    }

    const holdDepositfee = await getFormattedHoldDepositFee(ctx, applicationInvoice);
    if (holdDepositfee) {
      holdDepositfee.fullName = person.fullName;
      resolvedAcc.push(holdDepositfee);
    }

    return resolvedAcc;
  }, Promise.resolve([]));

  feePool = [];
  return invoices;
};

export const getPartyDataForInvite = async (ctx, { partyId, propertyId, userId }) => {
  const tenant = await getTenantData(ctx);
  const party = await loadParty(ctx, partyId);
  const leasingAgent = await loadUserById({ ...ctx, tenantName: tenant.name }, party.userId || userId);
  const program = (await getOutProgramByTeamAndProperty(ctx, party.ownerTeam, party.assignedPropertyId)) || {};

  const team = party?.ownerTeam ? { id: party?.ownerTeam } : leasingAgent.teams.find(tm => party.teams.includes(tm.id));
  const partyMembers = await loadPartyMembers(ctx, partyId);
  const property = propertyId ? await getPropertyById(ctx, propertyId) : await getPropertyAssignedToParty(ctx, party);

  return {
    program,
    tenant,
    leasingAgent,
    team,
    party,
    partyMembers,
    property,
  };
};

export const getActiveAppointments = tasks =>
  tasks.filter(task => task.category === DALTypes.TaskCategories.APPOINTMENT && task.state !== DALTypes.TaskStates.CANCELED);

const isCompletedTourWithInventory = task => {
  const { name, state, metadata } = task;
  const isCompleted = name === DALTypes.TaskNames.APPOINTMENT && state === DALTypes.TaskStates.COMPLETED;
  if (!isCompleted) return false;

  const { inventories } = metadata;
  if (inventories && inventories.length) return true;

  return false;
};

export const completedAppointmentsWithInventory = tasks => (tasks || []).filter(isCompletedTourWithInventory);

export const getFavoriteUnitsPropertyIds = async (ctx, party) => {
  const favoriteUnitsIds = get(party, 'metadata.favoriteUnits');
  const favoriteUnits = favoriteUnitsIds && favoriteUnitsIds.length && (await getUnitsByIds(ctx, favoriteUnitsIds));
  return favoriteUnits ? uniq(favoriteUnits.map(unit => unit.propertyId)) : [];
};

export const getPartyUrl = async (ctx, partyId) => {
  if (!ctx.tenantId || !partyId) return '';

  const { name: tenantName } = await getTenant(ctx);
  return `https://${tenantName}.${config.domain}/party/${partyId}`;
};

export const sendPartyUpdatedNotification = async (ctx, partyId) => {
  const { teams } = await loadPartyById(ctx, partyId);
  await notify({
    ctx,
    event: EventTypes.PARTY_UPDATED,
    data: { partyId },
    routing: { teams },
  });
};
