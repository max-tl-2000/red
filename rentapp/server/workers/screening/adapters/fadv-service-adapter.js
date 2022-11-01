/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

// TODO: workers should not be using server config
import omit from 'lodash/omit';
import config from '../../../../config';

import logger from '../../../../../common/helpers/logger';
import { postXMLWithRetries } from '../../../../../common/helpers/postXML';
import { DALTypes } from '../../../../../common/enums/DALTypes';
import { obscureApplicantProperties } from '../../../helpers/screening-helper';

const { ScreeningProviderMode } = DALTypes;

const getFadvScreeningUrl = (screeningMode = ScreeningProviderMode.FADV_TEST) => {
  const { productionUrl, testUrl, ctUrl, uatUrl } = config.fadv;

  switch (screeningMode) {
    case ScreeningProviderMode.FADV_PROD:
      return productionUrl;
    case ScreeningProviderMode.FADV_CT:
      return ctUrl;
    case ScreeningProviderMode.FADV_UAT:
      return uatUrl;
    default:
      return testUrl;
  }
};

/**
 * Post XML To FADV
 *  @return {string} The output will be a promise resolving to JS and
                    the resolved JS will represent the XML structure of the response
*/
export const postToFADV = async (ctx, payload, { screeningMode = ScreeningProviderMode.FADV_TEST }) => {
  const timeout = config.fadv.timeout || 60000; // seconds
  const url = getFadvScreeningUrl(screeningMode);
  try {
    logger.trace({ ctx, url, screeningMode }, 'posting to FADV');
    const res = await postXMLWithRetries(url, payload, { timeout });
    const fadvResponse = res.ApplicantScreening.Response[0];
    const fadvResponseLog = omit(fadvResponse, ['BackgroundReport']);
    logger.info(obscureApplicantProperties(fadvResponseLog), 'postToFADV got response');
    return res;
  } catch (err) {
    logger.error({ ctx, err }, 'using postToFADV: server error');
    throw err;
  }
};
