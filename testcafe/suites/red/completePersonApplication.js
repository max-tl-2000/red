/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { loginAs, getTenantURL, getUserPassword, getPartyIdFromUrl } from '../../helpers/helpers';
import {
  createAParty,
  createAQuote,
  publishAQuote,
  completeApplicationPart1,
  completeApplicationPart2,
  payApplicationFee,
  getApplicantDocumentPath,
  getApplicationLinkForUser,
} from '../../helpers/rentalApplicationHelpers';
import { setHooks } from '../../helpers/hooks';
import { getPartyCommunications } from '../../helpers/communicationHelpers';
import { DALTypes } from '../../../common/enums/DALTypes';
import { mockPartyData, getMockedQuoteDataByUnit, getMockedContactInfoByEmail, getMockedApplicantDataByEmail } from '../../helpers/mockDataHelpers';

setHooks(fixture('Create and publish a quote with a Cove property unit, complete de application part 1 and 2 and fill all steppers.'), {
  fixtureName: 'completePersonApplication',
  beforeEach: async t => {
    await t.navigateTo(getTenantURL('/'));
  },
});

test('TEST-140: Complete application part 1 and part 2 without filled up steppers in part 2', async t => {
  // User logs in LAA agent
  const userInfo = { user: 'josh@reva.tech', password: getUserPassword(), fullName: 'Josh Helpman', team: 'Bay Area Call Center' };
  // await t.navigateTo(getTenantURL('/'));
  await loginAs(t, userInfo);

  // defines party and contact info
  const { partyInfo, qualificationInfo } = mockPartyData;
  const contactInfo = getMockedContactInfoByEmail('qatest+kathejohnson@reva.tech');
  const propertyName = partyInfo.properties[1].displayName; // Cove Apartments
  const hasRequiredSteppers = true;
  const skipSteppers = false;

  const documents = [
    {
      iconName: 'file-word',
      removeIconName: 'delete',
      category: DALTypes.DocumentCategories.INCOME_SOURCES,
      fileName: 'file-doc.doc',
      filePath: getApplicantDocumentPath('file-doc.doc'),
    },
    {
      iconName: 'file-word',
      removeIconName: 'delete',
      category: DALTypes.DocumentCategories.INCOME_SOURCES,
      fileName: 'file-docx.docx',
      filePath: getApplicantDocumentPath('file-docx.docx'),
    },
    {
      iconName: 'file-image',
      removeIconName: 'delete',
      category: DALTypes.DocumentCategories.DOCUMENTS,
      fileName: 'file-gif.gif',
      filePath: getApplicantDocumentPath('file-gif.gif'),
    },
    {
      iconName: 'file-image',
      removeIconName: 'delete',
      category: DALTypes.DocumentCategories.DOCUMENTS,
      fileName: 'file-jpeg.jpeg',
      filePath: getApplicantDocumentPath('file-jpeg.jpeg'),
    },
    {
      iconName: 'file-image',
      removeIconName: 'delete',
      category: DALTypes.DocumentCategories.DOCUMENTS,
      fileName: 'file-png.png',
      filePath: getApplicantDocumentPath('file-png.png'),
    },
    {
      iconName: 'file',
      fileName: 'file-mp3.mp3',
      statusMessage: 'Invalid file type',
      filePath: getApplicantDocumentPath('file-mp3.mp3'),
    },
    {
      iconName: 'file',
      fileName: 'file-mp4.mp4',
      statusMessage: 'Invalid file type',
      filePath: getApplicantDocumentPath('file-mp4.mp4'),
    },
    {
      iconName: 'file-image',
      removeIconName: 'delete',
      category: DALTypes.DocumentCategories.DOCUMENTS,
      fileName: 'tesla-roadster.jpg',
      filePath: getApplicantDocumentPath('tesla-roadster.jpg'),
    },
    {
      iconName: 'file-pdf',
      removeIconName: 'delete',
      fileName: 'it-budget-trends.pdf',
      category: DALTypes.DocumentCategories.ADDRESS_HISTORY,
      filePath: getApplicantDocumentPath('it-budget-trends.pdf'),
    },
    {
      iconName: 'file-word',
      fileName: 'file-invalid-size-doc.doc',
      statusMessage: 'File too large (limited to 20 MB)',
      filePath: getApplicantDocumentPath('file-invalid-size-doc.doc'),
    },
    {
      iconName: 'file-image',
      fileName: 'file-invalid-size-jpg.jpg',
      statusMessage: 'File too large (limited to 20 MB)',
      filePath: getApplicantDocumentPath('file-invalid-size-jpg.jpg'),
    },
    {
      iconName: 'file',
      fileName: 'invalid-file.txt',
      statusMessage: 'Invalid file type',
      filePath: getApplicantDocumentPath('invalid-file.txt'),
    },
    {
      iconName: 'file-pdf',
      fileName: 'invalid-file-size.pdf',
      statusMessage: 'File too large (limited to 20 MB)',
      filePath: getApplicantDocumentPath('invalid-file-size.pdf'),
    },
  ];

  const applicantData = {
    ...getMockedApplicantDataByEmail('qatest+kathejohnson@reva.tech'),
    privateDocuments: documents,
    sharedDocuments: documents,
  };

  const quoteInfo = {
    index: 0,
    leaseTerms: ['9 months'],
    ...getMockedQuoteDataByUnit('001SALT'),
  };

  // TEST-51 Create a party with initial contact info
  await createAParty(t, { partyInfo, propertyName, contactInfo, userInfo, qualificationInfo });
  const partyId = await getPartyIdFromUrl();
  await createAQuote(t, quoteInfo);
  // TEST-97: Send Quote published
  await publishAQuote(t, contactInfo);

  const comms = await getPartyCommunications(partyId);
  const applicationLink = getApplicationLinkForUser('qatest+kathejohnson', comms);

  // TEST-140:Complete application part 2 without filled up steppers in part 2
  await completeApplicationPart1(t, applicantData, propertyName, applicationLink);

  await payApplicationFee(t, applicantData);

  await completeApplicationPart2(t, applicantData, skipSteppers, hasRequiredSteppers);
});
