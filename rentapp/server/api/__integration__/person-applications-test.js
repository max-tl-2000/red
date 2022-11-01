/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import newId from 'uuid/v4';
import logger from '../../../../common/helpers/logger';
import { createAPersonApplication, createAPartyApplication, ctx, createAPartyMember } from '../../test-utils/repo-helper.js';
import {
  createAParty,
  createAPerson,
  createAPersonContactInfo,
  createADocument,
  createAUser,
  createAQuotePromotion,
} from '../../../../server/testUtils/repoHelper';
import { createDocument as createRentappDocument } from '../../services/documents';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { getPersonById } from '../../../../server/services/person';
import { removePartyMember, closeParty } from '../../../../server/services/party';
import {
  createOrUpdatePersonApplication,
  getPersonApplication,
  updatePersonApplication,
  getDocumentsForPersonApplication,
} from '../../test-utils/api-helper.js';

describe('API/personApplications', () => {
  const personApplicationKeys = [
    'id',
    'created_at',
    'updated_at',
    'personId',
    'partyId',
    'partyApplicationId',
    'applicationData',
    'additionalData',
    'paymentCompleted',
    'paymentLink',
    'applicationStatus',
    'isFeeWaived',
    'feeWaiverReason',
    'applicantId',
    'endedAsMergedAt',
    'ssn',
    'itin',
    'sendSsnEnabled',
    'tosEvents',
    'createdFromCommId',
    'applicationCompleted',
    'copiedFrom',
  ];

  let createdUser;

  beforeEach(async () => {
    createdUser = await createAUser();
  });

  context('GET/:personApplicationId', () => {
    describe("when a person application id isn't valid", () => {
      it('responds with status code 400 and INVALID_PERSON_APPLICANT_ID token', async () => {
        await getPersonApplication('wrongId')
          .expect(400)
          .expect(res => expect(res.body.token).to.equal('INVALID_PERSON_APPLICANT_ID'));
      });
    });

    describe("when a person application doesn't exist", () => {
      it('responds with status code 404 and INVALID_PERSON_APPLICANT_ID token', async () => {
        await getPersonApplication(newId())
          .expect(404)
          .expect(res => expect(res.body.token).to.equal('PERSON_APPLICATION_NOT_FOUND'));
      });
    });

    describe('when a person application exist', () => {
      it('responds with status code 200 and has personApplication in it', async () => {
        const personApplication = await createAPersonApplication({ firstName: 'Name' }, newId(), newId(), newId());
        logger.debug(personApplication);
        await getPersonApplication(personApplication.id)
          .expect(200)
          .expect(res => expect(res.body).to.have.all.keys(personApplicationKeys))
          .expect(res => expect(res.body.id).to.equal(personApplication.id))
          .expect(res => expect(res.body.applicationData.firstName).to.equal(personApplication.applicationData.firstName));
      });
    });
  });

  context('POST api/personApplications/current/screeningData', () => {
    const createPartyAndPartyMember = async (personId, fullName = 'TEST') => {
      const party = await createAParty({
        state: DALTypes.PartyStateType.PROSPECT,
      });
      const partyMember = await createAPartyMember(
        {
          memberType: DALTypes.MemberType.RESIDENT,
          memberState: DALTypes.PartyStateType.APPLICANT,
          fullName,
          personId,
        },
        party.id,
      );
      return { party, partyMember };
    };

    describe('when a person application is valid', () => {
      it('responds with status code 200 and create a new person application', async () => {
        const { party, partyMember } = await createPartyAndPartyMember();
        const partyId = party.id;
        const applicationData = {
          applicationData: {},
          maxApprovedAt: null,
          minDeniedAt: null,
        };

        await createAPartyApplication(partyId, newId(), applicationData);
        const personApplication = {
          personId: partyMember.personId,
          partyId,
          partyApplicationId: newId(),
          paymentCompleted: false,
          applicationData: {
            firstName: 'Name',
          },
        };
        await createOrUpdatePersonApplication(personApplication)
          .expect(200)
          .expect(res => expect(res.body).to.have.all.keys(personApplicationKeys))
          .expect(res => expect(res.body.applicationData.firstName).to.equal(personApplication.applicationData.firstName));
      });

      it('responds with status code 200 and create a new person application where a new party application was created and partyApplicationId was set correctly', async () => {
        const { party, partyMember } = await createPartyAndPartyMember();
        const personApplication = {
          personId: partyMember.personId,
          partyId: party.id,
          partyApplicationId: null,
          paymentCompleted: false,
          applicationData: {
            firstName: 'Name',
          },
        };
        await createOrUpdatePersonApplication(personApplication)
          .expect(200)
          .expect(res => expect(res.body).to.have.all.keys(personApplicationKeys))
          .expect(res => expect(res.body.partyApplicationId).to.not.be.null);
      });

      it('responds with status code 200 and update a existing person application', async () => {
        const { partyMember } = await createPartyAndPartyMember();
        const previousPersonApplication = await createAPersonApplication(
          { applicationData: { firstName: 'John', haveInternationalAddress: true, addressLine: '742 Evergreen Terrace' } },
          partyMember.personId,
          partyMember.partyId,
          newId(),
        );

        const personApplication = {
          personId: previousPersonApplication.personId,
          partyId: previousPersonApplication.partyId,
          partyApplicationId: previousPersonApplication.partyApplicationId,
          paymentCompleted: false,
          applicationData: {
            firstName: 'John Papa',
            haveInternationalAddress: false,
            addressLine1: 'Evergreen Terrace 1',
            addressLine2: 'Evergreen Terrace 2',
            email: 'john+test@reva.tech',
            dateOfBirth: '01/01/1990',
            city: 'Springfield',
            state: 'Illinois',
            zip: '0011',
          },
        };

        await createOrUpdatePersonApplication(personApplication)
          .expect(200)
          .expect(res => expect(res.body).to.have.all.keys(personApplicationKeys))
          .expect(res => expect(res.body.id).to.equal(previousPersonApplication.id))
          .expect(res => expect(res.body.partyApplicationId).to.equal(previousPersonApplication.partyApplicationId))
          .expect(res => {
            const { enteredByUser } = res.body.applicationData.address;
            expect(enteredByUser).to.have.all.keys(['line1', 'line2', 'city', 'state', 'postalCode', 'unparsedAddress', 'address']);
          })
          .expect(res => expect(res.body.applicationData.firstName).to.equal(personApplication.applicationData.firstName));
      });

      it('responds with status code 200 and update a existing person application and not clobbered contact information', async () => {
        const person = await createAPerson('John Papa', 'John');
        const { party } = await createPartyAndPartyMember(person.id);
        const initialEmail = 'john+default@reva.tech';
        const contactInfo = [
          { type: DALTypes.ContactInfoType.PHONE, value: '12025550395', isPrimary: true },
          { type: DALTypes.ContactInfoType.EMAIL, value: initialEmail, isPrimary: true },
          { type: DALTypes.ContactInfoType.EMAIL, value: 'john+test2@reva.tech' },
        ];
        await createAPersonContactInfo(person.id, ...contactInfo);

        const previousPersonApplication = await createAPersonApplication(
          { applicationData: { firstName: 'John', haveInternationalAddress: true, addressLine: '742 Evergreen Terrace' } },
          person.id,
          party.id,
          newId(),
        );

        const personApplication = {
          personId: previousPersonApplication.personId,
          partyId: previousPersonApplication.partyId,
          partyApplicationId: previousPersonApplication.partyApplicationId,
          paymentCompleted: false,
          applicationData: {
            firstName: 'John Papa',
            haveInternationalAddress: false,
            addressLine1: 'Evergreen Terrace 1',
            addressLine2: 'Evergreen Terrace 2',
            email: initialEmail,
            dateOfBirth: '01/01/1990',
            city: 'Springfield',
            state: 'Illinois',
            zip: '0011',
          },
        };

        await createOrUpdatePersonApplication(personApplication).expect(200);

        const personInformation = await getPersonById(ctx, personApplication.personId);
        const { defaultEmail, phones, emails } = personInformation.contactInfo;
        expect(phones.length).to.equal(1);
        expect(emails.length).to.equal(2);
        expect(defaultEmail).to.equal(initialEmail);
      });

      it('responds with status code 500 if application is already approved', async () => {
        const { party, partyMember } = await createPartyAndPartyMember();
        const previousPersonApplication = await createAPersonApplication(
          { applicationData: { firstName: 'John', haveInternationalAddress: true, addressLine: '742 Evergreen Terrace' } },
          partyMember.personId,
          party.id,
          newId(),
          true,
        );
        await createAQuotePromotion(party.id);

        const personApplication = {
          personId: previousPersonApplication.personId,
          partyId: previousPersonApplication.partyId,
          partyApplicationId: previousPersonApplication.partyApplicationId,
          paymentCompleted: false,
          applicationData: {
            firstName: 'John Papa',
            haveInternationalAddress: false,
            addressLine1: 'Evergreen Terrace 1',
            addressLine2: 'Evergreen Terrace 2',
            city: 'Springfield',
            state: 'Illinois',
            zip: '0011',
          },
        };

        await createOrUpdatePersonApplication(personApplication)
          .expect(500)
          .expect(res => expect(res.body.token).to.equal('APPLICATION_CANNOT_BE_EDITED'));
      });

      it('responds with status code 200 and verify that the party applications are the same for two people', async () => {
        const personA = await createAPerson('Bill', 'Smith');
        const { party: partyA } = await createPartyAndPartyMember(personA.id);

        const personApplicationA = {
          personId: personA.id,
          partyId: partyA.id,
          paymentCompleted: false,
          applicationData: {
            firstName: 'Bill',
            haveInternationalAddress: false,
            addressLine1: 'Evergreen Terrace 1',
            addressLine2: 'Evergreen Terrace 2',
            city: 'Springfield',
            state: 'Illinois',
            zip: '0011',
          },
        };

        const personB = await createAPerson('Deanna', 'Smith');
        await createAPartyMember(
          {
            memberType: DALTypes.MemberType.RESIDENT,
            memberState: DALTypes.PartyStateType.APPLICANT,
            personId: personB.id,
          },
          partyA.id,
        );

        const personApplicationB = {
          personId: personB.id,
          partyId: partyA.id,
          paymentCompleted: false,
          applicationData: {
            firstName: 'Deanna',
            haveInternationalAddress: false,
            addressLine1: 'Evergreen Terrace 1',
            addressLine2: 'Evergreen Terrace 2',
            city: 'Springfield',
            state: 'Illinois',
            zip: '0011',
          },
        };

        const resPersonA = await createOrUpdatePersonApplication(personApplicationA);
        expect(resPersonA.status).to.equal(200);

        await createOrUpdatePersonApplication(personApplicationB)
          .expect(200)
          .expect(res => expect(res.body.partyApplicationId).to.equal(resPersonA.body.partyApplicationId));
      });
    });

    describe('when a person application is valid and email is different from default ', () => {
      it('responds with status code 412 "Precondition Failed"', async () => {
        const person = await createAPerson('John Papa', 'John');
        const { party } = await createPartyAndPartyMember(person.id);
        const initialEmail = 'john+default@reva.tech';
        const contactInfo = [
          { type: DALTypes.ContactInfoType.PHONE, value: '12025550395', isPrimary: true },
          { type: DALTypes.ContactInfoType.EMAIL, value: initialEmail, isPrimary: true },
        ];
        await createAPersonContactInfo(person.id, ...contactInfo);

        const previousPersonApplication = await createAPersonApplication(
          { applicationData: { firstName: 'John', haveInternationalAddress: true, addressLine: '742 Evergreen Terrace' } },
          person.id,
          party.id,
          newId(),
        );

        const personApplication = {
          personId: previousPersonApplication.personId,
          partyId: previousPersonApplication.partyId,
          partyApplicationId: previousPersonApplication.partyApplicationId,
          paymentCompleted: false,
          applicationData: {
            firstName: 'John Papa',
            haveInternationalAddress: false,
            addressLine1: 'Evergreen Terrace 1',
            addressLine2: 'Evergreen Terrace 2',
            email: 'john+test3@reva.tech',
            dateOfBirth: '01/01/1990',
            city: 'Springfield',
            state: 'Illinois',
            zip: '0011',
          },
        };

        await createOrUpdatePersonApplication(personApplication)
          .expect(200)
          .expect(res => expect(res.body?.error?.token).to.equal('CANT_UPDATE_EMAIL'));
      });
    });

    describe('when a person application is related to a removed party or member', () => {
      it('responds with status code 404 and the token PARTY_MEMBER_REMOVED', async () => {
        const { partyMember } = await createPartyAndPartyMember(null, 'John Papa');
        const previousPersonApplication = await createAPersonApplication(
          { applicationData: { firstName: 'John', haveInternationalAddress: true, addressLine: '742 Evergreen Terrace' } },
          partyMember.personId,
          partyMember.partyId,
          newId(),
        );

        await removePartyMember({
          ...ctx,
          params: { partyId: partyMember.partyId, memberId: partyMember.id },
          body: {
            notes: 'Removed by party type conversion',
          },
        });

        const personApplication = {
          personId: previousPersonApplication.personId,
          partyId: previousPersonApplication.partyId,
          partyApplicationId: previousPersonApplication.partyApplicationId,
          paymentCompleted: false,
          applicationData: {
            firstName: 'John Papa',
            haveInternationalAddress: false,
            addressLine1: 'Evergreen Terrace 1',
            addressLine2: 'Evergreen Terrace 2',
            email: 'john+test@reva.tech',
            dateOfBirth: '01/01/1990',
            city: 'Springfield',
            state: 'Illinois',
            zip: '0011',
          },
        };

        await createOrUpdatePersonApplication(personApplication)
          .expect(404)
          .expect(res => expect(res.body.token).to.equal('PARTY_MEMBER_REMOVED'))
          .expect(res => expect(res.body.data.partyId).to.equal(partyMember.partyId))
          .expect(res => expect(res.body.data.applicantName).to.equal('John Papa'));
      });
    });

    describe('when a person application is related to a closed party', () => {
      it('responds with status code 404 and the token PARTY_MEMBER_REMOVED', async () => {
        const { partyMember } = await createPartyAndPartyMember(null, 'John Papa');
        const previousPersonApplication = await createAPersonApplication(
          { applicationData: { firstName: 'John', haveInternationalAddress: true, addressLine: '742 Evergreen Terrace' } },
          partyMember.personId,
          partyMember.partyId,
          newId(),
        );

        await closeParty(ctx, partyMember.partyId, DALTypes.ClosePartyReasons.NO_LONGER_MOVING);

        const personApplication = {
          personId: previousPersonApplication.personId,
          partyId: previousPersonApplication.partyId,
          partyApplicationId: previousPersonApplication.partyApplicationId,
          paymentCompleted: false,
          applicationData: {
            firstName: 'John Papa',
            haveInternationalAddress: false,
            addressLine1: 'Evergreen Terrace 1',
            addressLine2: 'Evergreen Terrace 2',
            email: 'john+test@reva.tech',
            dateOfBirth: '01/01/1990',
            city: 'Springfield',
            state: 'Illinois',
            zip: '0011',
          },
        };

        await createOrUpdatePersonApplication(personApplication)
          .expect(404)
          .expect(res => expect(res.body.token).to.equal('PARTY_CLOSED'))
          .expect(res => expect(res.body.data.partyId).to.equal(partyMember.partyId))
          .expect(res => expect(res.body.data.applicantName).to.equal('John Papa'));
      });
    });
  });

  context('PATCH api/personApplications', () => {
    describe("when a person application id isn't valid", () => {
      it('responds with status code 400 and INVALID_PERSON_APPLICANT_ID token', async () => {
        const personApplication = { id: 'wrongId' };
        await updatePersonApplication(personApplication)
          .expect(400)
          .expect(res => expect(res.body.token).to.equal('INVALID_PERSON_APPLICANT_ID'));
      });
    });

    describe("when a person application doesn't exist", () => {
      it('responds with status code 404 and PERSON_APPLICATION_NOT_FOUND token', async () => {
        const personApplication = { id: newId() };
        await updatePersonApplication(personApplication)
          .expect(404)
          .expect(res => expect(res.body.token).to.equal('PERSON_APPLICATION_NOT_FOUND'));
      });
    });

    describe('when a person application id is updated', () => {
      it('responds with status code 400 and INVALID_PERSON_APPLICANT_ID token', async () => {
        const personApplication = await createAPersonApplication({ applicationData: { firstName: 'Name' } }, newId(), newId(), newId());
        personApplication.id = 'wrongId';

        await updatePersonApplication(personApplication)
          .expect(400)
          .expect(res => expect(res.body.token).to.equal('INVALID_PERSON_APPLICANT_ID'));
      });
    });

    describe('when a person application is updated', () => {
      it('responds with status code 200 and has updated values', async () => {
        const personApplication = await createAPersonApplication({ applicationData: { firstName: 'Name' } }, newId(), newId(), newId());
        personApplication.applicationData.firstName = 'New name';

        await updatePersonApplication(personApplication)
          .expect(200)
          .expect(res => expect(res.body.id).to.equal(personApplication.id))
          .expect(res => expect(res.body.applicationData.firstName).to.equal(personApplication.applicationData.firstName));
      });
    });
  });

  // TODO: disabling this test, which is not written correctly.  It sets the userId in the token to the commonUserId,
  // mixing the concepts of employee and applicant.  As a result, it generates a 500 when attempting to verify
  // user id
  context.skip('GET personApplications/:personApplicationId:/documents', () => {
    describe('when a person application is getting documents', () => {
      let personApplication;
      const documentsIds = [newId(), newId()];
      const category = 'Documents';

      beforeEach(async () => {
        const newParty = await createAParty();
        personApplication = await createAPersonApplication({ firstName: 'Name' }, newId(), newParty.id, newId());
        const otherPersonApplication = await createAPersonApplication({ firstName: 'Name' }, newId(), newId(), newId());

        const uploadingUser = {
          exp: 1480886307,
          iat: 1480627107,
          tenantId: ctx.tenantId,
          commonUserId: createdUser.id,
          partyApplicationId: personApplication.partyApplicationId,
          personApplicationId: personApplication.id,
        };

        const otherUploadingUser = {
          exp: 1480886307,
          iat: 1480627107,
          tenantId: ctx.tenantId,
          commonUserId: newId(),
          partyApplicationId: otherPersonApplication.partyApplicationId,
          personApplicationId: otherPersonApplication.id,
        };

        await Promise.all(
          documentsIds.map(async id => {
            const documentToSave = {
              uuid: id,
              metadata: {
                file: { id, originalName: 'fileName1' },
                category,
                document: {
                  uploadingUser,
                },
              },
            };

            const rentappDocument = {
              documentId: id,
              accessType: 'private',
              metadata: {
                document: {
                  uploadingUser,
                },
                file: { id, originalName: 'fileName1' },
              },
            };

            await createADocument(ctx, documentToSave);
            await createRentappDocument(ctx, personApplication.id, rentappDocument);
          }),
        );

        const otherDocument = {
          documentId: newId(),
          accessType: 'private',
          metadata: {
            document: {
              uploadingUser: otherUploadingUser,
            },
            file: { originalName: 'otherDoc.png' },
          },
        };
        await createRentappDocument(ctx, otherPersonApplication.id, otherDocument);
      });

      it('should return the documents related to the person', async () => {
        const result = await getDocumentsForPersonApplication(personApplication.id, createdUser.id);

        expect(result.status).to.equal(200);
        expect(result.body).to.be.an('array');
        expect(result.body).to.have.lengthOf(2);

        result.body.forEach(res => {
          expect(res.file.id).to.be.oneOf(documentsIds);
          expect(res.document.uploadingUser.personApplicationId).to.equal(personApplication.id);
          expect(res.category).to.equal(category);
        });
      });
    });
  });
});
