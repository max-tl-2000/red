/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import sortBy from 'lodash/sortBy';
import xml2js from 'xml2js-es6-promise';
import chai from 'chai';
import { read } from '../../../../../common/helpers/xfs';
import { fillHandlebarsTemplate } from '../../../../../common/helpers/handlebars-utils';
import { FadvRequestTypes } from '../../../../../common/enums/fadvRequestTypes';
import { ctx, createAPartyApplication, createASubmissionRequest } from '../../../test-utils/repo-helper.js';
import { handleParsedFADVResponse } from '../screening-report-parser';
const { expect } = chai;

const readAndParseXml = async (fileName, { screeningRequestId, applicantsIdentifiers }) => {
  const xmlString = await read('rentapp/server/screening/fadv/__integration__/fixtures/'.concat(fileName), {
    encoding: 'utf8',
  });

  const filledResponseTemplate = await fillHandlebarsTemplate(xmlString, {
    applicantsIdentifiers,
    screeningRequestId,
  });
  return await xml2js(filledResponseTemplate);
};

const createSubmissionRequest = async applicantData => {
  const propertyId = newId();
  const partyApplication = await createAPartyApplication(newId(), newId());
  const submissionRequest = {
    partyApplicationId: partyApplication.id,
    requestType: FadvRequestTypes.NEW,
    rawRequest: '',
    propertyId,
    applicantData,
  };
  return createASubmissionRequest(submissionRequest);
};

describe('Given FADV response scenarios using the Response parser', () => {
  describe('When one applicant have a Credit Freeze', () => {
    it('should parse the services status into a reva value', async () => {
      const annApplicantId = newId();
      const bobApplicantId = newId();

      const serviceStatusResult = {
        [annApplicantId]: [
          { serviceName: 'Criminal', status: 'IN_PROCESS' },
          { serviceName: 'Collections', status: 'COMPLETE' },
          { serviceName: 'Credit', status: 'BLOCKED' },
        ],
        [bobApplicantId]: [
          { serviceName: 'Criminal', status: 'IN_PROCESS' },
          { serviceName: 'Collections', status: 'COMPLETE' },
          { serviceName: 'Credit', status: 'BLOCKED' },
        ],
      };

      const applicantData = {
        applicants: [
          {
            firstName: 'Ann',
            lastName: 'Smith',
            applicantId: annApplicantId,
          },
          {
            firstName: 'Bob',
            lastName: "O'Doole",
            applicantId: bobApplicantId,
          },
        ],
      };

      const { id: screeningRequestId } = await createSubmissionRequest(applicantData);
      const { tenantId } = ctx;

      const applicantsIdentifiers = [`${tenantId}:${annApplicantId}`, `${tenantId}:${bobApplicantId}`];

      const response = await readAndParseXml('scenario-ann-bob-incomplete.xml', { screeningRequestId, applicantsIdentifiers });
      const parsedFadvResponse = await handleParsedFADVResponse(ctx, response);
      const annServiceStatus = serviceStatusResult[annApplicantId];
      const bobServiceStatus = serviceStatusResult[bobApplicantId];
      serviceStatusResult[annApplicantId] = sortBy(annServiceStatus, 'serviceName');
      serviceStatusResult[bobApplicantId] = sortBy(bobServiceStatus, 'serviceName');

      expect(parsedFadvResponse.serviceStatus).to.eql(serviceStatusResult);
    });
  });
});
