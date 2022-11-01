/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import {
  getBlacklist as getBlacklistRepo,
  addToBlacklist as addToBlacklistRepo,
  removeFromBlacklist as removeFromBlacklistRepo,
  getSpamCommunicationsGroupedByFrom,
} from '../../dal/blacklistRepo';
import { getPersonsWithoutContactInfo as getPersons } from '../../dal/personRepo';
import { getObjectKeysAsArray } from '../../common/utils';
import { ServiceError } from '../../common/errors';
import { DALTypes } from '../../../common/enums/DALTypes';

const getPersonData = (allPersons, personId) => {
  const person = allPersons.find(p => p.id === personId);
  return {
    id: person.id,
    preferredName: person.preferredName,
    fullName: person.fullName,
  };
};

const groupPersonsByContactInfo = (allPersons, contactsInfo, spamCommsMap) =>
  contactsInfo.reduce((acc, item) => {
    const key = item.value;
    const personData = getPersonData(allPersons, item.personId);
    let contactInfoWithPersonList;

    if (acc[key]) {
      const { persons, ...rest } = acc[key];

      contactInfoWithPersonList = {
        ...rest,
        persons: [...persons, personData],
      };
    } else {
      const { type, value, personId, updated_at, markedAsSpamBy } = item; // eslint-disable-line
      const statistics = spamCommsMap.get(value);

      contactInfoWithPersonList = {
        type,
        value,
        markedAsSpamBy,
        persons: [personData],
        lastContact: statistics && statistics.lastContact,
        messageCount: (statistics && statistics.messageCount) || 0,
      };
    }

    acc[key] = contactInfoWithPersonList;
    return acc;
  }, {});

const getSpamCommsMap = async req => {
  const spamComms = await getSpamCommunicationsGroupedByFrom(req);
  return new Map(spamComms.map(comm => [comm.from, comm]));
};

export const getBlacklist = async req => {
  const spamCommsMap = await getSpamCommsMap(req);
  const allPersons = await getPersons(req);
  const contactsInfo = await getBlacklistRepo(req);
  const contactsInfoWithPersonList = groupPersonsByContactInfo(allPersons, contactsInfo, spamCommsMap);
  return getObjectKeysAsArray(contactsInfoWithPersonList);
};

const validateContactInfoType = async (ctx, type) => {
  const validContactInfoTypes = getObjectKeysAsArray(DALTypes.ContactInfoType);

  if (!validContactInfoTypes.includes(type)) {
    throw new ServiceError({
      token: 'CONTACT_INFO_TYPE_INVALID',
      status: 400,
    });
  }
};

const checkIfContactInfoValueIsSet = email => {
  if (!email) {
    throw new ServiceError({
      token: 'CONTACT_INFO_VALUE_MISSING',
      status: 400,
    });
  }
};

export const addToBlacklist = async req => {
  const { type, value } = req.body;
  await validateContactInfoType(req, type);
  checkIfContactInfoValueIsSet(value);
  return await addToBlacklistRepo(req, type, value);
};

export const removeFromBlacklist = async req => {
  const { type, value } = req.body;
  await validateContactInfoType(req, type);
  checkIfContactInfoValueIsSet(value);
  return await removeFromBlacklistRepo(req, type, value);
};
