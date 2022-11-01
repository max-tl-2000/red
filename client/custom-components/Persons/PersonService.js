/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { client } from '../../apiClient';

const getPersonByExactEmail = (persons, email = '') =>
  persons.find(person => person.contactInfo.emails.some(e => e.value.toLowerCase() === email.toLowerCase()));

const getPersonByExactPhone = (persons, phone) => persons.find(person => person.contactInfo.phones.some(e => e.value === phone));

// the endpoint should be `/validations/emailIsAvaiable` or something similar worst case scenario
// the endpoint should just respond with the person entity directly, or none if none found
export const emailIsTaken = async email => {
  const persons = await client.post('/search/persons', {
    data: { emails: [email], filters: { includeSpam: true } },
  });
  if (!persons.length) return null;

  return getPersonByExactEmail(persons, email);
};

export const phoneNumberAlreadyUsedByPerson = async phoneNo => {
  const persons = await client.post('/search/persons', {
    data: { phones: [phoneNo], filters: { includeSpam: true } },
  });
  if (!persons.length) return null;

  return getPersonByExactPhone(persons, phoneNo.replace('+', ''));
};
