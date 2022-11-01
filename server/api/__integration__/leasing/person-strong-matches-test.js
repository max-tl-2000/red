/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';
import getUUID from 'uuid/v4';

import app from '../../api';
import { testCtx as ctx, createAPerson, createAParty, createAPartyMember } from '../../../testUtils/repoHelper';
import { mergePersons } from '../../../services/person';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import { enhance } from '../../../../common/helpers/contactInfoUtils';
import { getAllStrongMatches } from '../../../dal/strongMatchesRepo';

describe('given a request to update a person', () => {
  describe('when there is no other person with the same phone number', () => {
    it('should not create any strong matches', async () => {
      const { id } = await createAPerson('Tyrion Lannister', 'The Imp');

      const contactInfo = enhance([
        {
          type: 'phone',
          value: '12025550190',
          id: getUUID(),
        },
      ]);

      await request(app).patch(`/persons/${id}`).set(getAuthHeader()).send({ contactInfo }).expect(200);

      const strongMatches = await getAllStrongMatches(ctx);
      expect(strongMatches.length).to.equal(0);
    });
  });

  describe('when there is another person with the same phone number', () => {
    describe('when the persons dont have parties in common', () => {
      it('should create a strong match between these two persons', async () => {
        const phoneNo = '12025550190';

        const firstPersonContactInfo = enhance([
          {
            type: 'phone',
            value: phoneNo,
            id: getUUID(),
          },
        ]);

        const party1 = await createAParty();
        await createAPartyMember(party1.id, {
          fullName: 'Tyrion Lannister',
          contactInfo: firstPersonContactInfo,
        });

        const secondPersonContactInfo = enhance([
          {
            type: 'phone',
            value: '12025550191',
            id: getUUID(),
          },
        ]);

        const party2 = await createAParty();
        const pm = await createAPartyMember(party2.id, {
          fullName: 'Tyrion Lannister - 2',
          contactInfo: secondPersonContactInfo,
        });

        const contactInfoToUpdate = enhance([
          {
            type: 'phone',
            value: '12025550190',
            id: getUUID(),
          },
        ]);

        await request(app).patch(`/persons/${pm.personId}`).set(getAuthHeader()).send({ contactInfo: contactInfoToUpdate }).expect(200);

        const strongMatches = await getAllStrongMatches(ctx);
        expect(strongMatches.length).to.equal(1);
      });
    });

    describe('when the persons have parties in common', () => {
      it('should not create a strong match between these two persons', async () => {
        const phoneNo = '12025550190';

        const firstPersonContactInfo = enhance([
          {
            type: 'phone',
            value: phoneNo,
            id: getUUID(),
          },
        ]);

        const party1 = await createAParty();
        await createAPartyMember(party1.id, {
          fullName: 'Tyrion Lannister',
          contactInfo: firstPersonContactInfo,
        });

        const secondPersonContactInfo = enhance([
          {
            type: 'phone',
            value: '12025550191',
            id: getUUID(),
          },
        ]);

        const pm = await createAPartyMember(party1.id, {
          fullName: 'Tyrion Lannister - 2',
          contactInfo: secondPersonContactInfo,
        });

        const contactInfoToUpdate = enhance([
          {
            type: 'phone',
            value: '12025550190',
            id: getUUID(),
          },
        ]);

        await request(app).patch(`/persons/${pm.personId}`).set(getAuthHeader()).send({ contactInfo: contactInfoToUpdate }).expect(200);

        const strongMatches = await getAllStrongMatches(ctx);
        expect(strongMatches.length).to.equal(0);
      });
    });

    describe('when the persons have parties in common, one person being in more than one party', () => {
      it('should not create a strong match between these two persons', async () => {
        const phoneNo = '12025550190';

        const firstPersonContactInfo = enhance([
          {
            type: 'phone',
            value: phoneNo,
            id: getUUID(),
          },
        ]);

        const party1 = await createAParty();
        await createAPartyMember(party1.id, {
          fullName: 'Tyrion Lannister',
          contactInfo: firstPersonContactInfo,
        });

        const secondPersonContactInfo = enhance([
          {
            type: 'phone',
            value: '12025550191',
            id: getUUID(),
          },
        ]);

        const { id: personId } = await createAPerson('Tyrion Lannister - 2', 'The Imp', secondPersonContactInfo);

        await createAPartyMember(party1.id, { personId });
        const party2 = await createAParty();
        await createAPartyMember(party2.id, { personId });

        const contactInfoToUpdate = enhance([
          {
            type: 'phone',
            value: '12025550190',
            id: getUUID(),
          },
        ]);

        await request(app).patch(`/persons/${personId}`).set(getAuthHeader()).send({ contactInfo: contactInfoToUpdate }).expect(200);

        const strongMatches = await getAllStrongMatches(ctx);
        expect(strongMatches.length).to.equal(0);
      });
    });

    describe('and that person was already merged with a different person', () => {
      it('should not create a strong match between these two persons', async () => {
        const phoneNo = '12025550190';

        const firstPersonContactInfo = enhance([{ type: 'phone', value: phoneNo, id: getUUID() }]);
        const firstPerson = await createAPerson('Tyrion Lannister 1', 'The Imp', firstPersonContactInfo);

        const secondPersonContactInfo = enhance([{ type: 'phone', value: phoneNo, id: getUUID() }]);
        const secondPerson = await createAPerson('Tyrion Lannister 2', 'The Imp', secondPersonContactInfo);

        const mergeResult = await mergePersons(ctx, firstPerson.id, secondPerson.id);

        const contactInfoToUpdate = enhance([{ type: 'phone', value: '12025550189', id: getUUID() }]);

        await request(app).patch(`/persons/${mergeResult.id}`).set(getAuthHeader()).send({ contactInfo: contactInfoToUpdate }).expect(200);

        const thirdPersonContactInfo = enhance([{ type: 'phone', value: '12025550191', id: getUUID() }]);
        const thirdPerson = await createAPerson('Tyrion Lannister 3', 'The Imp', thirdPersonContactInfo);

        const contactInfoToUpdateThirdPerson = enhance([{ type: 'phone', value: '12025550190', id: getUUID() }]);

        await request(app).patch(`/persons/${thirdPerson.id}`).set(getAuthHeader()).send({ contactInfo: contactInfoToUpdateThirdPerson }).expect(200);

        const strongMatches = await getAllStrongMatches(ctx);
        expect(strongMatches.length).to.equal(0);
      });
    });
  });

  describe('when a strong match exists between two persons and the contactInfo that triggered the strong match to be generated is removed', () => {
    it('should remove the existing strong match', async () => {
      const phoneNo = '12025550190';

      const firstPersonContactInfo = enhance([
        {
          type: 'phone',
          value: phoneNo,
          id: getUUID(),
        },
      ]);

      await createAPerson('Tyrion Lannister', 'The Imp', firstPersonContactInfo);

      const { id: secondPersonId } = await createAPerson('Tyrion Lannister - 2', 'The Imp');
      const secondPersonContactInfo = enhance([
        {
          type: 'phone',
          value: phoneNo,
          id: getUUID(),
        },
      ]);

      await request(app).patch(`/persons/${secondPersonId}`).set(getAuthHeader()).send({ contactInfo: secondPersonContactInfo }).expect(200);

      const strongMatches = await getAllStrongMatches(ctx);
      expect(strongMatches.length).to.equal(1);

      await request(app)
        .patch(`/persons/${secondPersonId}`)
        .set(getAuthHeader())
        .send({ contactInfo: enhance([]) })
        .expect(200);

      const strongMatches2 = await getAllStrongMatches(ctx);
      expect(strongMatches2.length).to.equal(0);
    });
  });
});
