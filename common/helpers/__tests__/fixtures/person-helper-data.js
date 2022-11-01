/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const expectedEmptyMsg = 'should return empty string';
export const displayNamedata = [
  { description: 'if nullish value is provided', expected: expectedEmptyMsg, person: null, result: '' },
  { description: 'if an empty object is provided', expected: expectedEmptyMsg, person: {}, result: '' },
  {
    description: 'if there is a displayName property in the structure',
    expected: 'should use it over fullName or preferredName',
    person: { displayName: 'Snoopy the dog', fullName: 'Snoopy G. Doo', preferredName: 'Snoopy' },
    result: 'Snoopy the dog',
  },
  {
    description: 'if the flag usePreferred is set to true',
    expected: 'should use preferredName',
    person: { fullName: 'Snoopy G. Doo', preferredName: 'Snoopy' },
    options: { usePreferred: true },
    result: 'Snoopy',
  },
  {
    description: 'if there is no displayName',
    expected: 'should use the fullName by default',
    person: { fullName: 'Snoopy G. Doo', preferredName: 'Snoopy' },
    result: 'Snoopy G. Doo',
  },
  {
    description: 'if there is only an email and a phone in the structure',
    expected: 'should return the email',
    person: { contactInfo: { defaultPhone: '14084119389', defaultEmail: 'snoopy@doo.com' } },
    result: 'snoopy@doo.com',
  },
  {
    description: 'if there is only a phone in the structure',
    expected: 'should return the phone formatted',
    person: { contactInfo: { defaultPhone: '14084109389' } },
    result: '(408) 410-9389',
  },
  {
    description: 'When the person has a preferredName and usePreferred is true',
    expected: 'should return the preferredName',
    person: { preferredName: 'Juanita', fullName: 'Juana Ramirez', contactInfo: { defaultPhone: '14084109389' } },
    options: { ignoreContactInfo: true, usePreferred: true },
    result: 'Juanita',
  },
  {
    description: 'When the person doesnt have a preferredName and has fullName and usePreferred is true',
    expected: 'should return the fullName',
    person: { preferredName: null, fullName: 'Juana Ramirez', contactInfo: { defaultPhone: '14084109389' } },
    options: { ignoreContactInfo: true, usePreferred: true },
    result: 'Juana Ramirez',
  },
  {
    description: 'When the person doesnt have a preferredName nor a fullName and usePreferred is true',
    expected: expectedEmptyMsg,
    person: { preferredName: null, fullName: null, contactInfo: { defaultPhone: '14084109389' } },
    options: { ignoreContactInfo: true, usePreferred: true },
    result: '',
  },
];
