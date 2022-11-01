/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';
import uuid from 'uuid/v4';
import app from '../../api';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import {
  createAParty,
  createAPartyMember,
  createAQuotePromotion,
  createALeaseTerm,
  createAQuote,
  createAUser,
  createATeam,
  createATeamMember,
  refreshUnitSearch,
  createACompany,
} from '../../../testUtils/repoHelper';
import { getPartyLeases } from '../../../dal/leaseRepo';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { tenant } from '../../../testUtils/setupTestGlobalContext';
import { MainRoleDefinition, FunctionalRoleDefinition } from '../../../../common/acd/rolesDefinition';
import { createLeaseTestData } from '../../../testUtils/leaseTestHelper';

describe('API ENDPOINTS FOR /quotePromotions', () => {
  const invalidUUID = '111-222-333';
  const quotePromotionKeys = [
    'id',
    'partyId',
    'quoteId',
    'leaseTermId',
    'promotionStatus',
    'modified_by',
    'created_at',
    'updated_at',
    'approvalDate',
    'approvedBy',
  ];

  let createdParty;
  let createdFakeUUID;
  let userLAA;
  let userLA;
  let team;
  let authUserTeamLA;

  beforeEach(async () => {
    userLAA = await createAUser();
    userLA = await createAUser();
    const functionalRoles = [FunctionalRoleDefinition.LAA.name, FunctionalRoleDefinition.LD.name];
    team = await createATeam({ functionalRoles });
    authUserTeamLA = await createATeam({
      functionalRoles: [FunctionalRoleDefinition.LD.name],
    });
    // Agent as Sally
    await createATeamMember({
      teamId: team.id,
      userId: userLAA.id,
      roles: {
        mainRoles: [MainRoleDefinition.LM.name],
        functionalRoles: [functionalRoles[0]],
      },
    });
    // Agent as Bill
    await createATeamMember({
      teamId: team.id,
      userId: userLA.id,
      roles: {
        mainRoles: [MainRoleDefinition.LA.name],
        functionalRoles: [functionalRoles[1], FunctionalRoleDefinition.LWA.name],
      },
    });
    // Bill create the Party
    createdParty = await createAParty({ userId: userLA.id, teams: [team.id] });
    createdFakeUUID = uuid();
  });

  describe('GET /quotePromotions', () => {
    describe('Error token scenarios', () => {
      describe('The partyId has incorrect format', () => {
        it('should respond with status code 400 and INCORRECT_PARTY_ID token', async () => {
          const res = await request(app).get(`/parties/${invalidUUID}/quotePromotions`).set(getAuthHeader());

          expect(res.status).to.equal(400);
          expect(res.body.token).to.equal('INCORRECT_PARTY_ID');
        });
      });

      describe('The partyId doesnt exists', () => {
        it('should respond with status code 404 and PARTY_NOT_FOUND token', async () => {
          const res = await request(app).get(`/parties/${createdFakeUUID}/quotePromotions`).set(getAuthHeader());

          expect(res.status).to.equal(404);
          expect(res.body.token).to.equal('PARTY_NOT_FOUND');
        });
      });
    });

    describe('The agent as LA/LAA can get all the promotions', () => {
      it('should respond with status code 200 and an array with 2 promoted quote', async () => {
        await createAQuotePromotion(createdParty.id, DALTypes.PromotionStatus.CANCELED);
        await createAQuotePromotion(createdParty.id, DALTypes.PromotionStatus.CANCELED);

        const res = await request(app).get(`/parties/${createdParty.id}/quotePromotions`).set(getAuthHeader());

        expect(res.status).to.equal(200);
        expect(res.body.length).to.equal(2);
      });
    });
  });

  describe('POST /quotePromotions', () => {
    describe('Error token scenarios', () => {
      describe('The partyId has incorrect format', () => {
        it('should respond with status code 400 and INCORRECT_PARTY_ID token', async () => {
          const res = await request(app).post(`/parties/${invalidUUID}/quotePromotions`).set(getAuthHeader());

          expect(res.status).to.equal(400);
          expect(res.body.token).to.equal('INCORRECT_PARTY_ID');
        });
      });

      describe('The partyId doesnt exists', () => {
        it('should respond with status code 404 and PARTY_NOT_FOUND token', async () => {
          const res = await request(app).post(`/parties/${createdFakeUUID}/quotePromotions`).set(getAuthHeader());

          expect(res.status).to.equal(404);
          expect(res.body.token).to.equal('PARTY_NOT_FOUND');
        });
      });

      describe('The promotion status for sending is different to PENDING_APPROVAL or APPROVED', () => {
        it('should respond with status code 412 and PROMOTION_STATUS_NOT_ACCEPT token, using REQUIRES_WORK', async () => {
          const newQuotePromotion = {
            partyId: createdParty.id,
            promotionStatus: DALTypes.PromotionStatus.REQUIRES_WORK,
          };

          const res = await request(app).post(`/parties/${createdParty.id}/quotePromotions`).set(getAuthHeader()).send(newQuotePromotion);

          expect(res.status).to.equal(412);
          expect(res.body.token).to.equal('PROMOTION_STATUS_NOT_ACCEPT');
        });
      });

      describe('There is a existed promotion with PENDING_APPROVAL or APPROVED status', () => {
        it('should respond with status code 412 and ACTIVE_PROMOTION_ALREADY_EXISTS token, using PENDING_APPROVAL', async () => {
          await createAQuotePromotion(createdParty.id, DALTypes.PromotionStatus.PENDING_APPROVAL);
          const newQuotePromotion = {
            partyId: createdParty.id,
            promotionStatus: '',
          };

          const res = await request(app).post(`/parties/${createdParty.id}/quotePromotions`).set(getAuthHeader()).send(newQuotePromotion);

          expect(res.status).to.equal(412);
          expect(res.body.token).to.equal('ACTIVE_PROMOTION_ALREADY_EXISTS');
        });

        it('should respond with status code 412 and ACTIVE_PROMOTION_ALREADY_EXISTS token, using APPROVED', async () => {
          await createAQuotePromotion(createdParty.id, DALTypes.PromotionStatus.APPROVED);
          const newQuotePromotion = {
            partyId: createdParty.id,
            promotionStatus: '',
          };

          const res = await request(app).post(`/parties/${createdParty.id}/quotePromotions`).set(getAuthHeader()).send(newQuotePromotion);

          expect(res.status).to.equal(412);
          expect(res.body.token).to.equal('ACTIVE_PROMOTION_ALREADY_EXISTS');
        });
      });

      describe('when the party has missing names', () => {
        const createPartyAndQuotePromotionRequest = async leaseType => {
          const corporateParty = await createAParty({ userId: userLA.id, leaseType });
          const leaseTermCreate = await createALeaseTerm({});
          const createdQuote = await createAQuote(corporateParty.id);
          const quotePromotionRequest = {
            partyId: corporateParty.id,
            leaseTermId: leaseTermCreate.id,
            quoteId: createdQuote.id,
            promotionStatus: DALTypes.PromotionStatus.PENDING_APPROVAL,
          };
          return { party: corporateParty, quotePromotionRequest };
        };

        it('responds with status code 412 and MISSING_COMPANY_NAME token', async () => {
          const { party, quotePromotionRequest } = await createPartyAndQuotePromotionRequest(DALTypes.PartyTypes.CORPORATE);
          await createAPartyMember(party.id, {
            fullName: 'Luke Skywalker',
            memberType: DALTypes.MemberType.RESIDENT,
          });

          await request(app)
            .post(`/parties/${party.id}/quotePromotions`)
            .set(getAuthHeader(tenant.id, userLA.id, [authUserTeamLA], false))
            .send(quotePromotionRequest)
            .expect(412)
            .expect(r => expect(r.body.token).to.equal('MISSING_COMPANY_NAME'));
        });

        it('responds with status code 412 and MISSING_POINT_OF_CONTACT token', async () => {
          const { party, quotePromotionRequest } = await createPartyAndQuotePromotionRequest(DALTypes.PartyTypes.CORPORATE);
          const company = await createACompany('Ford Co');

          await createAPartyMember(party.id, {
            companyId: company.id,
            fullName: '',
            memberType: DALTypes.MemberType.RESIDENT,
          });

          await request(app)
            .post(`/parties/${party.id}/quotePromotions`)
            .set(getAuthHeader(tenant.id, userLA.id, [authUserTeamLA], false))
            .send(quotePromotionRequest)
            .expect(412)
            .expect(r => expect(r.body.token).to.equal('MISSING_POINT_OF_CONTACT'));
        });

        it('responds with status code 412 and MISSING_LEGAL_NAME token', async () => {
          const { party, quotePromotionRequest } = await createPartyAndQuotePromotionRequest(DALTypes.PartyTypes.TRADITIONAL);
          await createAPartyMember(party.id, {
            fullName: '',
            memberType: DALTypes.MemberType.RESIDENT,
          });

          await request(app)
            .post(`/parties/${party.id}/quotePromotions`)
            .set(getAuthHeader(tenant.id, userLA.id, [authUserTeamLA], false))
            .send(quotePromotionRequest)
            .expect(412)
            .expect(r => expect(r.body.token).to.equal('MISSING_LEGAL_NAME'));
        });
      });
    });

    describe('The agent as LA promote a quote+term', () => {
      let newQuotePromotion;

      beforeEach(async () => {
        const leaseTermCreate = await createALeaseTerm({});
        const createdQuote = await createAQuote(createdParty.id);
        newQuotePromotion = {
          partyId: createdParty.id,
          leaseTermId: leaseTermCreate.id,
          quoteId: createdQuote.id,
          promotionStatus: '',
        };
      });

      describe('Agent do "request approval" action', () => {
        it('should respond with status code 200', async () => {
          newQuotePromotion.promotionStatus = DALTypes.PromotionStatus.PENDING_APPROVAL;
          newQuotePromotion.createApprovalTask = true;

          const res = await request(app)
            .post(`/parties/${createdParty.id}/quotePromotions`)
            .set(getAuthHeader(tenant.id, userLA.id, [authUserTeamLA], false))
            .send(newQuotePromotion);

          expect(res.status).to.equal(200);
          expect(res.body).to.have.all.keys('quotePromotion');
          const { quotePromotion } = res.body;
          expect(quotePromotion).to.have.all.keys(quotePromotionKeys);
          expect(quotePromotion.promotionStatus).to.equal(newQuotePromotion.promotionStatus);
        });

        describe('There is already a quote promotion with REQUIRES_WORK status', () => {
          it('should respond with status code 200 and return a quote promotion', async () => {
            newQuotePromotion.promotionStatus = DALTypes.PromotionStatus.PENDING_APPROVAL;
            await createAQuotePromotion(createdParty.id, DALTypes.PromotionStatus.REQUIRES_WORK);

            const res = await request(app)
              .post(`/parties/${createdParty.id}/quotePromotions`)
              .set(getAuthHeader(tenant.id, userLA.id, [authUserTeamLA], false))
              .send(newQuotePromotion);

            expect(res.status).to.equal(200);
            expect(res.body).to.have.all.keys('quotePromotion');
            const { quotePromotion } = res.body;
            expect(quotePromotion).to.have.all.keys(quotePromotionKeys);
            expect(quotePromotion.promotionStatus).to.equal(newQuotePromotion.promotionStatus);
          });
        });
      });

      describe('Agent do "create lease" action', () => {
        // FIXME after create a inventory, this one can get by getInventoryById
        // into the createLease function.
        it.skip('should respond with status code 200 and return a quote promotion, also created lease', async () => {
          newQuotePromotion.promotionStatus = DALTypes.PromotionStatus.APPROVED;
          newQuotePromotion.createApprovalTask = false;
          await refreshUnitSearch();

          const res = await request(app)
            .post(`/parties/${newQuotePromotion.partyId}/quotePromotions`)
            .set(getAuthHeader(tenant.id, userLA.id, [authUserTeamLA], false))
            .send(newQuotePromotion);

          expect(res);
          expect(res.status).to.equals(200);
          expect(res.body).to.have.all.keys('quotePromotion');
          const { quotePromotion } = res.body;
          expect(quotePromotion).to.have.all.keys(quotePromotionKeys);
          expect(quotePromotion.promotionStatus).to.equal(newQuotePromotion.promotionStatus);

          const leases = await getPartyLeases(tenant, newQuotePromotion.partyId);
          const hasPartyALease = leases.some(lease => lease.quoteId === newQuotePromotion.quoteId);
          expect(hasPartyALease).to.be.true;
        });
      });
    });

    describe('The agent as LAA promote a quote+term', () => {
      beforeEach(async () => {});

      it('should respond with status code 200', async () => {
        const leaseTermCreate = await createALeaseTerm({});
        const createdQuote = await createAQuote(createdParty.id);
        const newQuotePromotion = {
          partyId: createdParty.id,
          leaseTermId: leaseTermCreate.id,
          quoteId: createdQuote.id,
          promotionStatus: DALTypes.PromotionStatus.PENDING_APPROVAL,
          createApprovalTask: true,
        };

        const res = await request(app)
          .post(`/parties/${createdParty.id}/quotePromotions`)
          .set(getAuthHeader(tenant.id, userLAA.id, [team], true))
          .send(newQuotePromotion);

        expect(res.status).to.equal(200);
        expect(res.body).to.have.all.keys('quotePromotion');
        const { quotePromotion } = res.body;
        expect(quotePromotion).to.have.all.keys(quotePromotionKeys);
        expect(quotePromotion.promotionStatus).to.equal(newQuotePromotion.promotionStatus);
      });

      describe('Agent does a "create lease" action', () => {
        it('should respond with status code 200 and return a quote promotion, also created lease', async () => {
          const { partyId, quote, leaseTerm } = await createLeaseTestData();
          const newQuotePromotion = {
            partyId,
            leaseTermId: leaseTerm.id,
            quoteId: quote.id,
            promotionStatus: DALTypes.PromotionStatus.APPROVED,
            createApprovalTask: false,
          };

          await refreshUnitSearch();

          const res = await request(app)
            .post(`/parties/${createdParty.id}/quotePromotions`)
            .set(getAuthHeader(tenant.id, userLAA.id, [team], true))
            .send(newQuotePromotion);

          expect(res.status).to.equal(200);
          expect(res.body).to.have.keys('quotePromotion', 'lease');
          const { quotePromotion } = res.body;
          expect(quotePromotion).to.have.all.keys(quotePromotionKeys);
          expect(quotePromotion.promotionStatus).to.equal(newQuotePromotion.promotionStatus);

          const leases = await getPartyLeases(tenant, createdParty.id);
          const hasPartyALease = leases.some(lease => lease.quoteId === newQuotePromotion.quoteId);
          expect(hasPartyALease).to.be.true;
        });
      });
    });
  });

  describe('GET /quotePromotions/:quotePromotionId', () => {
    let promotedQuote;

    beforeEach(async () => {
      promotedQuote = await createAQuotePromotion(createdParty.id, DALTypes.PromotionStatus.PENDING_APPROVAL);
    });

    describe('Error token scenarios', () => {
      describe('The partyId has incorrect format', () => {
        it('should respond with status code 400 and INCORRECT_PARTY_ID token', async () => {
          const res = await request(app).get(`/parties/${invalidUUID}/quotePromotions/${promotedQuote.id}`).set(getAuthHeader());

          expect(res.status).to.equal(400);
          expect(res.body.token).to.equal('INCORRECT_PARTY_ID');
        });
      });

      describe('The partyId doesnt exists', () => {
        it('should respond with status code 404 and PARTY_NOT_FOUND token', async () => {
          const res = await request(app).get(`/parties/${createdFakeUUID}/quotePromotions/${promotedQuote}`).set(getAuthHeader());

          expect(res.status).to.equal(404);
          expect(res.body.token).to.equal('PARTY_NOT_FOUND');
        });
      });

      describe('The quotePromotionId has incorrect format', () => {
        it('should respond with status code 400 and INCORRECT_PARTY_QUOTE_PROMOTION_ID token', async () => {
          const res = await request(app).get(`/parties/${createdParty.id}/quotePromotions/${invalidUUID}`).set(getAuthHeader());

          expect(res.status).to.equal(400);
          expect(res.body.token).to.equal('INCORRECT_PARTY_QUOTE_PROMOTION_ID');
        });
      });

      describe('The quotePromotionId doesnt exists', () => {
        it('should respond with status code 404 and PARTY_QUOTE_PROMOTION_NOT_FOUND token', async () => {
          const res = await request(app).get(`/parties/${createdParty.id}/quotePromotions/${createdFakeUUID}`).set(getAuthHeader());

          expect(res.status).to.equal(404);
          expect(res.body.token).to.equal('PARTY_QUOTE_PROMOTION_NOT_FOUND');
        });
      });
    });

    describe('The agent as LA/LAA can get all the promotions', () => {
      it('should respond with status code 200 and an array with 1 promoted quote', async () => {
        const res = await request(app).get(`/parties/${createdParty.id}/quotePromotions/${promotedQuote.id}`).set(getAuthHeader());

        expect(res.status).to.equal(200);
        expect(res.body).to.have.all.keys(quotePromotionKeys);
        expect(res.body.promotionStatus).to.equal(promotedQuote.promotionStatus);
      });
    });
  });

  describe('PATCH /quotePromotions/:quotePromotionId', () => {
    let promotedQuote;
    let promotionToUpdate;

    beforeEach(async () => {
      promotedQuote = await createAQuotePromotion(createdParty.id, DALTypes.PromotionStatus.PENDING_APPROVAL);
      promotionToUpdate = {
        quoteId: promotedQuote.quoteId,
        leaseTermId: promotedQuote.leaseTermId,
        partyId: promotedQuote.partyId,
        promotionStatus: DALTypes.PromotionStatus.APPROVED,
      };
    });

    describe('Error token scenarios', () => {
      describe('There is not promotion status in the request', () => {
        it('should respond with status code 400 and MISSING_STATUS token', async () => {
          promotionToUpdate.promotionStatus = '';

          const res = await request(app)
            .patch(`/parties/${promotionToUpdate.partyId}/quotePromotions/${promotedQuote.id}`)
            .set(getAuthHeader())
            .send(promotionToUpdate);

          expect(res.status).to.equal(400);
          expect(res.body.token).to.equal('MISSING_STATUS');
        });
      });

      describe('The partyId has incorrect format', () => {
        it('should respond with status code 400 and INCORRECT_PARTY_ID token', async () => {
          const res = await request(app).patch(`/parties/${invalidUUID}/quotePromotions/${promotedQuote.id}`).set(getAuthHeader()).send(promotionToUpdate);

          expect(res.status).to.equal(400);
          expect(res.body.token).to.equal('INCORRECT_PARTY_ID');
        });
      });

      describe('The partyId doesnt exists', () => {
        it('should respond with status code 404 and PARTY_NOT_FOUND token', async () => {
          const res = await request(app).patch(`/parties/${createdFakeUUID}/quotePromotions/${promotedQuote.id}`).set(getAuthHeader()).send(promotionToUpdate);

          expect(res.status).to.equal(404);
          expect(res.body.token).to.equal('PARTY_NOT_FOUND');
        });
      });

      describe('The quotePromotionId has incorrect format', () => {
        it('should respond with status code 400 and INCORRECT_PARTY_QUOTE_PROMOTION_ID token', async () => {
          const res = await request(app).patch(`/parties/${createdParty.id}/quotePromotions/${invalidUUID}`).set(getAuthHeader()).send(promotionToUpdate);

          expect(res.status).to.equal(400);
          expect(res.body.token).to.equal('INCORRECT_PARTY_QUOTE_PROMOTION_ID');
        });
      });

      describe('The quotePromotionId doesnt exists', () => {
        it('should respond with status code 404 and PARTY_QUOTE_PROMOTION_NOT_FOUND token', async () => {
          const res = await request(app).patch(`/parties/${createdParty.id}/quotePromotions/${createdFakeUUID}`).set(getAuthHeader()).send(promotionToUpdate);

          expect(res.status).to.equal(404);
          expect(res.body.token).to.equal('PARTY_QUOTE_PROMOTION_NOT_FOUND');
        });
      });

      describe('The promotion status for sending is different to REQUIRES_WORK, APPROVED or CANCELED', () => {
        it('should respond with status code 412 and PROMOTION_STATUS_NOT_ACCEPT token, using PENDING_APPROVAL', async () => {
          promotionToUpdate.promotionStatus = DALTypes.PromotionStatus.PENDING_APPROVAL;

          const res = await request(app).patch(`/parties/${createdParty.id}/quotePromotions/${promotedQuote.id}`).set(getAuthHeader()).send(promotionToUpdate);

          expect(res.status).to.equal(412);
          expect(res.body.token).to.equal('PROMOTION_STATUS_NOT_ACCEPT');
        });
      });

      describe('The agent as LA use this endpoint', () => {
        it('should respond with status code 403 and INVALID_USER_ROLE token', async () => {
          const res = await request(app)
            .patch(`/parties/${createdParty.id}/quotePromotions/${promotedQuote.id}`)
            .set(getAuthHeader(tenant.id, userLA.id, [authUserTeamLA], false))
            .send(promotionToUpdate);

          expect(res.status).to.equal(403);
          expect(res.body.token).to.equal('INVALID_USER_ROLE');
        });
      });
    });

    describe('The agent as LAA update a existed promotion', () => {
      describe('Agent do "decline" action', () => {
        it('should respond with status code 200', async () => {
          promotionToUpdate.promotionStatus = DALTypes.PromotionStatus.CANCELED;
          await createAQuote(createdParty.id);
          await refreshUnitSearch();

          const res = await request(app)
            .patch(`/parties/${promotedQuote.partyId}/quotePromotions/${promotedQuote.id}`)
            .set(getAuthHeader(tenant.id, userLAA.id, [team], false, userLAA))
            .send(promotionToUpdate);

          expect(res.status).to.equal(200);
          expect(res.body).to.have.all.keys('quotePromotion');
          const { quotePromotion } = res.body;
          expect(quotePromotion).to.have.all.keys(quotePromotionKeys);
          expect(quotePromotion.promotionStatus).to.equal(promotionToUpdate.promotionStatus);
        });
      });

      describe('Agent do "require additional work" action', () => {
        it('should respond with status code 200', async () => {
          promotionToUpdate.promotionStatus = DALTypes.PromotionStatus.REQUIRES_WORK;
          const res = await request(app)
            .patch(`/parties/${createdParty.id}/quotePromotions/${promotedQuote.id}`)
            .set(getAuthHeader(tenant.id, userLAA.id, [team], false))
            .send(promotionToUpdate);

          expect(res.status).to.equal(200);
          expect(res.body.quotePromotion).to.have.all.keys(quotePromotionKeys);
          expect(res.body.quotePromotion.promotionStatus).to.equal(promotionToUpdate.promotionStatus);
        });
      });

      describe('Agent do "approve" action', () => {
        // FIXME after create a inventory, this one can get by getInventoryById
        // into the createLease function.
        it.skip('should respond with status code 200', async () => {
          promotionToUpdate.promotionStatus = DALTypes.PromotionStatus.APPROVED;

          const res = await request(app)
            .patch(`/parties/${promotedQuote.partyId}/quotePromotions/${promotedQuote.id}`)
            .set(getAuthHeader(tenant.id, userLAA.id, [team], false))
            .send(promotionToUpdate);

          expect(res.status).to.equal(200);
          expect(res.body.quotePromotion).to.have.all.keys(quotePromotionKeys);
          expect(res.body.quotePromotion.promotionStatus).to.equal(promotionToUpdate.promotionStatus);
        });
      });
    });

    describe('The agent as LA update a existed promotion', () => {
      /*
      The agent as LA never can use this Endpoint, he never see the review application dialog,
      see the test case 'The agent as LA use this endpoint'
      */
    });
  });
});
