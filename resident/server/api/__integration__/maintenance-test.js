/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import sinon from 'sinon';
import { mapSeries } from 'bluebird';
import newId from 'uuid/v4';
import { expect } from 'chai';

import '../../../../server/testUtils/setupTestGlobalContext';
import app from '../../../../consumer/server/server';
import { getAuthHeader } from '../../../../server/testUtils/apiHelper';
import { createAProperty, createAPerson, createACommonUser, testCtx } from '../../../../server/testUtils/repoHelper';
import { LA_TIMEZONE } from '../../../../common/date-constants';
import { ResidentPropertyState } from '../../../../common/enums/residentPropertyStates';
import { updateProperty } from '../../../../server/dal/propertyRepo';
import { setRetrieveCommonUserPropertiesFunction, resetRetrieveCommonUserPropertiesFunction } from '../common-middlewares';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { setGetLeaseInfoForPersonFunction, resetGetLeaseInfoForPersonFunction, getAptexxMaintenanceTypes } from '../../services/maintenance';

describe('maintenance', () => {
  let property;
  let commonUserId;
  let propertyId;
  let token;
  let commonUser;
  let personId;
  const inventoryId = newId();

  const getPropertyRes = (withProperties = true) => {
    if (withProperties) {
      return [
        {
          propertyName: property.name,
          propertyId,
          tenantName: testCtx.name,
          tenantLegal: '',
          residentState: ResidentPropertyState.CURRENT,
          features: { paymentModule: true, maintenanceModule: true },
          personId,
          propertyTimezone: LA_TIMEZONE,
        },
      ];
    }
    return [];
  };

  const leaseInfoList = [
    {
      inventoryId,
      unitFullyQualifiedName: 'sampleUnitName',
      unitDisplayName: 'sample unit display name',
      buildingDisplayName: 'sample building display name',
      partyId: newId(),
      leaseId: newId(),
      activeLeaseId: newId(),
      personExternalId: 'ext123',
      propertyId,
      partyWorkflowState: DALTypes.WorkflowState.ACTIVE,
      partyState: DALTypes.PartyStateType.RESIDENT,
    },
  ];

  beforeEach(async () => {
    const person = await createAPerson();
    personId = person.id;
    const result = await createACommonUser({
      tenantId: testCtx.tenantId,
      fullName: 'Jackie Brown',
      preferredName: 'Jackie',
      email: 'jackie@bro.wn',
      personId,
    });
    commonUser = result.commonUser;
    commonUserId = commonUser.id;

    property = await createAProperty();
    propertyId = property.id;
    token = getAuthHeader(testCtx.tenantId, commonUserId, null, true, { email: commonUser.email, personId });

    const getCommonUserProperties = sinon.spy(() => getPropertyRes());
    setRetrieveCommonUserPropertiesFunction(getCommonUserProperties);
    const getLeaseInfoForPerson = sinon.spy(() => leaseInfoList);
    setGetLeaseInfoForPersonFunction(getLeaseInfoForPerson);
  });

  afterEach(() => {
    resetRetrieveCommonUserPropertiesFunction();
    resetGetLeaseInfoForPersonFunction();
  });

  describe('POST resident/api/properties/:propertyId/maintenanceTickets', () => {
    describe('given a request to create a maintenance ticket', () => {
      describe('when parameters are missing', () => {
        it('responds with status code 400 and MISSING_REQUIRED_PARAMETER token', async () => {
          const requiredParameters = {
            inventoryId,
            location: 'KITCHEN',
            type: 'electrical',
            phone: '+12025550678',
            description: 'test',
            hasPermissionToEnter: true,
            hasPets: false,
          };

          await mapSeries(Object.keys(requiredParameters), async key => {
            const { [key]: missingParameter, ...parameters } = requiredParameters;

            const res = await request(app)
              .post(`/resident/api/properties/${propertyId}/maintenanceTickets`)
              .set({ tenant: testCtx.name })
              .set(token)
              .send(parameters);

            expect(res.status).to.equal(400);
            expect(res.body.token).to.equal(`MISSING_REQUIRED_PARAMETER: ${key}`);
          });

          const requiredAttachmentParameters = {
            metadata: { some: 'metadata' },
            contentData: 'base64goeshere',
          };

          await mapSeries(Object.keys(requiredAttachmentParameters), async key => {
            const { [key]: missingParameter, ...attachment } = requiredAttachmentParameters;

            const res = await request(app)
              .post(`/resident/api/properties/${propertyId}/maintenanceTickets`)
              .set({ tenant: testCtx.name })
              .set(token)
              .send({
                ...requiredParameters,
                attachments: [attachment],
              });

            expect(res.status).to.equal(400);
            expect(res.body.token).to.equal(`MISSING_REQUIRED_PARAMETER: ${key}`);
          });
        });
      });

      describe('when payload has attachments', () => {
        it('responds with status code 200 and attachments urls', async () => {
          const params = {
            inventoryId,
            location: 'KITCHEN',
            type: 'electrical',
            phone: '+12025550678',
            description: 'test',
            hasPermissionToEnter: true,
            hasPets: false,
            attachments: [
              {
                metadata: { some: 'metadata' },
                contentData: 'base64goeshere',
              },
            ],
          };

          const res = await request(app)
            .post(`/resident/api/properties/${propertyId}/maintenanceTickets`)
            .set({ tenant: testCtx.name })
            .set(token)
            .send(params);

          expect(res.status).to.equal(200);
          expect(res.body.maintenanceId).to.not.be.null;
        });
      });
    });
  });

  describe('GET resident/api/properties/:propertyId/maintenanceInfo', () => {
    describe('given a request to retrieve the maintenance information', () => {
      describe('when common user does not exist', () => {
        it('responds with status code 500 and MISSING_COMMON_USER_ID token', async () => {
          const getCommonUserProperties = sinon.spy(() => getPropertyRes(false));

          setRetrieveCommonUserPropertiesFunction(getCommonUserProperties);
          const newToken = getAuthHeader(testCtx.tenantId, newId(), null);

          const res = await request(app).get(`/resident/api/properties/${propertyId}/maintenanceInfo`).set({ tenant: testCtx.name }).set(newToken);

          expect(res.status).to.equal(500);
          expect(res.body.token).to.equal('MISSING_COMMON_USER_ID');
        });
      });

      describe('when property is not associated to user', () => {
        it('responds with status code 403 and PROPERTY_NOT_ASSOCIATED_TO_USER token', async () => {
          const getCommonUserProperties = sinon.spy(() => getPropertyRes(false));

          setRetrieveCommonUserPropertiesFunction(getCommonUserProperties);

          const res = await request(app).get(`/resident/api/properties/${propertyId}/maintenanceInfo`).set({ tenant: testCtx.name }).set(token);

          expect(res.status).to.equal(403);
          expect(res.body.token).to.equal('PROPERTY_NOT_ASSOCIATED_TO_USER');
        });
      });

      describe('when request is correct', () => {
        it('responds with status code 200 and the maintenance information', async () => {
          const propertyRes = {
            propertyName: property.name,
            propertyId,
            tenantName: testCtx.name,
            tenantLegal: '',
            residentState: ResidentPropertyState.CURRENT,
            features: { paymentModule: true, maintenanceModule: true },
            personId,
            propertyTimezone: LA_TIMEZONE,
          };
          const getCommonUserProperties = sinon.spy(() => [propertyRes]);

          setRetrieveCommonUserPropertiesFunction(getCommonUserProperties);
          const maintenanceTicketKeys = ['inventoryId', 'tickets'];
          const ticketKeys = [
            'location',
            'dateCreated',
            'dateCompleted',
            'dateCancelled',
            'type',
            'description',
            'hasPermissionToEnter',
            'hasPets',
            'status',
            'ticketNumber',
            'attachmentUrls',
          ];

          const res = await request(app).get(`/resident/api/properties/${propertyId}/maintenanceInfo`).set({ tenant: testCtx.name }).set(token);
          expect(res.status).to.equal(200);
          const body = res.body;
          expect(body).to.have.all.keys(['unitsMaintenanceInfo']);
          expect(body.unitsMaintenanceInfo.length).to.equal(2); // based on the fake provider
          expect(body.unitsMaintenanceInfo[0]).to.have.all.keys(maintenanceTicketKeys);

          const firstTicket = body.unitsMaintenanceInfo[0].tickets[0];
          expect(firstTicket).to.have.all.keys(ticketKeys);
        });
      });
    });
  });

  describe('GET resident/api/properties/:propertyId/maintenanceTypes', () => {
    describe('given a request to retrieve the maintenance types', () => {
      describe('when common user does not exist', () => {
        it('responds with status code 500 and MISSING_COMMON_USER_ID token', async () => {
          const getCommonUserProperties = sinon.spy(() => getPropertyRes(false));

          setRetrieveCommonUserPropertiesFunction(getCommonUserProperties);
          const newToken = getAuthHeader(testCtx.tenantId, newId(), null);

          const res = await request(app).get(`/resident/api/properties/${propertyId}/maintenanceTypes`).set({ tenant: testCtx.name }).set(newToken);

          expect(res.status).to.equal(500);
          expect(res.body.token).to.equal('MISSING_COMMON_USER_ID');
        });
      });

      describe('when property is not associated to user', () => {
        it('responds with status code 403 and PROPERTY_NOT_ASSOCIATED_TO_USER token', async () => {
          const getCommonUserProperties = sinon.spy(() => getPropertyRes(false));

          setRetrieveCommonUserPropertiesFunction(getCommonUserProperties);

          const res = await request(app).get(`/resident/api/properties/${propertyId}/maintenanceTypes`).set({ tenant: testCtx.name }).set(token);

          expect(res.status).to.equal(403);
          expect(res.body.token).to.equal('PROPERTY_NOT_ASSOCIATED_TO_USER');
        });
      });

      describe('when in the property we do not have maintenance types', () => {
        it('responds with status code 500 and MAINTENANCE_TYPES_NOT_AVAILABLE token', async () => {
          const propertyRes = {
            propertyName: property.name,
            propertyId,
            tenantName: testCtx.name,
            tenantLegal: '',
            residentState: ResidentPropertyState.CURRENT,
            features: { paymentModule: true, maintenanceModule: true },
            personId,
            propertyTimezone: LA_TIMEZONE,
          };
          const getCommonUserProperties = sinon.spy(() => [propertyRes]);

          setRetrieveCommonUserPropertiesFunction(getCommonUserProperties);

          const res = await request(app).get(`/resident/api/properties/${propertyId}/maintenanceTypes`).set({ tenant: testCtx.name }).set(token);

          expect(res.status).to.equal(500);
          expect(res.body.token).to.equal('MAINTENANCE_TYPES_NOT_AVAILABLE');
        });
      });

      describe('when request is correct', () => {
        it('responds with status code 200 and the maintenance types information', async () => {
          const propertyRes = {
            propertyName: property.name,
            propertyId,
            tenantName: testCtx.name,
            tenantLegal: '',
            residentState: ResidentPropertyState.CURRENT,
            features: { paymentModule: true, maintenanceModule: true },
            personId,
            propertyTimezone: LA_TIMEZONE,
          };
          const getCommonUserProperties = sinon.spy(() => [propertyRes]);

          setRetrieveCommonUserPropertiesFunction(getCommonUserProperties);

          const maintenanceTypes = await getAptexxMaintenanceTypes(testCtx, { clientId: '1', accountId: '2' });
          await updateProperty(testCtx, { id: property.id }, { paymentProvider: { aptexx: { maintenanceTypes } } });

          const resultKeys = ['types', 'locations'];
          const maintenanceTypetKeys = ['integrationId', 'type'];
          const maintenanceLocationKeys = ['code', 'name'];

          const res = await request(app).get(`/resident/api/properties/${propertyId}/maintenanceTypes`).set({ tenant: testCtx.name }).set(token);
          expect(res.status).to.equal(200);

          const body = res.body;
          expect(body).to.have.all.keys(resultKeys);

          expect(body.types.length).to.be.not.null;
          expect(body.types[0]).to.have.all.keys(maintenanceTypetKeys);

          expect(body.locations.length).to.be.not.null;
          expect(body.locations[0]).to.have.all.keys(maintenanceLocationKeys);
        });
      });
    });
  });
});
