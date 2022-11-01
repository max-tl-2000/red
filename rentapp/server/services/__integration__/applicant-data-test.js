/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import * as sinon from 'sinon';
import proxyquire from 'proxyquire';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { testCtx as ctx, createAPerson, createAProperty } from '../../../../server/testUtils/repoHelper';
import { now } from '../../../../common/helpers/moment-utils';

chai.use(chaiAsPromised);
const { expect } = chai;

describe('Given a person application', () => {
  let saveApplicantData;
  const initialApplicationData = { email: 'email@reva.tech', phone: '15555555555', lastName: 'Lastname', firstName: 'Firstname' };
  let person;
  let property;

  beforeEach(async () => {
    person = await createAPerson();
    property = await createAProperty();

    saveApplicantData = proxyquire('../applicant-data.ts', {
      '../screening/v2/applicant-report': {
        refreshApplicantReports: sinon.stub().returns([]),
      },
    }).saveApplicantData;
  });

  const getApplicantDataObj = (personId, propertyId, applicationData) => ({
    personId,
    propertyId,
    applicationData,
    startDate: now().toDate(),
  });

  it('should create new applicant data when the person has no applicant data', async () => {
    const applicantData = getApplicantDataObj(person.id, property.id, initialApplicationData);

    const newApplicantData = await saveApplicantData(ctx, applicantData);

    expect(newApplicantData).to.not.be.empty;
    expect(newApplicantData.id).to.not.be.null;
    expect(newApplicantData.applicationDataDiff).to.not.be.empty;
    expect(newApplicantData.applicationDataDiff).to.deep.equal(initialApplicationData);
    expect(newApplicantData.applicationDataTimestamps).to.not.be.empty;
    expect(Object.keys(newApplicantData.applicationDataTimestamps).length === Object.keys(newApplicantData.applicationDataDiff).length).to.be.true;
    expect(newApplicantData.personId).to.equal(person.id);
    expect(newApplicantData.propertyId).to.equal(property.id);
  });

  it('should create new applicant data when the applicant data has changed', async () => {
    const applicantData = getApplicantDataObj(person.id, property.id, initialApplicationData);

    const existingApplicantData = await saveApplicantData(ctx, applicantData);
    const changedApplicationData = { lastName: 'John', firstName: 'Doe' };

    const updatedApplicantData = {
      ...applicantData,
      applicationData: { ...initialApplicationData, ...changedApplicationData },
    };

    const newApplicantData = await saveApplicantData(ctx, updatedApplicantData);
    expect(newApplicantData).to.not.be.empty;
    expect(newApplicantData.applicationDataDiff).to.not.be.empty;
    expect(newApplicantData.applicationDataDiff).to.deep.equal(changedApplicationData);
    expect(newApplicantData.applicationDataTimestamps).to.not.be.empty;
    expect(Object.keys(newApplicantData.applicationDataTimestamps).length === Object.keys(existingApplicantData.applicationDataTimestamps).length).to.be.true;
    expect(newApplicantData.applicationDataTimestamps.email === newApplicantData.applicationDataTimestamps.phone).to.be.true;
    expect(newApplicantData.applicationDataTimestamps.lastName === newApplicantData.applicationDataTimestamps.firstName).to.be.true;
    expect(newApplicantData.id).to.not.equal(existingApplicantData.id);
    expect(newApplicantData.propertyId).to.equal(existingApplicantData.propertyId);
    expect(newApplicantData.personId).to.equal(person.id);
    expect(newApplicantData.propertyId).to.equal(property.id);
  });

  it('should not create new applicant data when the applicant data has not changed', async () => {
    const applicantData = getApplicantDataObj(person.id, property.id, initialApplicationData);
    const existingApplicantData = await saveApplicantData(ctx, applicantData);

    const noNewApplicantData = await saveApplicantData(ctx, existingApplicantData);
    expect(noNewApplicantData).to.not.be.empty;
    expect(noNewApplicantData).to.deep.equal(existingApplicantData);
  });

  it('should throw an error when applicant data cannot be saved', async () => {
    let applicantData = getApplicantDataObj(undefined, property.id, initialApplicationData);
    let result = saveApplicantData(ctx, applicantData);
    expect(result).to.be.rejectedWith(Error);

    applicantData = getApplicantDataObj(person.id, undefined, initialApplicationData);
    result = saveApplicantData(ctx, applicantData);
    expect(result).to.be.rejectedWith(Error);

    applicantData = getApplicantDataObj(person.id, property.id, undefined);
    result = saveApplicantData(ctx, applicantData);
    expect(result).to.be.rejectedWith(Error);

    await saveApplicantData(ctx, getApplicantDataObj(person.id, property.id, initialApplicationData));

    applicantData = getApplicantDataObj(person.id, property.id, initialApplicationData);
    applicantData.startDate = undefined;
    result = saveApplicantData(ctx, applicantData);
    expect(result).to.be.rejectedWith(Error);
  });
});
