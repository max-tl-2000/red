/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { isAnonymousEmail } from '../anonymous-email';

describe('Anonymous email detection', () => {
  [
    {
      email: 'r7nyhb467r58rqf5p9_dcrdk1l@zlead.co',
      isAnonymized: true,
    },
    {
      email: '3b90555ff8dd3110befca435d58c1c53@reply.craigslist.org',
      isAnonymized: true,
    },
    {
      email: 'jack.harkness.mwy3y@renter.apartmentlist.com',
      isAnonymized: true,
    },
    {
      email: 'jackharkness.mwy3y@renter.apartmentlist.com',
      isAnonymized: false,
    },
    {
      email: 'reply+070e18faf53f41299bf1f4ef255ff4f2@messaging.yelp.com',
      isAnonymized: true,
    },
    {
      email: 'reply-feb51d73736c0c75-473_HTML-166810988-6237193-117936@email.rent.com',
      isAnonymized: true,
    },
    {
      email: 'reply-feb71d7873670d78-473_HTML-166824132-7001514-174930@message.my.apartmentguide.com',
      isAnonymized: true,
    },
    {
      email: 'abodoleads+7ox1m0hgd67l@abodoapts.com',
      isAnonymized: true,
    },
    {
      email: 'reply070e18faf53f41299bf1f4ef255ff4f2@messaging.yelp.com',
      isAnonymized: false,
    },
    {
      email: 'bill@reva.teh',
      isAnonymized: false,
    },
  ].forEach(({ email, isAnonymized }) => {
    it(`should return '${isAnonymized}' when the email is ${email}`, () => {
      expect(isAnonymousEmail(email)).to.be.equal(isAnonymized);
    });
  });
});
