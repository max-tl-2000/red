/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import xml2js from 'xml2js-es6-promise';
import { request } from '../../../common/helpers/httpUtils';
import { hasOwnProp } from '../../../common/helpers/objUtils';

const parseXMLResponse = async uspsReponse => {
  try {
    return await xml2js(uspsReponse, {
      explicitArray: false,
      normalize: false,
      normalizeTags: false,
      trim: true,
    });
  } catch (err) {
    throw err;
  }
};

export const sendXMLRequest = async ({ apiPath, method, payload }) => {
  try {
    const responseFromUsps = await request(apiPath, {
      method: 'get',
      type: 'text/xml',
      query: {
        API: method,
        XML: payload,
      },
      buffer: true,
      alwaysReturnText: true,
    });

    const response = await parseXMLResponse(responseFromUsps);
    const success = !hasOwnProp(response, 'Error');

    return {
      success,
      ...(success ? { response } : { error: response }),
    };
  } catch (err) {
    return { success: false, error: err };
  }
};
