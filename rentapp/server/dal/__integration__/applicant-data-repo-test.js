/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import getUUID from 'uuid/v4';
import { expect } from 'chai';
import { now } from '../../../../common/helpers/moment-utils';
import { createAPerson, createAProperty, testCtx } from '../../../../server/testUtils/repoHelper';
import {
  createApplicantData as createApplicantDataDAL,
  getActiveApplicantDataByPersonId,
  getApplicantDataHistoryByPersonId,
  updateApplicantData,
} from '../applicant-data-repo.ts';

describe('dal/applicant-data-repo', () => {
  const createApplicantData = async ({ personId, propertyId, endDate } = {}) => {
    const person = (personId && { id: personId }) || (await createAPerson());
    const property = (propertyId && { id: propertyId }) || (await createAProperty());

    const dataTimestamp = now();
    const applicationData = { email: 'email@reva.tech', phone: '15555555555', lastName: 'Lastname', firstName: 'Firstname' };
    const applicationDataTimestamps = { email: dataTimestamp, phone: dataTimestamp, lastName: dataTimestamp, firstName: dataTimestamp };
    const applicationDataDiff = applicationData;

    const applicantData = {
      personId: person.id,
      propertyId: property.id,
      applicationData,
      applicationDataTimestamps,
      applicationDataDiff,
      startDate: now(),
      endDate,
    };

    return {
      applicantData: await createApplicantDataDAL(testCtx, applicantData),
      person,
      property,
    };
  };

  const endDate = now();
  let personOne;
  let personTwo;
  let aProperty;

  const initApplicantData = async () => {
    personOne = await createAPerson();
    personTwo = await createAPerson();
    aProperty = await createAProperty();

    const personApplicationData = [
      { personId: personOne.id, propertyId: aProperty.id, endDate },
      { personId: personOne.id, propertyId: aProperty.id, endDate },
      { personId: personOne.id, propertyId: aProperty.id },
      { personId: personTwo.id, propertyId: aProperty.id, endDate },
      { personId: personTwo.id, propertyId: aProperty.id },
    ];

    return await mapSeries(personApplicationData, async applicantData => await createApplicantData(applicantData));
  };

  describe('Given a person applicant data', () => {
    it('should save the applicant data to the database', async () => {
      const { applicantData, person, property } = await createApplicantData();

      expect(applicantData).to.not.be.undefined;
      expect(applicantData.id).to.not.be.undefined;
      expect(applicantData.personId).to.equal(person.id);
      expect(applicantData.propertyId).to.equal(property.id);
    });

    it('should update the applicant data', async () => {
      const { applicantData, person, property } = await createApplicantData();

      expect(applicantData).to.not.be.undefined;
      expect(applicantData.endDate).to.be.null;
      expect(applicantData.created_at.getTime()).to.equal(applicantData.updated_at.getTime());

      applicantData.endDate = now();
      const [updatedApplicantData] = await updateApplicantData(testCtx, applicantData.id, applicantData);

      expect(updatedApplicantData).to.not.be.emtpy;
      expect(updatedApplicantData.id).to.equal(applicantData.id);
      expect(updatedApplicantData.endDate).to.not.be.null;
      expect(updatedApplicantData.personId).to.equal(person.id);
      expect(updatedApplicantData.propertyId).to.equal(property.id);
      expect(updatedApplicantData.created_at.getTime()).to.not.equal(updatedApplicantData.updated_at.getTime());
    });

    it('should get the applicant data from the database', async () => {
      const { applicantData: savedApplicantData, person, property } = await createApplicantData();
      const applicantData = await getActiveApplicantDataByPersonId(testCtx, person.id);

      expect(applicantData).to.not.be.undefined;
      expect(applicantData.id).to.equal(savedApplicantData.id);
      expect(applicantData.personId).to.equal(person.id);
      expect(applicantData.propertyId).to.equal(property.id);
    });

    it('should get empty applicant data for a person lacking an application', async () => {
      const person = await createAPerson();
      const applicantData = await getActiveApplicantDataByPersonId(testCtx, person.id);
      expect(applicantData).to.be.empty;
    });

    it('should get the active applicant data for a person with an application', async () => {
      await initApplicantData();

      let activeApplicantData = await getActiveApplicantDataByPersonId(testCtx, personOne.id);
      expect(activeApplicantData).to.not.be.empty;
      expect(activeApplicantData.personId).to.equal(personOne.id);
      expect(activeApplicantData.endDate).to.be.null;

      activeApplicantData = await getActiveApplicantDataByPersonId(testCtx, personTwo.id);
      expect(activeApplicantData).to.not.be.empty;
      expect(activeApplicantData.personId).to.equal(personTwo.id);
      expect(activeApplicantData.endDate).to.be.null;
    });

    it("should get a person's applicant data history", async () => {
      await initApplicantData();

      let applicantDataHistory = await getApplicantDataHistoryByPersonId(testCtx, personOne.id);
      expect(applicantDataHistory).to.not.be.empty;
      expect(applicantDataHistory.length).to.equal(3);
      expect(applicantDataHistory.every(applicantData => applicantData.personId === personOne.id)).to.be.true;

      applicantDataHistory = await getApplicantDataHistoryByPersonId(testCtx, personTwo.id);
      expect(applicantDataHistory).to.not.be.empty;
      expect(applicantDataHistory.length).to.equal(2);
      expect(applicantDataHistory.every(applicantData => applicantData.personId === personTwo.id)).to.be.true;

      applicantDataHistory = await getApplicantDataHistoryByPersonId(testCtx, getUUID());
      expect(applicantDataHistory).to.be.empty;
    });
  });
});
