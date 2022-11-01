/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import request from 'supertest';
import newId from 'uuid/v4';
import app from '../../../../server/api/api';
import { getAuthHeader } from '../../../../server/testUtils/apiHelper';
import { createAPartyApplication, ctx } from '../../test-utils/repo-helper.js';
import { createAParty, createAPartyMember, createATeam, createADocument, createAUser, createACommonUser } from '../../../../server/testUtils/repoHelper';
import { createPartyApplicationDocument } from '../../dal/party-application-repo';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { enhance } from '../../../../common/helpers/contactInfoUtils';

describe('API/partyApplication', () => {
  const partyApplicationDocumentKeys = ['file', 'category', 'document'];

  const createTestData = async () => {
    const user = await createAUser();
    const team = await createATeam({
      name: 'team',
      module: 'leasing',
      email: 'team1@reva.tech',
      phone: '12025550190',
    });
    const party = await createAParty({ userId: user.id, teams: [team.id] });
    const contactInfo = enhance([
      { type: 'email', value: 'luke@reva.tech' },
      { type: 'phone', value: '12025550163' },
    ]);
    const partyMember = await createAPartyMember(party.id, {
      fullName: 'Anakin Skywalker',
      memberType: DALTypes.MemberType.GUARANTOR,
      contactInfo,
    });
    const commonUser = await createACommonUser({
      tenantId: ctx.tenantId,
      fullName: 'Anakin Skywalker',
      preferredName: 'Any',
      email: 'luke@reva.tech',
      personId: partyMember.personId,
    });
    const partyApplication = await createAPartyApplication(party.id, newId(), {}, ctx.tenantId);
    const docId = newId();

    const category = 'Documents';
    const documentToSave = {
      uuid: docId,
      metadata: {
        file: { docId, originalName: 'fileName1' },
        category,
        document: {
          uploadingUser: user,
        },
      },
    };
    await createADocument(ctx, documentToSave);
    const rentappDocument = {
      id: newId(),
      partyApplicationId: partyApplication.id,
      metadata: {
        documentId: docId,
      },
    };

    await createPartyApplicationDocument(ctx, rentappDocument);

    return {
      commonUser,
      partyApplication,
      docId,
    };
  };

  const getPartyApplicationDocuments = (partyApplicationId, token) =>
    request(app)
      .get(`/partyApplications/${partyApplicationId}/documents`)
      .set(token || getAuthHeader());

  context('GET/partyApplications/:partyApplicationId/documents', () => {
    describe("when a party application id isn't valid", () => {
      it('responds with status code 400 and INVALID_PARTY_APPLICANT_ID token', async () => {
        await getPartyApplicationDocuments('wrongId')
          .expect(400)
          .expect(res => expect(res.body.token).to.equal('INVALID_PARTY_APPLICANT_ID'));
      });
    });

    describe("when a party application doesn't exist", () => {
      it('responds with status code 401 and INVALID_UPLOADER token', async () => {
        await getPartyApplicationDocuments(newId())
          .expect(401)
          .expect(res => expect(res.body.token).to.equal('INVALID_UPLOADER'));
      });
    });

    describe('when a party application exist', () => {
      describe('and part application document exists', () => {
        it('responds with status code 200 and list of documents', async () => {
          const { commonUser, partyApplication, docId } = await createTestData();
          const token = getAuthHeader(ctx.id, commonUser.commonUser.id, false, true);
          await getPartyApplicationDocuments(partyApplication.id, token)
            .expect(200)
            .expect(res => expect(res.body[0]).to.have.all.keys(partyApplicationDocumentKeys))
            .expect(res => expect(res.body[0].file.docId).to.equal(docId));
        });
      });
    });
  });
});
