/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import Promise from 'bluebird';
import orderBy from 'lodash/orderBy';
import {
  getRankedUnits as getRankedUnitsFromDb,
  searchUnits as searchUnitsInDb,
  searchParties as searchPartiesInDb,
  searchPersons as searchPersonsInDb,
  getPersonMatches as getPersonMatchesFromDb,
  searchCompanies as searchCompaniesInDb,
} from '../dal/searchRepo';
import { knex, updateJSONBField } from '../database/factory';
import { ServiceError } from '../common/errors';
import { DALTypes } from '../../common/enums/DALTypes';
import { enhance } from '../../common/helpers/contactInfoUtils';
import { getInventoriesOnHold, getAllInventoryAmenities } from '../dal/inventoryRepo.js';
import logger from '../../common/helpers/logger';
import { getPersonsLastContactedDate } from '../dal/communicationRepo';
import { getLeaseTerms } from '../dal/leaseTermRepo';
import { getAllConcessionsWithLeaseTerms } from '../dal/concessionRepo';
import { loadPartiesByPersonIds } from '../dal/partyRepo';
import { phoneSanitize } from '../helpers/searchUtils';
import { getTeamsForUser } from '../dal/teamsRepo';
import { getPropertiesAssociatedWithTeams, getProperties } from '../dal/propertyRepo';
import { formatInventoryAssetUrl, formatEmployeeAssetUrl } from '../helpers/assets-helper';
import { getMarketRentInfoForUnit } from './helpers/marketRentHelpers';
import { GLOBAL_SEARCH_QUERY_MAX_LENGTH } from '../../common/enums/enums';

const allowedSearchByParameters = ['fullName', 'phones', 'emails'];

const formatStringArrays = query => query.trim().split(',').join(' ');

const addORConditions = query => query.split(' ').join(' | ');

const formatSearchQuery = query => addORConditions(formatStringArrays(query));

const buildSearchQuery = searchByParameters =>
  allowedSearchByParameters.reduce((query, parameterName) => {
    let parameter = searchByParameters[parameterName];
    if (parameter) {
      parameter = parameterName === 'emails' ? `${parameter}`.toLowerCase() : phoneSanitize(`${parameter}`);
      query = formatSearchQuery(`${query} ${parameter}`);
    }
    return query;
  }, null);

const getBuildingQualifiedName = (buildingShorthand, name) => (buildingShorthand ? `${buildingShorthand}-${name}` : name);

export const flattenedUnits = async (ctx, units, unitsOnHold = [], properties = [], partyId) => {
  if (!units.length) return [];

  const leaseTerms = await getLeaseTerms(ctx);
  const concessions = await getAllConcessionsWithLeaseTerms(ctx);
  const inventoryAmenities = await getAllInventoryAmenities(ctx);

  const _units = Promise.mapSeries(units, async unit => {
    const { inventoryObject } = unit;
    const { id, buildingShorthand, name } = inventoryObject;
    const buildingQualifiedName = getBuildingQualifiedName(buildingShorthand, name);
    const unitsOnHoldIds = unitsOnHold.map(item => item.inventoryId);

    const property = properties.find(p => p.id === unit.propertyId) || {};

    const { specials, adjustedMarketRent, isRenewal, leaseLength } = await getMarketRentInfoForUnit(ctx, unit, {
      property,
      leaseTerms,
      inventoryAmenities,
      concessions,
      partyId,
    });
    const isInventoryOnHold = unitsOnHoldIds.includes(id);
    const imageUrl = await formatInventoryAssetUrl(ctx, id);
    return {
      ...inventoryObject,
      isRenewal,
      imageUrl,
      specials,
      adjustedMarketRent,
      nextStateExpectedDate: unit.nextStateExpectedDate,
      fullQualifiedName: unit.fullQualifiedName,
      buildingQualifiedName,
      unitName: name,
      rank: unit.rank,
      inventoryGroupId: unit.inventoryGroupId,
      isInventoryOnHold,
      availabilityDateSource: unit.availabilityDateSource,
      externalId: unit.externalId,
      address: unit.address,
      hideStateFlag: unit.hideStateFlag,
      availabilityDate: unit.availabilityDate,
      lossLeaderUnit: unit.lossLeaderUnit,
      quotable: isInventoryOnHold ? unitsOnHold.find(u => u.inventoryId === id).quotable : true,
      property,
      leaseTerm: {
        termLength: leaseLength || 12,
        period: DALTypes.LeasePeriod.MONTH,
      },
      state: unit.state,
      stateStartDate: unit.stateStartDate,
    };
  });

  return _units;
};

const MAX_SEARCH_HISTORY = 10;

const getPropertiesForSearch = async (ctx, userId) => {
  const teams = await getTeamsForUser(ctx, userId);
  const properties = await getPropertiesAssociatedWithTeams(
    ctx,
    teams.map(team => team.id),
  );
  return properties;
};

export const getRankedUnits = async req => {
  logger.trace({ ctx: req, readOnlyServer: req.readOnlyServer }, 'getRankedUnits');

  const { tenantId, authUser, body: filters = {} } = req;
  const { id: userId } = authUser;
  const ctx = { tenantId, readOnlyServer: req.readOnlyServer };

  const properties = await getPropertiesForSearch(ctx, userId);
  const rankedUnits = await getRankedUnitsFromDb(ctx, filters, userId);
  const unitsOnHold = await getInventoriesOnHold(ctx);
  return await flattenedUnits(req, rankedUnits, unitsOnHold, properties, filters.partyId);
};

export const getSearchHistory = async (ctx, userId) => {
  try {
    const searchHistory =
      ((await knex.withSchema(ctx.tenantId).from('Users').select('metadata').where({ id: userId }).first()).metadata || {}).searchHistory || [];

    const searches = do {
      if (typeof searchHistory === 'string') {
        // metadata is an object. metadata.searchHistory is supposed to be an object,
        // but previously it was being saved as a string. This type check was added
        // in order to avoid problems with the existing values. TODO: remove it later.
        JSON.parse(searchHistory);
      } else {
        searchHistory;
      }
    };

    return { searches: searches.slice(0, MAX_SEARCH_HISTORY) };
  } catch (error) {
    logger.error({ error, userId }, 'Error loading search history');
    throw new ServiceError('ERROR_LOADING_SEARCH_HISTORY');
  }
};

export const putSearchHistory = async (ctx, userId, history = {}) => {
  try {
    const previousSavedHistory = await getSearchHistory(ctx, userId);
    const searches = history.searches || [];
    const previousSearches = previousSavedHistory.searches || [];

    const seenAlready = {};

    const theHistory = searches.reduce((seq, entry) => {
      // if not seen already
      if (!seenAlready[entry.value]) {
        seenAlready[entry.value] = true;

        const indexOfEntry = seq.findIndex(ele => entry.value === ele.value);

        if (indexOfEntry > -1) {
          // element was already in history
          seq.splice(indexOfEntry, 1); // remove it from the history
        }

        // push the element to the begining of the array
        seq.unshift(entry);
      }
      return seq;
    }, previousSearches);

    const searchHistory = theHistory.slice(0, MAX_SEARCH_HISTORY);

    await updateJSONBField({
      ctx,
      table: 'Users',
      tableId: userId,
      field: 'metadata',
      key: 'searchHistory',
      value: searchHistory,
    });

    return { searches: searchHistory };
  } catch (error) {
    logger.error({ error, userId, history }, 'Error loading search history');
    throw new ServiceError('ERROR_SAVING_SEARCH_HISTORY');
  }
};

export const enhancePersons = async (req, persons) => {
  const employees = persons.filter(item => item.personType && item.personType === DALTypes.AssetType.EMPLOYEE);
  const contacts = persons.filter(item => item.personType && item.personType !== DALTypes.AssetType.EMPLOYEE);

  const employeesAssets = employees.length
    ? await formatEmployeeAssetUrl(
        req,
        employees.map(it => it.id),
      )
    : [];
  const enhancedEmployees = employees.map(employee => ({
    ...employee,
    avatarUrl: employeesAssets.find(it => it.entityId === employee.id)?.assetUrl,
  }));
  const enhanceContactWithLastContactedDate = async contactsToEnhance => {
    const contactsLastContactedDate = await getPersonsLastContactedDate(
      req,
      contacts.map(contact => contact.id),
    );
    return contactsToEnhance.map(contact => ({
      ...contact,
      lastContactedDate: contactsLastContactedDate[contact.id],
    }));
  };
  const enhancedContacts = await enhanceContactWithLastContactedDate(contacts);
  return enhancedContacts.concat(enhancedEmployees);
};

export const searchPersons = async request => {
  const query = buildSearchQuery(request.body);
  if (!query) return [];

  const { filters } = request.body;
  const persons = await searchPersonsInDb(request.tenantId, query, filters);
  const enhanceContactInfo = m => ({
    ...m,
    contactInfo: enhance(m.contactInfo || []),
  });
  return persons.filter(item => item.personType && item.personType !== DALTypes.AssetType.EMPLOYEE).map(enhanceContactInfo);
};

export const searchCompanies = async (ctx, payload) => {
  const { query } = payload;
  if (!query) return [];

  return await searchCompaniesInDb(ctx, query);
};

const lowerUnitsRank = units =>
  units.map(unit => ({
    ...unit,
    rank: unit.rank / 100,
  }));

const adjustPartiesRank = (parties, authUserTeams = []) =>
  parties?.map(party => {
    const userTeamBelongToParty = party.teams?.some(p => authUserTeams.indexOf(p) >= 0);
    party.rank += userTeamBelongToParty ? 20 : 0;
    if (party.workflowState === DALTypes.WorkflowState.ACTIVE) {
      if (party.workflowName === DALTypes.WorkflowName.RENEWAL) {
        party.rank += 10;
      }
      if (party.workflowName === DALTypes.WorkflowName.ACTIVE_LEASE) {
        party.rank += 5;
      }
    }
    return party;
  });

export const unitSearch = async (ctx, query, options) => {
  const { userId, tenantId } = ctx;
  let { hideUnits = false, isAutoSuggest = false } = options;
  hideUnits = isAutoSuggest ? false : hideUnits;
  const unitsResult = !hideUnits ? await searchUnitsInDb(tenantId, query) : [];
  const propertiesIds = await getPropertiesForSearch(ctx, userId);
  const units = await flattenedUnits(ctx, unitsResult, propertiesIds);
  return units && units.length ? lowerUnitsRank(units) : [];
};

const getLastValidClosedPartyForGroup = (activeParties, closedParties) => {
  if (activeParties.length || closedParties.length === 0) return [];

  if (closedParties.length !== closedParties.filter(p => p.workflowState === DALTypes.WorkflowState.ARCHIVED).length) {
    // this means that at least one party in the group was closed because of other reasons so we default to the old implementation
    return [closedParties[0]];
  }

  // this means that in this group we have no more active parties and all of them are archived. if this is true, based on CPM-19186
  // Filter out all but the last archived AL WF within an umbrella that is already archived.
  //  More generally, we should hide all archived WFs from the full search results,
  // except for the case when the umbrella is archived, in which case we should only show the last archived AL workflow.
  // in case of the corporate party, this order might not be right, so we should always return last
  // archived AL. this should cover us on all party types

  const activeLeases = closedParties.filter(p => p.workflowName === DALTypes.WorkflowName.ACTIVE_LEASE);
  const orderedAL = orderBy(activeLeases, ['archiveDate'], ['desc']);

  return orderedAL.length ? [orderedAL[0]] : [];
};

export const partySearch = async (ctx, query, options, adjustParties = true) => {
  const { searchArchived } = options;
  const { authUserTeams, tenantId } = ctx;
  let parties = await searchPartiesInDb(tenantId, query, options);
  const openParties = parties.filter(party => party.workflowState === DALTypes.WorkflowState.ACTIVE);

  if (searchArchived) {
    if (!openParties.length) {
      const archiveParties = parties.filter(party => party.workflowState !== DALTypes.WorkflowState.ACTIVE);
      const filteredParties = orderBy(archiveParties, ['createdAt'], ['desc']).slice(0, 1);
      return adjustParties ? adjustPartiesRank(filteredParties, authUserTeams) : filteredParties;
    }
    parties = openParties;
  }

  const groupedParties = parties.reduce((r, a) => {
    r[a.partyGroupId] = [...(r[a.partyGroupId] || []), a];
    return r;
  }, {});
  const filteredParties = Object.keys(groupedParties).reduce((acc, key) => {
    const closeParties = [];
    const activeParties = [];
    groupedParties[key].forEach(party => {
      if (party.workflowState === DALTypes.WorkflowState.ACTIVE) {
        activeParties.push(party);
      } else {
        closeParties.push(party);
      }
    });
    const orderedCloseParties = orderBy(closeParties, ['createdAt'], ['desc']);
    acc = acc.concat(activeParties.concat(getLastValidClosedPartyForGroup(activeParties, orderedCloseParties)));
    return acc.filter(p => p);
  }, []);

  return adjustParties ? adjustPartiesRank(filteredParties, authUserTeams) : filteredParties;
};

export const personSearch = async (req, query, options) => {
  const { hidePersons } = options;
  const persons = !hidePersons ? await searchPersonsInDb(req.tenantId, query, options) : [];
  return !hidePersons ? await enhancePersons(req, persons) : [];
};

export const globalSearch = async (ctx, query, options) => {
  const { hideUnits, isAutoSuggest = false } = options;

  const trimmedQuery = query.substring(0, GLOBAL_SEARCH_QUERY_MAX_LENGTH);
  const sanitizedQuery = trimmedQuery.includes('@') ? trimmedQuery : phoneSanitize(trimmedQuery);
  options.addPhoneSearch = sanitizedQuery.length >= 7;
  logger.trace({ ctx, trimmedQuery, options, sanitizedQuery }, 'global search query');

  const units = await unitSearch(ctx, sanitizedQuery, options);
  options.searchArchived = !!(units.length && isAutoSuggest);
  const parties = await partySearch(ctx, sanitizedQuery, options);
  const persons = await personSearch(ctx, sanitizedQuery, options);

  if (hideUnits) {
    return orderBy(parties.concat(persons), ['rank'], ['desc']);
  }
  return orderBy(units.concat(parties).concat(persons), ['rank'], ['desc']);
};

const enhancePartiesWithProperty = async (ctx, parties) => {
  const properties = await getProperties(ctx);
  return parties.map(party => {
    const property = properties.find(pr => pr.id === party.assignedPropertyId) || {};
    return { ...party, propertyName: property.displayName || '' };
  });
};

export const getPersonMatches = async req => {
  const matches = await getPersonMatchesFromDb(req.tenantId, req.body);
  const parties = await loadPartiesByPersonIds(
    { tenantId: req.tenantId },
    matches.map(item => item.personObject.id),
  );

  const partiesForMatches = await enhancePartiesWithProperty(req, parties);
  const enhancedPersons = await enhancePersons(
    req,
    matches.map(match => match.personObject),
  );

  return {
    matchedPersons: matches.map(match => ({
      rank: match.rank,
      type: match.type,
      personObject: enhancedPersons.find(person => person.id === match.personObject.id),
      exactEmailMatch: match.exactEmailMatch,
    })),
    partiesForMatches,
  };
};
