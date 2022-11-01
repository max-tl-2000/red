/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import Promise from 'bluebird';
import request from 'superagent';
import xml2js from 'xml2js';
import fs from 'fs';
import path from 'path';
import { getIndividualScreeningReports } from '../utils';
import { fillHandlebarsTemplate } from '../../../common/helpers/handlebars-utils';
import logger from '../../../common/helpers/logger';

import config from '../config';
import { getScreeningVersionOrdinal, ScreeningVersion } from '../../../common/enums/screeningReportTypes';

const { corticonServerUrl } = config;
const serviceUrl = `${corticonServerUrl}/services/Corticon`;
const readFile = Promise.promisify(fs.readFile);
const V2_PARTY = getScreeningVersionOrdinal(ScreeningVersion.V2);

// WSDL: http://ds.dev.env.reva.tech:8080/axis/dswsdl/Screening/1/0
const parseXmlResult = (payload, explicitArray = true) => {
  const parser = new xml2js.Parser({ explicitArray, trim: true });
  return new Promise((resolve, reject) => {
    parser.parseString(payload, (error, result) => {
      if (error) {
        return reject(error);
      }

      return resolve(result);
    });
  });
};

export const buildCorticonScreeningRequest = async (_party, individualScreeningReports) => {
  const requestTemplate = await readFile(path.join(__dirname, 'samples', 'template-request.xml'), 'utf8');
  const screeningRequest = await fillHandlebarsTemplate(requestTemplate, individualScreeningReports);
  return screeningRequest;
};

const computePartyScreening = async (ctx, party, individualScreeningReports) => {
  const reqBody = await buildCorticonScreeningRequest(party, individualScreeningReports);

  const res = await request.post(serviceUrl).set('Content-Type', 'text/xml;charset=UTF-8').send(reqBody);

  logger.trace({ ctx, res }, 'Corticon response');
  const response = parseXmlResult(res.text);

  logger.trace({ ctx, res: JSON.stringify(response, null, 2) }, 'Corticon screening response');
  return response;
};

export const computePartyScreeningResult = async ({ ctx, party, token }) => {
  logger.trace({ ctx, partyId: party.id, version: party.version }, 'Compute screening result via Corticon');

  const { partyApplications } = party;
  if (!partyApplications || !partyApplications.length) {
    logger.trace({ ctx, version: party.version, partyId: party.id }, 'Skipping party with no party application');
    return party;
  }

  const notV2Party = partyApplications.find(app => app.screeningVersion !== V2_PARTY);
  if (notV2Party) {
    logger.trace({ ctx, version: party.version, partyId: party.id }, 'Skipping party screening report. V1 party!');
    return notV2Party;
  }

  const screeningData = await getIndividualScreeningReports(ctx, party.id, token);
  logger.trace({ ctx, screeningData }, 'Screening data');
  const screeningResult = await computePartyScreening(ctx, party, screeningData);
  return screeningResult;
};
