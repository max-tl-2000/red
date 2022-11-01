/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import { expect } from 'chai';
import app from '../../api';
import { tenant } from '../../../testUtils/setupTestGlobalContext';
import * as repo from '../../../dal/marketingContactRepo';
import { updateProgram, loadPrograms } from '../../../dal/programsRepo';
import { testCtx as ctx, createAProgram, createAProperty, createAProgramReferrer, createAProgramReference } from '../../../testUtils/repoHelper';
import config from '../../../config';
import { generateTokenForDomain } from '../../../services/tenantService';
import { formatTenantEmailDomain } from '../../../../common/helpers/utils';
import { getEmailIdentifierFromUuid } from '../../../../common/helpers/strings';

describe('API/marketing/session', () => {
  describe('POST', () => {
    beforeEach(async () => {
      const globalProgram = await createAProgram({ name: 'global', directEmailIdentifier: 'global', directPhoneIdentifier: '12025550000' });
      await createAProgramReferrer({ programId: globalProgram.id, order: '999.00', currentUrl: '^(.*\\.)?global$', referrerUrl: '.*' });
    });
    const createHeader = async (data = { referrer: 'http://www.woodchaseforexample.com', validateReferrer: true }) => {
      const { referrer, validateReferrer } = data;
      const token = await generateTokenForDomain({
        tenantId: tenant.id,
        domain: 'www.woodchaseforexample.com',
        expiresIn: '1m',
        allowedEndpoints: ['marketing/session', 'marketingContact'],
        validateReferrer,
      });
      return {
        Authorization: `Bearer ${token}`,
        referer: referrer,
      };
    };

    it('should be a protected route', async () => {
      const res = await request(app).post('/marketing/session').send({});

      expect(res.status).to.equal(401);
    });

    describe('when the request has no currentUrl in the body', () => {
      it('should respond with 400 MISSING_CURRENT_URL', async () => {
        const header = await createHeader();

        const { status, body } = await request(app).post('/marketing/session').set(header).send({});

        expect(status).to.equal(400);
        expect(body.token).to.equal('MISSING_CURRENT_URL');
      });
    });

    const executeMatchingProgramExpects = (res, program) => {
      expect(res.status).to.equal(200);
      const { phone, email, marketingSessionId } = res.body;

      expect(marketingSessionId).to.be.ok;

      const domain = formatTenantEmailDomain(ctx.name, config.mail.emailDomain);
      const expectedEmailAddress = `${program.directEmailIdentifier}.${getEmailIdentifierFromUuid(marketingSessionId)}@${domain}`;

      expect(email).to.equal(expectedEmailAddress);
      expect(phone).to.equal(program.directPhoneIdentifier);
    };

    describe('when the request body is missing the referrerUrl', () => {
      it('should respond with 200 and the matching program data', async () => {
        const program = await createAProgram({ name: '1', directEmailIdentifier: '1', directPhoneIdentifier: '12025550127' });
        await createAProgramReferrer({ programId: program.id, order: '9.00', currentUrl: '^(.*\\.)?bing.com$', referrerUrl: '.*' });

        const res = await request(app)
          .post('/marketing/session')
          .set(await createHeader())
          .send({ currentUrl: 'woodchase.bing.com' });

        executeMatchingProgramExpects(res, program);
      });
    });

    describe('when the token has validateReferrer flag as false', () => {
      it('should respond with 200 and the matching program data', async () => {
        const program = await createAProgram({ name: '1', directEmailIdentifier: '1', directPhoneIdentifier: '12025550127' });
        await createAProgramReferrer({ programId: program.id, order: '9.00', currentUrl: '^(.*\\.)?bing.com$', referrerUrl: '.*' });

        const res = await request(app)
          .post('/marketing/session')
          .set(await createHeader({ referrer: 'www.google.com', validateReferrer: false }))
          .send({ currentUrl: 'woodchase.bing.com' });

        executeMatchingProgramExpects(res, program);
      });
    });

    describe('when the token has validateReferrer flag as true', () => {
      it('should respond with 400', async () => {
        const program = await createAProgram({ name: '1', directEmailIdentifier: '1', directPhoneIdentifier: '12025550127' });
        await createAProgramReferrer({ programId: program.id, order: '9.00', currentUrl: '^(.*\\.)?bing.com$', referrerUrl: '.*' });

        const res = await request(app)
          .post('/marketing/session')
          .set(await createHeader({ referrer: 'www.google.com', validateReferrer: true }))
          .send({ currentUrl: 'woodchase.bing.com' });

        expect(res.status).to.equal(400);
      });
    });

    describe('/marketingContact legacy', () => {
      describe('when the request body is missing the referrerUrl', () => {
        it('should respond with 200 and the matching program data', async () => {
          const program = await createAProgram({ name: '1', directEmailIdentifier: '1', directPhoneIdentifier: '12025550127' });
          await createAProgramReferrer({ programId: program.id, order: '9.00', currentUrl: '^(.*\\.)?bing.com$', referrerUrl: '.*' });

          const res = await request(app)
            .post('/marketingContact')
            .set(await createHeader())
            .send({ currentUrl: 'woodchase.bing.com' });

          expect(res.status).to.equal(200);
          const { phone, email, marketingSessionId } = res.body;

          expect(marketingSessionId).to.be.ok;

          const domain = formatTenantEmailDomain(ctx.name, config.mail.emailDomain);
          const expectedEmailAddress = `${program.directEmailIdentifier}.${getEmailIdentifierFromUuid(marketingSessionId)}@${domain}`;

          expect(email).to.equal(expectedEmailAddress);
          expect(phone).to.equal(program.directPhoneIdentifier);
        });
      });
    });

    describe('when no program referrers match', () => {
      const req = async () => {
        const reqData = { currentUrl: 'woodchase.bing.com', referrerUrl: 'woodchase.google.com' };
        const header = await createHeader();
        const res = await request(app).post('/marketing/session').set(header).send(reqData);
        // note that req here include any mutations done by the middleware!
        return { reqData, res };
      };

      it('should respond with 404 PROGRAM_NOT_FOUND', async () => {
        const { res } = await req();
        const { status, body } = res;

        expect(status).to.equal(404);
        expect(body.token).to.equal('PROGRAM_NOT_FOUND');
      });

      it('should save a MarketingContactHistory entry with NO_EXISTING_SESSION_NO_PROGRAM_MATCHED resolution', async () => {
        await req();

        const historyEntries = await repo.loadMarketingContactHistory(ctx);
        expect(historyEntries).to.have.lengthOf(1);

        const [{ marketingSessionId, marketingSessionResolution }] = historyEntries;
        expect(marketingSessionId).to.not.be.ok;
        expect(marketingSessionResolution).to.equal(repo.marketingSessionResolution.NO_EXISTING_SESSION_NO_PROGRAM_MATCHED);
      });
    });

    it('should respond with phone and email from matching program with smallest order and a marketingSessionId', async () => {
      const program1 = await createAProgram({ name: '1', directEmailIdentifier: '1', directPhoneIdentifier: '12025550127' });
      await createAProgramReferrer({ programId: program1.id, order: '9.00', currentUrl: '^(.*\\.)?bing.com$', referrerUrl: '^(.*\\.)?google.com$' });

      const program2 = await createAProgram({ name: '2', directEmailIdentifier: '2', directPhoneIdentifier: '12025550128' });
      await createAProgramReferrer({ programId: program2.id, order: '33.00', currentUrl: '^(.*\\.)?bing.com$', referrerUrl: '^(.*\\.)?google.com$' });

      const program3 = await createAProgram({ name: '3', directEmailIdentifier: '3', directPhoneIdentifier: '12025550129' });
      await createAProgramReferrer({ programId: program3.id, order: '10', currentUrl: '^(.*\\.)?bing.com$', referrerUrl: '^(.*\\.)?google.com$' });

      const headers = await createHeader();
      const res = await request(app).post('/marketing/session').set(headers).send({ currentUrl: 'woodchase.bing.com', referrerUrl: 'woodchase.google.com' });

      expect(res.status).to.equal(200);
      const { phone, email, marketingSessionId } = res.body;

      expect(marketingSessionId).to.be.ok;

      const domain = formatTenantEmailDomain(ctx.name, config.mail.emailDomain);
      const expectedEmailAddress = `${program1.directEmailIdentifier}.${getEmailIdentifierFromUuid(marketingSessionId)}@${domain}`;

      expect(email).to.equal(expectedEmailAddress);
      expect(phone).to.equal(program1.directPhoneIdentifier);
    });

    it('should save data to MarketingContactData and MarketingContactHistory tables', async () => {
      const requestData = { currentUrl: 'woodchase.bing.com', referrerUrl: 'woodchase.google.com', other: 'example info' };

      const program = await createAProgram({ name: '1', directEmailIdentifier: '1', directPhoneIdentifier: '12025550127' });
      await createAProgramReferrer({ programId: program.id, order: '1', currentUrl: '^(.*\\.)?bing.com$', referrerUrl: '^(.*\\.)?google.com$' });

      const header = await createHeader();

      const res = await request(app).post('/marketing/session').set(header).send(requestData);

      expect(res.status).to.equal(200);

      const dataEntries = await repo.loadMarketingContactData(ctx);
      expect(dataEntries.length).to.equal(1);
      const [{ marketingSessionId, programId, contact }] = dataEntries;

      expect(marketingSessionId).to.be.ok;
      expect(programId).to.equal(program.id);

      const domain = formatTenantEmailDomain(ctx.name, config.mail.emailDomain);
      const expectedEmailIdentifier = `${program.directEmailIdentifier}.${getEmailIdentifierFromUuid(marketingSessionId)}`;
      const expectedEmailAddress = `${expectedEmailIdentifier}@${domain}`;

      expect(contact.emailIdentifier).to.equal(expectedEmailIdentifier);
      expect(contact.email).to.equal(expectedEmailAddress);
      expect(contact.phone).to.equal(program.directPhoneIdentifier);

      const historyEntries = await repo.loadMarketingContactHistory(ctx);

      expect(historyEntries).to.have.lengthOf(1);

      const [historyEntry] = historyEntries;
      expect(historyEntry.marketingSessionId).to.equal(marketingSessionId);
      expect(historyEntry.requestData).to.deep.equal({ ...requestData, referrer: header.referer });
      expect(historyEntry.marketingSessionResolution).to.equal(repo.marketingSessionResolution.NO_EXISTING_SESSION_NEW_PROGRAM_MATCHED);
    });

    describe('when marketingSessionId is passed in the request body', () => {
      const createMarketingContactSession = async () => {
        const requestData = { currentUrl: 'woodchase.bing.com', referrerUrl: 'woodchase.google.com' };

        const property = await createAProperty();

        const program = await createAProgram({ name: '1', directEmailIdentifier: '1', directPhoneIdentifier: '12025550127', property });
        await createAProgramReferrer({ programId: program.id, order: '1', currentUrl: '^(.*\\.)?bing.com$', referrerUrl: '^(.*\\.)?google.com$' });

        const header = await createHeader();

        const { status, body } = await request(app).post('/marketing/session').set(header).send(requestData);

        expect(status).to.equal(200);

        return { requestData, sessionData: body, program, referrer: header.referer, property };
      };

      const createMultiProgramAndReferences = async (isDefaultReferrer = false) => {
        const program1 = await createAProgram({ name: '1', directEmailIdentifier: '1', directPhoneIdentifier: '12025550127' });
        await createAProgramReferrer({
          programId: program1.id,
          order: '9.00',
          currentUrl: '^(.*\\.)?bing.com$',
          referrerUrl: '^(.*\\.)?google.com$',
          isDefault: isDefaultReferrer,
        });

        const program2 = await createAProgram({ name: '2', directEmailIdentifier: '2', directPhoneIdentifier: '12025550128' });
        await createAProgramReferrer({
          programId: program2.id,
          order: '33.00',
          currentUrl: '^(.*\\.)?bing.com$',
          referrerUrl: '^(.*\\.)?google.com$',
          isDefault: isDefaultReferrer,
        });

        const program3 = await createAProgram({ name: '3', directEmailIdentifier: '3', directPhoneIdentifier: '12025550129' });
        await createAProgramReferrer({
          programId: program3.id,
          order: '10',
          currentUrl: '^(.*\\.)?bing.com$',
          referrerUrl: '^(.*\\.)?google.com$',
          isDefault: isDefaultReferrer,
        });

        const programs = await loadPrograms(ctx);

        await createAProgramReference({
          parentProgramId: program1.id,
          referenceProgramId: program2.id,
          referenceProgramPropertyId: programs.find(c => c.id === program2.id).primaryPropertyId,
        });

        await createAProgramReference({
          parentProgramId: program1.id,
          referenceProgramId: program3.id,
          referenceProgramPropertyId: programs.find(c => c.id === program3.id).primaryPropertyId,
        });

        await createAProgramReference({
          parentProgramId: program3.id,
          referenceProgramId: program1.id,
          referenceProgramPropertyId: programs.find(c => c.id === program1.id).primaryPropertyId,
        });

        return programs;
      };

      const createMarketingContactSessionWithProperties = async (propertyNames, marketingSessionId) => {
        const res = await request(app)
          .post('/marketing/session')
          .set(await createHeader())
          .send({
            currentUrl: 'woodchase.bing.com',
            marketingSessionId,
            referrerUrl: 'woodchase.google.com',
            properties: propertyNames,
          });

        expect(res.status).to.equal(200);
        return res;
      };

      describe('when the request data is the same as the previous one in the same session', () => {
        it('should respond with the data from the existing marketing session', async () => {
          const { requestData, sessionData } = await createMarketingContactSession();

          const firstRes = await request(app)
            .post('/marketing/session')
            .set(await createHeader())
            .send({ ...requestData, marketingSessionId: sessionData.marketingSessionId });

          expect(firstRes.status).to.equal(200);
          expect(firstRes.body).to.deep.equal(sessionData);

          const secondRes = await request(app)
            .post('/marketing/session')
            .set(await createHeader())
            .send({ ...requestData, marketingSessionId: sessionData.marketingSessionId });

          expect(secondRes.status).to.equal(200);

          expect(secondRes.body).to.deep.equal(firstRes.body);
        });

        it('should NOT save a new MarketingContactHistory entry', async () => {
          const { requestData, sessionData } = await createMarketingContactSession();

          await request(app)
            .post('/marketing/session')
            .set(await createHeader())
            .send({ ...requestData, marketingSessionId: sessionData.marketingSessionId });

          await request(app)
            .post('/marketing/session')
            .set(await createHeader())
            .send({ ...requestData, marketingSessionId: sessionData.marketingSessionId });

          const historyEntries = (await repo.loadMarketingContactHistory(ctx)).filter(e => !!e.requestData.marketingSessionId);

          // there should be only one entry, for the first request
          expect(historyEntries).to.have.length(1);
        });
      });

      describe('when the currentUrl and referrerUrl match the same program as the existing session', () => {
        it('should respond with the data from the existing marketing session', async () => {
          const { requestData, sessionData } = await createMarketingContactSession();

          const res = await request(app)
            .post('/marketing/session')
            .set(await createHeader())
            .send({ ...requestData, marketingSessionId: sessionData.marketingSessionId });

          expect(res.status).to.equal(200);

          expect(res.body).to.deep.equal(sessionData);
        });

        it('should save a MarketingContactHistory entry with EXISTING_SESSION_SAME_PROGRAM_MATCHED resolution', async () => {
          const { requestData, sessionData, referrer } = await createMarketingContactSession();

          await request(app)
            .post('/marketing/session')
            .set(await createHeader())
            .send({ ...requestData, marketingSessionId: sessionData.marketingSessionId });

          const historyEntries = await repo.loadMarketingContactHistory(ctx);

          const historyEntry = historyEntries.find(e => e.marketingSessionResolution === repo.marketingSessionResolution.EXISTING_SESSION_SAME_PROGRAM_MATCHED);

          expect(historyEntry).to.be.ok;
          expect(historyEntry.marketingSessionId).to.equal(sessionData.marketingSessionId);
          expect(historyEntry.requestData).to.deep.equal({ ...requestData, referrer, marketingSessionId: sessionData.marketingSessionId });
        });

        describe('but the program contact info has updated', () => {
          it('should respond with the updated contact info from the program and a new session', async () => {
            const { requestData, sessionData, program } = await createMarketingContactSession();

            const updatedProgram = await updateProgram(ctx, program.name, { directEmailIdentifier: '2', directPhoneIdentifier: '12025550129' });

            const res = await request(app)
              .post('/marketing/session')
              .set(await createHeader())
              .send({ ...requestData, marketingSessionId: sessionData.marketingSessionId });

            expect(res.status).to.equal(200);

            const { phone, email, marketingSessionId } = res.body;

            expect(marketingSessionId).to.be.ok;
            expect(marketingSessionId).to.not.equal(sessionData.marketingSessionId);

            const domain = formatTenantEmailDomain(ctx.name, config.mail.emailDomain);
            const expectedEmailAddress = `${updatedProgram.directEmailIdentifier}.${getEmailIdentifierFromUuid(marketingSessionId)}@${domain}`;

            expect(email).to.equal(expectedEmailAddress);
            expect(phone).to.equal(updatedProgram.directPhoneIdentifier);
          });

          it('should save a MarketingContactHistory entry with EXISTING_SESSION_UPDATED_PROGRAM_MATCHED resolution', async () => {
            const { requestData, sessionData, referrer, program } = await createMarketingContactSession();

            await updateProgram(ctx, program.name, { directEmailIdentifier: '2', directPhoneIdentifier: '12025550129' });

            const { body: newSessionData } = await request(app)
              .post('/marketing/session')
              .set(await createHeader())
              .send({ ...requestData, marketingSessionId: sessionData.marketingSessionId });

            const historyEntries = await repo.loadMarketingContactHistory(ctx);

            const historyEntry = historyEntries.find(
              e => e.marketingSessionResolution === repo.marketingSessionResolution.EXISTING_SESSION_UPDATED_PROGRAM_MATCHED,
            );

            expect(historyEntry).to.be.ok;
            expect(historyEntry.marketingSessionId).to.equal(newSessionData.marketingSessionId);
            expect(historyEntry.requestData).to.deep.equal({ ...requestData, referrer, marketingSessionId: sessionData.marketingSessionId });
          });
        });

        describe('but the property list has updated', () => {
          [false, true].forEach(isDefaultReferrer =>
            it('should respond with the updated contact info from the program and a new session', async () => {
              const programs = await createMultiProgramAndReferences(isDefaultReferrer);
              const program1 = programs.find(c => c.name === '1');
              const program3 = programs.find(c => c.name === '3');

              const name1 = program3.primaryProperty;
              const name2 = program1.primaryProperty;
              const name3 = 'random';

              const propertyNames = [name1, name2, name3];

              const res = await createMarketingContactSessionWithProperties(propertyNames);
              const { marketingSessionId: marketingSessionId1, phone: phone1, emailIdentifier: email1, associatedProperties: associatedProperties1 } = res.body;

              expect(email1).to.equal(`${program1.directEmailIdentifier}.${getEmailIdentifierFromUuid(marketingSessionId1)}`);
              expect(phone1).to.equal(program1.directPhoneIdentifier);

              expect(Object.keys(associatedProperties1)).to.have.length(3);

              const propertyNames2 = [name1, name2];

              const res2 = await createMarketingContactSessionWithProperties(propertyNames2, marketingSessionId1);
              const {
                phone: phone2,
                emailIdentifier: email2,
                marketingSessionId: marketingSessionId2,
                associatedProperties: associatedProperties2,
              } = res2.body;

              expect(email2).to.equal(`${program1.directEmailIdentifier}.${getEmailIdentifierFromUuid(marketingSessionId2)}`);
              expect(phone2).to.equal(program1.directPhoneIdentifier);

              expect(Object.keys(associatedProperties2)).to.have.length(2);
              expect(marketingSessionId1).to.not.equal(marketingSessionId2);

              expect(associatedProperties1[name1]).to.not.be.undefined;
              expect(associatedProperties2[name1]).to.not.be.undefined;
              expect(associatedProperties1[name1].phone).to.equal(program3.directPhoneIdentifier);
              expect(associatedProperties1[name1].phone).to.equal(associatedProperties2[name1].phone);

              expect(associatedProperties1[name2]).to.not.be.undefined;
              expect(associatedProperties2[name2]).to.not.be.undefined;
              expect(associatedProperties2[name2].email).is.undefined;
              expect(associatedProperties1[name2].email).is.undefined;
              expect(associatedProperties1[name2].description).to.equal('NO_REFERENCE_PROGRAM_FOR_PROPERTY');
              expect(associatedProperties1[name2].description).to.equal(associatedProperties2[name2].description);
              expect(associatedProperties1[name2].error).to.equal('404');
              expect(associatedProperties1[name2].error).to.equal(associatedProperties2[name2].error);

              const historyEntries = await repo.loadMarketingContactHistory(ctx);

              const historyEntry = historyEntries.find(
                e => e.marketingSessionResolution === repo.marketingSessionResolution.EXISTING_SESSION_ASSOCIATED_PROPERTIES_CHANGED,
              );

              expect(historyEntry).to.be.ok;
              expect(historyEntry.marketingSessionId).to.equal(marketingSessionId2);
            }),
          );
        });
      });

      describe('when the currentUrl and referrerUrl do not match any program', () => {
        it('should respond with the data from the existing marketing session', async () => {
          const { sessionData } = await createMarketingContactSession();

          const res = await request(app)
            .post('/marketing/session')
            .set(await createHeader())
            .send({ currentUrl: 'random', referrerUrl: 'random', marketingSessionId: sessionData.marketingSessionId });

          expect(res.status).to.equal(200);

          expect(res.body).to.deep.equal(sessionData);
        });

        it('should save a MarketingContactHistory entry with EXISTING_SESSION_NO_PROGRAM_MATCHED resolution', async () => {
          const { sessionData, referrer } = await createMarketingContactSession();
          const requestData = { currentUrl: 'random', referrerUrl: 'random', marketingSessionId: sessionData.marketingSessionId };

          await request(app)
            .post('/marketing/session')
            .set(await createHeader())
            .send(requestData);

          const historyEntries = await repo.loadMarketingContactHistory(ctx);

          const historyEntry = historyEntries.find(e => e.marketingSessionResolution === repo.marketingSessionResolution.EXISTING_SESSION_NO_PROGRAM_MATCHED);

          expect(historyEntry).to.be.ok;
          expect(historyEntry.marketingSessionId).to.equal(sessionData.marketingSessionId);
          expect(historyEntry.requestData).to.deep.equal({ ...requestData, referrer });
        });
      });

      describe('when the currentUrl and referrerUrl match another program', () => {
        it('should respond with the data from the new program', async () => {
          const { sessionData } = await createMarketingContactSession();

          const program = await createAProgram({ name: '2', directEmailIdentifier: '2', directPhoneIdentifier: '12025550128' });
          await createAProgramReferrer({ programId: program.id, order: '1', currentUrl: '^(.*\\.)?xyz.com$', referrerUrl: '^(.*\\.)?abc.com$' });

          const res = await request(app)
            .post('/marketing/session')
            .set(await createHeader())
            .send({ currentUrl: 'woodchase.xyz.com', referrerUrl: 'woodchase.abc.com', marketingSessionId: sessionData.marketingSessionId });

          expect(res.status).to.equal(200);

          const { phone, email, marketingSessionId } = res.body;

          expect(marketingSessionId).to.be.ok;
          expect(marketingSessionId).to.not.equal(sessionData.marketingSessionId);

          const domain = formatTenantEmailDomain(ctx.name, config.mail.emailDomain);
          const expectedEmailAddress = `${program.directEmailIdentifier}.${getEmailIdentifierFromUuid(marketingSessionId)}@${domain}`;

          expect(email).to.equal(expectedEmailAddress);
          expect(phone).to.equal(program.directPhoneIdentifier);
        });

        it('should save a MarketingContactHistory entry with EXISTING_SESSION_NEW_PROGRAM_MATCHED resolution', async () => {
          const { sessionData, referrer } = await createMarketingContactSession();

          const program = await createAProgram({ name: '2', directEmailIdentifier: '2', directPhoneIdentifier: '12025550128' });
          await createAProgramReferrer({ programId: program.id, order: '1', currentUrl: '^(.*\\.)?xyz.com$', referrerUrl: '^(.*\\.)?abc.com$' });

          const requestData = { currentUrl: 'woodchase.xyz.com', referrerUrl: 'woodchase.abc.com', marketingSessionId: sessionData.marketingSessionId };

          const { body: newSessionData } = await request(app)
            .post('/marketing/session')
            .set(await createHeader())
            .send(requestData);

          const historyEntries = await repo.loadMarketingContactHistory(ctx);

          const historyEntry = historyEntries.find(e => e.marketingSessionResolution === repo.marketingSessionResolution.EXISTING_SESSION_NEW_PROGRAM_MATCHED);

          expect(historyEntry).to.be.ok;
          expect(historyEntry.marketingSessionId).to.equal(newSessionData.marketingSessionId);
          expect(historyEntry.requestData).to.deep.equal({ ...requestData, referrer });
        });

        describe('but the matched program is the default one but for a different property', () => {
          it('should respond with the data from the new program', async () => {
            const { sessionData } = await createMarketingContactSession();

            const differentPropertyDefaultProgram = await createAProgram({ name: '2', directEmailIdentifier: '2', directPhoneIdentifier: '12025550128' });
            await createAProgramReferrer({
              programId: differentPropertyDefaultProgram.id,
              order: '1',
              currentUrl: '^(.*\\.)?xyz.com$',
              referrerUrl: '^(.*\\.)?abc.com$',
              isDefault: true,
            });

            const res = await request(app)
              .post('/marketingContact')
              .set(await createHeader())
              .send({ currentUrl: 'woodchase.xyz.com', referrerUrl: 'woodchase.abc.com', marketingSessionId: sessionData.marketingSessionId });

            expect(res.status).to.equal(200);

            const { phone, email, marketingSessionId } = res.body;

            expect(marketingSessionId).to.be.ok;
            expect(marketingSessionId).to.not.equal(sessionData.marketingSessionId);

            const domain = formatTenantEmailDomain(ctx.name, config.mail.emailDomain);
            const expectedEmailAddress = `${differentPropertyDefaultProgram.directEmailIdentifier}.${getEmailIdentifierFromUuid(marketingSessionId)}@${domain}`;

            expect(email).to.equal(expectedEmailAddress);
            expect(phone).to.equal(differentPropertyDefaultProgram.directPhoneIdentifier);
          });

          it('should save a MarketingContactHistory entry with EXISTING_SESSION_NEW_PROGRAM_MATCHED resolution', async () => {
            const { sessionData, referrer } = await createMarketingContactSession();

            const program = await createAProgram({ name: '2', directEmailIdentifier: '2', directPhoneIdentifier: '12025550128' });
            await createAProgramReferrer({
              programId: program.id,
              order: '1',
              currentUrl: '^(.*\\.)?xyz.com$',
              referrerUrl: '^(.*\\.)?abc.com$',
              isDefault: true,
            });

            const requestData = { currentUrl: 'woodchase.xyz.com', referrerUrl: 'woodchase.abc.com', marketingSessionId: sessionData.marketingSessionId };

            const { body: newSessionData } = await request(app)
              .post('/marketingContact')
              .set(await createHeader())
              .send(requestData);

            const historyEntries = await repo.loadMarketingContactHistory(ctx);

            const historyEntry = historyEntries.find(
              e => e.marketingSessionResolution === repo.marketingSessionResolution.EXISTING_SESSION_NEW_PROGRAM_MATCHED,
            );

            expect(historyEntry).to.be.ok;
            expect(historyEntry.marketingSessionId).to.equal(newSessionData.marketingSessionId);
            expect(historyEntry.requestData).to.deep.equal({ ...requestData, referrer });
          });
        });

        describe('but the matched program is the default one for the same property', () => {
          it('should respond with the data from the existing marketing session', async () => {
            const { sessionData, property } = await createMarketingContactSession();

            const program = await createAProgram({ name: '2', directEmailIdentifier: '2', directPhoneIdentifier: '12025550128', property });
            await createAProgramReferrer({
              programId: program.id,
              order: '1',
              currentUrl: '^(.*\\.)?xyz.com$',
              referrerUrl: '^(.*\\.)?abc.com$',
              isDefault: true,
            });

            const res = await request(app)
              .post('/marketing/session')
              .set(await createHeader())
              .send({ currentUrl: 'woodchase.xyz.com', referrerUrl: 'woodchase.abc.com', marketingSessionId: sessionData.marketingSessionId });

            expect(res.status).to.equal(200);
            expect(res.body).to.deep.equal(sessionData);
          });

          it('should save a MarketingContactHistory entry with EXISTING_SESSION_DEFAULT_PROGRAM_MATCHED resolution', async () => {
            const { sessionData, referrer, property } = await createMarketingContactSession();

            const program = await createAProgram({ name: '2', directEmailIdentifier: '2', directPhoneIdentifier: '12025550128', property });
            await createAProgramReferrer({
              programId: program.id,
              order: '1',
              currentUrl: '^(.*\\.)?xyz.com$',
              referrerUrl: '^(.*\\.)?abc.com$',
              isDefault: true,
            });

            const requestData = { currentUrl: 'woodchase.xyz.com', referrerUrl: 'woodchase.abc.com', marketingSessionId: sessionData.marketingSessionId };

            await request(app)
              .post('/marketing/session')
              .set(await createHeader())
              .send(requestData);

            const historyEntries = await repo.loadMarketingContactHistory(ctx);

            const historyEntry = historyEntries.find(
              e => e.marketingSessionResolution === repo.marketingSessionResolution.EXISTING_SESSION_DEFAULT_PROGRAM_MATCHED,
            );

            expect(historyEntry).to.be.ok;
            expect(historyEntry.marketingSessionId).to.equal(sessionData.marketingSessionId);
            expect(historyEntry.requestData).to.deep.equal({ ...requestData, referrer });
          });
        });
      });

      describe('when the request has properties in the body', () => {
        it('should respond with a list of contact information for the properties that are referred properties ', async () => {
          const programs = await createMultiProgramAndReferences();
          const program1 = programs.find(c => c.name === '1');
          const program3 = programs.find(c => c.name === '3');

          const name1 = program3.primaryProperty;
          const name2 = program1.primaryProperty;
          const name3 = 'random';

          const propertyNames = [name1, name2, name3];

          const res = await createMarketingContactSessionWithProperties(propertyNames);
          const { phone, email, marketingSessionId, associatedProperties } = res.body;

          expect(marketingSessionId).to.be.ok;

          const domain = formatTenantEmailDomain(ctx.name, config.mail.emailDomain);
          const expectedEmailAddress = `${program1.directEmailIdentifier}.${getEmailIdentifierFromUuid(marketingSessionId)}@${domain}`;

          expect(email).to.equal(expectedEmailAddress);
          expect(phone).to.equal(program1.directPhoneIdentifier);

          expect(Object.keys(associatedProperties)).to.have.length(3);

          expect(associatedProperties[name1]).to.not.be.undefined;
          const emailAddress = `${program3.directEmailIdentifier}.${getEmailIdentifierFromUuid(marketingSessionId)}@${domain}`;
          expect(associatedProperties[name1].email).to.equal(emailAddress);
          expect(associatedProperties[name1].phone).to.equal(program3.directPhoneIdentifier);

          expect(associatedProperties[name2]).to.not.be.undefined;
          expect(associatedProperties[name2].email).is.undefined;
          expect(associatedProperties[name2].description).to.equal('NO_REFERENCE_PROGRAM_FOR_PROPERTY');
          expect(associatedProperties[name2].error).to.equal('404');

          expect(associatedProperties[name3]).to.not.be.undefined;
          expect(associatedProperties[name3].email).is.undefined;
          expect(associatedProperties[name3].description).to.equal('INVALID_PROPERTY');
          expect(associatedProperties[name3].error).to.equal('404');
        });
      });
    });
  });
});
