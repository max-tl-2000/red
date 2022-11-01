/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import fs from 'fs';
import path from 'path';
const { mockModules } = require('../../../../common/test-helpers/mocker').default(jest);

chai.use(chaiAsPromised);
const { expect } = chai;

describe('documents', () => {
  let getApplicationDocumentByDocId;
  const partyId = newId();
  const documentName = 'test-document.docx';

  const readTestFile = () => {
    const filePath = path.join(__dirname, `../../../../server/api/__integration__/resources/${documentName}`);
    return fs.createReadStream(filePath);
  };

  const defaultMocks = () => ({
    canUserDownloadDocument: jest.fn(() => true),
    getDocumentNameById: jest.fn(() => documentName),
    downloadDocument: jest.fn(() => readTestFile()),
  });

  const setupMocks = mocks => {
    jest.resetModules();
    mockModules({
      '../../../../server/api/helpers/validators': {
        validTenant: () => true,
        uuid: () => true,
      },
      '../../services/documents': {
        canUserDownloadDocument: mocks.canUserDownloadDocument,
        getDocumentNameById: mocks.getDocumentNameById,
      },
      '../../../../server/workers/upload/documents/documentsS3Upload': {
        downloadDocument: mocks.downloadDocument,
      },
    });
    const documents = require('../actions/documents'); // eslint-disable-line global-require
    getApplicationDocumentByDocId = documents.getApplicationDocumentByDocId;
  };

  describe('getApplicationDocumentByDocId', () => {
    let req;

    let mocks;

    beforeEach(() => {
      req = {
        tenantId: newId(),
        authUser: {
          partyId,
          tenantId: newId(),
          quoteId: newId(),
          personId: newId(),
          personName: 'Harry Potter',
          tenantDomain: 'tenant.local.env.reva.tech',
        },
        params: { documentId: newId() },
      };
    });

    it('should return type and filename when call the API with valid tenantId and documentId', async () => {
      mocks = defaultMocks();
      setupMocks(mocks);

      readTestFile();

      const result = await getApplicationDocumentByDocId(req);

      expect(result.type).to.equal('stream');
      expect(result.filename).to.equal(documentName);
    });
  });
});
