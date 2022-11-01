/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import uniq from 'lodash/uniq';
import { getPropertyTimezone, getPropertyId, getPropertiesByExternalIds, getPropertiesByNames } from '../../services/properties';
import { ImportMappersEntityTypes } from '../../../common/enums/enums';
import { createParty, createPartyMember } from '../../dal/partyRepo.js';
import { createPerson } from '../../dal/personRepo.js';
import { enhance } from '../../../common/helpers/contactInfoUtils';
import { enhanceContactInfoWithSmsInfo } from '../../services/telephony/twilio';

/* This function gets the roperty using the propertyName or the externalId in the csv row,
   in this case the row is an array, so we first find out the array index of the param
*/
export const getPropertyByNameIndex = (ctx, { entityType, row, propertyNameIndex, properties }) => {
  const filter = row[propertyNameIndex];
  const filterBy = entityType === ImportMappersEntityTypes.UnitAmenitiesMapper ? p => p.name === filter : p => p.externalId === filter;
  return properties.find(filterBy) || {};
};

// This function gets the timezone of the property using the propertyName in the csv row, in this case the row is an object
export const getTimezoneByPropertyColumn = async (ctx, row, column) => {
  const propertyId = await getPropertyId(ctx, row[column]);
  return await getPropertyTimezone(ctx, propertyId);
};

const getRowPropertyNames = (rows, propertyNameIndex) => rows.map(row => row[propertyNameIndex]);

export const getRowsProperties = async (ctx, { entityType, rows, propertyNameIndex }) => {
  const propertyNames = uniq(getRowPropertyNames(rows, propertyNameIndex));
  return entityType === ImportMappersEntityTypes.UnitAmenitiesMapper
    ? await getPropertiesByNames(ctx, propertyNames)
    : await getPropertiesByExternalIds(ctx, propertyNames);
};

export const handleCreateParty = async ({ ctx, partyState, fullName, preferredName, memberType, externalId, email, phone, cellPhone, partyId }) => {
  let dbParty = {};
  if (!partyId) {
    const party = {
      state: partyState,
    };
    dbParty = await createParty(ctx, party);
  } else {
    dbParty.id = partyId;
  }
  const member = {
    fullName,
    preferredName,
    memberType,
    memberState: 'Applicant',
    contactInfo: [],
    externalId,
  };
  if (phone) member.contactInfo.push({ type: 'phone', value: phone });
  if (email) member.contactInfo.push({ type: 'email', value: email });
  if (cellPhone) member.contactInfo.push({ type: 'phone', value: cellPhone });

  member.contactInfo.all = await enhanceContactInfoWithSmsInfo(ctx, member.contactInfo.all);

  const person = await createPerson(ctx, {
    fullName,
    preferredName,
    contactInfo: enhance(member.contactInfo),
  });
  const guest = {
    ...member,
    personId: person.id,
    contactInfo: enhance(member.contactInfo),
  };
  await createPartyMember(ctx, guest, dbParty.id);
};
