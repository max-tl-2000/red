/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import escape from 'lodash/escape';
import path from 'path';
import config from '../../config';
import { read } from '../../../common/helpers/xfs';
import { fillHandlebarsTemplate } from '../../../common/helpers/handlebars-utils';

const escapeContent = (input = '') => escape(input);

const getZipCodeParts = zip => (zip ? zip.split('-') : []);

export const getAddressStandardizationRequest = async ({ addressLine1, addressLine2, city, state, zip }, userId) => {
  const addressStandardizationRequest = await read(path.resolve(__dirname, `../resources/${config.usps.addressStandardizationXmlRequestTemplate}`), {
    encoding: 'utf8',
  });

  const [zip5, zip4] = getZipCodeParts(zip);
  // The usps use the address2 as primary address field and the address1 is not mandatory.
  // And we use in the other way around in reva
  const addressRequestData = {
    userId,
    address: {
      address1: escapeContent(addressLine2),
      address2: escapeContent(addressLine1),
      city: escapeContent(city),
      state: escapeContent(state),
      zip5: escapeContent(zip5),
      zip4: escapeContent(zip4),
    },
  };

  return await fillHandlebarsTemplate(addressStandardizationRequest, addressRequestData);
};

export const getCityStateLookupRequest = async (zip, userId) => {
  const cityStateLookupRequest = await read(path.resolve(__dirname, `../resources/${config.usps.cityStateLookupXmlRequestTemplate}`), {
    encoding: 'utf8',
  });

  const [zip5] = getZipCodeParts(zip);
  const cityStateLookupRequestData = {
    userId,
    zipCode: {
      zip5: escapeContent(zip5),
    },
  };

  return await fillHandlebarsTemplate(cityStateLookupRequest, cityStateLookupRequestData);
};
