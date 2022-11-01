/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import pick from 'lodash/pick';
import orderBy from 'lodash/orderBy';
import omit from 'lodash/omit';
import uniq from 'lodash/uniq';
import uniqBy from 'lodash/uniqBy';
import flatten from 'lodash/flatten';
import get from 'lodash/get';
import isEmpty from 'lodash/isEmpty';
import { mapSeries } from 'bluebird';
import config from '../config';
import loggerModule from '../../common/helpers/logger';
import { now, DATE_ISO_FORMAT, toMoment, rangeMoment } from '../../common/helpers/moment-utils';
import { formatTenantEmailDomain } from '../../common/helpers/utils';
import { getProperties, getMarketingPropertiesWithExtendedInformation, getOccupancyRate, getPropertyAddress } from '../dal/propertyRepo';
import { getMinAndMaxRentForAllAvailableInventories } from '../dal/rmsPricingRepo';
import { getLifestylesForMarketing, getAmenitiesByPropertyId } from '../dal/amenityRepo';
import { getUsedMarketingLayoutGroups } from '../dal/marketingLayoutGroupsRepo';
import { loadProgramForIncomingCommByEmail, loadProgramByMarketingSessionId, getProgramReferences, loadPrograms } from '../dal/programsRepo';
import { formatAssetUrl } from '../workers/upload/uploadUtil';
import { DALTypes } from '../../common/enums/DALTypes';
import { getAssetUrlsByEntityId, getLogoForProperty } from './assets';
import { getTeamsByIds } from '../dal/teamsRepo';
import { getNearbyPlaces, FETCH_BY } from '../../common/server/google-maps';
import * as redis from '../../common/server/redis-client.ts';
import tryParse from '../../common/helpers/try-parse';
import { assert } from '../../common/assert';
import { getMarketingSearches } from '../dal/marketingSearchRepo';
import { formatShortAddress, formatLongAddress, formatFullAddress } from '../../common/helpers/addressUtils';
import { isUrl } from '../../common/regex';
import { isCalendarIntegrationEnabled } from './externalCalendars/cronofyService';
import { getTeamEvents } from '../dal/calendarEventsRepo';
import { getMarketingAssetsByPropertyId } from '../dal/marketingAssetsRepo';

const logger = loggerModule.child({ subType: 'marketingProperties' });
const DEFAULT_MIN_VALUE = 0;
const DEFAULT_MAX_VALUE = 999999;

const marketingBaseRequestAditionalFields = ['cityAliases', 'stateAliases', 'regionAliases', 'neighborhoodAliases'];
const marketingRequiredFields = [
  'city',
  'state',
  'region',
  'neighborhood',
  'tags',
  'testimonials',
  'mapZoomLevel',
  'specials',
  'enableScheduleTour',
  'facebookURL',
  'instagramURL',
  'googleReviewsURL',
  'officeHours',
  'selfServeAllowExpandLeaseLengthsForUnits',
  'enableHeroListingHighlight',
];
const defaultPoiCategories = ['bank', 'hospital', 'transit', 'movie', 'restaurant', 'school', 'shopping'];

const getPropertyMarketingFields = (property, fields) => pick(property.settings.marketing, fields);
const getPropertyBaseFields = async (ctx, property) => {
  const address = property.settings?.marketingLocation || (await getPropertyAddress(ctx, property.id));

  return {
    propertyId: property.id,
    name: property.name,
    displayName: property.displayName,
    geoLocation: property.geoLocation,
    slugUrl: property.website,
    timezone: property.timezone,
    address,
    formattedShortAddress: formatShortAddress(address),
    formattedLongAddress: formatLongAddress(address),
    formattedFullAddress: formatFullAddress(address),
    enableSelfServiceEdit: property.settings?.appointment?.enableSelfServiceEdit,
    ...getPropertyMarketingFields(property, marketingRequiredFields),
  };
};

const formatNumBedrooms = numBedrooms => {
  const bedroomOptions = DALTypes.QualificationQuestions.BedroomOptions;
  return (numBedrooms || []).map(n => Object.keys(bedroomOptions).find(key => bedroomOptions[key] === n));
};

const getPropertyAdditionalFields = async (ctx, property, includeImages = false) => {
  const images = await getAssetUrlsByEntityId(ctx, { entityId: property.id, assetType: DALTypes.AssetType.PROPERTY_MARKETING, getMetadata: true });
  const formattedImages = (images || []).map(({ url, metadata = {} }) => ({ url, caption: metadata.label, floorPlan: metadata.floorPlan }));

  return {
    numBedrooms: formatNumBedrooms(property.numBedrooms),
    surfaceArea: { min: property.minSurfaceArea, max: property.maxSurfaceArea },
    lifestyles: orderBy(property.lifestyles, 'order'),
    imageUrl: images[0]?.url,
    ...(includeImages ? { images: formattedImages } : {}),
  };
};

const getMinAndMaxValuesfromRMS = async (ctx, propertyIds) => {
  const rentValues = await getMinAndMaxRentForAllAvailableInventories(ctx, propertyIds, DALTypes.InventoryType.UNIT);

  if (!propertyIds) {
    const { min = DEFAULT_MIN_VALUE, max = DEFAULT_MAX_VALUE } = rentValues[0] || {};
    return { min, max };
  }

  return propertyIds.map(p => {
    const rent = rentValues.find(r => r.propertyId === p);
    return {
      propertyId: p,
      min: rent?.min || DEFAULT_MIN_VALUE,
      max: rent?.max || DEFAULT_MAX_VALUE,
    };
  });
};

export const enhancePropertyAmenities = async (marketingAmenities, propertyAmenities) => {
  if (!marketingAmenities || marketingAmenities.length === 0) return [];
  const result = await mapSeries(marketingAmenities, async ma => {
    const pa = propertyAmenities.find(p => p.name === ma);
    if (!pa) return null;
    return {
      name: pa.name,
      displayName: pa.displayName,
      description: pa.description,
    };
  });
  return result.filter(e => !!e);
};

const isSmsEnabled = ({ directPhoneIdentifier, metadata = {} }) => {
  const { forwardingEnabled, forwardSMSToExternalTarget } = metadata?.commsForwardingData || {};
  return !!(forwardingEnabled ? forwardSMSToExternalTarget : directPhoneIdentifier);
};

const getProgramUrl = (ctx, property, program) => {
  if (program?.displayUrl) return program.displayUrl;

  const campaignQueryString = program?.name ? `?rtm_campaign=${program.name}` : '';
  const { websiteDomain, website = '' } = property || {};
  if (isUrl(website)) return `${website}${campaignQueryString}`;

  if (!websiteDomain) {
    logger.error({ ctx, program, propertyId: property?.id }, 'websiteDomain is empty when trying to use it');
    return null;
  }

  return `https://${websiteDomain}${website.indexOf('/') === 0 ? '' : '/'}${website}${campaignQueryString}`;
};

const enhanceProgramInformation = (ctx, { domain, program, webSiteProgram, team, onSiteTeam, property }) => ({
  phone: program.displayPhoneNumber || program.directPhoneIdentifier || '',
  smsEnabled: isSmsEnabled(program),
  directEmailIdentifier: program.directEmailIdentifier,
  email: program.displayEmail || (program.directEmailIdentifier ? `${program.directEmailIdentifier}@${domain}` : ''),
  url: getProgramUrl(ctx, property, webSiteProgram),
  team: {
    timeZone: team.timeZone,
    hours: team.hours,
    calendarHours: team.calendarHours,
  },
  onSiteLeasingTeam: {
    timeZone: onSiteTeam?.timeZone,
    hours: onSiteTeam?.hours,
    calendarHours: team.calendarHours,
  },
});

export const convertOfficeHours = officeHours => {
  const formattedHours = {};
  const startOfDay = () => now().startOf('day');

  (Object.keys(officeHours) || []).forEach(
    key =>
      (formattedHours[key] = {
        endTime: startOfDay().add(officeHours[key].endTimeOffsetInMin, 'minutes').format('HH:mm'),
        startTime: startOfDay().add(officeHours[key].startTimeOffsetInMin, 'minutes').format('HH:mm'),
      }),
  );

  return formattedHours;
};

const getJoinedEventRangesForDay = sortedEventsRange =>
  sortedEventsRange.reduce((accumulator, currentValue) => {
    if (accumulator.length === 0) {
      accumulator.push(currentValue);
      return accumulator;
    }

    const lastItemInAccumulator = accumulator[accumulator.length - 1];
    const addRangeResult = lastItemInAccumulator.add(currentValue, { adjacent: true });

    if (addRangeResult === null) {
      accumulator.push(currentValue);
      return accumulator;
    }
    accumulator.pop();
    accumulator.push(addRangeResult);
    return accumulator;
  }, []);

const getOfficeHoursForDay = (startOfDay, teamEvents, timezone) => {
  const endOfDay = startOfDay.clone().add(1, 'days');

  const eventsInterlappingWithDay = teamEvents
    .filter(t => toMoment(t.startDate, { timezone }).isBefore(endOfDay) && startOfDay.isBefore(toMoment(t.endDate, { timezone })))
    .slice()
    .sort((a, b) => a.startDate - b.startDate)
    .map(t => ({ startDate: toMoment(t.startDate, { timezone }), endDate: toMoment(t.endDate, { timezone }) }));

  const sortedEventsRange = eventsInterlappingWithDay.map(st => rangeMoment.range(st.startDate, st.endDate));
  const displayEndOfDay = endOfDay.clone().add(-1, 'minutes');

  const eventsForDay = getJoinedEventRangesForDay(sortedEventsRange);
  if (eventsForDay.length === 0) return { startMoment: startOfDay, endMoment: displayEndOfDay }; // no events for day => day is open all day
  const firstEvent = eventsForDay[0];
  const lastEvent = eventsForDay[eventsForDay.length - 1];

  const firstEventStart = firstEvent.start;
  const firstEventEnd = firstEvent.end;
  const lastEventStart = lastEvent.start;
  const lastEventEnd = lastEvent.end;

  let startWorkDay;
  let endWorkDay;
  if (startOfDay.isSameOrAfter(firstEventStart)) {
    startWorkDay = firstEventEnd.isSameOrAfter(endOfDay) ? endOfDay : firstEventEnd;
  } else {
    startWorkDay = startOfDay;
  }
  // this is needed because the events that should end at the end of the work day are defined in external calendars
  // for teams with 23:59, but we still want to consider that the end of the day for those cases.
  // all day events end at 00:00 the next day
  if (endOfDay.isSameOrBefore(lastEventEnd) || lastEventEnd.isSame(displayEndOfDay)) {
    endWorkDay = lastEventStart.isSameOrBefore(startOfDay) ? startOfDay : lastEventStart;
  } else {
    endWorkDay = displayEndOfDay;
  }
  if (startWorkDay === endOfDay && endWorkDay === startOfDay) {
    return { startMoment: startOfDay, endMoment: endOfDay }; // day is off
  }
  return { startMoment: startWorkDay, endMoment: endWorkDay };
};

export const computeOfficeHoursFromExternalCalendar = async (ctx, team) => {
  const formattedHours = {};
  const startOfWeek = now({ timezone: team.timeZone }).startOf('day');

  const teamEvents = await getTeamEvents(ctx, team.id, startOfWeek.format(DATE_ISO_FORMAT));

  const daysToDisplay = 7;
  let loopCount = 0;
  while (loopCount < daysToDisplay) {
    const startOfDay = startOfWeek.clone().add(loopCount, 'days');
    const determinedWorkHours = getOfficeHoursForDay(startOfDay, teamEvents, team.timeZone);

    if (determinedWorkHours.startMoment && determinedWorkHours.endMoment) {
      formattedHours[startOfDay.format('dddd')] = {
        endTime: determinedWorkHours.endMoment.format('HH:mm'),
        startTime: determinedWorkHours.startMoment.format('HH:mm'),
      };
    }
    loopCount++;
  }

  return formattedHours;
};

const getProgramWithTeamHours = async (ctx, program, property, webSiteProgram) => {
  const domain = await formatTenantEmailDomain(ctx.tenantName, config.mail.emailDomain);
  const teamInfo = await getTeamsByIds(ctx, [program.onSiteLeasingTeamId, program.teamId]);
  const integrationEnabled = await isCalendarIntegrationEnabled(ctx);

  const formattedTeamInfo = await mapSeries(teamInfo, async team => {
    if (integrationEnabled && team.externalCalendars.calendarAccount && team.externalCalendars.teamCalendarId) {
      const hours = await computeOfficeHoursFromExternalCalendar(ctx, team);
      return {
        id: team.id,
        timeZone: team.timeZone,
        hours,
        calendarHours: true,
      };
    }

    return {
      id: team.id,
      timeZone: team.timeZone,
      hours: convertOfficeHours(team.officeHours, team.timeZone),
      calendarHours: false,
    };
  });

  const team = formattedTeamInfo.find(ti => ti.id === program.teamId);
  const onSiteTeam = formattedTeamInfo.find(ti => ti.id === program.onSiteLeasingTeamId);
  return enhanceProgramInformation(ctx, { domain, program, webSiteProgram, team, onSiteTeam, property });
};

export const getProgramAfterConfigMatches = (programs, program, propertyId) =>
  program &&
  programs.find(
    p =>
      p.primaryPropertyId === propertyId &&
      p.path === (program.metadata.requireMatchingPath ? program.path : program.metadata.defaultMatchingPath) &&
      p.sourceId === (program.metadata.requireMatchingSource ? program.sourceId : program.metadata.defaultMatchingSourceId),
  );

const getProgramBySourceMatching = (propertyId, programs, source, path = 'direct') =>
  programs.find(p => p.primaryPropertyId === propertyId && p.path === path && p.source === source);

const extractProgramInformation = async (ctx, propertyId, programInformation) => {
  const programReferenceForProperty = (programInformation.programReferences || []).find(pr => pr.referenceProgramPropertyId === propertyId);

  let program;
  const webSiteProgram = getProgramBySourceMatching(propertyId, programInformation.allPrograms, programInformation.source, 'via-website');
  if (programInformation.source) {
    program = getProgramBySourceMatching(propertyId, programInformation.allPrograms, programInformation.source);
    if (program) return await getProgramWithTeamHours(ctx, program, programInformation.property, webSiteProgram);
  }

  if (programReferenceForProperty) {
    program = programInformation.allPrograms.find(p => p.id === programReferenceForProperty.referenceProgramId);
    if (program) return await getProgramWithTeamHours(ctx, program, programInformation.property, webSiteProgram);
  }

  program = programInformation.program && getProgramAfterConfigMatches(programInformation.allPrograms, programInformation.program, propertyId);
  if (program) {
    return await getProgramWithTeamHours(ctx, program, programInformation.property, webSiteProgram);
  }

  program = programInformation.allPrograms.find(p => p.id === programInformation.defaultProgram);
  const [specificProgram] = !program ? await loadPrograms(ctx, { programId: programInformation.defaultProgram }) : [program];
  return await getProgramWithTeamHours(ctx, specificProgram, programInformation.property, webSiteProgram);
};

const getMarketingLayoutGroupsFields = (tenantId, m) => ({
  id: m.id,
  name: m.name,
  displayName: m.displayName,
  description: m.description,
  shortDisplayName: m.shortDisplayName,
  imageUrl: m.assetId && formatAssetUrl(tenantId, m.assetId),
});

const getMarketingLayoutGroups = async (ctx, propertyIds) => {
  const marketingLayoutGroups = await getUsedMarketingLayoutGroups(ctx, propertyIds);
  if (!propertyIds) {
    const filteredData = orderBy(uniqBy(flatten(marketingLayoutGroups.map(mlg => mlg.mlgInfo)), 'id'), 'order');
    return filteredData.map(m => getMarketingLayoutGroupsFields(ctx.tenantId, m));
  }

  return marketingLayoutGroups.map(mlg => ({
    propertyId: mlg.propertyId,
    marketingLayoutGroups: orderBy(mlg.mlgInfo, 'order').map(m => getMarketingLayoutGroupsFields(ctx.tenantId, m)),
  }));
};

const getProgram = async (ctx, { marketingSessionId, programEmail }) =>
  marketingSessionId ? await loadProgramByMarketingSessionId(ctx, marketingSessionId) : await loadProgramForIncomingCommByEmail(ctx, programEmail);

const isANeighborhood = (propertyNeighborhood, neighborhood) => {
  if (!neighborhood) return true;
  if (propertyNeighborhood) return propertyNeighborhood === neighborhood;

  return false;
};

const filterByAddressValues = (property, addressValues) => {
  const { city, state, region, neighborhood } = addressValues;
  const { state: propertyState, city: propertyCity, region: propertyRegion, neighborhood: propertyNeighborhood } = property.settings.marketing;

  return (
    (propertyState && state ? propertyState === state : true) &&
    (propertyCity && city ? propertyCity === city : true) &&
    (propertyRegion && region ? propertyRegion === region : true) &&
    isANeighborhood(propertyNeighborhood, neighborhood)
  );
};

const filterByBedroomCount = (property, bedroomCount) => {
  if (!bedroomCount || !bedroomCount.length) return true;
  const targetBedroomCount = bedroomCount.map(b => DALTypes.QualificationQuestions.BedroomOptions[b]);
  return targetBedroomCount.some(n => property.numBedrooms.includes(n));
};

const filterByMaxRent = (property, marketRent) => {
  if (!marketRent || !marketRent.max) return true;
  return parseFloat(property.marketRent.min) <= parseFloat(marketRent.max);
};

const filterByMarketingLayoutGroups = (property, marketingLayoutGroups) => {
  if (!marketingLayoutGroups || !marketingLayoutGroups.length) return true;
  return (property.marketingLayoutGroups || []).map(mlg => mlg.id).some(m => marketingLayoutGroups.includes(m));
};

const filterByLifestyles = (property, lifestyles) => {
  if (!lifestyles || !lifestyles.length) return true;
  return lifestyles.every(lifestyle => (property.lifestyles || []).some(({ displayName }) => displayName === lifestyle));
};

const filterByQQ = (properties, { city, state, region, neighborhood, bedroomCount, lifestyles }) =>
  properties
    .filter(p => filterByAddressValues(p, { city, state, region, neighborhood }))
    .filter(p => filterByBedroomCount(p, bedroomCount))
    .filter(p => filterByLifestyles(p, lifestyles));

const filterByMarketingData = (properties, marketingLayoutGroups, marketRent) =>
  properties.filter(p => filterByMarketingLayoutGroups(p, marketingLayoutGroups)).filter(p => filterByMaxRent(p, marketRent));

const getMarketingLayoutGroupsForPropertyAndDaughterProperties = (marketingLayoutGroups, property) => {
  const mlGroups = marketingLayoutGroups.filter(mlg => [property.id, ...property.daughterProperties].includes(mlg.propertyId));

  return uniqBy(flatten(mlGroups.map(m => m.marketingLayoutGroups)), 'name');
};

const enhancePropertiesWithMarketingData = async (ctx, properties) => {
  const propertyIds = properties.map(p => p.id);
  const daughterPropertiesIds = flatten(properties.map(property => property.daughterProperties));
  const allPropertyIds = uniq([...propertyIds, ...daughterPropertiesIds]);
  const rentValues = await getMinAndMaxValuesfromRMS(ctx, propertyIds);
  const marketingLayoutGroups = await getMarketingLayoutGroups(ctx, allPropertyIds);

  return mapSeries(properties, async p => ({
    ...p,
    marketRent: omit(
      rentValues.find(r => r.propertyId === p.id),
      ['propertyId'],
    ),
    marketingLayoutGroups: getMarketingLayoutGroupsForPropertyAndDaughterProperties(marketingLayoutGroups, p),
  }));
};

const filterPropertiesByMarketingInfo = async (ctx, properties, query) => {
  const { marketingLayoutGroups, marketRent, programEmail, marketingSessionId } = query;

  const propertiesWithMarketingData = await enhancePropertiesWithMarketingData(ctx, properties);
  const propertiesFilteredByMarketingData = filterByMarketingData(propertiesWithMarketingData, marketingLayoutGroups, marketRent);

  const program = await getProgram(ctx, { programEmail, marketingSessionId });
  const programReferences = (await getProgramReferences(ctx)).filter(pr => pr.parentProgramId === program.id);
  const allPrograms = await loadPrograms(ctx, { propertyIds: properties.map(p => p.id) });

  return await mapSeries(propertiesFilteredByMarketingData, async p => {
    const contactInfo = await extractProgramInformation(ctx, p.id, {
      program,
      programReferences,
      allPrograms,
      defaultProgram: p.settings.comms.defaultPropertyProgram,
      property: p,
    });

    return {
      ...(await getPropertyBaseFields(ctx, p)),
      ...(await getPropertyAdditionalFields(ctx, p)),
      marketRent: p.marketRent,
      occupancyRate: await getOccupancyRate(ctx, p.id),
      marketingLayoutGroups: p.marketingLayoutGroups,
      ...pick(contactInfo, ['phone', 'email']),
    };
  });
};

const getMarketingPropertiesInformation = async ctx => {
  const properties = await getProperties(ctx, { includeMarketingFilters: true });
  return await mapSeries(properties, async p => ({
    ...(await getPropertyBaseFields(ctx, p)),
    ...getPropertyMarketingFields(p, marketingBaseRequestAditionalFields),
  }));
};

const sortByOccupancyRate = properties => orderBy(properties, p => parseFloat(p.occupancyRate), 'asc');

const filterByIndex = (properties, { offset, limit }) => {
  const startIdx = offset || 0;
  const limitIdx = limit ? startIdx + limit : properties.length;

  return properties.slice(startIdx, limitIdx);
};

const isSameNeighborhood = (property, targetProperty) => property.settings.marketing.neighborhood === targetProperty.settings.marketing.neighborhood;
const isSameCity = (property, targetProperty) => property.settings.marketing.city === targetProperty.settings.marketing.city;
const isSameRegion = (property, targetProperty) => property.settings.marketing.region === targetProperty.settings.marketing.region;
const isSameState = (property, targetProperty) => property.settings.marketing.state === targetProperty.settings.marketing.state;

const getExtendedPropertiesSearchInformation = async (ctx, query) => {
  const properties = await getMarketingPropertiesWithExtendedInformation(ctx, { includeMarketingFilters: true });
  const propertiesFilteredByQQ = filterByQQ(properties, query);
  const filteredPropertiesData = await filterPropertiesByMarketingInfo(ctx, propertiesFilteredByQQ, query);

  return (filterByIndex(sortByOccupancyRate(filteredPropertiesData), query) || []).map(res => omit(res, ['occupancyRate', 'lifestyles']));
};

const RelatedPropertyWeight = {
  Neighborhood: 4,
  City: 3,
  Region: 2,
  State: 1,
  None: 0,
};

const MAX_NUMBER_OF_RELATED_PROPERTIES = 3;

const computeRelatedWeight = (property, targetProperty) => {
  if (property.settings.marketing.neighborhood && isSameNeighborhood(property, targetProperty)) return RelatedPropertyWeight.Neighborhood;
  if (property.settings.marketing.city && isSameCity(property, targetProperty)) return RelatedPropertyWeight.City;
  if (property.settings.marketing.region && isSameRegion(property, targetProperty)) return RelatedPropertyWeight.Region;
  if (property.settings.marketing.state && isSameState(property, targetProperty)) return RelatedPropertyWeight.State;

  return RelatedPropertyWeight.None;
};

const getRelatedPropertiesByWeight = (properties, targetProperty, minLevelOfRelation) => {
  const propertiesWithRelatedWeight = properties.reduce((acc, p) => {
    const relatedWeight = computeRelatedWeight(p, targetProperty);
    if (relatedWeight >= minLevelOfRelation) acc.push({ ...p, relatedWeight });
    return acc;
  }, []);
  const orderedResult = orderBy(propertiesWithRelatedWeight, 'relatedWeight', 'desc');
  return orderedResult.slice(0, MAX_NUMBER_OF_RELATED_PROPERTIES);
};

const getRelatedPropertiesInformation = async (ctx, { targetPropertyId, query }) => {
  const properties = await getMarketingPropertiesWithExtendedInformation(ctx, { includeMarketingFilters: true });
  const targetProperty = properties.find(p => p.id === targetPropertyId);

  properties.splice(properties.indexOf(targetProperty), 1);

  const relatedProperties = getRelatedPropertiesByWeight(properties, targetProperty, RelatedPropertyWeight.Region);
  const filteredPropertiesData = await filterPropertiesByMarketingInfo(ctx, relatedProperties, query);

  return sortByOccupancyRate(filteredPropertiesData).map(res => omit(res, ['occupancyRate', 'lifestyles']));
};

export const getProgramInformationForProperty = async (ctx, property, program, source) => {
  const programReferences = program && (await getProgramReferences(ctx)).filter(pr => pr.parentProgramId === program.id);
  const allPrograms = await loadPrograms(ctx, { propertyIds: [property.id] });

  return await extractProgramInformation(ctx, property.id, {
    program,
    source,
    programReferences,
    allPrograms,
    defaultProgram: property.settings.comms.defaultPropertyProgram,
    property,
  });
};

const getPoiByKeywords = (results, categories) => {
  const poiByCategories = {};
  categories.reduce((acc, cat) => {
    acc[cat] = [];
    return acc;
  }, poiByCategories);

  Object.keys(poiByCategories).reduce((acc, cat) => {
    const poiByCategory = results.filter(res => res.types.find(type => type.includes(cat)));
    acc[cat] = poiByCategory;

    return acc;
  }, poiByCategories);

  return poiByCategories;
};

const getCachedPropertyPointsOfInterest = async (ctx, propertyId) => {
  const cachedPropertyPoiKey = `${propertyId}_poi`;
  const cachedPoi = await redis.getString(ctx, cachedPropertyPoiKey);
  if (cachedPoi) return { ...tryParse(cachedPoi, { poi: {} }), cached: true };
  return {};
};

const cachePropertyPointsOfInterest = async (ctx, propertyId, poi = {}) => {
  if (isEmpty(poi)) return false;
  const cachedPropertyPoiKey = `${propertyId}_poi`;

  return await redis.setString(ctx, cachedPropertyPoiKey, JSON.stringify(poi), {
    keyExpiration: {
      expirationTime: redis.REDIS_KEY_EXPIRATION.NINETY_DAYS,
    },
  });
};

const getPropertyPointsOfInterestByKeywords = async (ctx, propertyId, location, categories) => {
  const cachedPoi = await getCachedPropertyPointsOfInterest(ctx, propertyId);
  if (!isEmpty(cachedPoi)) return cachedPoi;

  const res = await getNearbyPlaces(ctx, {
    fetchBy: FETCH_BY.KEYWORD,
    location,
    categories,
  });

  const poi = {
    categories,
    poi: getPoiByKeywords(res, categories),
  };

  await cachePropertyPointsOfInterest(ctx, propertyId, poi);

  return { ...poi, cached: false };
};

const getPropertyPointsOfInterestByType = async (ctx, propertyId, location, categories) => {
  const cachedPoi = await getCachedPropertyPointsOfInterest(ctx, propertyId);
  if (!isEmpty(cachedPoi)) return cachedPoi;

  const poiByCategories = {};
  await Promise.all(
    categories.map(async cat => {
      const res = await getNearbyPlaces(ctx, {
        fetchBy: FETCH_BY.TYPE,
        location,
        categories: [cat],
      });

      poiByCategories[cat] = res;
    }),
  );

  const poi = {
    categories,
    poi: poiByCategories,
  };

  await cachePropertyPointsOfInterest(ctx, propertyId, poi);

  return { ...poi, cached: false };
};

const getPropertyPointsOfInterest = async (ctx, property, options = { getBy: 'type', timeout: 3000 }) => {
  const { getBy, timeout = 3000 } = options;
  let propertyPointsOfInterest = {
    poi: {},
  };

  if (config.isIntegration) return propertyPointsOfInterest;

  try {
    logger.trace({ ctx, getBy, propertyId: property?.id }, 'getting property points of interest');
    const { id: propertyId } = property;
    const location = property.geoLocation;
    const categories = getBy === 'type' ? get(property, 'settings.marketing.mapPlaces', []) : defaultPoiCategories;

    assert(propertyId, 'getPropertyPointsOfInterest: propertyId must be defined');
    assert(location, 'getPropertyPointsOfInterest: geoLocation must be defined');

    const fetchPoi =
      getBy === 'keyword'
        ? getPropertyPointsOfInterestByKeywords(ctx, propertyId, location, categories)
        : getPropertyPointsOfInterestByType(ctx, propertyId, location, categories);

    propertyPointsOfInterest = await Promise.race([
      fetchPoi,
      new Promise((resolve, reject) => {
        setTimeout(() => {
          reject(new Error(`Execution timed out after ${timeout} milliseconds`));
        }, timeout);
      }),
    ]).then(
      val => val,
      err => {
        throw err;
      },
    );
  } catch (error) {
    logger.error({ ctx, getBy, propertyId: property?.id, error }, 'An error occured getting the property points of interest');
  }

  return propertyPointsOfInterest;
};

export const getExtendedPropertyInformation = async (
  ctx,
  { propertyId, program, source, includeImages = false, includePOIs = false, includeAmenities = false },
) => {
  const properties = await getMarketingPropertiesWithExtendedInformation(ctx);
  const property = properties.find(p => p.id === propertyId);
  const daughterPropertiesIds = property.daughterProperties;

  const baseFields = await getPropertyBaseFields(ctx, property);
  const additionalFields = await getPropertyAdditionalFields(ctx, property, includeImages);
  const mlgs = await getMarketingLayoutGroups(ctx, [property.id, ...daughterPropertiesIds]);
  const mlgsForPropertyAndDaughterProperties = getMarketingLayoutGroupsForPropertyAndDaughterProperties(mlgs, property);
  const marketRent = omit((await getMinAndMaxValuesfromRMS(ctx, [property.id]))[0], ['propertyId']);
  const propertyName = baseFields.name;
  const logoUrl = await getLogoForProperty(ctx, {
    propertyName,
  });

  const programInfo = omit(await getProgramInformationForProperty(ctx, property, program, source), ['directEmailIdentifier']);
  if (programInfo.team.calendarHours) {
    baseFields.officeHours = ''; // if we have calendar enabled for the team, we should disregard the property marketing office hours and take the one from the external calendars
  }

  const result = {
    ...baseFields,
    ...additionalFields,
    marketingLayoutGroups: mlgsForPropertyAndDaughterProperties,
    marketRent,
    ...programInfo,
    logoUrl,
  };

  const unitMarketingAssets = await getMarketingAssetsByPropertyId(ctx, propertyId);
  result.videoUrls = unitMarketingAssets.filter(a => a.type === DALTypes.MarketingAssetType.VIDEO);
  result['3DUrls'] = unitMarketingAssets.filter(a => a.type === DALTypes.MarketingAssetType.THREE_D);

  if (includeAmenities) {
    const amenities = await getAmenitiesByPropertyId(ctx, propertyId);
    result.propertyAmenities = await enhancePropertyAmenities(property.settings.marketing.propertyAmenities, amenities);
    result.layoutAmenities = await enhancePropertyAmenities(property.settings.marketing.layoutAmenities, amenities);
  }

  if (includePOIs) {
    result.propertyPointsOfInterest = await getPropertyPointsOfInterest(ctx, property);
  }

  return result;
};

export const respondToMarketingPropertiesRequest = async ctx => {
  logger.trace({ ctx }, 'handling marketing Properties request');
  const properties = await getMarketingPropertiesInformation(ctx);
  const marketRent = await getMinAndMaxValuesfromRMS(ctx);
  const marketingLayoutGroups = await getMarketingLayoutGroups(ctx);
  const lifestyles = await getLifestylesForMarketing(ctx);
  const marketingSearch = await getMarketingSearches(ctx);
  return { marketingLayoutGroups, marketRent, properties, lifestyles, marketingSearch };
};

export const respondToMarketingPropertiesSearchRequest = async (ctx, requestData) => {
  logger.trace({ ctx, requestData, readOnlyServer: ctx.readOnlyServer }, 'handling marketing Properties search request');
  return await getExtendedPropertiesSearchInformation(ctx, requestData);
};

export const respondToMarketingPropertyRequest = async (
  ctx,
  propertyId,
  { programEmail, marketingSessionId, includePOIs = false, includeAmenities = false },
) => {
  const program = await getProgram(ctx, { programEmail, marketingSessionId });
  logger.trace({ ctx, propertyId, program, includePOIs }, 'handling marketing property request');
  return await getExtendedPropertyInformation(ctx, { propertyId, program, includePOIs, includeAmenities, includeImages: true });
};

export const respondToMarketingRelatedPropertiesSearchRequest = async (ctx, requestData) => {
  logger.trace({ ctx, requestData }, 'handling marketing property search request');
  return await getRelatedPropertiesInformation(ctx, requestData);
};
