/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import getUUID from 'uuid/v4';
import { expect } from 'chai';
import { createAPerson, createAParty, testCtx } from '../../../../server/testUtils/repoHelper';
import { createAPartyApplication } from '../../test-utils/repo-helper';
import {
  createApplicantDataNotCommitted as createApplicantDataNotCommittedDAL,
  updateApplicantDataNotCommitted,
  getApplicantDataNotCommittedByPersonIdAndPartyId,
  getApplicantDataNotCommittedByPersonIdAndPartyApplicationId,
} from '../applicant-data-not-committed-repo.ts';

describe('dal/applicant-data-not-committed-repo', () => {
  const createApplicantDataNotCommitted = async ({ personId, partyId } = {}) => {
    const person = (personId && { id: personId }) || (await createAPerson());
    const party = (partyId && { id: partyId }) || (await createAParty());
    const partyApplication = await createAPartyApplication(party.id, getUUID(), {}, testCtx.tenantId);

    const applicationData = { email: 'email@reva.tech', phone: '15555555555', lastName: 'Lastname', firstName: 'Firstname' };

    const applicantDataNotCommitted = {
      personId: person.id,
      partyId: party.id,
      partyApplicationId: partyApplication.id,
      applicationData,
    };

    return {
      applicantDataNotCommitted: await createApplicantDataNotCommittedDAL(testCtx, applicantDataNotCommitted),
      partyApplication,
      person,
      party,
    };
  };

  describe('Given non committed applicant data', () => {
    it('should save the applicant data', async () => {
      const { applicantDataNotCommitted, person, party } = await createApplicantDataNotCommitted();

      expect(applicantDataNotCommitted).to.not.be.undefined;
      expect(applicantDataNotCommitted.id).to.not.be.undefined;
      expect(applicantDataNotCommitted.personId).to.equal(person.id);
      expect(applicantDataNotCommitted.partyId).to.equal(party.id);
    });

    it('should update the applicant data', async () => {
      const { applicantDataNotCommitted, person, party } = await createApplicantDataNotCommitted();

      expect(applicantDataNotCommitted).to.not.be.undefined;
      expect(applicantDataNotCommitted.created_at.getTime()).to.equal(applicantDataNotCommitted.updated_at.getTime());

      const updatedApplicationData = { ...applicantDataNotCommitted.applicationData, firstName: 'John', lastName: 'Smith' };
      applicantDataNotCommitted.applicationData = updatedApplicationData;

      const [updatedApplicantDataNotCommitted] = await updateApplicantDataNotCommitted(testCtx, applicantDataNotCommitted.id, applicantDataNotCommitted);

      expect(updatedApplicantDataNotCommitted).to.not.be.emtpy;
      expect(updatedApplicantDataNotCommitted.id).to.equal(applicantDataNotCommitted.id);
      expect(updatedApplicantDataNotCommitted.endDate).to.not.be.null;
      expect(updatedApplicantDataNotCommitted.personId).to.equal(person.id);
      expect(updatedApplicantDataNotCommitted.partyId).to.equal(party.id);
      expect(updatedApplicantDataNotCommitted.created_at.getTime()).to.not.equal(updatedApplicantDataNotCommitted.updated_at.getTime());
      expect(updatedApplicantDataNotCommitted.applicationData).to.deep.equal(updatedApplicationData);
    });

    it('should get the applicant data from the database using the person id and party id', async () => {
      const { applicantDataNotCommitted: savedApplicantDataNotCommitted, person, party } = await createApplicantDataNotCommitted();
      const applicantDataNotCommitted = await getApplicantDataNotCommittedByPersonIdAndPartyId(testCtx, person.id, party.id);

      expect(applicantDataNotCommitted).to.not.be.undefined;
      expect(applicantDataNotCommitted.id).to.equal(savedApplicantDataNotCommitted.id);
      expect(applicantDataNotCommitted.personId).to.equal(person.id);
      expect(applicantDataNotCommitted.partyId).to.equal(party.id);
    });

    it('should get the applicant data from the database using the person id and party application id', async () => {
      const { applicantDataNotCommitted: savedApplicantDataNotCommitted, person, party, partyApplication } = await createApplicantDataNotCommitted();
      const applicantDataNotCommitted = await getApplicantDataNotCommittedByPersonIdAndPartyApplicationId(testCtx, person.id, partyApplication.id);

      expect(applicantDataNotCommitted).to.not.be.undefined;
      expect(applicantDataNotCommitted.id).to.equal(savedApplicantDataNotCommitted.id);
      expect(applicantDataNotCommitted.personId).to.equal(person.id);
      expect(applicantDataNotCommitted.partyId).to.equal(party.id);
      expect(applicantDataNotCommitted.partyApplicationId).to.equal(partyApplication.id);
    });

    it('should get empty applicant data for a person lacking an application from a given party', async () => {
      const person = await createAPerson();
      const party = await createAParty();
      const applicantDataNotCommitted = await getApplicantDataNotCommittedByPersonIdAndPartyId(testCtx, person.id, party.id);
      expect(applicantDataNotCommitted).to.be.empty;
    });

    it('should get empty applicant data for a person lacking an application from a given party application', async () => {
      const person = await createAPerson();
      const party = await createAParty();
      const partyApplicationId = getUUID();
      const partyApplication = await createAPartyApplication(party.id, partyApplicationId, {}, testCtx.tenantId);
      const applicantDataNotCommitted = await getApplicantDataNotCommittedByPersonIdAndPartyApplicationId(testCtx, person.id, partyApplication.id);
      expect(applicantDataNotCommitted).to.be.empty;
    });
  });
});
