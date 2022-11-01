/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import fs from 'fs';
import getUUID from 'uuid/v4';
import { TemplateTypes } from '../../../common/enums/templateTypes';

const { mockModules } = require('../../../common/test-helpers/mocker').default(jest);

class InnerMjmlComponent extends Component {
  renderName = t => `"${t}"`;

  render() {
    const { personNames } = this.props;
    return (
      <mj-column>
        <mj-text>{personNames.map(name => this.renderName(name))}</mj-text>
      </mj-column>
    );
  }
}

describe('services/templates', () => {
  const validStaticMjmlTemplate = `<mjml>
         <mj-body>
           <mj-text>{{title}}</mj-text>
           <mj-section>
             <mj-column>
               <mj-text>{{person.name}}</mj-text>
             </mj-column>
            <mj-column>
               <mj-text>{{person.lastName}}</mj-text>
            </mj-column>
            <mj-column>
               <mj-text>{{person.age}}</mj-text>
            </mj-column>
           </mj-section>
         </mj-body>
       </mjml>`;

  const validStaticMjmlTemplateSnapshot = fs.readFileSync('server/services/__tests__/__snapshots__/valid-static-mjml-template-result.html', 'utf8');
  const validSmsTemplate = 'Hi, my name is {{person.name}} {{person.lastName}}';
  const validSmsTemplateSnapshot = 'Hi, my name is John Smith';

  const validEmailTemplateId = getUUID();
  const validSmsTemplateId = getUUID();
  const validEmailAndSmsTemplateId = getUUID();

  const validEmailAndSmsTemplateSubject = 'Valid email and sms templates';

  const commsTemplates = [
    { id: validEmailTemplateId, emailSubject: 'Valid email template', emailTemplate: validStaticMjmlTemplate, smsTemplate: null },
    { id: validSmsTemplateId, emailSubject: 'Valid sms template', emailTemplate: null, smsTemplate: validSmsTemplate },
    { id: validEmailAndSmsTemplateId, emailSubject: validEmailAndSmsTemplateSubject, emailTemplate: validStaticMjmlTemplate, smsTemplate: validSmsTemplate },
  ];

  mockModules({
    /* '../../config': {
      mail: { component: { personNames: 'fakePath' } },
    }, */
    '../../dal/commsTemplateRepo': {
      getCommsTemplateById: (ctx, templateId) => commsTemplates.find(({ id }) => id === templateId),
    },
    '../../dal/propertyRepo': {},
    '../textExpansionContext/textExpansionContext': {
      getTextExpansionContext: () => ({}),
    },
    '../../services/mails': {
      sendCommsTemplateDataBindingErrorEmail: () => {},
    },
  });

  jest.unmock('../../../common/helpers/render-email-tpl.js');
  const emailTemplateHelpers = require('../../../common/helpers/render-email-tpl.js'); //eslint-disable-line
  emailTemplateHelpers.getReactMjmlTemplate = () => InnerMjmlComponent;

  const { mjmlToHtml, mjmlComponentToHtml, renderTemplate } = require('../templates'); //eslint-disable-line

  const ctx = { tenantId: 'fbcc00c0-a151-46d6-bc72-cfdc38b017e3' };

  describe('calling mjmlComponentToHtml function', () => {
    const validMjmlComponent = ({ text }) => {
      const renderText = t => `"${t}"`;

      return (
        <mjml>
          <mj-body>
            <mj-section>
              <mj-column>
                <mj-text>{renderText(text)}</mj-text>
              </mj-column>
            </mj-section>
          </mj-body>
        </mjml>
      );
    };

    const validMjmlComponentSnapshot = fs.readFileSync('server/services/__tests__/__snapshots__/valid-mjml-component-result.html', 'utf8');

    const invalidMjmlComponent = ({ text }) => {
      const renderText = t => `"${t}"`;

      return (
        <html lang="en">
          <mj-body>
            <mj-section>
              <mj-column>
                <mj-text>{renderText(text)}</mj-text>
              </mj-column>
            </mj-section>
          </mj-body>
        </html>
      );
    };

    describe('when sending a mjml component with the correct mjml sintax', () => {
      it('should return the converted minify mjml without errors', () => {
        const { errors, html } = mjmlComponentToHtml(ctx, {
          mjmlComponent: validMjmlComponent,
          props: { text: 'Hello World!' },
          options: { validationLevel: 'skip', minify: true, beautify: true },
        });
        expect(errors.length).toBe(0);
        expect(html).toBe(validMjmlComponentSnapshot);
      });
    });

    describe('when sending a mjml component with the incorrect mjml sintax', () => {
      it('should return conversion errors', () => {
        const { errors } = mjmlComponentToHtml(ctx, {
          mjmlComponent: invalidMjmlComponent,
          props: { text: 'Hello World!' },
          options: { validationLevel: 'soft', minify: true, beautify: true },
        });
        expect(errors.length).toBe(1);
      });
    });
  });

  describe('calling mjmlToHtml function', () => {
    const invalidStaticMjmlTemplate = '<html><div>Hello World</div></html>';

    const invalidStaticMjmlTemplateSnapshot = fs.readFileSync('server/services/__tests__/__snapshots__/invalid-static-mjml-template-result.html', 'utf8');

    // const validDynamicMjmlTemplateSnapshot = fs.readFileSync('server/services/__tests__/__snapshots__/valid-dynamic-mjml-template-result.html', 'utf8');

    /* const validDynamicMjmlTemplate = `<mjml>
         <mj-body>
           <mj-text>{{title}}</mj-text>
           <mj-section>
            {component.personNames}
           </mj-section>
         </mj-body>
       </mjml>`; */

    describe('when sending a mjml template with the correct mjml sintax', () => {
      it('should return the converted mjml with the bound data', () => {
        const data = {
          title: 'Person Info',
          person: {
            name: 'Paul',
            lastName: 'Taylor',
            age: 20,
          },
        };

        const { renderedTemplate } = mjmlToHtml(ctx, { mjml: validStaticMjmlTemplate, data, options: { validationLevel: 'soft', beautify: true } });
        expect(renderedTemplate).toBe(validStaticMjmlTemplateSnapshot);
      });
    });

    describe('when sending a mjml template with the incorrect mjml sintax', () => {
      it('should return the converted mjml without body content', () => {
        const { renderedTemplate } = mjmlToHtml(ctx, { mjml: invalidStaticMjmlTemplate });
        expect(renderedTemplate).toBe(invalidStaticMjmlTemplateSnapshot);
      });
    });

    /* describe('when sending a mjml template with dynamic content', () => {
      it('should return the converted mjml with the bound data', () => {
        const data = {
          title: 'People Info',
          personNames: ['Paul', 'Lindsey', 'Ron'],
        };

        const { renderedTemplate } = mjmlToHtml(ctx, { mjml: validDynamicMjmlTemplate, data, options: { validationLevel: 'soft', beautify: true } });
        expect(renderedTemplate).toBe(validDynamicMjmlTemplateSnapshot);
      });
    }); */
  });

  describe('calling renderTemplate function', () => {
    describe('when sending a valid template id', () => {
      describe(`and context is ${TemplateTypes.EMAIL}`, () => {
        describe('and the email template exists', () => {
          it('should return the rendered email template successfully', async () => {
            const templateDataOverride = {
              title: 'Person Info',
              person: {
                name: 'Paul',
                lastName: 'Taylor',
                age: 20,
              },
            };

            const { subject, body, missingTokens } = await renderTemplate(ctx, {
              templateId: validEmailAndSmsTemplateId,
              context: TemplateTypes.EMAIL,
              partyId: getUUID(),
              templateDataOverride,
              options: { validationLevel: 'soft', beautify: true },
            });
            expect(subject).toBe(validEmailAndSmsTemplateSubject);
            expect(missingTokens.length).toBe(0);
            expect(body).toBe(validStaticMjmlTemplateSnapshot);
          });
        });
        describe('and the email template does not exists', () => {
          it('should return the rendered sms template successfully', async () => {
            const templateDataOverride = {
              person: {
                name: 'John',
                lastName: 'Smith',
              },
            };

            const { body, missingTokens } = await renderTemplate(ctx, {
              templateId: validSmsTemplateId,
              context: TemplateTypes.EMAIL,
              partyId: getUUID(),
              templateDataOverride,
            });
            expect(missingTokens.length).toBe(0);
            expect(body).toBe(validSmsTemplateSnapshot);
          });
        });
      });

      describe(`and context is ${TemplateTypes.SMS}`, () => {
        describe('and the sms template exists', () => {
          it('should return the rendered sms template successfully', async () => {
            const templateDataOverride = {
              person: {
                name: 'John',
                lastName: 'Smith',
              },
            };

            const { body, missingTokens } = await renderTemplate(ctx, {
              templateId: validSmsTemplateId,
              context: TemplateTypes.SMS,
              partyId: getUUID(),
              templateDataOverride,
            });
            expect(missingTokens.length).toBe(0);
            expect(body).toBe(validSmsTemplateSnapshot);
          });
        });
        describe('and the sms template does not exists', () => {
          it('should return an empty template', async () => {
            const templateDataOverride = {
              person: {
                name: 'John',
                lastName: 'Smith',
              },
            };

            const { body, missingTokens } = await renderTemplate(ctx, {
              templateId: validEmailTemplateId,
              context: TemplateTypes.SMS,
              partyId: getUUID(),
              templateDataOverride,
            });
            expect(missingTokens.length).toBe(0);
            expect(body).toBe('');
          });
        });
        describe('and there are missing tokens', () => {
          it('should return the rendered sms template without the tokens', async () => {
            const { missingTokens } = await renderTemplate(ctx, {
              templateId: validSmsTemplateId,
              context: TemplateTypes.SMS,
              partyId: getUUID(),
              templateDataOverride: {},
            });
            expect(missingTokens.length).toBe(2);
            expect(missingTokens).toEqual(['person.name', 'person.lastName']);
          });
        });
      });
    });

    describe('when sending an invalid template id', () => {
      it('should throw a service error', async () => {
        let error;
        try {
          await renderTemplate(ctx, { templateId: getUUID(), context: TemplateTypes.EMAIL, partyId: getUUID() });
        } catch (err) {
          error = err;
        }
        expect(error.token).toBe('THE_TEMPLATE_DOES_NOT_EXIST');
      });
    });
  });
});
