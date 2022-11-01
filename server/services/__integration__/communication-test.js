/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getUUID from 'uuid/v4';
import path from 'path';
import chai from 'chai';
import { TemplateTypes } from '../../../common/enums/templateTypes';
import { getCommsTemplatesFromWorkbook, processWorkbook } from '../../import/excelInventory.js';
import { importCommsTemplates } from '../../import/inventory/commsTemplate';
import { tenant } from '../../testUtils/setupTestGlobalContext';
import { spreadsheet } from '../../../common/helpers/spreadsheet';
import { getCommsTemplateByName } from '../../dal/commsTemplateRepo';
import { sendCommunication } from '../communication';
import { createAParty, createAPerson, createAUser, createAProperty, createATeam, addATeamPropertyProgram, createAProgram } from '../../testUtils/repoHelper';
import { CommunicationContext, CommunicationContextError } from '../../../common/enums/communicationTypes';
import { enhance } from '../../../common/helpers/contactInfoUtils';
import { updateTenant } from '../tenantService';
import { parse } from '../../helpers/workbook';

const { expect } = chai;

const getSomefakeNumbers = () => {
  const fakeNumberPrefix = '12025550';
  const numbers = Array.from(new Array(100).keys()).map(seq => `${fakeNumberPrefix}${seq + 100}`);
  return numbers.map(pNumber => ({ phoneNumber: pNumber }));
};

describe('Communication Services', () => {
  describe('calling sendCommunication service', () => {
    const inventoryFilePath = path.join(__dirname, '../../import/__tests__/resources/Inventory.xlsx');
    const ctx = { tenantId: tenant.id, authUser: {} };

    const validPropertyName = 'cove';
    const validTemplateName = 'application-test-invite-noquote';

    let templateId;
    let propertyId;
    let partyId;
    let personWithoutContactInfo;
    let personWithEmailAndPhone;
    let personOnlyWithPhone;
    let personOnlyWithEmail;

    const templateData = {
      recipient: {
        applicationUrl: {
          short: 'test.com',
        },
        legalName: 'Ian',
      },
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
      currentYear: '2018',
    };

    const commTemplates = [
      {
        workbookSheetName: spreadsheet.CommsTemplate.workbookSheetName,
        getEntities: getCommsTemplatesFromWorkbook,
        importEntities: importCommsTemplates,
        headers: spreadsheet.CommsTemplate.columns,
      },
    ];

    const setupSampleData = async () => {
      await processWorkbook(ctx, await parse(inventoryFilePath), commTemplates);
      templateId = (await getCommsTemplateByName(ctx, validTemplateName)).id;
      await updateTenant(ctx.tenantId, {
        metadata: {
          ...tenant.metadata,
          phoneNumbers: getSomefakeNumbers(),
        },
      });

      propertyId = (await createAProperty({}, { name: validPropertyName })).id;
      const team = await createATeam({ name: 'Swparkme L' });
      const program = await createAProgram();

      await addATeamPropertyProgram(ctx, {
        teamId: team.id,
        propertyId,
        programId: program.id,
        commDirection: 'out',
      });

      const userId = (await createAUser()).id;
      ctx.authUser.id = userId;
      ctx.authUser.teams = [team];

      partyId = (await createAParty({ assignedPropertyId: propertyId, ownerTeam: team.id })).id;
      personWithoutContactInfo = await createAPerson('John Smith', 'John');
      personWithEmailAndPhone = await createAPerson(
        'Ken Walker',
        'Ken',
        enhance([
          { type: 'phone', value: '12025550101', id: getUUID() },
          { type: 'email', value: 'ken@test.com', id: getUUID() },
        ]),
      );
      personOnlyWithPhone = await createAPerson('Lois Carter', 'Lois', enhance([{ type: 'phone', value: '12025550102', id: getUUID() }]));
      personOnlyWithEmail = await createAPerson('Kat Moore', 'Kat', enhance([{ type: 'email', value: 'kat@test.com', id: getUUID() }]));
    };

    beforeEach(async () => {
      await setupSampleData();
    });

    describe('when the person has no contact info', () => {
      it('should no return any error', async () => {
        const { id } = personWithoutContactInfo;
        const results = await sendCommunication(ctx, { templateId, partyId, personIds: [id] });
        expect(results.length).to.equal(0);
      });
    });

    const executeSendCommunicationTest = async (
      communicationContext,
      personIds,
      templateDataOverride,
      { channels, communicationsLength, error, resultsLength },
    ) => {
      const results = await sendCommunication(ctx, { templateId, partyId, personIds, context: communicationContext, templateDataOverride });
      expect(results.length).to.equal(resultsLength);

      personIds.forEach((personId, index) => {
        const result = results[index];
        expect(result.personId).to.equal(personId);
        expect(result.channels).to.deep.equal(channels[index]);
        expect(result.communications.length).to.equal(communicationsLength);

        expect(result.error).to.deep.equal(error);
      });
    };

    describe(`when the context is ${CommunicationContext.PREFER_SMS}`, () => {
      const context = CommunicationContext.PREFER_SMS;

      describe('and the person has email and phone as contact info', () => {
        it('should send an SMS with the rendered template', async () => {
          const expectations = { channels: [[TemplateTypes.SMS]], communicationsLength: 1, resultsLength: 1 };
          await executeSendCommunicationTest(context, [personWithEmailAndPhone.id], templateData, expectations);
        });
      });
      describe('and the person only has a phone as contact info', () => {
        it('should send an SMS with the rendered template', async () => {
          const expectations = { channels: [[TemplateTypes.SMS]], communicationsLength: 1, resultsLength: 1 };
          await executeSendCommunicationTest(context, [personOnlyWithPhone.id], templateData, expectations);
        });
      });
      describe('and the person only has an email as contact info', () => {
        it('should send an EMAIL with the rendered template', async () => {
          const expectations = { channels: [[TemplateTypes.EMAIL]], communicationsLength: 1, resultsLength: 1 };
          await executeSendCommunicationTest(context, [personOnlyWithEmail.id], templateData, expectations);
        });
      });
      describe('and the people(persons) have a phone as contact info', () => {
        it('should send several SMS with the rendered template', async () => {
          const expectations = { channels: [[TemplateTypes.SMS], [TemplateTypes.SMS]], communicationsLength: 1, resultsLength: 2 };
          await executeSendCommunicationTest(context, [personOnlyWithPhone.id, personWithEmailAndPhone.id], templateData, expectations);
        });
      });
      describe('and there are missing tokens to render the template', () => {
        it('should return an error', async () => {
          const tpltData = {
            recipient: {
              applicationUrl: {
                short: 'test.com',
              },
            },
          };
          const expectations = {
            channels: [[TemplateTypes.SMS]],
            communicationsLength: 0,
            resultsLength: 1,
            error: CommunicationContextError.RENDER_TEMPLATE_FAILED,
          };
          await executeSendCommunicationTest(context, [personOnlyWithPhone.id], tpltData, expectations);
        });
      });
    });

    describe(`when the context is ${CommunicationContext.PREFER_EMAIL}`, () => {
      const context = CommunicationContext.PREFER_EMAIL;
      describe('and the person has email and phone as contact info', () => {
        it('should send an EMAIL with the rendered template', async () => {
          const expectations = { channels: [[TemplateTypes.EMAIL]], communicationsLength: 1, resultsLength: 1 };
          await executeSendCommunicationTest(context, [personWithEmailAndPhone.id], templateData, expectations);
        });
      });
      describe('and the person only has a phone as contact info', () => {
        it('should send an SMS with the rendered template', async () => {
          const expectations = { channels: [[TemplateTypes.SMS]], communicationsLength: 1, resultsLength: 1 };
          await executeSendCommunicationTest(context, [personOnlyWithPhone.id], templateData, expectations);
        });
      });
      describe('and the person only has an email as contact info', () => {
        it('should send an EMAIL with the rendered template', async () => {
          const expectations = { channels: [[TemplateTypes.EMAIL]], communicationsLength: 1, resultsLength: 1 };
          await executeSendCommunicationTest(context, [personOnlyWithEmail.id], templateData, expectations);
        });
      });
    });

    describe(`when the context is ${CommunicationContext.PREFER_EMAIL_AND_SMS}`, () => {
      const context = CommunicationContext.PREFER_EMAIL_AND_SMS;
      describe('and the person has email and phone as contact info', () => {
        it('should send an EMAIL and an SMS with the rendered template', async () => {
          const expectations = { channels: [[TemplateTypes.SMS, TemplateTypes.EMAIL]], communicationsLength: 2, resultsLength: 1 };
          await executeSendCommunicationTest(context, [personWithEmailAndPhone.id], templateData, expectations);
        });
      });
      describe('and the person only has a phone as contact info', () => {
        it('should send an SMS with the rendered template', async () => {
          const expectations = { channels: [[TemplateTypes.SMS]], communicationsLength: 1, resultsLength: 1 };
          await executeSendCommunicationTest(context, [personOnlyWithPhone.id], templateData, expectations);
        });
      });
      describe('and the person only has an email as contact info', () => {
        it('should send an EMAIL with the rendered template', async () => {
          const expectations = { channels: [[TemplateTypes.EMAIL]], communicationsLength: 1, resultsLength: 1 };
          await executeSendCommunicationTest(context, [personOnlyWithEmail.id], templateData, expectations);
        });
      });
    });

    describe(`when the context is ${CommunicationContext.REQUIRE_SMS}`, () => {
      const context = CommunicationContext.REQUIRE_SMS;
      describe('and the person has email and phone as contact info', () => {
        it('should send an SMS with the rendered template', async () => {
          const expectations = { channels: [[TemplateTypes.SMS]], communicationsLength: 1, resultsLength: 1 };
          await executeSendCommunicationTest(context, [personWithEmailAndPhone.id], templateData, expectations);
        });
      });
      describe('and the person only has a phone as contact info', () => {
        it('should send an SMS with the rendered template', async () => {
          const expectations = { channels: [[TemplateTypes.SMS]], communicationsLength: 1, resultsLength: 1 };
          await executeSendCommunicationTest(context, [personOnlyWithPhone.id], templateData, expectations);
        });
      });
      describe('and the person only has an email as contact info', () => {
        it('should return an error', async () => {
          const expectations = {
            channels: [[]],
            communicationsLength: 0,
            resultsLength: 1,
            error: CommunicationContextError.REQUIRED_PHONE_NUMBER_UNAVAILABLE,
          };
          await executeSendCommunicationTest(context, [personOnlyWithEmail.id], undefined, expectations);
        });
      });
    });

    describe(`when the context is ${CommunicationContext.REQUIRE_EMAIL}`, () => {
      const context = CommunicationContext.REQUIRE_EMAIL;
      describe('and the person has email and phone as contact info', () => {
        it('should send an EMAIL with the rendered template', async () => {
          const expectations = { channels: [[TemplateTypes.EMAIL]], communicationsLength: 1, resultsLength: 1 };
          await executeSendCommunicationTest(context, [personWithEmailAndPhone.id], templateData, expectations);
        });
      });
      describe('and the person only has a phone as contact info', () => {
        it('should return an error', async () => {
          const expectations = { channels: [[]], communicationsLength: 0, resultsLength: 1, error: CommunicationContextError.REQUIRED_EMAIL_UNAVAILABLE };
          await executeSendCommunicationTest(context, [personOnlyWithPhone.id], undefined, expectations);
        });
      });
      describe('and the person only has an email as contact info', () => {
        it('should send an EMAIL with the rendered template', async () => {
          const expectations = { channels: [[TemplateTypes.EMAIL]], communicationsLength: 1, resultsLength: 1 };
          await executeSendCommunicationTest(context, [personOnlyWithEmail.id], templateData, expectations);
        });
      });
    });

    describe(`when the context is ${CommunicationContext.REQUIRE_EMAIL_OR_SMS}`, () => {
      const context = CommunicationContext.REQUIRE_EMAIL_OR_SMS;
      describe('and the person has email and phone as contact info', () => {
        it('should send an EMAIL with the rendered template', async () => {
          const expectations = { channels: [[TemplateTypes.EMAIL]], communicationsLength: 1, resultsLength: 1 };
          await executeSendCommunicationTest(context, [personWithEmailAndPhone.id], templateData, expectations);
        });
      });
      describe('and the person only has a phone as contact info', () => {
        it('should send an SMS with the rendered template', async () => {
          const expectations = { channels: [[TemplateTypes.SMS]], communicationsLength: 1, resultsLength: 1 };
          await executeSendCommunicationTest(context, [personOnlyWithPhone.id], templateData, expectations);
        });
      });
      describe('and the person only has an email as contact info', () => {
        it('should send an EMAIL with the rendered template', async () => {
          const expectations = { channels: [[TemplateTypes.EMAIL]], communicationsLength: 1, resultsLength: 1 };
          await executeSendCommunicationTest(context, [personOnlyWithEmail.id], templateData, expectations);
        });
      });
    });

    describe('when the context is not defined', () => {
      describe('and the person has email and phone as contact info', () => {
        it('should send an EMAIL with the rendered template', async () => {
          const expectations = { channels: [[TemplateTypes.EMAIL]], communicationsLength: 1, resultsLength: 1 };
          await executeSendCommunicationTest(null, [personWithEmailAndPhone.id], templateData, expectations);
        });
      });
      describe('and the person only has a phone as contact info', () => {
        it('should send an SMS with the rendered template', async () => {
          const expectations = { channels: [[TemplateTypes.SMS]], communicationsLength: 1, resultsLength: 1 };
          await executeSendCommunicationTest(null, [personOnlyWithPhone.id], templateData, expectations);
        });
      });
      describe('and the person only has an email as contact info', () => {
        it('should send an EMAIL with the rendered template', async () => {
          const expectations = { channels: [[TemplateTypes.EMAIL]], communicationsLength: 1, resultsLength: 1 };
          await executeSendCommunicationTest(null, [personOnlyWithEmail.id], templateData, expectations);
        });
      });
    });
  });
});
