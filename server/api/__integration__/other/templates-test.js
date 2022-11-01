/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import request from 'supertest';
import getUUID from 'uuid/v4';
import path from 'path';
import chaiJestSnapshot from 'chai-jest-snapshot';
import chai from 'chai';
import app from '../../api';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import { TemplateTypes } from '../../../../common/enums/templateTypes';
import {
  processWorkbook,
  getPropertyFromWorkbook,
  getCommsTemplatesFromWorkbook,
  getTemplateShortCodesFromWorkbook,
  getBusinessEntityFromWorkbook,
  getPropertyGroupFromWorkbook,
  getPartyCohortsFromWorkbook,
} from '../../../import/excelInventory.js';
import { parse } from '../../../helpers/workbook';
import { importProperties } from '../../../import/inventory/property';
import { importCommsTemplates } from '../../../import/inventory/commsTemplate';
import { importTemplateShortCodes } from '../../../import/inventory/templateShortCode';
import { importBusinessEntities } from '../../../import/inventory/businessEntity';
import { importPropertyGroups } from '../../../import/inventory/propertyGroup';
import { importPartyCohorts } from '../../../import/inventory/partyCohort';
import { tenant } from '../../../testUtils/setupTestGlobalContext';
import { getPropertyByName } from '../../../dal/propertyRepo';
import { getCommsTemplateByName } from '../../../dal/commsTemplateRepo';
import { spreadsheet } from '../../../../common/helpers/spreadsheet';

import config from '../../../config';
import { override } from '../../../../common/test-helpers/overrider';

chai.use(chaiJestSnapshot);
const { expect } = chai;

describe('API/templates', () => {
  const inventoryFilePath = path.join(__dirname, '../../../import/__tests__/resources/Inventory.xlsx');
  const ctx = { tenantId: tenant.id };

  const validPropertyName = 'cove';
  const validTemplateName = 'application-test-invite-noquote';
  const validTemplateSubject = 'Rental application - Apply now';
  const validEmailTemplateTokensData = {
    property: {
      displayName: 'COVE',
      heroImageUrl: 'https://reva.tech/wp-content/themes/reva/images/reva_logo.svg',
      termsUrl: 'https://reva.tech/terms-and-conditions/',
      privacyUrl: 'https://reva.tech/privacy-policy/',
      contactUrl: 'https://reva.tech/',
      address: 'Some address',
    },
    employee: {
      avatarImage: {
        imageUrl: 'https://reva.tech/wp-content/themes/reva/images/reva_logo.svg',
      },
      fullName: 'John Smith',
      businessTitle: 'Manager',
    },
    primaryPropertyTeam: {
      phone: { displayFormat: '+1046784468' },
      email: 'john@reva.tech',
    },
    recipient: { applicationUrl: 'https://reva.tech/' },
    currentYear: '2018',
  };

  const validSmsTemplateTokensData = {
    recipient: {
      legalName: 'John Smith',
      applicationUrl: { short: 'https://reva.tech/' },
    },
    property: {
      displayName: 'COVE',
    },
  };

  let propertyId;

  const sheetsForTemplates = [
    {
      workbookSheetName: spreadsheet.BusinessEntity.workbookSheetName,
      getEntities: getBusinessEntityFromWorkbook,
      importEntities: importBusinessEntities,
      headers: spreadsheet.BusinessEntity.columns,
    },
    {
      workbookSheetName: spreadsheet.PropertyGroup.workbookSheetName,
      getEntities: getPropertyGroupFromWorkbook,
      importEntities: importPropertyGroups,
      headers: spreadsheet.PropertyGroup.columns,
    },
    {
      workbookSheetName: spreadsheet.PartyCohorts.workbookSheetName,
      getEntities: getPartyCohortsFromWorkbook,
      importEntities: importPartyCohorts,
      headers: spreadsheet.PartyCohorts.columns,
    },
    {
      workbookSheetName: spreadsheet.Property.workbookSheetName,
      getEntities: getPropertyFromWorkbook,
      importEntities: importProperties,
      isAllowedForCustomerAdmin: true,
      headers: spreadsheet.Property.columns,
    },
    {
      workbookSheetName: spreadsheet.CommsTemplate.workbookSheetName,
      getEntities: getCommsTemplatesFromWorkbook,
      importEntities: importCommsTemplates,
      headers: spreadsheet.CommsTemplate.columns,
    },
    {
      workbookSheetName: spreadsheet.TemplateShortCode.workbookSheetName,
      getEntities: getTemplateShortCodesFromWorkbook,
      importEntities: importTemplateShortCodes,
      headers: spreadsheet.TemplateShortCode.columns,
    },
  ];

  const setupSampleData = async () => {
    await processWorkbook(ctx, await parse(inventoryFilePath), sheetsForTemplates);
    propertyId = ((await getPropertyByName(ctx, validPropertyName)) || {}).id;
  };

  describe('calling /templates/mjmlToHtml', () => {
    describe('when sending request to /templates/mjmlToHtml api', () => {
      it('should return 200 status when request is successfully', async () => {
        const payload = {
          mjml: '<mjml><mj-body><mj-section>Appointment cancelled</mj-section></mj-body></mjml>',
        };

        const { status, body } = await request(app).post('/templates/mjmlToHtml').set(getAuthHeader()).send(payload);

        expect(status).to.equal(200);
        expect(body).to.have.property('missingTokens');
        expect(body).to.have.property('errors');
        expect(body).to.have.property('renderedTemplate');
      });

      it('should return 400 status when request body does not have mjml property or is empty', async () => {
        const payload = {
          mjml: '',
        };

        const ov = override(config, { isProdEnv: true });

        const { status, body } = await request(app).post('/templates/mjmlToHtml').set(getAuthHeader()).send(payload);

        ov.restore();
        expect(status).to.equal(400);
        expect(body.message).to.equal('Error processing request');
        expect(body.token).to.equal('MJML_PARAM_NOT_DEFINED');
      });
    });
  });

  describe('calling /templates/:propertyId/shortCodes', () => {
    describe('when sending a valid property id', () => {
      it('should return the templates shortCodes for that property successfully', async () => {
        await setupSampleData();
        const expectedShortCodes = ['rinv', 'acre', 'aupd', 'acan', 'arem'];

        const { status, body } = await request(app).get(`/templates/${propertyId}/shortCodes`).set(getAuthHeader());

        expect(status).to.equal(200);
        expect(body).to.be.an('array');
        expect(body.map(({ shortCode }) => shortCode)).to.include.all.members(expectedShortCodes);
      });
    });
  });

  const callRenderTemplateApi = async ({ templateId, context, templateDataOverride }) => {
    const payload = {
      context,
      partyId: getUUID(),
      templateDataOverride,
      options: { validationLevel: 'skip', beautify: true },
    };

    return await request(app).post(`/templates/${templateId}/render`).set(getAuthHeader()).send(payload);
  };

  describe('calling /templates/:templateId/render', () => {
    let templateId;
    beforeEach(async () => {
      await setupSampleData();
      templateId = ((await getCommsTemplateByName(ctx, validTemplateName)) || {}).id;
    });

    describe('when sending a valid template id', () => {
      describe(`and context is ${TemplateTypes.EMAIL}`, () => {
        describe('and there are valid tokens', () => {
          it('should return the rendered email template successfully', async () => {
            chaiJestSnapshot.setFilename('server/api/__integration__/__snapshots__/valid-email-template-snapshot.html');
            chaiJestSnapshot.setTestName('Email template rendered successfully');

            const { status, body } = await callRenderTemplateApi({
              templateId,
              context: TemplateTypes.EMAIL,
              templateDataOverride: validEmailTemplateTokensData,
            });

            const { subject, body: templateBody, missingTokens } = body;

            expect(status).to.equal(200);
            expect(subject).to.equal(validTemplateSubject);
            expect(missingTokens.length).to.equal(0);
            expect(templateBody).to.matchSnapshot();
          });
        });
        describe('and there are missing tokens', () => {
          it('should return the rendered email template without the tokens', async () => {
            chaiJestSnapshot.setFilename('server/api/__integration__/__snapshots__/invalid-email-template-snapshot.html');
            chaiJestSnapshot.setTestName('Email template rendered without the tokens');

            const { status, body } = await callRenderTemplateApi({ templateId, context: TemplateTypes.EMAIL, templateDataOverride: {} });

            const { subject, body: templateBody, missingTokens } = body;

            expect(status).to.equal(200);
            expect(subject).to.equal(validTemplateSubject);
            expect(templateBody).to.matchSnapshot();
            expect(missingTokens.length).to.equal(17);
            expect(missingTokens).to.deep.equal([
              'property.displayName',
              'employee.avatarImage.imageUrl',
              'employee.fullName',
              'employee.businessTitle',
              'primaryPropertyTeam.phone.displayFormat',
              'primaryPropertyTeam.email',
              'property.heroImageUrl',
              'property.displayName',
              'property.displayName',
              'employee.fullName',
              'recipient.applicationUrl',
              'property.termsUrl',
              'property.privacyUrl',
              'property.contactUrl',
              'currentYear',
              'property.displayName',
              'property.address',
            ]);
          });
        });
      });

      describe(`and context is ${TemplateTypes.SMS}`, () => {
        describe('and there are valid tokens', () => {
          it('should return the rendered sms template successfully', async () => {
            chaiJestSnapshot.setFilename('server/api/__integration__/__snapshots__/valid-sms-template-snapshot.html');
            chaiJestSnapshot.setTestName('Sms template rendered successfully');

            const { status, body } = await callRenderTemplateApi({ templateId, context: TemplateTypes.SMS, templateDataOverride: validSmsTemplateTokensData });

            const { subject, body: templateBody, missingTokens } = body;

            expect(status).to.equal(200);
            expect(subject).to.equal(validTemplateSubject);
            expect(missingTokens.length).to.equal(0);
            expect(templateBody).to.matchSnapshot();
          });
        });

        describe('and there are missing tokens', () => {
          it('should return the rendered sms template without the tokens', async () => {
            chaiJestSnapshot.setFilename('server/api/__integration__/__snapshots__/invalid-sms-template-snapshot.html');
            chaiJestSnapshot.setTestName('Sms template rendered without the tokens');

            const { status, body } = await callRenderTemplateApi({ templateId, context: TemplateTypes.SMS, templateDataOverride: {} });

            const { subject, body: templateBody, missingTokens } = body;

            expect(status).to.equal(200);
            expect(subject).to.equal(validTemplateSubject);
            expect(missingTokens.length).to.equal(3);
            expect(templateBody).to.matchSnapshot();
            expect(missingTokens).to.deep.equal(['recipient.legalName', 'recipient.applicationUrl.short', 'property.displayName']);
          });
        });
      });
    });

    describe('when sending an invalid template id', () => {
      it('should throw a service error', async () => {
        const { status, body } = await callRenderTemplateApi({ templateId: getUUID(), context: TemplateTypes.EMAIL, templateDataOverride: {} });
        expect(status).to.equal(412);
        expect(body.token).to.equal('THE_TEMPLATE_DOES_NOT_EXIST');
      });
    });
  });
});
