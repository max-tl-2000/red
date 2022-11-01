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
import { createAPersonApplication } from '../../test-utils/repo-helper.js';
import { testCtx as ctx, createAParty, createAUser, createADocument, createATeam, createATeamMember } from '../../../../server/testUtils/repoHelper';
import { createDocument as createRentappDocument } from '../../services/documents';
import { FunctionalRoleDefinition } from '../../../../common/acd/rolesDefinition';

// Currently this only tests the ACL's used for document download -- not the actual document retrieval

describe('GET personApplications/current/documents/:documentId/retrieve', () => {
  describe('When request document download', () => {
    const docId = newId();
    let personApplication;
    const category = 'Documents';
    let laaUser;
    let team;
    let documentToSave;
    let rentappDocument;

    beforeEach(async () => {
      team = await createATeam({
        name: 'team1',
        module: 'leasing',
        email: 'test1@test.a',
        phone: '15417544217',
      });
      laaUser = await createAUser();
      laaUser.teams = [team.id];
      await createATeamMember({
        teamId: team.id,
        userId: laaUser.id,
        roles: {
          functionalRoles: [FunctionalRoleDefinition.LAA.name],
        },
      });
      const party = await createAParty(
        {
          id: newId(),
          userId: laaUser.id,
          teams: [team.id],
        },
        ctx,
      );

      personApplication = await createAPersonApplication({ firstName: 'Name' }, newId(), party.id, newId());
      const userCreated = await createAUser();

      const uploadingUser = {
        exp: 1480886307,
        iat: 1480627107,
        tenantId: ctx.tenantId,
        commonUserId: userCreated.id,
        partyApplicationId: personApplication.partyApplicationId,
        personApplicationId: personApplication.id,
      };

      documentToSave = {
        uuid: docId,
        metadata: {
          file: { docId, originalName: 'fileName1' },
          category,
          document: {
            uploadingUser,
          },
        },
      };

      rentappDocument = {
        documentId: docId,
        accessType: 'private',
        metadata: {
          document: {
            uploadingUser,
          },
          file: { docId, originalName: 'fileName1' },
        },
      };
    });

    it('should return documentId not found when the documentId does not exits', async () => {
      const res = await request(app).get(`/personApplications/current/documents/${docId}/retrieve`).set(getAuthHeader(ctx.tenantId)).send();

      expect(res.status).to.equal(400);
      expect(res.body.token).to.equal('INVALID_DOCUMENT_ID');
    });

    // MAM: disabling this test because as written, it throws an exception while trying to read from S3
    // S3 upload/download needs to be disabled in integration tests...
    xit('should allow user to download event if user is not LAA', async () => {
      await createADocument(ctx, documentToSave);
      await createRentappDocument(ctx, personApplication.id, rentappDocument);
      const res = await request(app)
        .get(`/personApplications/current/documents/${docId}/retrieve`)
        .set(
          getAuthHeader(ctx.tenantId, laaUser.id, [
            {
              id: team.id,
              functionalRoles: [FunctionalRoleDefinition.LD.name],
            },
          ]),
        )
        .send();

      expect(res.status).to.equal(200);
    });
  });
});
