/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import uuid from 'uuid/v4';
import SparkMD5 from 'spark-md5';
import update from 'lodash/update';
import trim from './trim';
import { window } from './globals';
import { DALTypes } from '../enums/DALTypes';
import { approvedScreening, conditionalScreening, deniedScreening } from '../enums/applicationTypes';

export const SEARCH_LIMIT_RESULTS = 20;

export const maxUnixTenantName = 20;

export const minUnixTenantName = 4;

export const formatTenantEmailDomain = (tenantName, emailDomain) => `${tenantName}.${emailDomain}`;

export const getEmailAddressWithoutDomain = email => email.split('@').shift();

export const computeThreadId = (type, persons) => {
  const personsString = persons.concat().sort().join('_');
  return SparkMD5.hash(`${type}_${personsString}`);
};

export const getPriceByPeriod = (priceObject, period) => {
  switch (period) {
    case 'month':
      return priceObject.basePriceMonthly;
    case 'week':
      return priceObject.basePriceWeekly;
    case 'day':
      return priceObject.basePriceDaily;
    case 'hour':
      return priceObject.basePriceHourly;
    default:
      return null;
  }
};

export const formatFromEmailAddress = ({ fullName }, teamEmailAddress) => `${fullName} ${teamEmailAddress}`;

export const getNewFromEmailAddress = (ctx, senderName, config) => {
  const id = uuid();
  const emailIdentifier = id.replace('-', '').substring(0, 20);
  const emailDomain = formatTenantEmailDomain(ctx.tenantName, config.mail.emailDomain);
  const emailAddress = `${emailIdentifier}@${emailDomain}`;
  return formatFromEmailAddress({ fullName: senderName }, emailAddress);
};

const trimBeforeComma = message => message.replace(/ \,/g, ','); // eslint-disable-line no-useless-escape

export const replaceTemplatedValues = (str, mapObj) => {
  try {
    const regex = Object.keys(mapObj)
      .map(p => `\{${p}\}`) // eslint-disable-line no-useless-escape
      .join('|');
    const re = new RegExp(regex, 'gi');
    const message = str.replace(re, matched => mapObj[matched.slice(1, matched.length - 1)]);
    return trimBeforeComma(message);
  } catch (e) {
    console.log({ error: e }, 'Error in replaceTemplatedValues ');
  }
  return '';
};

// replace the last 4 chars of SSN with X's
// Note this works regardless of whether SSN has dashes or not.
export const maskSSNWithX = ssn => (ssn ? `${ssn.substring(0, ssn.length - 4)}XXXX` : ssn);

export const applicationWithMaskedSSN = application => {
  update(application, 'applicationData.ssn', maskSSNWithX);
  update(application, 'applicationData.itin', maskSSNWithX);
  return application;
};

const extractValueFromXml = (xml, matchExpression) => {
  const [, matchedValue = ''] = xml.match(matchExpression) || [];
  return matchedValue;
};

export const getRequestTypefromRaw = request => extractValueFromXml(request.rawRequest, /<RequestType>(.*)<\/RequestType>/);

export const getRequestReportIdfromRaw = request => extractValueFromXml(request.rawRequest, /<ReportID>(.*)<\/ReportID>/);

export const formatPropertyAddress = property => {
  const {
    address: { addressLine1, city, state },
  } = property;
  return [addressLine1, city, state].join(', ');
};

// replace empty spaces should consider the case it might receive an undefined or null values
export const replaceEmptySpaces = string => trim(string).replace(/\s+/g, '');
export const removeEmptySpacesAndNonAlphanumeric = string => trim(string).replace(/[^a-zA-Z0-9]+/g, '');

export const isDemoDomain = (ctx = null) => {
  const host = (window.location || (ctx && ctx.headers) || {}).host || '';

  return host.match(/^demo(.*)\./);
};

// This method is implemented like this temporarily for CPM-12803
export const isUnitPricingEnabled = tenantName => tenantName && (tenantName.includes('customerold') || tenantName.includes('customernew'));

export const isCommAnOutgoingDirectMessage = comm =>
  comm.direction === DALTypes.CommunicationDirection.OUT && comm.type === DALTypes.CommunicationMessageType.DIRECT_MESSAGE;

export const removeEmptyElementsFromArray = (array = []) => (Array.isArray(array) ? array.filter(e => e) : []);

export const isBlueMoonLeasingProviderMode = providerMode =>
  [DALTypes.LeasingProviderMode.BLUEMOON_PROD, DALTypes.LeasingProviderMode.BLUEMOON_TEST].includes(providerMode);

export const isUserAuthorizedToExportCreditReport = (screeningDecision, currentUser, partyTeam) => {
  if (!screeningDecision || !currentUser || !partyTeam) return false;

  const teamLevels = currentUser.laaAccessLevels.find(level => level.teamId === partyTeam);
  if (!teamLevels) return false;

  const allLevels = [DALTypes.LAAAccessLevels.APPROVED_SCREENING, DALTypes.LAAAccessLevels.CONDITIONAL_SCREENING, DALTypes.LAAAccessLevels.DENIED_SCREENING];

  if (allLevels.every(level => teamLevels.laaAccessLevels.includes(level))) {
    return true;
  }

  const decision = screeningDecision.toLowerCase();

  if (approvedScreening.includes(decision) && teamLevels.laaAccessLevels.includes(DALTypes.LAAAccessLevels.APPROVED_SCREENING)) return true;
  if (conditionalScreening.includes(decision) && teamLevels.laaAccessLevels.includes(DALTypes.LAAAccessLevels.CONDITIONAL_SCREENING)) return true;
  if (deniedScreening.includes(decision) && teamLevels.laaAccessLevels.includes(DALTypes.LAAAccessLevels.DENIED_SCREENING)) return true;

  return false;
};
