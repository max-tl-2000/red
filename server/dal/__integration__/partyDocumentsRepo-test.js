/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { toMoment } from '../../../common/helpers/moment-utils';
import { createAParty } from '../../testUtils/repoHelper';
import { updatePartyDocumentHistory, createPartyDocumentHistory, getUnprocessedDocuments } from '../partyDocumentRepo';
import { DALTypes } from '../../../common/enums/DALTypes';
import { tenant } from '../../testUtils/setupTestGlobalContext';

const ctx = { tenantId: tenant.id };
const { PartyDocumentStatus } = DALTypes;

describe('dal/partyDocumentsRepo', () => {
  const mockPartyDocumentsHistory = [
    { status: PartyDocumentStatus.PENDING, delta: 0 },
    { status: PartyDocumentStatus.PENDING, delta: 15 },
    { status: PartyDocumentStatus.PENDING, delta: 30 },
    { status: PartyDocumentStatus.PENDING, delta: 150 },
    { status: PartyDocumentStatus.PENDING, delta: 9, timeFrame: 'hours' },
    { status: PartyDocumentStatus.SENDING, delta: 0 },
    { status: PartyDocumentStatus.SENDING, delta: 20 },
    { status: PartyDocumentStatus.SENDING, delta: 65 },
    { status: PartyDocumentStatus.SENDING, delta: 4, timeFrame: 'hours' },
    { status: PartyDocumentStatus.SENDING, delta: 13, timeFrame: 'hours' },
    { status: PartyDocumentStatus.SENT, delta: 10 },
    { status: PartyDocumentStatus.SENT, delta: 65 },
    { status: PartyDocumentStatus.SENT, delta: 185 },
  ];

  const updatePartyDocumentCreatedAt = async document => {
    const { delta: createdAtDelta, timeFrame } = document;
    const createdAt = toMoment(document.created_at).add(-createdAtDelta, timeFrame);
    [document] = await updatePartyDocumentHistory(ctx, document.id, {
      created_at: createdAt.toJSON(),
    });
    return document;
  };

  const initParties = async () => await Promise.all([0, 1, 2].map(() => createAParty()));

  const initPartyDocumentHistory = async () => {
    const parties = await initParties();

    return await Promise.all(
      mockPartyDocumentsHistory.map(async doc => {
        const { status, delta, timeFrame = 'minutes' } = doc;
        const document = await createPartyDocumentHistory(ctx, {
          status,
          partyId: parties[Math.floor(Math.random() * parties.length)].id,
          document: {},
          deliveryStatus: {},
          // eslint-disable-next-line camelcase
          transaction_id: 1,
          // eslint-disable-next-line camelcase
          triggered_by: {},
        });
        return await updatePartyDocumentCreatedAt({ ...document, delta, timeFrame });
      }),
    );
  };

  describe('getUnprocessedDocuments()', () => {
    it('should get all unprocessed party document history in a given time frame', async () => {
      await initPartyDocumentHistory();
      const isPendingOrSending = ({ status }) => status === PartyDocumentStatus.PENDING || status === PartyDocumentStatus.SENDING;
      const filterByStatus = (doc, status) => doc.status === status;

      let docs = await getUnprocessedDocuments(ctx);
      expect(docs.every(isPendingOrSending)).to.be.true;
      expect(docs.filter(doc => filterByStatus(doc, PartyDocumentStatus.PENDING)).length).to.equal(5);
      expect(docs.filter(doc => filterByStatus(doc, PartyDocumentStatus.SENDING)).length).to.equal(5);
      expect(docs.length).to.equal(10);

      docs = await getUnprocessedDocuments(ctx, { minTime: 5, maxTime: 250, timeFrame: 'minutes' });
      expect(docs.every(isPendingOrSending)).to.be.true;
      expect(docs.filter(doc => filterByStatus(doc, PartyDocumentStatus.PENDING)).length).to.equal(3);
      expect(docs.filter(doc => filterByStatus(doc, PartyDocumentStatus.SENDING)).length).to.equal(3);
      expect(docs.length).to.equal(6);

      docs = await getUnprocessedDocuments(ctx, { minTime: 1, maxTime: 3, timeFrame: 'hours' });
      expect(docs.every(isPendingOrSending)).to.be.true;
      expect(docs.filter(doc => filterByStatus(doc, PartyDocumentStatus.PENDING)).length).to.equal(1);
      expect(docs.filter(doc => filterByStatus(doc, PartyDocumentStatus.SENDING)).length).to.equal(1);
      expect(docs.length).to.equal(2);

      docs = await getUnprocessedDocuments(ctx, { minTime: 3, maxTime: 5, timeFrame: 'hours' });
      expect(docs.every(isPendingOrSending)).to.be.true;
      expect(docs.filter(doc => filterByStatus(doc, PartyDocumentStatus.PENDING)).length).to.equal(0);
      expect(docs.filter(doc => filterByStatus(doc, PartyDocumentStatus.SENDING)).length).to.equal(1);
      expect(docs.length).to.equal(1);

      docs = await getUnprocessedDocuments(ctx, { minTime: 1, maxTime: 12, timeFrame: 'hours' });
      expect(docs.every(isPendingOrSending)).to.be.true;
      expect(docs.filter(doc => filterByStatus(doc, PartyDocumentStatus.PENDING)).length).to.equal(2);
      expect(docs.filter(doc => filterByStatus(doc, PartyDocumentStatus.SENDING)).length).to.equal(2);
      expect(docs.length).to.equal(4);
    });

    it('should get all unprocessed party document history including the document', async () => {
      await initPartyDocumentHistory();

      let [doc] = await getUnprocessedDocuments(ctx, { includeDocument: true });
      expect(doc.document).to.deep.equal({});

      [doc] = await getUnprocessedDocuments(ctx, { includeDocument: false });
      expect(doc.document).to.be.undefined;
    });
  });
});
