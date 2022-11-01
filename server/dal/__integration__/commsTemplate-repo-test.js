/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import getUUID from 'uuid/v4';
import pick from 'lodash/pick';
import {
  saveCommsTemplate,
  getCommsTemplateById,
  getCommsTemplateByName,
  getTemplatesShortCodesByProperty,
  saveTemplateShortCodes,
} from '../commsTemplateRepo';
import { tenant } from '../../testUtils/setupTestGlobalContext';
import { createAProperty } from '../../testUtils/repoHelper';
import { commsTemplateKeys, templateShortCodeKeys } from '../../testUtils/expectedKeys';

const ctx = { tenantId: tenant.id };
const nullConstraintErrorMsg = /null value in column ".*".*violates not-null constraint/;

describe('commsTemplateRepo', () => {
  const validCommsTemplateId = getUUID();
  const validCommsTemplateName = 'valid_comms_template';
  const validCommsTemplateDisplayName = 'Valid CommsTemplate';

  const validCommsTemplate = {
    id: validCommsTemplateId,
    name: validCommsTemplateName,
    displayName: validCommsTemplateDisplayName,
    description: 'Valid CommsTemplate',
    emailSubject: 'Hello',
    emailTemplate: '<mjml><mj-body> Hello World <mj-body></mjml>',
    smsTemplate: 'Hello World',
  };

  const validTemplateShortCodeId = getUUID();
  const validTemplateShortCode = {
    id: validTemplateShortCodeId,
    shortCode: 'test',
    templateId: validCommsTemplateId,
  };

  let propertyId;

  describe('when calling saveCommsTemplate', () => {
    const invalidCommsTemplate = {
      id: getUUID(),
      displayName: 'Valid CommsTemplate',
      description: 'Valid CommsTemplate',
      emailSubject: 'Hello',
      smsTemplate: 'Hello World',
    };

    describe('given a valid template entity', () => {
      it('should insert the template successfully', async () => {
        const result = await saveCommsTemplate(ctx, validCommsTemplate);
        expect(pick(result, commsTemplateKeys)).to.deep.equal(validCommsTemplate);
      });
    });

    describe('given a invalid template entity', () => {
      it(`should throw an error matching ${nullConstraintErrorMsg}`, async () => {
        let error;
        try {
          await saveCommsTemplate(ctx, invalidCommsTemplate);
        } catch (err) {
          error = err;
        }
        expect(error.toString()).to.match(nullConstraintErrorMsg);
      });
    });
  });

  describe('when getting a template', () => {
    beforeEach(async () => await saveCommsTemplate(ctx, validCommsTemplate));

    describe('using getCommsTemplateById', () => {
      describe('given a valid template id', () => {
        it('should return the template that matches the id', async () => {
          const result = await getCommsTemplateById(ctx, validCommsTemplateId);
          expect(pick(result, commsTemplateKeys)).to.deep.equal(validCommsTemplate);
        });
      });

      describe('given an invalid template id', () => {
        it('should return undefined', async () => {
          const result = await getCommsTemplateById(ctx, getUUID());
          expect(result).to.be.undefined;
        });
      });
    });

    describe('using getCommsTemplateByName', () => {
      describe('given a valid template name', () => {
        it('should return the template that matches the name', async () => {
          const result = await getCommsTemplateByName(ctx, validCommsTemplateName);
          expect(pick(result, commsTemplateKeys)).to.deep.equal(validCommsTemplate);
        });
      });

      describe('given an invalid template name', () => {
        it('should return undefined', async () => {
          const result = await getCommsTemplateByName(ctx, 'invalidName');
          expect(result).to.be.undefined;
        });
      });
    });
  });

  describe('when calling saveTemplateShortCode', () => {
    const invalidTemplateShortCode = {
      id: getUUID(),
      shortCode: 'test',
      templateId: validCommsTemplateId,
    };

    beforeEach(async () => {
      await saveCommsTemplate(ctx, validCommsTemplate);
      const { id } = await createAProperty(null, {}, ctx);
      propertyId = id;
    });

    describe('given a valid template short code entity', () => {
      it('should insert the template short code successfully', async () => {
        await saveTemplateShortCodes(ctx, [{ ...validTemplateShortCode, propertyId }]);
        const result = await getTemplatesShortCodesByProperty(ctx, propertyId);
        expect(result[0].id).to.deep.equal(validTemplateShortCodeId);
      });
    });

    describe('given a invalid template short code entity', () => {
      it('should throw an error', async () => {
        let error;
        try {
          await saveTemplateShortCodes(ctx, [invalidTemplateShortCode]);
        } catch (err) {
          error = err;
        }
        expect(error.toString()).to.match(nullConstraintErrorMsg);
      });
    });
  });

  describe('when getting the templates short codes', () => {
    let validTemplateShortCodeForProperty;

    beforeEach(async () => {
      await saveCommsTemplate(ctx, validCommsTemplate);
      const { id } = await createAProperty(null, {}, ctx);
      propertyId = id;
      validTemplateShortCodeForProperty = { ...validTemplateShortCode, propertyId };
      await saveTemplateShortCodes(ctx, [validTemplateShortCodeForProperty]);
    });

    describe('using getTemplatesShortCodesByProperty', () => {
      describe('given a valid propertyId id', () => {
        it('should return the templates short codes that matches the property id', async () => {
          const result = await getTemplatesShortCodesByProperty(ctx, propertyId);

          const templatesShortCodesByProperty = [
            {
              ...validTemplateShortCodeForProperty,
              displayName: validCommsTemplate.displayName,
              description: validCommsTemplate.description,
            },
          ];

          expect(result.map(row => pick(row, templateShortCodeKeys))).to.deep.equal(templatesShortCodesByProperty);
        });
      });

      describe('given an invalid property id', () => {
        it('should return an empty array', async () => {
          const result = await getTemplatesShortCodesByProperty(ctx, getUUID());
          expect(result).to.deep.equal([]);
        });
      });
    });
  });
});
