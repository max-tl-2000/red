/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import flatMap from 'lodash/flatMap';
import range from 'lodash/range';
import random from 'lodash/random';
import sample from 'lodash/sample';
import logger from '../../../../common/helpers/logger';
import { updateTenantPhoneNumbers, getTenantData, updateTenant } from '../../../dal/tenantsRepo';
import { admin } from '../../../common/schemaConstants';

const FAKE_NUMBERS_COUNT = 200;
const countryPrefix = 1;
const fakeNumberConstant = 5550;
const fakeNumberPattern = (cityPrefix, suffix) => `${countryPrefix}${cityPrefix}${fakeNumberConstant}${100 + suffix}`;

const cityPrefixes = [
  202, // Washington
  207, // Augusta
  208, // Boise
  225, // Baton Rouge
  302, // Dover
  303, // Denver
  307, // Cheyenne
  317, // Indianapolis
  334, // Montgomery
  360, // Olympia
  385, // Salt Lake City
  401, // Providence
  402, // Lincoln
  404, // Atlanta
  405, // Oklahoma City
  406, // Helena
  410, // Annapolis
  417, // Springfield
  501, // Little Rock
  502, // Frankfort
  503, // Salem
  505, // Santa Fe
  512, // Austin
  515, // Des Moines
  517, // Lansing
  518, // Albany
  573, // Jefferson City
  601, // Jackson
  602, // Phoenix
  603, // Concord
  605, // Pierre
  608, // Madison
  609, // Trenton
  614, // Columbus
  615, // Nashville
  617, // Boston
  651, // Saint Paul
  701, // Bismarck
  717, // Harrisburg
  775, // Carson City
  785, // Topeka
  802, // Montpelier
  803, // Columbia
  804, // Richmond
  808, // Honolulu
  843, // Charleston
  850, // Tallahassee
  860, // Hartford
  904, // Jacksonville
  907, // Juneau
  916, // Sacramento
  919, // Raleigh
];
// according to https://en.wikipedia.org/wiki/555_(telephone_number)
// 555-0100 through 555-0199 are now specifically reserved for fictional use

export const getAvailableNumbers = usedByCucumber => {
  logger.info({ usedByCucumber }, 'Fake telephony provider - getAvailableNumbers');

  const suffixes = range(100);
  return flatMap(cityPrefixes, prefix => suffixes.map(suffix => fakeNumberPattern(prefix, suffix)));
};

export const setupUser = async ({ user }) => {
  logger.info({ userId: user.id }, 'Fake telephony provider - setupUser: ');
};

export const createIpPhoneEndpoint = async ({ user }) => {
  logger.info({ userId: user.id }, 'Fake telephony provider - createIpPhoneEndpoint: ');
};

export const removeIpPhoneEndpoint = async ({ user }) => {
  logger.info({ userId: user.id }, 'Fake telephony provider - removeIpPhoneEndpoint: ');
};

export const setupTenant = async tenant => {
  logger.info({ tenantId: tenant.id, tenantName: tenant.name }, 'Fake telephony provider - setupTenant: ');

  const allNumbers = await getAvailableNumbers();

  const numbersLength = FAKE_NUMBERS_COUNT;
  const start = random(0, allNumbers.length - numbersLength);
  const end = start + numbersLength;

  const phoneNumbers = allNumbers.slice(start, end).map(phoneNumber => ({ phoneNumber }));

  return updateTenantPhoneNumbers({ tenantId: tenant.id }, tenant, phoneNumbers);
};

export const deleteEndpoints = endpoints => logger.info({ endpoints }, 'Fake telephony provider - deleteEndpoints: ');

export const deleteRecordings = recordings => logger.info({ recordings }, 'Fake telephony provider - deleteRecordings: ');

export const cleanupTenant = async ({ tenant }) => {
  logger.info({ tenantId: tenant.id, tenantName: tenant.name }, 'Fake telephony provider - cleanupTenant: ');
};

export const deassignPhoneNumbers = async numbersToDeassign => {
  logger.info('Fake telephony provider - cleanupTenant: ', numbersToDeassign);
};

export const assignPhoneNumbers = async numbersToAssign => {
  logger.info('Fake telephony provider - assign numbers: ', numbersToAssign);
  return numbersToAssign;
};

export const createGuestApplication = async ({ id }) => {
  logger.info('creating fake guest application');
  const adminCtx = { tenantId: admin.id };
  const tenant = await getTenantData(adminCtx, id);
  const numbers = await getAvailableNumbers();

  const assignedPhoneNumber = numbers[numbers.length - 1];
  const phoneNumbers = [
    ...tenant.metadata.phoneNumbers,
    {
      phoneNumber: assignedPhoneNumber,
    },
  ];
  logger.info(`creating fake guest application with phone ${assignedPhoneNumber}`);

  const tenantMetadata = {
    ...tenant.metadata,
    phoneNumbers,
    plivoGuestAppId: 'fake-plivo-guest-app-id',
    plivoGuestPhoneNumber: assignedPhoneNumber,
  };

  await updateTenant(adminCtx, tenant.id, { metadata: tenantMetadata });
};

export const buyNumber = number => {
  logger.info({ number }, 'Fake telephony provider - buyPhoneNumber: ');
};

export const searchNumbers = ({ maxResults = 24, pattern }) => {
  logger.info({ maxResults, pattern }, 'Fake telephony provider - searchNumbers: ');
  if (!cityPrefixes.includes(parseInt(pattern, 10)) && pattern !== '') return [];
  return range(maxResults).map(() => {
    const patternForSearch = pattern === '' ? sample(cityPrefixes) : pattern;
    const id = fakeNumberPattern(patternForSearch, Math.floor(Math.random() * (99 - 10) + 10));
    return { id };
  });
};
