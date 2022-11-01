/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import getUUID from 'uuid/v4';

const { mockModules } = require('test-helpers/mocker').default(jest);

describe('Given a new document entry', () => {
  let documents;
  const personApplicationId = getUUID();
  const documentId = getUUID();
  const accessType = 'private';
  const tenantId = getUUID();

  const uploadingUser = {
    exp: 1480886307,
    iat: 1480627107,
    tenantId,
    commonUserId: getUUID(),
    partyApplicationId: getUUID(),
    personApplicationId,
  };

  const documentName = 'testFile.doc';

  const metadata = {
    documentId,
    accessType,
    uploadingUser,
    documentName,
  };

  const personApplicationDocument = {
    id: getUUID,
    personApplicationId,
    metadata,
  };

  const defaultMocks = () => ({
    createDocument: jest.fn(() => personApplicationDocument),
  });

  const setupMocks = mocks => {
    jest.resetModules();
    mockModules({
      '../../dal/documents-repo': {
        createDocument: mocks.createDocument,
      },
    });
    documents = require('../documents'); // eslint-disable-line
  };

  let mocks;

  it('return the created document', () => {
    mocks = defaultMocks();
    setupMocks(mocks);
    const document = {
      metadata: {
        document: {
          uploadingUser,
        },
        file: { originalName: documentName },
      },
    };

    const result = documents.createDocument({ tenantId }, personApplicationId, document);
    expect(result).to.be.an('object');
    expect(result.personApplicationId).to.equal(personApplicationId);
    expect(result.metadata.documentId).to.equal(documentId);
    expect(result.metadata.accessType).to.equal(accessType);
    expect(result.metadata.uploadingUser).to.deep.equal(uploadingUser);
    expect(result.metadata.documentName).to.equal(documentName);
  });
});
