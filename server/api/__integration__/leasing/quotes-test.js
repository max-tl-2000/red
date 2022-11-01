/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import chai from 'chai';
import chaiUrl from 'chai-url';
import chaiJwt from 'chai-jwt';
import chaiSubset from 'chai-subset';

import request from 'supertest';
import v4 from 'uuid/v4';
import { decodeJWTToken } from '../../../../common/server/jwt-helpers';
import app from '../../api';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import {
  testCtx as ctx,
  createAUser,
  createAParty,
  createAnInventory,
  createAnAmenity,
  createAProperty,
  addAmenityToInventory,
  refreshUnitSearch,
  createALeaseTerm,
  createALeaseName,
  createAInventoryGroup,
  createAPartyMember,
  saveUnitsRevaPricing,
  createInventoryProcess,
} from '../../../testUtils/repoHelper';
import sleep from '../../../../common/helpers/sleep';
import { enhance } from '../../../../common/helpers/contactInfoUtils';
import { shouldUseRmsPricing } from '../../../services/rms';
import { saveUnitsPricingUsingPropertyExternalId } from '../../../dal/rmsPricingRepo';
import { now, toMoment } from '../../../../common/helpers/moment-utils';
import { RmsPricingEvents } from '../../../../common/enums/enums';
import { override } from '../../../../common/test-helpers/overrider';
import config from '../../../config';

const { expect } = chai;
chai.use(chaiUrl);
chai.use(chaiJwt);
chai.use(chaiSubset);

describe('API/quotes', () => {
  const DELAY_FOR_AMQ_MS = 1000;

  afterEach(async () => {
    // give AMQ time to process any remaining stuff
    console.log('>>>Sleeping to let AMQ settle');
    await sleep(DELAY_FOR_AMQ_MS);
    console.log('>>>Back from Sleeping to let AMQ settle');
  });

  const createQuoteDraft = (inventoryId, partyId) => request(app).post('/quotes').set(getAuthHeader()).send({ inventoryId, partyId });

  const publishQuote = quoteDraftId =>
    request(app)
      .patch(`/quotes/draft/${quoteDraftId}`)
      .set(getAuthHeader())
      .send({
        leaseStartDate: now().toISOString(),
        publishDate: now().toISOString(),
        expirationDate: now().add(50, 'days').toISOString(),
        propertyTimezone: 'America/Los_Angeles',
      });

  const createRmsUnitPricing = ({ externalId }) => ({
    externalId,
    availDate: now(),
    status: '',
    amenityValue: 0,
    rmsProvider: 'LRO',
    fileName: 'LRO.xml',
    rentMatrix: { 1: {} },
    standardLeaseLength: 12,
    standardRent: 4000,
    minRentLeaseLength: 12,
    minRentStartDate: now(),
    minRentEndDate: now(),
    minRent: 4000,
  });

  const createQuotePrerequisites = async ({ propertyData, propertySettings } = {}) => {
    const user = await createAUser();
    const party = await createAParty({ userId: user.id });
    const contactInfo = enhance([{ type: 'email', value: 'luke@jedi.org', id: v4() }]);
    const member = await createAPartyMember(party.id, {
      fullName: 'Luke Skywalker',
      contactInfo,
    });

    const property = await createAProperty(propertySettings, propertyData);
    const leaseName = await createALeaseName(ctx, { propertyId: property.id });
    const inventoryGroup = await createAInventoryGroup({
      propertyId: property.id,
      leaseNameId: leaseName.id,
    });

    const leaseTerm = await createALeaseTerm({
      leaseNameId: leaseName.id,
      propertyId: property.id,
      termLength: '1',
    });

    const inventoryExternalId = 'CAPT-01';
    const inventory = await createAnInventory({
      propertyId: property.id,
      inventoryGroupId: inventoryGroup.id,
      externalId: inventoryExternalId,
      rmsExternalId: inventoryExternalId,
    });

    if (shouldUseRmsPricing(propertySettings)) {
      const rmsUnitPricing = createRmsUnitPricing({ externalId: inventoryExternalId });

      await saveUnitsPricingUsingPropertyExternalId(ctx, {
        unitsPricing: [rmsUnitPricing],
        propertyExternalId: propertyData.rmsExternalId,
        rmsPricingEvent: RmsPricingEvents.EXTERNAL_RMS_IMPORT,
      });
    }

    const amenity = await createAnAmenity({
      id: v4(),
      category: 'inventory',
      propertyId: property.id,
    });

    await addAmenityToInventory(ctx, inventory.id, amenity.id);
    await saveUnitsRevaPricing([inventory]);
    await refreshUnitSearch();

    return {
      inventoryId: inventory.id,
      amenityId: amenity.id,
      propertyId: inventory.id,
      partyId: party.id,
      leaseTermId: leaseTerm.id,
      member,
    };
  };

  let selections = { selectedLeaseTerms: [{ id: v4() }] };

  const createQuoteDraftWithSupportingData = async (data = {}) => {
    const quotePrerequisites = await createQuotePrerequisites(data);
    selections = { selectedLeaseTerms: [{ id: quotePrerequisites.leaseTermId }] };
    return (await createQuoteDraft(quotePrerequisites.inventoryId, quotePrerequisites.partyId)).body;
  };

  const checkApplyNowUrl = (url, expectedDataInToken) => {
    expect(url).to.have.protocol('https');
    expect(url).to.have.hostname('application.0.0.1'); // 127.0.0.1 with 127 replaced with application
    expect(url).to.contain.path('/applyNow/');
    const token = url.split('/')[4];
    expect(token).to.be.a.jwt;
    expect(decodeJWTToken(token)).containSubset(expectedDataInToken);
  };

  context('GET api/quotes?partyId={partyId}', () => {
    it('should fail when partyId is not supplied', async () => {
      await request(app).get('/quotes').set(getAuthHeader()).expect(400);
    });

    it('should return all the created quotes', async () => {
      const user = await createAUser();
      const party = await createAParty({ userId: user.id });

      for (let i = 0; i < 3; i++) {
        const inventory = await createInventoryProcess();
        await createQuoteDraft(inventory.id, party.id);
      }

      await request(app)
        .get(`/quotes?partyId=${party.id}`)
        .set(getAuthHeader())
        .expect(200)
        .expect(response => {
          expect(response.body).to.have.all.keys('data');
          expect(response.body.data.length).to.equal(3);
        });
    });

    it('should return no quotes when the party has no quotes', async () => {
      const user = await createAUser();
      const party = await createAParty({ userId: user.id });
      await request(app)
        .get(`/quotes?partyId=${party.id}`)
        .set(getAuthHeader())
        .expect(200)
        .expect(response => {
          expect(response.body).to.have.all.keys('data');
          expect(response.body.data).to.be.empty;
        });
    });
  });

  context('POST api/quotes', () => {
    it('should create a new quote', async () => {
      const user = await createAUser();
      const party = await createAParty({ userId: user.id });
      const inventory = await createInventoryProcess();

      await createQuoteDraft(inventory.id, party.id)
        .expect(200)
        .expect(response => {
          const keys = [
            'expirationDate',
            'id',
            'inventoryId',
            'leaseStartDate',
            'leaseTerms',
            'publishDate',
            'publishedQuoteData',
            'renewalDate',
            'partyId',
            'selections',
            'additionalAndOneTimeCharges',
            'created_at',
            'updated_at',
            'confirmationNumber',
            'modified_by',
            'rentMatrix',
            'defaultLeaseLengths',
            'defaultLeaseStartDate',
            'propertyTimezone',
            'createdFromCommId',
            'leaseState',
          ];

          expect(response.body).to.have.all.keys(keys);
        });
    });
  });

  context('GET api/quotes/draft/{quoteId}', () => {
    it('should return 404 if the given id is invalid', async () => {
      await request(app).get('/quotes/draft/1').set(getAuthHeader()).expect(404);
    });

    it('should return 404 if the given id is valid but there is no entry for it', async () => {
      await request(app).get(`/quotes/draft/${v4()}`).set(getAuthHeader()).expect(404);
    });

    it('should return a single quote given its id', async () => {
      const quote = await createQuoteDraftWithSupportingData();
      await request(app)
        .get(`/quotes/draft/${quote.id}`)
        .set(getAuthHeader())
        .expect(200)
        .expect(response => {
          expect(response.body.id).to.equal(quote.id);
        });
    });
  });

  context('GET api/quotes/published/{quoteId}', () => {
    it('should return 404 if the given id is invalid', async () => {
      await request(app)
        .get('/quotes/published/1')
        .set(getAuthHeader(undefined, undefined, undefined, undefined, { quoteId: '1' }))
        .expect(404);
    });

    it('should return 404 if the given id is valid but there is no entry for it', async () => {
      const fakeQuoteId = v4();
      await request(app)
        .get(`/quotes/published/${fakeQuoteId}`)
        .set(getAuthHeader(undefined, undefined, undefined, undefined, { quoteId: fakeQuoteId }))
        .expect(404);
    });

    it('should return 200 given its id', async () => {
      const quote = await createQuoteDraftWithSupportingData();
      await publishQuote(quote.id);
      await request(app)
        .get(`/quotes/published/${quote.id}`)
        .set(getAuthHeader(undefined, undefined, undefined, undefined, { quoteId: quote.id }))
        .expect(response => {
          expect(!!response.body.id).to.equal(true);
          expect(!!response.body.id).to.equal(true);
        })
        .expect(200);
    });
  });

  context('PATCH api/quotes/draft/{quoteId}', () => {
    it('should update a quote with no errors', async () => {
      const quote = await createQuoteDraftWithSupportingData();

      await request(app)
        .get(`/quotes/draft/${quote.id}`)
        .set(getAuthHeader())
        .expect(response => {
          expect(!!response.body.publishDate).to.equal(false);
        });

      const today = now();
      await request(app)
        .patch(`/quotes/draft/${quote.id}`)
        .set(getAuthHeader())
        .send({
          leaseStartDate: today.toISOString(),
          selections,
        })
        .expect(200);

      await request(app)
        .get(`/quotes/draft/${quote.id}`)
        .set(getAuthHeader())
        .expect(response => {
          // TODO: ask Avantica to double check if this expect is correct as it is comparing dates in UTC
          // and they might not be the same day when moved to property time
          expect(toMoment(response.body.leaseStartDate).isSame(today, 'days')).to.equal(true);
        });
    });

    it('should not modify the id', async () => {
      const quote = await createQuoteDraftWithSupportingData();

      await request(app)
        .patch(`/quotes/draft/${quote.id}`)
        .set(getAuthHeader())
        .send({ id: v4(), leaseStartDate: now().toISOString(), selections })
        .expect(200);

      await request(app)
        .get(`/quotes/draft/${quote.id}`)
        .set(getAuthHeader())
        .expect(200)
        .expect(response => {
          expect(response.body.id).to.equal(quote.id);
        });
    });

    it('should not have data in the publishedQuoteData column', async () => {
      const quote = await createQuoteDraftWithSupportingData();
      await request(app)
        .patch(`/quotes/draft/${quote.id}`)
        .set(getAuthHeader())
        .send({
          leaseStartDate: now().toISOString(),
          selections,
        })
        .expect(200);

      await request(app)
        .get(`/quotes/draft/${quote.id}`)
        .set(getAuthHeader())
        .expect(200)
        .expect(response => {
          expect(!!response.body.publishedQuoteData).to.equal(false);
        });
    });

    const quotesToTest = [
      { context: 'terms', leaseStartDate: now().toISOString() },
      { context: 'start date', selections },
    ];
    quotesToTest.forEach(q => {
      context(`When the quote has no lease ${q.context} selected`, () => {
        it('should remove the quote', async () => {
          const quote = await createQuoteDraftWithSupportingData();

          await request(app)
            .get(`/quotes/draft/${quote.id}`)
            .set(getAuthHeader())
            .expect(response => {
              expect(!!response.body.publishDate).to.equal(false);
            });

          await request(app)
            .patch(`/quotes/draft/${quote.id}`)
            .set(getAuthHeader())
            .send({
              leaseStartDate: q.leaseStartDate,
              selections: q.selections,
            })
            .expect(200);

          await request(app).get(`/quotes/draft/${quote.id}`).set(getAuthHeader()).expect(404);
        });
      });
    });

    context('If an empty leaseStartDate was sent', () => {
      it('should update a quote with no errors', async () => {
        const propertySettings = {
          integration: { import: { unitPricing: true } },
        };

        const quote = await createQuoteDraftWithSupportingData({ propertySettings, propertyData: { rmsExternalId: 'COVE' } });

        await request(app)
          .patch(`/quotes/draft/${quote.id}`)
          .set(getAuthHeader())
          .send({
            leaseStartDate: null,
            selections,
          })
          .expect(200);
      });
    });

    context('quote publication', () => {
      it('should not publish a quote if it doesnt have a leaseStartDate', async () => {
        const quote = await createQuoteDraftWithSupportingData();

        await request(app)
          .patch(`/quotes/draft/${quote.id}`)
          .set(getAuthHeader())
          .send({
            publishDate: now().toISOString(),
            expirationDate: now().add(50, 'days').toISOString(),
          })
          .expect(412);
      });

      it('should publish when publishDate and leaseStartDate are sent', async () => {
        const quote = await createQuoteDraftWithSupportingData();

        await request(app)
          .patch(`/quotes/draft/${quote.id}`)
          .set(getAuthHeader())
          .send({
            leaseStartDate: now().toISOString(),
            publishDate: now().toISOString(),
            expirationDate: now().add(50, 'days').toISOString(),
          })
          .expect(200);
      });

      it('should set publishDate and expirationDate even when they are provided', async () => {
        const quote = await createQuoteDraftWithSupportingData();

        await request(app).patch(`/quotes/draft/${quote.id}`).set(getAuthHeader()).send({
          leaseStartDate: now().toISOString(),
          selections,
        });

        const wrongPublishDate = now().add(100, 'days');

        await request(app)
          .patch(`/quotes/draft/${quote.id}`)
          .set(getAuthHeader())
          .send({
            publishDate: wrongPublishDate.toISOString(),
            expirationDate: wrongPublishDate.clone().add(50, 'days').toISOString(),
          })
          .expect(200);

        await request(app)
          .get(`/quotes/draft/${quote.id}`)
          .set(getAuthHeader())
          .expect(200)
          .expect(response => {
            const storedPublishDate = toMoment(response.body.publishDate);
            const storedExpirationDate = toMoment(response.body.expirationDate);
            expect(storedPublishDate.isBefore(wrongPublishDate)).to.be.true;
            expect(storedExpirationDate.isBefore(wrongPublishDate)).to.be.true;
          });
      });

      it('should get the published quote with ', async () => {
        const data = await createQuotePrerequisites();
        const { member, partyId } = data;
        const quote = (await createQuoteDraft(data.inventoryId, data.partyId)).body;
        const leaseTerms = [
          {
            id: data.leaseTermId,
            concessions: [],
            additionalAndOneTimeCharges: [],
          },
        ];

        selections = {
          selectedLeaseTerms: [
            {
              id: data.leaseTermId,
              paymentSchedule: [
                {
                  timeframe: 'Aug - Sep 2016',
                  amount: 1000,
                },
              ],
            },
          ],
          concessions: [],
        };

        // TODO: should go through a helper method to set up the draft quote
        await request(app)
          .get(`/quotes/draft/${quote.id}`)
          .set(getAuthHeader())
          .expect(200)
          .expect(response => {
            expect(response.body.id).to.equal(quote.id);
          });

        // We save the leaseTerms and the leaseTerm selected
        await request(app).patch(`/quotes/draft/${quote.id}`).set(getAuthHeader()).send({
          leaseTerms,
          selections,
          leaseStartDate: now(),
        });

        // We publish the quote
        await request(app).patch(`/quotes/draft/${quote.id}`).set(getAuthHeader()).send({
          publishDate: now(),
        });

        await request(app)
          .get(`/quotes/published/${quote.id}`)
          .set(getAuthHeader(undefined, undefined, undefined, undefined, { quoteId: quote.id }))
          .expect(200)
          .expect(response => {
            const { id: quoteId } = quote;
            const { tenantId } = ctx;
            const { personId, preferredName } = member;
            const tenantDomain = '127.0.0.1';
            checkApplyNowUrl(response.body.applyNowUrl, {
              quoteId,
              tenantId,
              personId,
              personName: preferredName,
              partyId,
              tenantDomain,
            });
            expect(response.body.leaseTerms[0].paymentSchedule.timeframe).to.equal(selections.selectedLeaseTerms[0].paymentSchedule.timeframe);
            expect(response.body.leaseTerms[0].paymentSchedule.amount).to.equal(selections.selectedLeaseTerms[0].paymentSchedule.amount);
          });
      });
    });
  });

  context('DELETE api/quotes/{quoteId}', () => {
    it('should delete a quote with no errors', async () => {
      const quote = await createQuoteDraftWithSupportingData();

      await request(app).delete(`/quotes/${quote.id}`).set(getAuthHeader()).expect(200);
    });

    it('should not delete a published quote', async () => {
      const quote = await createQuoteDraftWithSupportingData();

      await request(app).patch(`/quotes/draft/${quote.id}`).set(getAuthHeader()).send({
        leaseStartDate: now().toISOString(),
        selections,
      });

      const publishDate = now().toISOString();

      await request(app)
        .patch(`/quotes/draft/${quote.id}`)
        .set(getAuthHeader())
        .send({
          publishDate,
        })
        .expect(200);

      await request(app).delete(`/quotes/${quote.id}`).set(getAuthHeader()).expect(412);
    });
  });

  context('POST communication/{partyId}/sendQuoteMail', () => {
    it('should send a quote sent party event when partyId and quoteId are valid', async () => {
      const quote = await createQuoteDraftWithSupportingData();
      const { id: quoteId, partyId } = quote;

      await request(app)
        .post(`/communication/${partyId}/sendQuoteMail`)
        .set(getAuthHeader())
        .send({
          quoteId,
        })
        .expect(200);
    });

    it('should return http status code 412 when quoteId is not sent', async () => {
      const quote = await createQuoteDraftWithSupportingData();
      const { partyId } = quote;

      const ov = override(config, { isProdEnv: true });
      await request(app)
        .post(`/communication/${partyId}/sendQuoteMail`)
        .set(getAuthHeader())
        .expect(412)
        .expect(response => {
          expect(response.body.token).to.equal('QUOTE_ID_NOT_DEFINED');
          expect(response.body.message).to.equal('Error processing request');
        });

      ov.restore();
    });

    it('should return http status code 404 when partyId is not valid', async () => {
      const quote = await createQuoteDraftWithSupportingData();
      const { id: quoteId } = quote;

      await request(app)
        .post(`/communication/${v4()}/sendQuoteMail`)
        .set(getAuthHeader())
        .send({
          quoteId,
        })
        .expect(404);
    });
  });
});
