/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import getUUID from 'uuid/v4';
import { ctx, createAPersonApplication, createAPartyApplication } from '../../test-utils/repo-helper';
import { createDocument } from '../documents-repo';
import { createPartyApplicationDocument } from '../party-application-repo';
import '../../../../server/testUtils/setupTestGlobalContext';

describe('dal/documents-repo', () => {
  let personApplication;
  beforeEach(async () => {
    personApplication = await createAPersonApplication({ firstName: 'Name' }, getUUID(), getUUID(), getUUID(), false, ctx.tenantId);
  });

  describe('given a document entry', () => {
    it('should create a new document', async () => {
      const documentId = getUUID();
      const accessType = 'private';
      const personApplicationId = personApplication.id;
      const partyApplicationId = personApplication.partyApplicationId;
      const uploadingUser = {
        exp: 1480886307,
        iat: 1480627107,
        tenantId: ctx.tenantId,
        commonUserId: getUUID(),
        partyApplicationId,
        personApplicationId,
      };

      const documentName = 'testFile.doc';

      const metadata = {
        documentId,
        accessType,
        uploadingUser,
        documentName,
      };
      const document = {
        personApplicationId,
        metadata,
      };

      const result = await createDocument(ctx, document);

      expect(result).to.be.an('object');
      expect(result.personApplicationId).to.equal(personApplicationId);
      expect(result.metadata).to.deep.equal(metadata);
    });
  });
});

describe('create party application document', () => {
  let partyApplication;
  beforeEach(async () => {
    partyApplication = await createAPartyApplication(getUUID(), getUUID(), {}, ctx.tenantId);
  });

  describe('given a document entry', () => {
    it('should create a new document', async () => {
      const documentId = getUUID();
      const accessType = 'private';
      const partyApplicationId = partyApplication.id;
      const uploadingUser = {
        exp: 1480886307,
        iat: 1480627107,
        tenantId: ctx.tenantId,
        commonUserId: getUUID(),
        partyApplicationId,
      };

      const documentName = 'testFile.doc';

      const metadata = {
        documentId,
        accessType,
        uploadingUser,
        documentName,
      };
      const document = {
        metadata,
        partyApplicationId,
      };
      const result = await createPartyApplicationDocument(ctx, document);

      expect(result).to.be.an('object');
      expect(result.partyApplicationId).to.equal(partyApplicationId);
      expect(result.metadata).to.deep.equal(metadata);
    });
  });
});
