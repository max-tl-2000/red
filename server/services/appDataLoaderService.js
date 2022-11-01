/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries, Promise } from 'bluebird';
import flatten from 'lodash/flatten';
import groupBy from 'lodash/groupBy';
import pick from 'lodash/pick';
import {
  loadParties,
  loadParty,
  loadPartyMembersBy,
  getPartyIdsByPersonIds,
  getPersonIdsbyPartyIds,
  getPartyMembersByPartyIds,
  loadInactivePartyMembers,
  loadAllQuotePromotions,
  getAdditionalInfoByPartyAndType,
  getPartyProgram,
  getTeamsAllowedToModifyParty,
  getRenewalPartyIdBySeedPartyId,
} from '../dal/partyRepo';
import { getOtherPartiesApplications } from './party';
import { loadDashboardData } from '../dal/dashboardRepo';
import { getPropertiesWithAmenitiesAndFloors, getPropertyTimezone } from '../dal/propertyRepo';
import { getLastActivityLogsByPartyForUsers } from '../dal/activityLogRepo';
import { getPersonsByIds } from './person';
import { getUsers as getUsersFromDb } from '../dal/usersRepo';
import { getUnitFullQualifiedNamesByQuoteIds } from '../dal/searchRepo';
import { getActiveLeaseWorkflowDataByPartyId } from '../dal/activeLeaseWorkflowRepo';
import { getOutProgramByTeamAndProperty } from '../dal/programsRepo';
import { getTasksByPartyIds, getTasksForPartiesByName } from '../dal/tasksRepo';
import { getTeamMembers, getTeamProperties, getTeamsFromTenant } from '../dal/teamsRepo';
import { getPartyLeases, getLeaseById } from '../dal/leaseRepo';
import { getUnitsByIds, getInventoriesOnHold, getFullInventoryName, getFullUnitQualifiedNameForInventories } from '../dal/inventoryRepo';
import { DALTypes } from '../../common/enums/DALTypes';
import { getAllApplicationStatusByPartyAndType } from './applications';
import { sanitizeUsers } from './users';
import { getScreeningSummary } from '../../rentapp/server/services/screening';
import { getPropertiesByIds } from './properties';
import { enhance } from '../../common/helpers/contactInfoUtils';
import { REVA_ADMIN_EMAIL } from '../../common/auth-constants';
import {
  isCorporateParty,
  isTaskAllowedOnCorporateParties,
  isScreeningRequired,
  isRenewalWorkflow,
  isActiveLeaseWorkflow,
} from '../../common/helpers/party-utils';
import { ADMIN } from '../common/schemaConstants';
import loggerModule from '../../common/helpers/logger';
import { listToHash } from '../../common/helpers/list-utils';
import { getFavoriteUnitsPropertyIds } from '../helpers/party';
import { isRevaAdmin } from '../../common/helpers/auth';
import { getInventoryItemWithDetails } from './inventories';
import { enhanceChargesWithAdjustedDates } from '../../common/helpers/activeLease-utils';
import { partyWfStatesSubset } from '../../common/enums/partyTypes';
import { loadCommunicationsByPersons } from './communication';
import { getTenant } from './tenantService';
import { isBlueMoonLeasingProviderMode } from '../../common/helpers/utils';
import config from '../config';
import { formatStringWithPlaceholders } from '../../common/helpers/strings';

const logger = loggerModule.child({ subType: 'services/appDataLoaderService' });

const stripPersonDataFromMember = member => {
  const { fullName, preferredName, contactInfo, ...rest } = member;
  return rest;
};

const setTeamsData = (users, teamMembers, teamProperties) =>
  users.map(user => {
    const userTeamMembers = teamMembers.filter(teamMember => teamMember.userId === user.id);

    return {
      ...user,
      teams: userTeamMembers
        .filter(tm => !tm.inactive)
        .map(teamMember => ({
          id: teamMember.teamId,
          displayName: teamMember.teamName,
          mainRoles: teamMember.mainRoles,
          functionalRoles: teamMember.functionalRoles,
          properties: (teamProperties.find(p => p.id === teamMember.teamId) || {}).propertyIds,
        })),
    };
  });

const enhanceAppointmentsWithUnits = async (ctx, appointments) => {
  const unitsInAppointments = await getUnitsByIds(ctx, flatten(appointments.map(app => app.metadata.inventories)));

  return appointments.map(appointment => {
    appointment.metadata.inventories = unitsInAppointments.filter(unit => appointment.metadata.inventories.includes(unit.id));
    return appointment;
  });
};

export const getUsers = async (ctx, excludeInactiveTeams = true) => {
  const teamMembers = await getTeamMembers(ctx.tenantId, excludeInactiveTeams);
  const teamProperties = await getTeamProperties(ctx);
  let users = await getUsersFromDb(ctx);
  users = setTeamsData(users, teamMembers, teamProperties);
  return sanitizeUsers(ctx, users, excludeInactiveTeams);
};

const enhanceLeaseWithUnitQualifiedName = async (tenantId, leases = []) => {
  const unitQualifiedNames = await getUnitFullQualifiedNamesByQuoteIds(
    tenantId,
    leases.map(lease => lease.quoteId),
  );
  return leases.map(lease => {
    lease.fullQualifiedName = (unitQualifiedNames.find(unit => unit.quoteId === lease.quoteId) || {}).fullQualifiedName;
    return lease;
  });
};

const enhancePartiesWithAssignedPropertyName = async (ctx, parties) => {
  const propertyIds = new Set([].concat(...parties.map(party => party.assignedPropertyId)).filter(p => !!p));
  const properties = await getPropertiesByIds(ctx, Array.from(propertyIds));
  const names = new Map();
  properties.forEach(p => names.set(p.id, p.displayName));

  return parties.map(party => {
    const { assignedPropertyId } = party;
    if (!assignedPropertyId) return party;
    party.assignedPropertyName = names.get(assignedPropertyId);
    return party;
  });
};

const enhancePartiesWithFavoriteUnits = async (ctx, parties) => {
  const inventories = [].concat(...parties.map(party => party.metadata && (party.metadata.favoriteUnits || [])));
  const units = await getUnitsByIds(ctx, [...new Set(inventories)]);

  return parties.map(party => {
    const favoriteUnitsIds = party.metadata.favoriteUnits || [];
    const favoriteUnits = favoriteUnitsIds.map(unitId => units.find(unit => unit.id === unitId));
    party.favoriteUnits = favoriteUnits.filter(unit => !!unit);
    return party;
  });
};

const enhanceActiveLeaseWorkflowDataWithFullInventoryName = async (ctx, activeLeaseWorkflowData) => {
  const inventoryId = activeLeaseWorkflowData.leaseData?.inventoryId;
  const fullInventoryName = inventoryId && (await getFullInventoryName(ctx, inventoryId));
  const inventory = {
    name: fullInventoryName.inventoryName,
    property: { name: fullInventoryName.propertyName },
    building: { name: fullInventoryName.buildingName },
  };
  activeLeaseWorkflowData.leaseData.inventory = inventory;
};

const enhancePartiesActiveLeaseWorkflowDataWithFullInventoryName = async (ctx, parties) => {
  const inventoryIds = parties.map(p => p.activeLeaseWorkflowData?.inventoryId).filter(x => !!x);
  const inventoriesFullQualifiedName = !!inventoryIds.length && (await getFullUnitQualifiedNameForInventories(ctx, inventoryIds));

  return parties.map(party => {
    const inventory = (inventoriesFullQualifiedName || []).find(i => i.id === party.activeLeaseWorkflowData?.inventoryId);
    if (inventory) {
      const fullInventoryName = {
        name: inventory.inventoryName,
        property: { name: inventory.propertyName },
        building: { name: inventory.buildingName },
      };

      party.activeLeaseWorkflowData.inventory = fullInventoryName;
    }
    return party;
  });
};

const prepareLaneData = (partiesForLane, { partyMembers, tasks: tasksAgg, partyQuotePromotions, personApplications, leases }, includeStrongMatchData) =>
  partiesForLane.map(({ id: partyId, timezone, program, rank, rn: rowNumber, party, communication, activeLeaseWorkflowData, movingOutDate }) => {
    const persons = {};
    const partyMemberCompany = {};
    const pm = (partyMembers[partyId] || []).map(({ partyMember, person, contactInfo, strongMatchCount, company = {} }) => {
      const enhancedContact = enhance(contactInfo || []);
      person.contactInfo = enhancedContact;

      persons[person.id] = person;
      partyMember.contactInfo = enhancedContact;
      partyMember.fullName = person.fullName;
      partyMember.preferredName = person.preferredName;
      partyMember.dob = person.dob;

      if (company?.id) partyMemberCompany[partyMember.companyId] = company;
      if (includeStrongMatchData) partyMember.strongMatchCount = strongMatchCount;
      return partyMember;
    });

    const applications = (personApplications[partyId] || []).map(({ personApplication, privateDocumentsCount }) => {
      const propertyId = party.assignedPropertyId;
      const partyMemberId = (pm.find(p => p.personId === personApplication.personId) || {}).id;
      return { partyId, ...personApplication, propertyId, partyMemberId, documents: { privateDocumentsCount } };
    });

    const appointments = (tasksAgg[partyId] || []).filter(tsk => tsk.category === DALTypes.TaskCategories.APPOINTMENT);
    const tasks = (tasksAgg[partyId] || []).filter(tsk => tsk.category !== DALTypes.TaskCategories.APPOINTMENT);

    const result = {
      ...party,
      rank,
      timezone,
      program,
      rowNumber,
      partyMembersIds: pm.map(p => p.id),
      members: pm,
      persons,
      company: partyMemberCompany,
      appointments: appointments || [],
      tasks: tasks || [],
      communication,
      applications,
      leases: leases[partyId] || [],
      partyQuotePromotions: partyQuotePromotions[partyId] || [],
      activeLeaseWorkflowData: activeLeaseWorkflowData ? { ...activeLeaseWorkflowData, movingOutDate } : null,
    };

    if (includeStrongMatchData) result.partyHasStrongMatch = pm.some(member => member.strongMatchCount > 0);
    return result;
  });

export const loadFilteredDashboardBulk = async (ctx, acdFilter, extraFilter) => {
  logger.trace({ ctx, acdFilter, extraFilter, readOnlyServer: ctx.readOnlyServer }, 'loadFilteredDashboardBulk');

  const { includeStrongMatchData } = extraFilter;
  const { rows, additionalData, strongMatchData } = await loadDashboardData(ctx, acdFilter, extraFilter);
  const res = await Promise.reduce(
    rows,
    async (acc, { state, total, today, tomorrow, groupedParties }) => {
      const laneData = prepareLaneData(groupedParties || [], additionalData, includeStrongMatchData);

      const leases = laneData.reduce((leasesAcc, party) => {
        (party.leases || []).map(lease => leasesAcc.push(lease));
        return leasesAcc;
      }, []);
      await enhanceLeaseWithUnitQualifiedName(ctx.tenantId, leases);

      const parties = laneData.reduce((partyAcc, party) => {
        partyAcc.push(party);
        return partyAcc;
      }, []);
      await enhancePartiesWithFavoriteUnits(ctx, parties);
      await enhancePartiesActiveLeaseWorkflowDataWithFullInventoryName(ctx, parties);
      acc[state] = {
        state,
        total,
        today,
        tomorrow,
        laneData,
      };

      await enhancePartiesWithAssignedPropertyName(ctx, parties);
      return acc;
    },
    {},
  );

  res.strongMatchData = strongMatchData;

  return res;
};

const getActiveLeaseWorkflowDataByWorkflow = async (ctx, party) => {
  if (isRenewalWorkflow(party)) return await getActiveLeaseWorkflowDataByPartyId(ctx, party.seedPartyId);
  if (isActiveLeaseWorkflow(party)) return await getActiveLeaseWorkflowDataByPartyId(ctx, party.id);
  return null;
};

export const loadPersonDetailsData = async (ctx, personId) => {
  const includeClosedParties = true;
  const excludeInactiveMember = false;
  const partiesIds = await getPartyIdsByPersonIds(ctx, [personId], includeClosedParties, excludeInactiveMember);
  const parties = await loadParties(ctx, partyWfStatesSubset.all, q => q.whereIn('Party.id', partiesIds));
  const enhancedParties = await mapSeries(parties, async party => {
    const teamsAllowedToModify = await getTeamsAllowedToModifyParty(ctx, party.id);
    const activeLeaseWorkflowData = await getActiveLeaseWorkflowDataByWorkflow(ctx, party);
    if (activeLeaseWorkflowData) await enhanceActiveLeaseWorkflowDataWithFullInventoryName(ctx, activeLeaseWorkflowData);
    return { ...party, teamsAllowedToModify, activeLeaseWorkflowData };
  });
  const personsIds = await getPersonIdsbyPartyIds(ctx, partiesIds);
  const persons = await getPersonsByIds(ctx, personsIds);
  const communications = await loadCommunicationsByPersons(ctx, [personId]);
  const members = (await getPartyMembersByPartyIds(ctx, partiesIds)).map(m => stripPersonDataFromMember(m));
  const inactiveMembers = await loadInactivePartyMembers(ctx, q => q.whereIn('PartyMember.partyId', partiesIds));
  const tasks = await getTasksForPartiesByName(ctx, partiesIds, DALTypes.TaskNames.APPOINTMENT);
  const appointmentsWithUnits = await enhanceAppointmentsWithUnits(
    ctx,
    tasks.filter(task => task.name === DALTypes.TaskNames.APPOINTMENT),
  );

  return {
    parties: enhancedParties,
    persons,
    communications,
    members,
    inactiveMembers,
    tasks: appointmentsWithUnits,
  };
};

const getInventoryWithHolds = async (ctx, party, inventoryId) => {
  const inventory = await getInventoryItemWithDetails(ctx, inventoryId, { partyId: party.id });
  const inventoriesOnHold = await getInventoriesOnHold(ctx);
  const holdsForLeasedInventory = inventoriesOnHold.filter(invHold => invHold.inventoryId === inventoryId);
  return { ...inventory, inventoryHolds: holdsForLeasedInventory };
};

const getActiveLeaseWorkflowData = async (ctx, party, timezone) => {
  const activeLeaseWorkflowData = await getActiveLeaseWorkflowDataByWorkflow(ctx, party);

  if (!activeLeaseWorkflowData) return null;
  const { leaseId } = activeLeaseWorkflowData;
  const { status: currentLeaseStatus } = leaseId ? await getLeaseById(ctx, leaseId) : {};
  const activeLeaseWfData = enhanceChargesWithAdjustedDates(activeLeaseWorkflowData, timezone);

  if (isActiveLeaseWorkflow(party)) {
    return { currentLeaseStatus, ...activeLeaseWfData };
  }

  const inventoryId = activeLeaseWfData?.leaseData?.inventoryId;
  const inventory = inventoryId && (await getInventoryWithHolds(ctx, party, inventoryId));
  return {
    inventory,
    currentLeaseStatus,
    ...activeLeaseWfData,
  };
};

export const loadPartyDetailsData = async (ctx, partyId) => {
  const party = await loadParty(ctx, partyId);
  const { ownerTeam: teamId, assignedPropertyId: propertyId, seedPartyId } = party;
  const timezone = await getPropertyTimezone(ctx, propertyId);
  const program = await getOutProgramByTeamAndProperty(ctx, teamId, propertyId);
  const outCommsProgram = (program && [{ ...program, id: program.teamPropertyProgramId }]) || [];

  const isCorporate = isCorporateParty(party);

  const activeLeaseWorkflowData = await getActiveLeaseWorkflowData(ctx, party, timezone);

  if (activeLeaseWorkflowData) await enhanceActiveLeaseWorkflowDataWithFullInventoryName(ctx, activeLeaseWorkflowData);

  const filterByPartyId = q => q.where({ 'PartyMember.partyId': partyId });
  const inactiveMembers = (await loadInactivePartyMembers(ctx, filterByPartyId)).map(m => stripPersonDataFromMember(m));
  const inactiveMembersIds = inactiveMembers.map(m => m.id);
  const members = (await loadPartyMembersBy(ctx, filterByPartyId, { excludeInactive: false }))
    .map(m => (inactiveMembersIds.includes(m.id) ? { ...m, deleted: true } : m))
    .map(m => {
      const { preferredName, contactInfo, ...rest } = m;
      return rest;
    });

  const tasks = (await getTasksByPartyIds(ctx, [partyId])).map(task =>
    task.state === DALTypes.TaskStates.CANCELED && task.name !== DALTypes.TaskNames.APPOINTMENT ? { ...task, deleted: true } : task,
  );

  const allMembers = [...members, ...inactiveMembers];
  const persons = await getPersonsByIds(
    ctx,
    allMembers.map(p => p.personId),
  );
  const leases = await getPartyLeases(ctx, partyId);

  const returnSsn = isRevaAdmin(ctx.authUser);
  const applications = !isCorporate ? await getAllApplicationStatusByPartyAndType(ctx, [partyId], { returnSsn }) : [];
  const quotePromotions = await loadAllQuotePromotions(ctx, partyId);
  const screeningSummary = !isCorporate ? await getScreeningSummary(ctx, { partyId }) : {};
  const appointmentsWithUnits = await enhanceAppointmentsWithUnits(
    ctx,
    tasks.filter(task => task.name === DALTypes.TaskNames.APPOINTMENT),
  );
  const usersLastActivity = await getLastActivityLogsByPartyForUsers(ctx, partyId);
  const partiesAdditionalInfo = await getAdditionalInfoByPartyAndType(ctx, partyId);
  const partyProgram = await getPartyProgram(ctx, partyId);
  const filterTasksByLeaseType = ({ name, category }) => !isCorporate || isTaskAllowedOnCorporateParties(name, category);
  const favoriteUnitsPropertyIds = await getFavoriteUnitsPropertyIds(ctx, party);
  const renewalPartyId = await getRenewalPartyIdBySeedPartyId(ctx, partyId);
  const seedPartyData = (await loadParty(ctx, seedPartyId)) || {};

  const otherPartiesApplications = await getOtherPartiesApplications(ctx, partyId, { partyMembers: members });

  return {
    parties: [
      {
        ...party,
        timezone,
        teamsAllowedToModify: await getTeamsAllowedToModifyParty(ctx, partyId),
        favoriteUnitsPropertyIds,
        screeningRequired: isScreeningRequired(isCorporate, party.workflowName),
        renewalPartyId,
      },
    ],
    screeningSummary: [{ id: partyId, partyId, screeningSummary }],
    members,
    inactiveMembers,
    tasks: tasks.filter(task => task.name !== DALTypes.TaskNames.APPOINTMENT && filterTasksByLeaseType(task)).concat(appointmentsWithUnits),
    persons,
    leases,
    applications,
    otherPartiesApplications,
    quotePromotions,
    usersLastActivity,
    outCommsProgram,
    partiesAdditionalInfo,
    partiesProgram: [partyProgram],
    activeLeaseWorkflowData: activeLeaseWorkflowData ? [activeLeaseWorkflowData] : [],
    seedPartyData: [seedPartyData],
  };
};

const excludePropertyPrivateInfo = async (ctx, properties) => {
  const common = ['id', 'name', 'displayName', 'timezone'];
  const pageUnified = ['leaseTerms', 'teamIds', 'floors', 'amenities', 'lifestyleDisplayNames', 'city', 'state', 'displayName'];
  const helperParty = ['leasingOfficeAddress'];
  const closeOrArchivePartiesDialog = ['endDate'];
  const leaseForm = ['applicationSettings']; // LeaseForm and LeaseFormDialogWrapper
  const tenant = await getTenant(ctx);
  const { leasingProviderMode } = tenant.metadata;

  const toPick = [...common, ...pageUnified, ...helperParty, ...closeOrArchivePartiesDialog, ...leaseForm];

  return properties.map(property => {
    const s = property.settings;

    // the url is specified only when using bluemoon and bmAutoESignatureRequest=false
    let leaseProviderLoginUrl;
    if (isBlueMoonLeasingProviderMode(leasingProviderMode) && !s.integration?.lease?.bmAutoESignatureRequest && s.lease?.username) {
      const { testWebsite, productionWebsite, loginPath } = config.bluemoon.contract;
      const website = leasingProviderMode === DALTypes.LeasingProviderMode.BLUEMOON_PROD ? productionWebsite : testWebsite;
      const creds = s.lease?.username.split('@');
      const path = formatStringWithPlaceholders(loginPath, { '%serial%': creds[1], '%userId%': creds[0] });

      // We can fully login when providing the password as well
      leaseProviderLoginUrl = encodeURI(`${website}${path}`);
    }

    // Most of the settings below should be exposed as a flat list
    // or different structure than the way they are orginaized in the settings json
    const settings = {
      calendar: { teamSlotDuration: s.calendar?.teamSlotDuration }, // scheduleAppointmentForm
      comms: { daysToRouteToALPostMoveout: s.comms?.daysToRouteToALPostMoveout }, // partySelectors
      appointment: { tourTypesAvailable: s.appointment?.tourTypesAvailable }, // partySelectors
      integration: {
        import: { residentData: s.integration?.import?.residentData }, // partySelectors, LeaseFromExistingResident, PartyCardMenu, ClosePartyDialog (Should be moved at root level)
        export: { renewalLease: s.integration?.export?.renewalLease, newLease: s.integration?.export?.newLease }, // LeaseFormDialogWrapper: should be changed to intermediary setting
        lease: { bmAutoESignatureRequest: s.integration?.lease?.bmAutoESignatureRequest }, // LeaseForm, Party
      },
      rxp: { app: { allowAccess: s.rxp?.app?.allowAccess, name: s.rxp?.app?.name } }, // PartyMembersPanel
      applicationReview: {
        conditionalApprovalOptions: s.applicationReview?.conditionalApprovalOptions,
        sendAALetterOnDecline: s.applicationReview?.sendAALetterOnDecline,
        sendAALetterOnConditional: s.applicationReview?.sendAALetterOnConditional,
      }, // ApprovalDialog, DeclineDialog
      lease: {
        allowPartyRepresentativeSelection: s.lease?.allowPartyRepresentativeSelection, // LeaseFormDialogWrapper
        allowRentableItemSelection: s.lease?.allowRentableItemSelection, // inventorySelectors
        residentSignatureTypes: s.lease?.residentSignatureTypes, // Party: lease section
        guarantorSignatureTypes: s.lease?.guarantorSignatureTypes, // Party: lease section
        leaseProviderLoginUrl, // publishLeaseDialog
      },
      renewals: { renewalCycleStart: s.renewals?.renewalCycleStart }, // RenewalDialog
      quote: {
        prorationStrategy: s.quote?.prorationStrategy, // QuoteDraft
        expirationPeriod: s.quote?.expirationPeriod, // QuoteDraft
        renewalLetterExpirationPeriod: s.quote?.renewalLetterExpirationPeriod, // QuoteDraft
        policyStatement: s.quote?.policyStatement, // inventory
      },
      applicationSettings: s.applicationSettings, // LeaseForm
    };
    return { ...pick(property, toPick), settings };
  });
};

export const loadGlobalData = async (ctx, user) => {
  logger.trace({ ctx }, 'loadGlobalData');
  if (ctx.tenantId === ADMIN) {
    return {
      users: {},
      teams: {},
      properties: [],
      propertiesByTeams: {},
    };
  }
  const authUserEmail = ctx.authUser?.email || user?.email;
  const excludeInactiveTeams = REVA_ADMIN_EMAIL !== authUserEmail;

  // CAUTION: All the data that is built here is exposed to the front end.
  // We have to make sure to call functions that will only pick what is needed and not expose all the data we store in our DB
  const users = await getUsers(ctx, excludeInactiveTeams);
  const teams = await getTeamsFromTenant(ctx.tenantId, excludeInactiveTeams);
  const properties = await getPropertiesWithAmenitiesAndFloors(ctx, excludeInactiveTeams);
  const propertyTeamPairs = properties.reduce((acc, property) => {
    property.teamIds.map(teamId => acc.push({ id: property.id, teamId }));
    return acc;
  }, []);

  return {
    users: listToHash(users),
    teams: listToHash(teams),
    properties: await excludePropertyPrivateInfo(ctx, properties),
    propertiesByTeams: groupBy(propertyTeamPairs, 'id'),
  };
};
