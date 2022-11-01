/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import v4 from 'uuid/v4';
import { waitFor } from '../../testUtils/apiHelper';
import { tenant, chan, createResolverMatcher } from '../../testUtils/setupTestGlobalContext';
import { setupConsumers } from '../../workers/consumer';
import { createAPerson, createATeam, createAUser, createATeamMember, createAProperty, createATeamPropertyProgram } from '../../testUtils/repoHelper';
import { setTwilioProviderOps } from '../../common/twillioHelper';
import { enhanceContactWithThirdPartyInfo } from '../contactEnhancerService';
import { enhance, constructNameForUnknownPerson } from '../../../common/helpers/contactInfoUtils';
import { updateTenant } from '../tenantService';
import { postSms } from '../../testUtils/telephonyHelper';
import { DALTypes } from '../../../common/enums/DALTypes';

chai.use(sinonChai);
const expect = chai.expect;
const fullResponse = `{
    "country_code": "US",
    "phone_number": "16197384381",
    "national_format": "(415) 701-2311",
    "url": "https://lookups.twilio.com/v1/PhoneNumbers/+12025550196?Type=carrier",
    "caller_name": {
        "caller_name": "test_name",
        "caller_type": "BUSINESS",
        "error_code": null
    },
  "carrier": {
        "type": "mobile",
        "error_code": null,
        "mobile_network_code": null,
        "mobile_country_code": null,
        "name": "Pacific Bell"
    }
}`;

const phone = '16197384381';
describe('contact enhancer service', () => {
  beforeEach(async () => {
    await updateTenant(tenant.id, {
      metadata: {
        ...tenant.metadata,
        enablePhoneSupport: true,
      },
    });
  });
  const ctx = { tenantId: tenant.id };
  const processQueueMesage = async condition => {
    const { resolvers, promises } = waitFor([condition]);
    const matcher = createResolverMatcher(resolvers);
    await setupConsumers(chan(), matcher, ['sms']);
    return { task: promises[0] };
  };

  describe('called the service', () => {
    it('will store the returned result in the metadata column', async () => {
      setTwilioProviderOps({
        getPhoneNumberInfo: () => JSON.parse(fullResponse),
      });
      const callParams = { callerName: true };
      const contactInfo = enhance([{ type: 'phone', value: phone }]);
      const person = await createAPerson('A', 'B', contactInfo);
      const enhancedPerson = await enhanceContactWithThirdPartyInfo(ctx, person, callParams, phone);
      const result = enhancedPerson.contactInfo.all.find(p => p.value === phone).metadata.thirdPartyCallResult;
      expect(result).to.deep.equal(JSON.parse(fullResponse));
    });
  });

  describe('called with caller-name parameter ', () => {
    describe('caller-name was found in server call response', () => {
      let callParams;
      let contactInfo;
      beforeEach(() => {
        setTwilioProviderOps({
          getPhoneNumberInfo: () => JSON.parse(fullResponse),
        });
        callParams = { callerName: true };
        contactInfo = enhance([{ type: 'phone', value: phone }]);
      });

      it("will update person with returned caller-name if person doesn't have an already set name", async () => {
        const unknownName = constructNameForUnknownPerson(phone);
        const person = await createAPerson(unknownName, unknownName, contactInfo);
        const enhancedPerson = await enhanceContactWithThirdPartyInfo(ctx, person, callParams, phone);
        expect(enhancedPerson.fullName).to.equal('Test_name');
      });

      it('will not update person with returned caller-name if person already has a name set', async () => {
        const person = await createAPerson('John Doe', 'John Doe', contactInfo);
        const enhancedPerson = await enhanceContactWithThirdPartyInfo(ctx, person, callParams, phone);
        expect(enhancedPerson.fullName).to.equal('John Doe');
      });
    });

    describe('caller-name was not found in server call response', () => {
      it('will keep the original name on person', async () => {
        const response = `{
    "caller_name": {
        "caller_name": null,
        "caller_type": "BUSINESS",
        "error_code": null
    }
}`;
        const callParams = { callerName: true };
        setTwilioProviderOps({
          getPhoneNumberInfo: () => JSON.parse(response),
        });
        const contactInfo = enhance([{ type: 'phone', value: phone }]);
        const unknownName = constructNameForUnknownPerson(phone);
        const person = await createAPerson(unknownName, unknownName, contactInfo);
        const enhancedPerson = await enhanceContactWithThirdPartyInfo(ctx, person, callParams, phone);
        expect(enhancedPerson.fullName).to.equal(unknownName);
      });
    });

    describe('caller-name was found in server response', () => {
      it('will return the capitalized first word for full name and correct preferred name ', async () => {
        const response = `{
    "caller_name": {
        "caller_name": "tEst nAMe",
        "caller_type": "BUSINESS",
        "error_code": null
    }
}`;
        const callParams = { callerName: true };
        setTwilioProviderOps({
          getPhoneNumberInfo: () => JSON.parse(response),
        });
        const contactInfo = enhance([{ type: 'phone', value: phone }]);
        const unknownName = constructNameForUnknownPerson(phone);
        const person = await createAPerson(unknownName, unknownName, contactInfo);
        const enhancedPerson = await enhanceContactWithThirdPartyInfo(ctx, person, callParams, phone);
        expect(enhancedPerson.fullName).to.equal('Test Name');
        expect(enhancedPerson.preferredName).to.equal('Test');
      });
    });
  });

  describe('called with carrier parameter ', () => {
    it('will set contact sms flag to true when carrier type is mobile', async () => {
      const response = `{
  "carrier": {
        "type": "mobile",
        "error_code": null,
        "mobile_network_code": null,
        "mobile_country_code": null,
        "name": "Pacific Bell"
    }
}`;
      setTwilioProviderOps({ getPhoneNumberInfo: () => JSON.parse(response) });
      const callParams = { carrier: true };
      const contactInfo = enhance([{ type: 'phone', value: phone }]);
      const unknownName = constructNameForUnknownPerson(phone);
      const person = await createAPerson(unknownName, unknownName, contactInfo);
      const enhancedPerson = await enhanceContactWithThirdPartyInfo(ctx, person, callParams, phone);
      const isSms = enhancedPerson.contactInfo.all.find(p => p.value === phone).metadata.sms;
      expect(isSms).is.true;
    });
    it('will set contact sms flag to true when carrier type is voip', async () => {
      const response = `{
  "carrier": {
        "type": "voip",
        "error_code": null,
        "mobile_network_code": null,
        "mobile_country_code": null,
        "name": "Pacific Bell"
    }
}`;
      setTwilioProviderOps({ getPhoneNumberInfo: () => JSON.parse(response) });
      const callParams = { carrier: true };
      const contactInfo = enhance([{ type: 'phone', value: phone }]);
      const unknownName = constructNameForUnknownPerson(phone);
      const person = await createAPerson(unknownName, unknownName, contactInfo);
      const enhancedPerson = await enhanceContactWithThirdPartyInfo(ctx, person, callParams, phone);
      const isSms = enhancedPerson.contactInfo.all.find(p => p.value === phone).metadata.sms;
      expect(isSms).is.true;
    });
    it('will set contact sms flag to false when carrier type is landline', async () => {
      const response = `{
  "carrier": {
        "type": "landline",
        "error_code": null,
        "mobile_network_code": null,
        "mobile_country_code": null,
        "name": "Pacific Bell"
    }
}`;
      setTwilioProviderOps({ getPhoneNumberInfo: () => JSON.parse(response) });
      const callParams = { carrier: true };
      const contactInfo = enhance([{ type: 'phone', value: phone }]);
      const unknownName = constructNameForUnknownPerson(phone);
      const person = await createAPerson(unknownName, unknownName, contactInfo);
      const enhancedPerson = await enhanceContactWithThirdPartyInfo(ctx, person, callParams, phone);
      const isSms = enhancedPerson.contactInfo.all.find(p => p.value === phone).metadata.sms;
      expect(isSms).is.false;
    });
  });

  describe('when a sms is received', () => {
    it('should trigger a service call ', async () => {
      const programPhoneIdentifier = '12025550120';

      const msgId = v4();
      const testData = {
        To: programPhoneIdentifier,
        From: phone,
        TotalRate: '0',
        Units: '1',
        Text: 'Test incoming SMS message!',
        TotalAmount: '0',
        Type: 'sms',
        MessageUUID: msgId,
      };
      const user = await createAUser();
      const team = await createATeam({
        name: 'test team',
        module: 'leasing',
        email: 'leasing',
        phone: '16504375757',
      });
      await createATeamMember({ teamId: team.id, userId: user.id });

      const { id: programPropertyId } = await createAProperty();
      await createATeamPropertyProgram({
        teamId: team.id,
        propertyId: programPropertyId,
        directPhoneIdentifier: programPhoneIdentifier,
        commDirection: DALTypes.CommunicationDirection.IN,
      });

      const response = `{
    "caller_name": {
        "caller_name": null,
        "caller_type": "BUSINESS",
        "error_code": null
    }
}`;
      const callMock = sinon.spy(() => JSON.parse(response));
      setTwilioProviderOps({ getPhoneNumberInfo: callMock });
      const { task } = await processQueueMesage(msg => msg.MessageUUID === msgId);
      await postSms().send(testData);
      await task;
      expect(callMock).to.have.been.called.twice; // since a call is done upon saving the number as well
    });
  });

  describe("when a sms is received for a phone number which doesn't belong to a team", () => {
    it('a service call should not be triggered ', async () => {
      const msgId = v4();
      const testData = {
        To: '16504375757',
        From: phone,
        TotalRate: '0',
        Units: '1',
        Text: 'Test incoming SMS message!',
        TotalAmount: '0',
        Type: 'sms',
        MessageUUID: msgId,
      };
      const user = await createAUser();
      const team = await createATeam({
        name: 'test team',
        module: 'leasing',
        email: 'leasing',
        phone: '12345678901',
      });
      await createATeamMember({ teamId: team.id, userId: user.id });
      const response = `{
    "caller_name": {
        "caller_name": null,
        "caller_type": "BUSINESS",
        "error_code": null
    }
}`;
      const callMock = sinon.spy(() => JSON.parse(response));
      setTwilioProviderOps({ getPhoneNumberInfo: callMock });
      const { task } = await processQueueMesage(msg => msg.MessageUUID === msgId);
      await postSms().send(testData);
      await task;
      expect(callMock).to.not.have.been.called;
    });
  });
});
