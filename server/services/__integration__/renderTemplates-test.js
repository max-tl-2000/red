/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import getUUID from 'uuid/v4';
import { createAPerson, createAPersonContactInfo, createAUser, createAParty, createAPartyMember, createAProperty } from '../../testUtils/repoHelper';
import { DALTypes } from '../../../common/enums/DALTypes';
import { tenant } from '../../testUtils/setupTestGlobalContext';
import { renderTemplate } from '../templates';
import { saveCommsTemplate } from '../../dal/commsTemplateRepo';
import { TemplateTypes } from '../../../common/enums/templateTypes';
import { init as initCloudinary } from '../../../common/helpers/cloudinary';
import { formatPropertyAssetUrl, formatEmployeeAssetUrl } from '../../helpers/assets-helper';
import { config } from '../../../common/publicImagesHelper';
import { createRegexToSearchBetween } from '../../../common/regex';

describe('/templates', () => {
  let basePerson;
  let baseParty;
  let baseAssignedProperty;
  let baseTemplate;
  let user;
  const ctx = { tenantId: tenant.id, tenantName: tenant.name };
  const cloudName = 'test';
  const cloudinaryPrefix = `https://res.cloudinary.com/${cloudName}/image/fetch`;

  const commsTemplate = {
    id: getUUID(),
    name: 'template_with_tokens_and_parameters',
    displayName: 'Email CommsTemplate',
    description: 'Pass image parameters from the templates itself',
    emailSubject: 'Template with tokens and parameters',
    emailTemplate: `<mjml>
      <mj-body>
        <mj-text>{{currentYear}} - {{property.address}}</mj-text>
        <mj-section>
        <mj-column>
          <mj-image src="{{property.heroImageUrl?r=2&w=1200&ar=4&c=fill}}" />
        </mj-column>
        <mj-column>
          <mj-image src="{{property.heroImageUrl?r=3&w=40&c=fill}}" />
        </mj-column>
        <mj-column>
          <mj-image src="{{property.heroImageUrl}}" />
        </mj-column>
        </mj-section>
        <mj-section>
          <mj-column>
            <mj-text>{{employee.fullName}}</mj-text>
            <mj-image src="{{registration.heroImageUrl?r=2&unkown=23}}" />
            <mj-image src="{{registration.heroImageUrl}}" />
            <mj-image src="{{resetPassword.heroImageUrl?ar=4}}" />
          </mj-column>
        <mj-column>{component.avatar}</mj-column>
        </mj-section>
      </mj-body>
    </mjml>`,
    smsTemplate: '',
  };

  const imageForEmailDefaultParameters = 'c_fill,g_auto:no_faces,f_auto,q_auto:good,e_improve,e_auto_brightness,fl_force_strip';
  const propertyImageDefaultParameters = 'ar_2.35,f_auto,c_fill,q_auto:good,g_auto:no_faces,e_improve,e_auto_brightness,fl_force_strip';
  const layoutImageDefaultParameters = 'c_fill,g_auto:no_faces,f_auto,q_auto:good,e_improve,e_auto_brightness,fl_force_strip';
  const smallAvatarParameters = 'ar_1:1,c_thumb,g_face:center,f_auto,q_auto:good,r_max,e_auto_brightness,fl_force_strip,cs_no_cmyk,dpr_1.0,w_40,z_0.9';

  // inputParameters, just to map parameters in the template with output results.
  // inputParameters empty means the default sizes used in the app.
  const getExpectedImagesFromTemplate = async (propertyId, userId) => [
    {
      inputParameters: 'r=2&w=1200&ar=4&c=fill',
      imageUrl: `${await formatPropertyAssetUrl(ctx, propertyId, {
        permaLink: true,
        from: 'template',
      })}&cParams=r_2,w_1200,ar_4,${imageForEmailDefaultParameters}`,
    },
    {
      inputParameters: 'r=3&w=40&c=fill',
      imageUrl: `${await formatPropertyAssetUrl(ctx, propertyId, {
        permaLink: true,
        from: 'template',
      })}&cParams=r_3,w_40,${imageForEmailDefaultParameters}`,
    },
    {
      inputParameters: '',
      imageUrl: `${await formatPropertyAssetUrl(ctx, propertyId, {
        permaLink: true,
        from: 'template',
      })}&cParams=w_1200,${propertyImageDefaultParameters}`,
    },
    {
      inputParameters: 'r=2&unkown=23',
      imageUrl: `${cloudinaryPrefix}/r_2,${imageForEmailDefaultParameters}/${config.publicUrl}/email-invite.jpg`,
    },
    {
      inputParameters: '',
      imageUrl: `${cloudinaryPrefix}/h_190,${layoutImageDefaultParameters}/${config.publicUrl}/email-invite.jpg`,
    },
    {
      inputParameters: 'ar=4',
      imageUrl: `${cloudinaryPrefix}/ar_4,${imageForEmailDefaultParameters}/${config.publicUrl}/email-forgot-password.jpg`,
    },
    {
      inputParameters: '',
      imageUrl: `${await formatEmployeeAssetUrl(ctx, userId, {
        permaLink: true,
        from: 'template',
      })}&cParams=${smallAvatarParameters}`,
    },
  ];

  const extractImagesFromTemplate = body => {
    const srcImages = body.match(/src\s*=\s*"(.+?)"/g) || [];
    return srcImages.map(src => {
      const [, , imageUrl] = src.match(/([^=]+)="(.+)"/) || [];
      return decodeURIComponent(imageUrl);
    });
  };

  beforeEach(async () => {
    initCloudinary({ cloudName, tenantName: 'test', cloudEnv: 'cucumber' });
    baseAssignedProperty = await createAProperty();
    basePerson = await createAPerson('John Papa SR', 'John P');
    const contactInfo1 = [
      { type: DALTypes.ContactInfoType.PHONE, value: '12025550395', isPrimary: true },
      { type: DALTypes.ContactInfoType.EMAIL, value: 'john+default@reva.tech', isPrimary: true },
    ];

    await createAPersonContactInfo(basePerson.id, ...contactInfo1);

    user = await createAUser();
    baseParty = await createAParty({ userId: user.id, assignedPropertyId: baseAssignedProperty.id });
    await createAPartyMember(baseParty.id, { personId: basePerson.id });

    baseTemplate = await saveCommsTemplate(ctx, commsTemplate);
  });

  describe('calling renderTemplate function', () => {
    describe('when the mjml template has hero images with parameters', () => {
      it('should return the rendered email template successfully', async () => {
        const templateArgs = {
          personId: basePerson.id,
          propertyId: baseAssignedProperty.id,
        };

        const { subject, body, missingTokens } = await renderTemplate(
          { ...ctx, authUser: user },
          {
            templateId: baseTemplate.id,
            context: TemplateTypes.EMAIL,
            partyId: baseParty.id,
            templateArgs,
            options: { validationLevel: 'soft', beautify: true },
          },
        );
        const imagesFromTemplate = extractImagesFromTemplate(body);
        const expectedParameters = await getExpectedImagesFromTemplate(baseAssignedProperty.id, user.id);

        expect(subject).to.equal(baseTemplate.emailSubject);
        expect(missingTokens.length).to.equal(0);
        expect(imagesFromTemplate).to.have.lengthOf(7);

        // This is needed because the layer url has env settings
        const encodedUrlRegex = createRegexToSearchBetween('l_fetch:', ',fl_cutter');
        expect(imagesFromTemplate.map(url => url.replace(/amp;/gm, '').replace(encodedUrlRegex, '[ENCODED_URL]'))).to.deep.equal(
          expectedParameters.map(({ imageUrl }) => imageUrl),
        );
      });
    });
  });
});
