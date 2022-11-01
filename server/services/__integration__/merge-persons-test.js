/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import newId from 'uuid/v4';
import {
  createAPerson,
  createAPersonContactInfo,
  createAUser,
  createAParty,
  createAPartyMember,
  createACommunicationEntry,
  createAnAppointment,
  createAProperty,
  createACommonUser,
} from '../../testUtils/repoHelper';
import { createAPersonApplication, createAPartyApplication, createAnApplicationInvoice } from '../../../rentapp/server/test-utils/repo-helper';
import { getPersonApplicationsByPersonIds, updatePersonApplication, savePersonApplicationEvent } from '../../../rentapp/server/dal/person-application-repo';
import { DALTypes } from '../../../common/enums/DALTypes';
import { mergePersons, determineBasePersonForMerge, updatePerson } from '../person';
import { archiveParty } from '../party';
import { tenant } from '../../testUtils/setupTestGlobalContext';
import { loadCommunicationsByPersonIds } from '../../dal/communicationRepo';
import { loadParty, createPartyMember, updateParty, loadPartyMembers, closeParty } from '../../dal/partyRepo';
import { getAllStrongMatches } from '../../dal/strongMatchesRepo';
import { getPersonById } from '../../dal/personRepo';
import { performPartyStateTransition } from '../partyStatesTransitions';
import { now } from '../../../common/helpers/moment-utils';
import { enhance } from '../../../common/helpers/contactInfoUtils';
import { LA_TIMEZONE } from '../../../common/date-constants';
import { saveCommsTemplate, saveCommsTemplateSetting } from '../../dal/commsTemplateRepo';
import { saveNotificationUnsubscription, getNotificationUnsubscriptionByPersonId } from '../../dal/cohortCommsRepo';
import { TemplateActions, TemplateSections } from '../../../common/enums/templateTypes';

describe('merge persons tests', () => {
  let person1;
  let person2;
  let contactInfo1;
  let contactInfo2;
  let party1;
  let party2;
  let partyMember1;
  let user;

  const ctx = { tenantId: tenant.id };
  const tosEvents = [
    {
      localIP: '192.168.1.155',
      publicIP: '5.2.198.221',
      eventType: 'pageView',
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.110 Safari/537.36',
    },
    {
      localIP: '192.168.1.155',
      publicIP: '5.2.198.221',
      eventType: 'checked',
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.110 Safari/537.36',
    },
    {
      localIP: '192.168.1.155',
      publicIP: '5.2.198.221',
      eventType: 'buttonClicked',
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.110 Safari/537.36',
    },
  ];
  const createCommonUserForPerson = async personId =>
    await createACommonUser({
      tenantId: ctx.tenantId,
      fullName: 'John Doe',
      preferredName: 'Any',
      email: 'johndoe+234@reva.tech',
      personId,
    });

  beforeEach(async () => {
    person1 = await createAPerson('John Papa SR', 'John P');
    contactInfo1 = [
      { type: DALTypes.ContactInfoType.PHONE, value: '12025550395', isPrimary: true },
      { type: DALTypes.ContactInfoType.EMAIL, value: 'john+default@reva.tech', isPrimary: true },
      { type: DALTypes.ContactInfoType.EMAIL, value: 'john+test2@reva.tech' },
    ];

    await createAPersonContactInfo(person1.id, ...contactInfo1);

    person2 = await createAPerson('John Papa', 'John');
    contactInfo2 = [
      { type: DALTypes.ContactInfoType.PHONE, value: '12025550300', isPrimary: true },
      { type: DALTypes.ContactInfoType.EMAIL, value: 'johnpapa@gmail.tech', isPrimary: true },
    ];

    await createAPersonContactInfo(person2.id, ...contactInfo2);

    user = await createAUser();
    party1 = await createAParty({ userId: user.id });
    partyMember1 = await createAPartyMember(party1.id, { personId: person1.id });

    party2 = await createAParty({ userId: user.id });
    await createAPartyMember(party2.id, { personId: person2.id });
  });

  describe('when two persons need to be merged', () => {
    it('should unsubscribe result person', async () => {
      const commsTemplate = {
        id: newId(),
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
      const { id: templateId } = await saveCommsTemplate(ctx, commsTemplate);
      const { id: propertyId } = await createAProperty();

      const templateSettings = await saveCommsTemplateSetting(ctx, {
        propertyId,
        templateId,
        section: TemplateSections.NOTIFICATION,
        action: TemplateActions.RXP_ANNOUNCEMENT,
      });

      await saveNotificationUnsubscription(ctx, {
        commsTemplateSettingsId: templateSettings.id,
        personId: person1.id,
      });

      await mergePersons(ctx, person1.id, person2.id);
      const unsubscriptionFromPerson1 = await getNotificationUnsubscriptionByPersonId(ctx, person1.id);
      const unsubscriptionFromPerson2 = await getNotificationUnsubscriptionByPersonId(ctx, person2.id);

      expect(unsubscriptionFromPerson1).to.equal(undefined);
      expect(unsubscriptionFromPerson2.personId).to.equal(person2.id);
    });

    it('should return the result person together with the contactInfos from both', async () => {
      const resultPerson = await mergePersons(ctx, person1.id, person2.id);

      expect(resultPerson.contactInfo.phones.map(item => item.value)).to.include(contactInfo1[0].value);
      expect(resultPerson.contactInfo.phones.map(item => item.value)).to.include(contactInfo2[0].value);
      expect(resultPerson.contactInfo.emails.map(item => item.value)).to.include(contactInfo1[1].value);
      expect(resultPerson.contactInfo.emails.map(item => item.value)).to.include(contactInfo1[2].value);
      expect(resultPerson.contactInfo.emails.map(item => item.value)).to.include(contactInfo2[1].value);
    });

    it('should return the result person together with the comms from both and the SMS and CALL comms thread ids will be updated', async () => {
      const smsComm1 = await createACommunicationEntry({
        parties: [party1.id],
        persons: [person1.id],
        direction: DALTypes.CommunicationDirection.OUT,
        type: DALTypes.CommunicationMessageType.SMS,
      });

      const smsComm2 = await createACommunicationEntry({
        parties: [party2.id],
        persons: [person2.id],
        direction: DALTypes.CommunicationDirection.OUT,
        type: DALTypes.CommunicationMessageType.SMS,
      });

      const smsComm3 = await createACommunicationEntry({
        parties: [party1.id, party2.id],
        persons: [person1.id, person2.id],
        direction: DALTypes.CommunicationDirection.IN,
        type: DALTypes.CommunicationMessageType.SMS,
      });

      const phoneComm1 = await createACommunicationEntry({
        parties: [party1.id],
        persons: [person1.id],
        direction: DALTypes.CommunicationDirection.OUT,
        type: DALTypes.CommunicationMessageType.CALL,
      });

      const phoneComm2 = await createACommunicationEntry({
        parties: [party2.id],
        persons: [person2.id],
        direction: DALTypes.CommunicationDirection.OUT,
        type: DALTypes.CommunicationMessageType.CALL,
      });

      const emailComm1 = await createACommunicationEntry({
        parties: [party1.id],
        persons: [person1.id],
        direction: DALTypes.CommunicationDirection.OUT,
        type: DALTypes.CommunicationMessageType.EMAIL,
      });

      const emailComm2 = await createACommunicationEntry({
        parties: [party2.id],
        persons: [person2.id],
        direction: DALTypes.CommunicationDirection.OUT,
        type: DALTypes.CommunicationMessageType.EMAIL,
      });

      const resultPerson = await mergePersons(ctx, person1.id, person2.id);
      const commsForResultPerson = await loadCommunicationsByPersonIds(ctx, resultPerson.id);

      expect(commsForResultPerson.map(item => item.id)).to.include(smsComm1.id);
      expect(commsForResultPerson.map(item => item.id)).to.include(smsComm2.id);
      expect(commsForResultPerson.map(item => item.id)).to.include(smsComm3.id);
      expect(commsForResultPerson.map(item => item.id)).to.include(phoneComm1.id);
      expect(commsForResultPerson.map(item => item.id)).to.include(phoneComm2.id);
      expect(commsForResultPerson.map(item => item.id)).to.include(emailComm1.id);
      expect(commsForResultPerson.map(item => item.id)).to.include(emailComm2.id);

      const [firstSmsComm, secondSmsComm, thirdSmsComm] = commsForResultPerson.filter(c => c.type === DALTypes.CommunicationMessageType.SMS);
      expect(firstSmsComm.threadId).to.equal(secondSmsComm.threadId);
      expect(firstSmsComm.threadId).to.equal(thirdSmsComm.threadId);

      const [fistPhoneComm, secondPhoneComm] = commsForResultPerson.filter(c => c.type === DALTypes.CommunicationMessageType.CALL);
      expect(fistPhoneComm.threadId).to.equal(secondPhoneComm.threadId);

      const [firstEmailComm, secondEmailComm] = commsForResultPerson.filter(c => c.type === DALTypes.CommunicationMessageType.EMAIL);
      expect(firstEmailComm.threadId).not.to.equal(secondEmailComm.threadId);
    });

    it('should return the result person as the person in both parties merged', async () => {
      const resultPerson = await mergePersons(ctx, person1.id, person2.id);
      const resultParty1 = await loadParty(ctx, party1.id);
      const resultParty2 = await loadParty(ctx, party2.id);

      expect(resultParty1.partyMembers[0].personId).to.equal(resultPerson.id);
      expect(resultParty2.partyMembers[0].personId).to.equal(resultPerson.id);
    });

    it('should mark the other person as merged with the based person', async () => {
      const resultPerson = await mergePersons(ctx, person1.id, person2.id);

      const otherPersonId = resultPerson.id === person1.id ? person2.id : person1.id;
      const otherPerson = await getPersonById(ctx, otherPersonId);

      expect(otherPerson.mergedWith).to.equal(resultPerson.id);
    });

    describe('given that persons are in different parties and both persons have applications, but only one has paid', () => {
      it('both applications should move to the result person', async () => {
        const paidApp = await createAPersonApplication({ firstName: 'Gigi Buffon' }, person1.id, party1.id, newId(), true);
        await updatePersonApplication(ctx, paidApp.id, { applicationStatus: DALTypes.PersonApplicationStatus.PAID });
        await createCommonUserForPerson(person1.id);
        await savePersonApplicationEvent(ctx, paidApp.id, tosEvents, LA_TIMEZONE);
        await createAPersonApplication({ firstName: 'Pippo Inzaghi' }, person2.id, party2.id, newId(), false);
        const resultPerson = await mergePersons(ctx, person1.id, person2.id);

        expect(resultPerson.id).to.equal(person1.id);
        const otherPersonId = person2.id;
        const appsForOtherPerson = await getPersonApplicationsByPersonIds(ctx, [otherPersonId]);
        const appsForResultPerson = await getPersonApplicationsByPersonIds(ctx, [resultPerson.id]);

        expect(appsForOtherPerson.length).to.equal(0);
        expect(appsForResultPerson.length).to.equal(2);

        const mergedApps = appsForResultPerson.filter(app => app.endedAsMergedAt);
        expect(mergedApps.length).to.equal(0);
      });
    });

    describe('given that persons are in the same party and have applications, but only one has paid', () => {
      it('both applications should move to the result person, and one should be marked as endedAsMergedAt', async () => {
        const paidApp = await createAPersonApplication({ firstName: 'Gigi Buffon' }, person1.id, party1.id, newId(), true);
        await updatePersonApplication(ctx, paidApp.id, { applicationStatus: DALTypes.PersonApplicationStatus.PAID });
        await createCommonUserForPerson(person1.id);
        await savePersonApplicationEvent(ctx, paidApp.id, tosEvents, LA_TIMEZONE);
        await createAPartyMember(party1.id, { personId: person2.id });
        await createAPersonApplication({ firstName: 'Pippo Inzaghi' }, person2.id, party1.id, newId(), false);
        const resultPerson = await mergePersons(ctx, person1.id, person2.id);
        expect(resultPerson.id).to.equal(person1.id);
        const otherPersonId = person2.id;
        const appsForOtherPerson = await getPersonApplicationsByPersonIds(ctx, [otherPersonId]);
        const appsForResultPerson = await getPersonApplicationsByPersonIds(ctx, [resultPerson.id]);

        expect(appsForOtherPerson.length).to.equal(0);
        expect(appsForResultPerson.length).to.equal(1);

        expect(appsForResultPerson[0].id).to.equal(paidApp.id);
        expect(appsForResultPerson[0].endedAsMergedAt).to.equal(null);
      });
    });

    describe('given that persons are in the same party and have applications, but only one has an open one', () => {
      it('both applications should move to the result person, and one should be marked as endedAsMergedAt', async () => {
        await createAPersonApplication({ firstName: 'Gigi Buffon' }, person1.id, party1.id, newId(), false);
        await createAPartyMember(party1.id, { personId: person2.id });
        await createAPersonApplication({ firstName: 'Pippo Inzaghi' }, person2.id, party1.id, newId(), false);
        const resultPerson = await mergePersons(ctx, person1.id, person2.id);
        const otherPersonId = resultPerson.id === person1.id ? person2.id : person1.id;
        const appsForOtherPerson = await getPersonApplicationsByPersonIds(ctx, [otherPersonId]);
        const appsForResultPerson = await getPersonApplicationsByPersonIds(ctx, [resultPerson.id]);

        expect(appsForOtherPerson.length).to.equal(0);
        expect(appsForResultPerson.length).to.equal(1);
      });
    });

    describe('given that persons are in different parties and one person has an application which is completed', () => {
      it('the application should move to the result person', async () => {
        const application = await createAPersonApplication({ firstName: 'Gigi Buffon', email: contactInfo1[1].value }, person1.id, party1.id, newId(), true);
        await createCommonUserForPerson(person1.id);
        await updatePersonApplication(ctx, application.id, { applicationStatus: DALTypes.PersonApplicationStatus.COMPLETED });
        await savePersonApplicationEvent(ctx, application.id, tosEvents, LA_TIMEZONE);

        const resultPerson = await mergePersons(ctx, person1.id, person2.id);

        expect(resultPerson.id).to.equal(person1.id);
        const otherPersonId = person2.id;
        const appsForOtherPerson = await getPersonApplicationsByPersonIds(ctx, [otherPersonId]);
        const appsForResultPerson = await getPersonApplicationsByPersonIds(ctx, [resultPerson.id]);

        expect(appsForOtherPerson.length).to.equal(0);
        expect(appsForResultPerson.length).to.equal(1);

        const mergedApps = appsForResultPerson.filter(app => app.endedAsMergedAt);
        expect(mergedApps.length).to.equal(0);
      });
    });
    describe('given that one person has an application', () => {
      const setUpCopyActiveApplicationScenario = async (sameAssignedProperty = false, paidApplication = false) => {
        const partyApplicationData = {
          applicationData: {},
          maxApprovedAt: null,
          minDeniedAt: null,
        };

        const { id: propertyId } = await createAProperty();
        const { id: propertyId1 } = await createAProperty();
        const { id: propertyId2 } = await createAProperty();
        await updateParty(ctx, { id: party1.id, assignedPropertyId: sameAssignedProperty ? propertyId : propertyId1 });
        await updateParty(ctx, { id: party2.id, assignedPropertyId: sameAssignedProperty ? propertyId : propertyId2 });
        const partyApplication = await createAPartyApplication(party2.id, newId(), partyApplicationData);
        const paidApp = await createAPersonApplication({ firstName: 'Pippo Inzaghi' }, person2.id, party2.id, newId(), paidApplication);
        await createAnApplicationInvoice({
          id: newId(),
          applicationFeeId: newId(),
          applicationFeeAmount: 43,
          paymentCompleted: true,
          personApplicationId: paidApp.id,
          partyApplicationId: partyApplication.id,
        });
        await createCommonUserForPerson(person2.id);

        const resultPerson = await mergePersons(ctx, person1.id, person2.id);

        expect(resultPerson.id).to.equal(person2.id);
        const otherPersonId = person1.id;
        const appsForOtherPerson = await getPersonApplicationsByPersonIds(ctx, [otherPersonId]);
        const appsForResultPerson = await getPersonApplicationsByPersonIds(ctx, [resultPerson.id]);
        return { appsForOtherPerson, appsForResultPerson };
      };

      describe('when both parties have the same assigned property', () => {
        it('should copy the active application when the application is paid', async () => {
          const { appsForOtherPerson, appsForResultPerson } = await setUpCopyActiveApplicationScenario(true, true);
          expect(appsForOtherPerson.length).to.equal(0);
          expect(appsForResultPerson.length).to.equal(2);

          const mergedApps = appsForResultPerson.filter(app => app.endedAsMergedAt);
          expect(mergedApps.length).to.equal(0);
          expect(appsForResultPerson.map(({ partyId }) => partyId)).to.include(party2.id);
        });

        it('should not copy the active application when the application is not paid', async () => {
          const { appsForOtherPerson, appsForResultPerson } = await setUpCopyActiveApplicationScenario(true, false);

          expect(appsForOtherPerson.length).to.equal(0);
          expect(appsForResultPerson.length).to.equal(1);
          expect(appsForResultPerson[0].endedAsMergedAt).to.equal(null);
        });
      });

      describe('when the parties have different assigned property', () => {
        it('should not copy the active application even when the application is paid', async () => {
          const { appsForOtherPerson, appsForResultPerson } = await setUpCopyActiveApplicationScenario(false, true);

          expect(appsForOtherPerson.length).to.equal(0);
          expect(appsForResultPerson.length).to.equal(1);
          expect(appsForResultPerson.filter(app => !app.endedAsMergedAt).length).to.equal(1);
        });
      });
    });

    describe('given that both persons share at least one party', () => {
      it('should merge the persons and delete the party membership of the other person', async () => {
        const otherPerson = await createAPerson('Gigi Buffon', 'Gigi');
        await createAPartyMember(party1.id, { personId: otherPerson.id });
        await mergePersons(ctx, person1.id, otherPerson.id);
        const partyMembersIds = (await loadParty(ctx, party1.id)).partyMembers.map(pm => pm.id);

        expect(partyMembersIds).to.not.deep.include(person1.id);
      });
    });
  });

  describe('when three persons need to be merged', () => {
    it('should return the result person with the other two marked as merged with the result person', async () => {
      const resultPerson1 = await mergePersons(ctx, person1.id, person2.id);

      const otherPersonAfterFirstMergeId = resultPerson1.id === person1.id ? person2.id : person1.id;

      const thirdPerson = await createAPerson('Third Person', 'TP');
      const contactInfo = [
        { type: DALTypes.ContactInfoType.PHONE, value: '12025550391', isPrimary: true },
        { type: DALTypes.ContactInfoType.EMAIL, value: 'tp@reva.tech', isPrimary: true },
      ];

      await createAPersonContactInfo(thirdPerson.id, ...contactInfo);

      const resultPerson2 = await mergePersons(ctx, resultPerson1.id, thirdPerson.id);

      const otherPersonAfterFirstMerge = await getPersonById(ctx, otherPersonAfterFirstMergeId);
      const otherPersonAfterSecondMergeId = resultPerson2.id === resultPerson1.id ? thirdPerson.id : resultPerson1.id;
      const otherPersonAfterSecondMerge = await getPersonById(ctx, otherPersonAfterSecondMergeId);

      expect(otherPersonAfterFirstMerge.mergedWith).to.equal(resultPerson2.id);
      expect(otherPersonAfterSecondMerge.mergedWith).to.equal(resultPerson2.id);
    });
  });

  describe('given two persons that need to be merged we need to determine which is the base person', () => {
    describe('given that one person is in a party and already has an appointment', () => {
      it('should decide which person is the base person and return the one that has an appointment', async () => {
        await performPartyStateTransition(ctx, party2.id);

        await createAnAppointment({
          partyId: party1.id,
          salesPersonId: user.id,
          partyMembers: [partyMember1.id],
          endDate: now().add(1, 'days'),
        });

        await performPartyStateTransition(ctx, party1.id);

        const result = await determineBasePersonForMerge(ctx, person1.id, person2.id);
        expect(result).to.equal(person1.id);
      });
    });

    describe('given that one person is in a party and already has answered qualification questions', () => {
      it('should decide which person is the base person and return the one that has answered qualification questions', async () => {
        await performPartyStateTransition(ctx, party2.id);

        const qualificationQuestions = { testQuestions: 'testAnswer' };
        await updateParty(ctx, { id: party1.id, qualificationQuestions });
        await performPartyStateTransition(ctx, party1.id);

        const result = await determineBasePersonForMerge(ctx, person1.id, person2.id);
        expect(result).to.equal(person1.id);
      });
    });

    describe('given that one person is in a party of applicant state', () => {
      it('should decide which person is the base person and return the one in applicant state', async () => {
        await performPartyStateTransition(ctx, party2.id);

        await createPartyMember(
          ctx,
          {
            memberType: DALTypes.MemberType.OCCUPANT,
            memberState: DALTypes.PartyStateType.APPLICANT,
            fullname: 'TEST',
          },
          party1.id,
        );

        await performPartyStateTransition(ctx, party1.id);

        const result = await determineBasePersonForMerge(ctx, person1.id, person2.id);
        expect(result).to.equal(person1.id);
      });
    });

    describe('given that one person was in a party that has been archived', () => {
      it('should retrieve the other one as the base person', async () => {
        await archiveParty(
          { ...ctx, authUser: { id: user.id } },
          { partyId: party1.id, archiveReasonId: DALTypes.ArchivePartyReasons.MERGED_WITH_ANOTHER_PARTY },
        );

        const result = await determineBasePersonForMerge(ctx, person1.id, person2.id);
        expect(result).to.equal(person2.id);
      });
    });

    describe('given that one person is not part of any party', () => {
      it('should retrieve the other one as the base person', async () => {
        const aPerson = await createAPerson('A Person', 'AP');

        const result = await determineBasePersonForMerge(ctx, aPerson.id, person1.id);
        expect(result).to.equal(person1.id);
      });
    });

    describe('given that both persons have applications', () => {
      it('should retrieve the one with the paid application', async () => {
        await createAPersonApplication({ firstName: 'Gigi Buffon' }, person1.id, party1.id, newId(), true);
        await createAPersonApplication({ firstName: 'Pippo Inzaghi' }, person2.id, party2.id, newId(), false);

        const result = await determineBasePersonForMerge(ctx, person1.id, person2.id);
        expect(result).to.equal(person1.id);
      });

      it('should retrieve the one with the paid application', async () => {
        await createAPersonApplication({ firstName: 'Gigi Buffon' }, person1.id, party1.id, newId(), false);
        await createAPersonApplication({ firstName: 'Pippo Inzaghi' }, person2.id, party2.id, newId(), true);

        const result = await determineBasePersonForMerge(ctx, person1.id, person2.id);
        expect(result).to.equal(person2.id);
      });

      describe('given that neither application is paid', () => {
        it('should retrieve the one that was clicked', async () => {
          await createAPersonApplication({ firstName: 'Gigi Buffon' }, person1.id, party1.id, newId(), false);
          await createAPersonApplication({ firstName: 'Pippo Inzaghi' }, person2.id, party2.id, newId(), false);

          const result = await determineBasePersonForMerge(ctx, person1.id, person2.id);
          expect(result).to.equal(person1.id);
        });
      });
    });
  });

  describe('given two persons that need to be merged and they have a strong match', () => {
    it('should mark the strong match as confirmed', async () => {
      const person4 = await createAPerson('John D Papa', 'Johnny');
      const newUser2 = await createAUser();
      const newParty2 = await createAParty({ userId: newUser2.id });
      await createAPartyMember(newParty2.id, { personId: person4.id });

      const newCi = [{ id: newId(), type: DALTypes.ContactInfoType.PHONE, value: '12025550395', isPrimary: true }];
      await updatePerson(ctx, person4.id, { fullName: 'John D Papa', contactInfo: enhance(newCi) });

      await mergePersons(ctx, person1.id, person4.id);

      const strongMatches = await getAllStrongMatches(ctx);

      expect(strongMatches.length).to.equal(1);
      expect(strongMatches[0].status).to.equal(DALTypes.StrongMatchStatus.CONFIRMED);
    });
  });

  describe('given two persons that need to be merged that are part of multiple parties', () => {
    it('the partymember for the merged person should be removed from all parties', async () => {
      const newUser = await createAUser();
      const newPerson = await createAPerson('John D Papa', 'Johnny');

      const openParty = await createAParty({ userId: newUser.id });
      await createAPartyMember(openParty.id, { personId: person1.id });
      await createAPartyMember(openParty.id, { personId: newPerson.id });

      const closedParty = await createAParty({ userId: newUser.id });
      await createAPartyMember(closedParty.id, { personId: person1.id });
      await createAPartyMember(closedParty.id, { personId: newPerson.id });

      await closeParty({ ...ctx, authUser: { id: newUser.id } }, closedParty.id, DALTypes.ClosePartyReasons.MERGED_WITH_ANOTHER_PARTY);

      await mergePersons(ctx, newPerson.id, person1.id);

      const membersInOpenParty = await loadPartyMembers(ctx, openParty.id, { excludeInactive: false });
      const membersInClosedParty = await loadPartyMembers(ctx, closedParty.id, { excludeInactive: false });

      expect(membersInOpenParty.find(pm => pm.personId === newPerson.id).endDate).to.not.be.null;
      expect(membersInClosedParty.find(pm => pm.personId === newPerson.id).endDate).to.not.be.null;
    });
  });
});
