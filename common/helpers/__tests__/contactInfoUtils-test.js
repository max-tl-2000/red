/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect, when } from '../../test-helpers';
import { enhance } from '../contactInfoUtils';

describe('enhance', () => {
  when('input is undefined or not an array', () => {
    it('throws invalid argument error', () => {
      expect(enhance()).to.deep.equal({ all: [] });
      expect(enhance(42)).to.deep.equal({ all: [] });
    });
  });

  when('input does not contain entries of certain types', () => {
    it('defaults should be undefined', () => {
      const { defaultPhone, defaultEmail } = enhance([]);
      expect(defaultPhone).to.not.be.ok;
      expect(defaultEmail).to.not.be.ok;
    });
  });

  when('input is an array of contact info', () => {
    it('should return a structure with first endpoint as default', () => {
      const contactInfos = [
        { type: 'phone', value: '11111111111' },
        { type: 'phone', value: '33333333333' },
        { type: 'email', value: 'aaa@bbb.ccc' },
        { type: 'email', value: 'ddd@eee.fff' },
      ];

      const { defaultPhone, defaultEmail } = enhance(contactInfos);
      expect(defaultPhone).to.equal('11111111111');
      expect(defaultEmail).to.equal('aaa@bbb.ccc');
    });
  });

  when('input is an array of contact info items with ids', () => {
    it('should return a structure with default ids', () => {
      const contactInfos = [
        { id: '1', type: 'phone', value: '11111111111' },
        { id: '2', type: 'phone', value: '33333333333' },
        { id: '3', type: 'email', value: 'aaa@bbb.ccc' },
        { id: '4', type: 'email', value: 'ddd@eee.fff' },
      ];

      const { defaultPhoneId, defaultEmailId } = enhance(contactInfos);

      expect(defaultPhoneId).to.equal('1');
      expect(defaultEmailId).to.equal('3');
    });
  });

  when('input is an array of contact info with default contactInfos marked', () => {
    it('should return a structure with marked endpoint as defaults', () => {
      const contactInfos = [
        { type: 'phone', value: '11111111111' },
        { type: 'phone', value: '33333333333', isPrimary: true },
        { type: 'email', value: 'aaa@bbb.ccc' },
        { type: 'email', value: 'ddd@eee.fff', isPrimary: true },
      ];

      const { defaultPhone, defaultEmail } = enhance(contactInfos);
      expect(defaultPhone).to.equal('33333333333');
      expect(defaultEmail).to.equal('ddd@eee.fff');
    });
  });

  it('should return a structure that can provide phones and emails', () => {
    const contactInfos = [
      { type: 'phone', value: '11111111111' },
      { type: 'phone', value: '33333333333', isPrimary: true },
      { type: 'email', value: 'aaa@bbb.ccc' },
      { type: 'email', value: 'ddd@eee.fff', isPrimary: true },
    ];

    const { phones, emails } = enhance(contactInfos);
    expect(phones).to.deep.equal([
      { type: 'phone', value: '11111111111' },
      { type: 'phone', value: '33333333333', isPrimary: true },
    ]);

    expect(emails).to.deep.equal([
      { type: 'email', value: 'aaa@bbb.ccc' },
      { type: 'email', value: 'ddd@eee.fff', isPrimary: true },
    ]);
  });

  it('should return a structure that agregates all contact info entries', () => {
    const contactInfos = [
      { type: 'phone', value: '11111111111' },
      { type: 'phone', value: '33333333333', isPrimary: true },
      { type: 'email', value: 'aaa@bbb.ccc' },
      { type: 'email', value: 'ddd@eee.fff', isPrimary: true },
    ];

    const { all } = enhance(contactInfos);
    expect(all).to.deep.equal(contactInfos);
  });

  when("default contact info item isn't market as default", () => {
    it('should be marked', () => {
      const contactInfoItems = [
        { type: 'phone', value: '12345123451' },
        { type: 'phone', value: '55555555555' },
        { type: 'email', value: 'me@me.me' },
        { type: 'email', value: 'you@you.you' },
      ];

      const updated = enhance(contactInfoItems);

      const expected = [
        { type: 'phone', value: '12345123451', isPrimary: true },
        { type: 'phone', value: '55555555555' },
        { type: 'email', value: 'me@me.me', isPrimary: true },
        { type: 'email', value: 'you@you.you' },
      ];
      expect(updated.all).to.deep.equal(expected);
    });
  });
});
