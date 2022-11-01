/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';
import getUUID from 'uuid/v4';
import path from 'path';
import app from '../../api';
import { getAuthHeader, waitFor } from '../../../testUtils/apiHelper';
import { createDocument } from '../../../dal/documentsRepo';
import { testCtx as ctx } from '../../../testUtils/repoHelper';
import { chan, createResolverMatcher } from '../../../testUtils/setupTestGlobalContext';
import { setupConsumers } from '../../../workers/consumer';

const setupMsgQueueAndWaitFor = async conditions => {
  const { resolvers, promises } = waitFor(conditions);
  const matcher = createResolverMatcher(resolvers);
  await setupConsumers(chan(), matcher, ['upload']);
  return { task: Promise.all(promises) };
};

describe('API/documents', () => {
  const basePath = '/documents';

  const uploadDocument = filename =>
    request(app)
      .post(basePath)
      .type('form')
      .set(getAuthHeader())
      .attach('files', path.resolve(path.dirname(__dirname), 'resources', filename));

  const fetchDocuments = () => request(app).get(basePath).set(getAuthHeader());

  const updateDocument = (documentId, metadata) => request(app).patch(`${basePath}/${documentId}/metadata`).send(metadata).set(getAuthHeader());

  describe('when the jobs endpoint is called', () => {
    it('should return 401 when not authorized', async () => {
      await request(app).get(basePath).expect(401);
    });

    it('should return the list of uploaded documents', async () => {
      const document = await createDocument(ctx, {
        uuid: getUUID(),
        accessType: 'private',
        metadata: { key1: 'value1' },
      });
      const res = await request(app).get(basePath).set(getAuthHeader()).expect(200);
      expect(res.body).to.not.be.empty;
      expect(res.body.length).to.be.equal(1);
      const doc = res.body[0];
      expect(doc.accessType).to.equal(document.accessType);
      expect(doc.metadata).to.deep.equal(document.metadata);
    });

    it('should return 400 when no files in request', async () => {
      await request(app)
        .post(basePath)
        .set(getAuthHeader())
        .expect(400)
        .expect(res => expect(res.body.token).to.equal('NO_FILES'));
    });
  });

  describe('when uploading a document', () => {
    it('should trigger an upload documents job', async () => {
      const filename = 'test-document.docx';
      const context = 'rentapp_documents';
      let res = await request(app)
        .post(basePath)
        .type('form')
        .field('custom-key1', 'custom value!!')
        .field('custom-key2', 'customValue2')
        .field('context', context)
        .set(getAuthHeader())
        .attach('files', path.resolve(path.dirname(__dirname), 'resources', filename))
        .expect(200);

      const queueCondition = msg => msg.files && msg.files.length === 1 && msg.files[0].originalName === filename;

      const { task } = await setupMsgQueueAndWaitFor([queueCondition]);
      await task;

      res = await fetchDocuments();

      expect(res.status).to.equal(200);
      expect(res.body.length).to.be.equal(1);
      const doc = res.body[0];
      expect(doc.accessType).to.equal('private');
      expect(doc.metadata.file.originalName).to.equal(filename);
      expect(doc.metadata.document['custom-key1']).to.equal('custom value!!');
      expect(doc.context).to.equal(context);
    });
  });

  describe('when calling the update service', () => {
    it('should update the document metadata', async () => {
      const filename = 'test-document.docx';

      await uploadDocument(filename);

      const queueCondition = msg => msg.files && msg.files.length === 1 && msg.files[0].originalName === filename;

      const { task } = await setupMsgQueueAndWaitFor([queueCondition]);
      await task;

      const fetchDocumentsRes = await fetchDocuments();

      const document = fetchDocumentsRes.body[0];

      const updateDocumentRes = await updateDocument(document.uuid, {
        category: 'Documents',
      });

      expect(updateDocumentRes.body.length).to.be.equal(1);
      const updatedDocument = updateDocumentRes.body[0];

      expect(updatedDocument.uuid).to.equal(document.uuid);
      expect(updatedDocument.metadata.category).to.equal('Documents');
    });
  });

  describe('When request document download', () => {
    const docId = getUUID();

    it('should return 401 when not authorized', async () => {
      await request(app).get(`/documents/${docId}/download`).expect(401);
    });

    it('should return 400 when using an invalid document id', async () => {
      await request(app)
        .get('/documents/123/download')
        .set(getAuthHeader())
        .expect(400)
        .expect(res => expect(res.body.token).to.equal('INVALID_DOCUMENT_ID'));
    });

    it('should return 404 when the document was not found', async () => {
      await request(app)
        .get(`/documents/${getUUID()}/download`)
        .set(getAuthHeader())
        .expect(404)
        .expect(res => expect(res.body.token).to.equal('DOCUMENT_NOT_FOUND'));
    });
  });

  describe('When deleting documents', () => {
    const docId = getUUID();

    it('should return 401 when not authorized', async () => {
      await request(app)
        .delete('/documents')
        .send({ documentIds: [docId] })
        .expect(401);
    });

    it('should return 400 when using document ids are missing', async () => {
      await request(app)
        .delete('/documents')
        .set(getAuthHeader())
        .send({})
        .expect(400)
        .expect(res => expect(res.body.token).to.equal('NO_DOCUMENTS_SPECIFIED'));
    });

    it('should return 400 when using an invalid document id', async () => {
      await request(app)
        .delete('/documents')
        .set(getAuthHeader())
        .send({ documentIds: ['123'] })
        .expect(400)
        .expect(res => expect(res.body.token).to.equal('INVALID_DOCUMENT_ID'));
    });

    it('should return 404 when the document was not found', async () => {
      await request(app)
        .get(`/documents/${getUUID()}/download`)
        .set(getAuthHeader())
        .expect(404)
        .expect(res => expect(res.body.token).to.equal('DOCUMENT_NOT_FOUND'));
    });
  });
});
