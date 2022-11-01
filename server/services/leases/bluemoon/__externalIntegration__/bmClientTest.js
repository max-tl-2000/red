/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/* eslint-disable camelcase */

import chai from 'chai';
import chaistring from 'chai-string';
const { expect } = chai;
chai.use(chaistring);

import logger from '../../../../../common/helpers/logger';
import sleep from '../../../../../common/helpers/sleep';
import apiClient from '../apiClient';
import { cleanupBluemoon } from '../cleanup/cleanBluemoon';
import { createBluemoonAuth } from '../bluemoonUtils';

const ctx = { tenantId: 'testTenantId' };

const TEST_REVA_PROPERTY_ID = 'revaId';
const TEST_PROPERTY_ID = 6715;
const NO_REVA_LEASE_ID = null; // this is so we won't attempt to save the req/resp
const TEST_USERNAME = 'developer@intest';
const TEST_PASSWORD = 'import';
const SIGNER_EMAIL = 'john.smith@noone.com';

const signers = [
  {
    email: SIGNER_EMAIL,
  },
];

describe('createLease flow', async () => {
  let leaseId;
  let esigRequestId;

  before(async () => {
    // Create a token for the APIs so that the tokenMagr does not use the database, and we can still test the APIs
    await createBluemoonAuth(ctx, TEST_PROPERTY_ID, TEST_REVA_PROPERTY_ID, TEST_USERNAME, TEST_PASSWORD);
  });

  it('should fetch the formset a property', async () => {
    const formset = await apiClient.getFormSet(ctx, TEST_REVA_PROPERTY_ID, TEST_PROPERTY_ID);
    const { forms, fields } = formset;
    const { lease: leaseForms } = forms;
    // TODO: add check of custom forms
    expect(leaseForms).to.be.ok;
    expect(leaseForms.find(f => f.name === 'APTLEASE')).to.be.ok;
    expect(fields).to.be.ok;
    expect(fields.find(f => f.name === 'washer_dryer_special_provisions')).to.be.ok;
  });

  it('should create a lease successfully', async () => {
    logger.debug('about to create a lease');
    const propertyId = TEST_PROPERTY_ID;
    const standardFields = {
      address: '123 Main St',
      date_of_lease: '2019-07-12',
      lease_begin_date: '2019-07-12',
      days_prorated: 19,
      lease_end_date: '2020-07-31',
      prorated_rent: 627,
      prorated_rent_per_day: 33,
      rent: 1000,
      // note - number of residents must match signers above
      resident_1: 'John Smith',
      // resident_2: 'Bob Jones',
      unit_number: '100A',
    };
    const customFields = {
      email_address: SIGNER_EMAIL,
    };
    /* sample response:
      "id": 82214187,
      "success": true,
      "message": "Lease created.",
      "errors": {},
      "property_id": 6715,
      "created_at": "2021-10-18T17:24:07+00:00",
      "updated_at": "2021-10-18T17:24:07+00:00",
      "renewed": false,
      "printed": false,
      "renewal_printed": false,
      "editable": true,
      "standard": { ... }
      "custom": { ... }
    */

    leaseId = await apiClient.createLease(ctx, TEST_REVA_PROPERTY_ID, NO_REVA_LEASE_ID, propertyId, standardFields, customFields);
    logger.info({ leaseId }, 'apiClient returned lease');
    expect(leaseId).to.be.a('string');
  });

  it('should create a signature request successfully', async () => {
    const FORM_NAMES = ['APTLEASE'];
    expect(leaseId).not.to.be.undefined;
    esigRequestId = await apiClient.createLeaseESignatureRequest(ctx, TEST_REVA_PROPERTY_ID, NO_REVA_LEASE_ID, leaseId, FORM_NAMES, signers);
    logger.info({ esigRequestId }, 'Got request id');
    expect(esigRequestId).to.be.a('string');
  });

  it('should fetch the signature request status', async () => {
    expect(esigRequestId).not.to.be.undefined;
    logger.info('starting should fetch the signature request status - sleeping for a bit');
    // IMPORTANT:  the esignature takes a brief amount of time (under 2 seconds?) to generate.  Until then
    // the esign block (which contains the signature URL's) will not be available.
    await sleep(5000);
    const signerStatuses = await apiClient.getLeaseESignatureRequest(ctx, TEST_REVA_PROPERTY_ID, NO_REVA_LEASE_ID, 'TODOenvelopId', esigRequestId);
    expect(signerStatuses).to.have.length(2); // 1 resident -- 1 countersigner
    const residentStatus = signerStatuses.find(ss => ss.clientUserId === 'Resident1');
    expect(residentStatus).to.be.ok;
    expect(residentStatus.recipientStatus).to.equal('');
    expect(residentStatus.signatureLink).to.startWith('https:');
  });

  it('should fetch the pdf for a lease', async () => {
    const doc = await apiClient.getPdf(ctx, TEST_REVA_PROPERTY_ID, leaseId, esigRequestId, '/tmp/foo.pdf');
    expect(doc).to.be.ok;
  });

  it.skip('should execute a lease', async () => {
    const ownerName = 'Test Owner';
    const ownerInitials = 'TO';
    const ownerTitle = 'Head Honcho';

    const executeResponse = await apiClient.executeLease(ctx, TEST_REVA_PROPERTY_ID, NO_REVA_LEASE_ID, 6074379, ownerName, ownerInitials, ownerTitle);
    expect(executeResponse.executed).to.be.true;
  });

  it('should retrieve the list of all eSignature statuses', async () => {
    const statuses = await apiClient.getAllESignatureStatuses(ctx, TEST_REVA_PROPERTY_ID);
    expect(statuses).to.be.ok;
  });

  after(async () => {
    await cleanupBluemoon(SIGNER_EMAIL);
  });
});
