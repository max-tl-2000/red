/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import xml2js from 'xml2js-es6-promise';
const { mockModules } = require('../../../../common/test-helpers/mocker').default(jest);

describe('given a request to verify Address Standardization', () => {
  let getStandardizedAddress;
  const addressPayload = { addressLine1: 'line01', addressLine2: 'line 02', city: 'city', state: 'CA', zip: '1234' };

  const getStandardizedAddressMock = async (success, response) => {
    const parsedResponse = await xml2js(response, {
      explicitArray: false,
      normalize: false,
      normalizeTags: false,
      trim: true,
    });
    return {
      sendXMLRequest: jest.fn(() => ({ success, response: parsedResponse })),
    };
  };

  const setupMocks = mocks => {
    jest.resetModules();
    mockModules({
      '../service-requestor': {
        sendXMLRequest: mocks.sendXMLRequest,
      },
      '../../../config': {
        usps: {
          baseUrl: 'http://localhost:3000',
          endpointPath: 'ShippingAPI.dll',
          userId: 'XXXXXXXXXXXX',
          addressInformationEnabled: true,
          addressStandardizationXmlRequestTemplate: 'usps-address-standardization-request-template.xml',
        },
      },
    });

    getStandardizedAddress = require('../usps-service').getStandardizedAddress;  // eslint-disable-line
  };

  describe('When the call to the USPS Address Standardization service fail', () => {
    it('should return null', async () => {
      const mocks = await getStandardizedAddressMock(false, '');
      setupMocks(mocks);

      const standardizedAddress = await getStandardizedAddress({}, addressPayload);
      expect(standardizedAddress).toBeNull();
    });
  });

  describe('When usps return a valid response', () => {
    it('should return a parsed address', async () => {
      const mocks = await getStandardizedAddressMock(
        true,
        `<AddressValidateResponse>
          <Address ID="0">
            <Address2>6406 IVY LN</Address2>
            <City>GREENBELT</City>
            <State>MD</State>
            <Zip5>20770</Zip5>
            <Zip4>1441</Zip4>
          </Address>
        </AddressValidateResponse>`,
      );
      setupMocks(mocks);
      const standardizedAddress = await getStandardizedAddress({}, addressPayload);

      expect(standardizedAddress.addressLine1).toEqual('6406 IVY LN');
      expect(standardizedAddress.city).toEqual('GREENBELT');
      expect(standardizedAddress.state).toEqual('MD');
      expect(standardizedAddress.zip).toEqual('20770-1441');
    });
  });

  describe('When usps return an error response', () => {
    it('should throw a ADDRESS_STANDARDIZATION_ERROR error', async () => {
      const mocks = await getStandardizedAddressMock(
        true,
        `<AddressValidateResponse>
            <Address ID="0">
              <Error>
                <Number>-2147219401</Number>
                <Source>clsAMS</Source>
                <Description>Address Not Found.  </Description>
                <HelpFile/>
                <HelpContext/>
              </Error>
            </Address>
        </AddressValidateResponse>`,
      );
      setupMocks(mocks);
      const { error } = await getStandardizedAddress({}, addressPayload);
      const { token, data } = error;
      expect(data.error.source).toEqual('clsAMS');
      expect(data.error.description).toEqual('Address Not Found.');
      expect(token).toEqual('ADDRESS_STANDARDIZATION_ERROR');
    });
  });
});
