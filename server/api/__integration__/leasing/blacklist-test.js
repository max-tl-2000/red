/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';
import app from '../../api';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import { saveContactInfo } from '../../../dal/contactInfoRepo';
import { getBlacklist } from '../../actions/blacklist';
import { testCtx as ctx, createAPerson, createAUser } from '../../../testUtils/repoHelper';
import { tenant } from '../../../testUtils/setupTestGlobalContext';

describe('API/blacklist', () => {
  describe('given some created contactInfos, when loading the blacklist', () => {
    it('should return all contactInfos marked as spam', async () => {
      const { id: personId } = await createAPerson();

      const contactInfos = [
        {
          type: 'email',
          value: 'email@domain.com',
          isSpam: true,
        },
        {
          type: 'email',
          value: 'email2@domain.com',
          isSpam: false,
        },
        {
          type: 'email',
          value: 'email3@domain.com',
          isSpam: true,
        },
      ];

      await saveContactInfo(ctx, contactInfos, personId);

      const response = await request(app).get('/blacklist').set(getAuthHeader());

      expect(response.status).to.equal(200);
      expect(response.body.length).to.equal(2);
    });
  });

  describe('when adding a phone/email to the blacklist and the type is not valid', () => {
    it('responds with status code 400 and CONTACT_INFO_TYPE_INVALID token', async () => {
      const response = await request(app).post('/blacklist').set(getAuthHeader()).send({ type: 'some-invalid-type', value: 'a@a.com' });

      expect(response.status).to.equal(400);
      expect(response.body.token).to.equal('CONTACT_INFO_TYPE_INVALID');
    });
  });

  describe('when adding a phone/email to the blacklist and the type is not set', () => {
    it('responds with status code 400 and CONTACT_INFO_TYPE_INVALID token', async () => {
      const response = await request(app).post('/blacklist').set(getAuthHeader()).send({ value: 'a@a.com' });

      expect(response.status).to.equal(400);
      expect(response.body.token).to.equal('CONTACT_INFO_TYPE_INVALID');
    });
  });

  describe('when adding a phone/email to the blacklist and the value is not set', () => {
    it('responds with status code 400 and CONTACT_INFO_VALUE_MISSING token', async () => {
      const response = await request(app).post('/blacklist').set(getAuthHeader()).send({ type: 'email' });

      expect(response.status).to.equal(400);
      expect(response.body.token).to.equal('CONTACT_INFO_VALUE_MISSING');
    });
  });

  describe('when adding a phone/type to the blacklist', () => {
    it('should be marked as spam', async () => {
      const user = await createAUser();

      const contactsInfo = [
        {
          type: 'email',
          value: 'email@domain.com',
          isSpam: false,
        },
        {
          type: 'email',
          value: 'email2@domain.com',
          isSpam: false,
        },
        {
          type: 'email',
          value: 'email3@domain.com',
          isSpam: false,
        },
      ];

      const firstPerson = await createAPerson();
      await saveContactInfo(ctx, [contactsInfo[0]], firstPerson.id);

      const secondPerson = await createAPerson();
      await saveContactInfo(ctx, [contactsInfo[1]], secondPerson.id);

      const thirdPerson = await createAPerson();
      await saveContactInfo(ctx, [contactsInfo[2]], thirdPerson.id);

      const response = await request(app)
        .post('/blacklist')
        .set(getAuthHeader(tenant.id, user.id))
        .send({ type: contactsInfo[0].type, value: contactsInfo[0].value });

      const blacklist = await getBlacklist(ctx);

      expect(response.status).to.equal(200);
      expect(response.body.sort()).to.deep.equal([firstPerson.id].sort());
      expect(blacklist.filter(item => item.type === contactsInfo[0].type && item.value === contactsInfo[0].value).length).to.equal(1);
      expect(blacklist.filter(item => item.type === contactsInfo[1].type && item.value === contactsInfo[1].value).length).to.equal(0);

      const contactInfoMarkedAsSpam = blacklist.find(item => item.type === contactsInfo[0].type && item.value === contactsInfo[0].value);
      expect(contactInfoMarkedAsSpam.markedAsSpamBy).to.equal(user.id);
    });
  });

  describe('when removing a contactInfo from the blacklist and the type is not valid', () => {
    it('responds with status code 400 and CONTACT_INFO_TYPE_INVALID token', async () => {
      const response = await request(app).delete('/blacklist').set(getAuthHeader()).send({ type: 'some-invalid-type', value: 'a@a.com' });

      expect(response.status).to.equal(400);
      expect(response.body.token).to.equal('CONTACT_INFO_TYPE_INVALID');
    });
  });

  describe('when removing a contactInfo from the blacklist and the type is not set', () => {
    it('responds with status code 400 and CONTACT_INFO_TYPE_INVALID token', async () => {
      const response = await request(app).delete('/blacklist').set(getAuthHeader()).send({ value: 'a@a.com' });

      expect(response.status).to.equal(400);
      expect(response.body.token).to.equal('CONTACT_INFO_TYPE_INVALID');
    });
  });

  describe('when removing a contactInfo from the blacklist and the value is not set', () => {
    it('responds with status code 400 and CONTACT_INFO_VALUE_MISSING token', async () => {
      const response = await request(app).delete('/blacklist').set(getAuthHeader()).send({ type: 'email' });

      expect(response.status).to.equal(400);
      expect(response.body.token).to.equal('CONTACT_INFO_VALUE_MISSING');
    });
  });

  describe('when removing a contactInfo from the blacklist and the id is valid', () => {
    it('should be un-marked as spam', async () => {
      const contactsInfo = [
        {
          type: 'email',
          value: 'email@domain.com',
          isSpam: true,
        },
        {
          type: 'email',
          value: 'email2@domain.com',
          isSpam: true,
        },
        {
          type: 'email',
          value: 'email3@domain.com',
          isSpam: true,
        },
      ];

      const firstPerson = await createAPerson();
      await saveContactInfo(ctx, [contactsInfo[0]], firstPerson.id);

      const secondPerson = await createAPerson();
      await saveContactInfo(ctx, [contactsInfo[1]], secondPerson.id);

      const thirdPerson = await createAPerson();
      await saveContactInfo(ctx, [contactsInfo[2]], thirdPerson.id);

      const response = await request(app).delete('/blacklist').set(getAuthHeader()).send({ type: contactsInfo[0].type, value: contactsInfo[0].value });

      const blacklist = await getBlacklist(ctx);

      expect(response.status).to.equal(200);
      expect(response.body.sort()).to.deep.equal([firstPerson.id].sort());
      expect(blacklist.filter(item => item.type === contactsInfo[0].type && item.value === contactsInfo[0].value).length).to.equal(0);
      expect(blacklist.filter(item => item.type === contactsInfo[1].type && item.value === contactsInfo[1].value).length).to.equal(1);
    });
  });
});
