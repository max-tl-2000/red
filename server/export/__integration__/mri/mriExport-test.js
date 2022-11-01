/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import path from 'path';
import request from 'supertest';
import newId from 'uuid/v4';

import {
  createTestData,
  cleanUp,
  markAppointmentAsCompleted,
  getMatchingDocument,
  getPublishedLeaseData,
  executeLease,
  getSelectedInventories,
  payApplicationFee,
  waitForMessage,
  doExport,
} from '../exportTestHelper';
import { tenant } from '../../../testUtils/setupTestGlobalContext';
import { createAnAppointment, createAFee, createAPartyMember, createAnInventory } from '../../../testUtils/repoHelper';
import { DALTypes } from '../../../../common/enums/DALTypes';

import { getActiveExternalInfoByParty, updateExternalInfo, insertExternalInfo } from '../../../dal/exportRepo';
import { setPostXMLFunc, setGetXMLFunc } from '../../mri/mriIntegration';
import { ExportType, exportToMri } from '../../mri/export';
import { generateGuestCardsExportSteps, addIndex, getExternalInfo } from '../../mri/mri-export-utils';
import { SCREENING_MESSAGE_TYPE } from '../../../helpers/message-constants';
import { getData as getExportAppointmentData } from '../../mri/exportMriAppointmentCompleted';
import { getData as getExportLeaseData } from '../../mri/exportMriSignedLease';
import { getData as getExportPaymentData, getExportSteps } from '../../mri/exportMriApplicationPayment';
import { getData as getVoidLeaseData } from '../../mri/exportMriVoidedLease';
import { getData as getUnitHeldData } from '../../mri/exportMriUnitHeld';
import { getData as getEditLeaseData } from '../../mri/exportMRIEditedLease';
import { formatDateForMRI, formatUSDate, formatDateForConfirmLease, getConcessionEndDate } from '../../mri/mappers/utils';
import { holdInventory, releaseInventory } from '../../../services/inventories';

import { read } from '../../../../common/helpers/xfs';
import { fillHandlebarsTemplate } from '../../../../common/helpers/handlebars-utils';
import { now } from '../../../../common/helpers/moment-utils';
import { enhance } from '../../../../common/helpers/contactInfoUtils';
import trim from '../../../../common/helpers/trim';

import app from '../../../api/api';
import { getAuthHeader } from '../../../testUtils/apiHelper';
import { saveMriExportQueueMessage } from '../../../dal/mri-export-repo';

chai.use(sinonChai);
chai.use(chaiAsPromised);
const expect = chai.expect;

const ctx = { tenantId: tenant.id, authUser: {} };

export const validate = async (baselineFilename, actual, { user, property, nameId, unitId, leaseEndDate, leaseStartDate }) => {
  const baseline = await read(path.resolve(__dirname, `./xml/${baselineFilename}`));
  const templateParams = {
    userExternalUniqueId: user.externalUniqueId,
    today: formatDateForMRI(now({ timezone: property.timezone })), // 2018-06-07T00:00:00.0000000
    todayInUSFormat: formatUSDate(now({ timezone: property.timezone }), property.timezone),
    nameId,
    unitId,
    property: property.name,
    leaseEndDate: formatDateForConfirmLease(leaseEndDate, property.timezone),
    leaseStartDate: formatDateForConfirmLease(leaseStartDate, property.timezone),
    concessionEndDate: `'${getConcessionEndDate(leaseStartDate, property.timezone)}'`,
  };
  const expected = trim(await fillHandlebarsTemplate(baseline, templateParams));
  expect(expected, `${baselineFilename} failed equality check with expected value`).to.equal(trim(actual));
};

const setExternalInfo = async (nameId, partyId, data, appFeeAmount) => {
  const [externalInfo] = await getActiveExternalInfoByParty(ctx, { partyId });
  if (appFeeAmount) {
    externalInfo.metadata = {
      ...externalInfo.metadata,
      exportData: { payments: [appFeeAmount] },
    };
  }

  await updateExternalInfo(ctx, { id: externalInfo.id, externalId: nameId });

  if (data) {
    data.externalInfo.externalId = nameId;
  }
};

describe('MRI export tests', () => {
  let matcher;
  let party;
  let userId;
  let leaseTestData;
  let unit;

  const setup = async (data = {}) => {
    leaseTestData = await createTestData(data);
    party = leaseTestData.party;
    userId = leaseTestData.userId;
    matcher = leaseTestData.matcher;
    unit = leaseTestData.inventory;
  };

  const getRandomNameId = () => `HO00456${Math.floor(Math.random() * 999)}`;

  afterEach(cleanUp);

  const fakePostXML = ({ nameId, unitId, requests, leaseEndDate, leaseStartDate }) => async (_ctx, { xml }) => {
    const { user, property } = leaseTestData;
    const fakeRequest = requests.find(fr => !fr.done);
    const { reqFilename, respFilename } = fakeRequest;

    await validate(reqFilename, xml, { user, property, nameId, unitId, leaseEndDate, leaseStartDate });

    fakeRequest.done = true;

    const template = await read(path.resolve(__dirname, `./xml/${respFilename}`));
    return await fillHandlebarsTemplate(template, { NameID: nameId });
  };

  const makeRequests = (reqFilename, respFilename) => [{ reqFilename, respFilename }];

  beforeEach(async () => await setup({ backendMode: DALTypes.BackendMode.MRI }));

  const setupExportedParty = async () => {
    const primaryNameId = getRandomNameId();
    const secondResidentNameId = getRandomNameId();
    const guarantorNameId = getRandomNameId();
    const primary = leaseTestData.residents[0];

    const { property } = leaseTestData;
    const propertyId = property.id;

    // add a 2nd resident
    const residentCi = enhance([
      { type: 'email', value: 'test@reva.tech' },
      { type: 'phone', value: '12025550163' },
    ]);
    const secondResident = await createAPartyMember(party.id, {
      fullName: 'Tim Jones',
      contactInfo: residentCi,
      memberType: DALTypes.MemberType.RESIDENT,
    });

    await insertExternalInfo(ctx, { partyMemberId: primary.id, partyId: party.id, externalId: primaryNameId, propertyId, isPrimary: true });
    await insertExternalInfo(ctx, { partyMemberId: secondResident.id, partyId: party.id, externalId: secondResidentNameId, propertyId });
    await insertExternalInfo(ctx, { partyMemberId: leaseTestData.guarantors[0].id, partyId: party.id, externalId: guarantorNameId, propertyId });

    return { primary, primaryNameId };
  };

  const completeAppointment = async inventoryId => {
    const metadata = {};
    if (inventoryId) {
      metadata.inventories = [inventoryId];
    }

    const appointment = await createAnAppointment({
      partyId: party.id,
      salesPersonId: userId,
      metadata,
    });
    await markAppointmentAsCompleted(appointment.id, userId);

    return appointment;
  };

  const placeUnitOnHold = async (inventoryId, reason, quoteId, skipExportToMRI, leaseId) => {
    const inventoryOnHold = {
      inventoryId,
      partyId: party.id,
      reason,
      leaseId: leaseId || undefined,
      skipExportToMRI,
      quotable: false,
      quoteId,
    };

    await holdInventory(ctx, { ...inventoryOnHold });
  };

  const removePrimary = async primary => {
    const result = await request(app).delete(`/parties/${party.id}/members/${primary.id}`).set(getAuthHeader(tenant.id, userId));
    expect(result.statusCode).to.equal(200);
  };

  describe('when an appointment is completed', () => {
    const setupTest = async testParams => {
      const { nameId, requests, inventoryId } = testParams;
      const appointment = await completeAppointment(inventoryId);

      setPostXMLFunc(fakePostXML({ nameId, requests }));

      const doc = await getMatchingDocument(ctx, party.id, DALTypes.PartyEventType.APPOINTMENT_COMPLETED);
      const { document } = doc;

      return { document, appointment };
    };

    describe('and is the first appointment with an inventory', () => {
      it('should export a Guest Card and Residential Interactions', async () => {
        const nameId = getRandomNameId();
        const requests = [
          {
            reqFilename: '01 guestCard-req.xml',
            respFilename: '02 guestCard-resp.xml',
          },
          {
            reqFilename: '03 residentialInteractions-req.xml',
            respFilename: '04 residentialInteractions-resp.xml',
          },
        ];
        const { document, appointment } = await setupTest({ nameId, requests, inventoryId: leaseTestData.inventory.id });
        // export the 1st party member (the resident)
        const data = await getExportAppointmentData(ctx, document, appointment);
        const guestCardSteps = await generateGuestCardsExportSteps(ctx, document, data);
        const exportSteps = addIndex([guestCardSteps[0], ExportType.ResidentialInteractions]);
        await saveMriExportQueueMessage(ctx, {
          partyId: party.id,
          exportData: { exportSteps, data },
        });

        const payload = {
          msgCtx: ctx,
          partyId: party.id,
        };
        await exportToMri(payload);
      });
    });

    describe('and does not have an associated inventory', () => {
      it('should not export anything', async () => {
        const func = sinon.spy();
        setPostXMLFunc(func);
        await completeAppointment();

        await doExport(ctx, matcher, party, DALTypes.PartyEventType.APPOINTMENT_COMPLETED);

        expect(func, 'No calls to MRI should have been performed.').to.not.have.been.called;
      });
    });

    describe('and the primary resident is removed from the party', () => {
      it('should export new Guest Cards for all the party members', async () => {
        const { primary, primaryNameId } = await setupExportedParty();

        await removePrimary(primary);

        const requests = [
          {
            reqFilename: '/select another primary/01 guestCard-2nd-resident-req.xml',
            respFilename: '02 guestCard-resp.xml',
          },
          {
            reqFilename: '/select another primary/01 guestCard-guarantor-req.xml',
            respFilename: '02 guestCard-resp.xml',
          },
          {
            reqFilename: '03 residentialInteractions-req.xml',
            respFilename: '04 residentialInteractions-resp.xml',
          },
        ];
        const { document, appointment } = await setupTest({ primaryNameId, requests, inventoryId: leaseTestData.inventory.id });
        const data = await getExportAppointmentData(ctx, document, appointment);
        const guestCardSteps = await generateGuestCardsExportSteps(ctx, document, data);
        const exportSteps = addIndex([...guestCardSteps, ExportType.ResidentialInteractions]);
        await saveMriExportQueueMessage(ctx, {
          partyId: party.id,
          exportData: { exportSteps, data },
        });

        const payload = {
          msgCtx: ctx,
          partyId: party.id,
        };

        await exportToMri(payload);
      });
    });

    describe('and the primary resident is moved to guarantors', () => {
      xit('should export new Guest Cards for all the party members', async () => {
        const { primary, primaryNameId } = await setupExportedParty();

        // move the primary resident to guarantors
        const result = await request(app)
          .patch(`/parties/${party.id}/members/${primary.id}`)
          .set(getAuthHeader(tenant.id, userId))
          .send({ memberType: DALTypes.MemberType.GUARANTOR });

        expect(result.statusCode).to.equal(200);

        const requests = [
          {
            reqFilename: '/select another primary/01 guestCard-2nd-resident-req.xml',
            respFilename: '02 guestCard-resp.xml',
          },
          {
            reqFilename: '/select another primary/01 guestCard-guarantor-req.xml',
            respFilename: '02 guestCard-resp.xml',
          },
          {
            reqFilename: '/select another primary/01 guestCard-primary-to-guarantor-req.xml',
            respFilename: '02 guestCard-resp.xml',
          },
          {
            reqFilename: '03 residentialInteractions-req.xml',
            respFilename: '04 residentialInteractions-resp.xml',
          },
        ];
        const { document, appointment } = await setupTest({ nameId: primaryNameId, requests, inventoryId: leaseTestData.inventory.id });
        const data = await getExportAppointmentData(ctx, document, appointment);
        const guestCardSteps = await generateGuestCardsExportSteps(ctx, document, data);
        const exportSteps = addIndex([...guestCardSteps, ExportType.ResidentialInteractions]);

        await saveMriExportQueueMessage(ctx, {
          partyId: party.id,
          exportData: { exportSteps, data },
        });

        const payload = {
          msgCtx: ctx,
          partyId: party.id,
        };

        await exportToMri(payload);
      });
    });
  });

  describe('when a lease is signed by all members', () => {
    const setupLeaseTest = async setupParams => {
      const {
        nameId,
        unitId,
        requests,
        useFee,
        useOneTimeConcession,
        useRecurringConcession,
        useAdminFee,
        useUndergroundParkingRent,
        addPet,
        useSecurityDeposit,
      } = setupParams;

      const { property, concessions } = leaseTestData;
      const publishedLease = await getPublishedLeaseData({ propertyId: property.id, concessions, timezone: property.timezone });

      // set selected inventory (e.g. parking space inventory)
      const { additionalCharges, oneTimeCharges } = publishedLease;
      const chargeId = Object.keys(additionalCharges)[0];
      const charge = additionalCharges[chargeId];
      additionalCharges[`${leaseTestData.inventoryGroup.id}--${chargeId}`] = charge;

      // keep only one additional charges (for rentable items and fees)
      publishedLease.additionalCharges = {};
      publishedLease.oneTimeCharges = {};
      if (useFee) {
        const additionalCharge = {};
        additionalCharge[chargeId] = charge;
        publishedLease.additionalCharges = additionalCharge;
      }

      if (useSecurityDeposit) {
        const oneTimeChargeId = Object.keys(oneTimeCharges)[3];
        const oneTimeCharge = oneTimeCharges[oneTimeChargeId];
        const chargeToAdd = {};
        chargeToAdd[oneTimeChargeId] = oneTimeCharge;
        publishedLease.oneTimeCharges = chargeToAdd;
      }

      charge.selectedInventories = await getSelectedInventories();

      if (useOneTimeConcession || useRecurringConcession) {
        // Use only 1 concession.
        // The first one in the list is one-time, the 2nd is recurring. Choose one based on the sent flags.
        const index = useOneTimeConcession ? 0 : 1;
        const concessionId = Object.keys(publishedLease.concessions)[index];
        const concession = publishedLease.concessions[concessionId];
        concession.relativeAmount = 8.33;

        publishedLease.concessions = {};
        publishedLease.concessions[concessionId] = concession;
      } else {
        publishedLease.concessions = {};
      }

      if (useAdminFee) {
        const fee = await createAFee({
          propertyId: property.id,
          absolutePrice: 37,
          feeName: 'AdminFee',
          externalChargeCode: 'ADM',
        });
        fee.amount = fee.absolutePrice;

        publishedLease.oneTimeCharges[fee.id] = fee;
      }
      if (useUndergroundParkingRent) {
        const fee = await createAFee({
          propertyId: property.id,
          absolutePrice: 85,
          feeName: 'UndergroundParkingBaseRent',
          externalChargeCode: 'GAR',
        });
        fee.amount = fee.absolutePrice;
        publishedLease.additionalCharges[fee.id] = fee;
      }
      if (addPet) {
        const petDeposit = await createAFee({
          propertyId: property.id,
          absolutePrice: 75,
          feeName: 'PetDeposit',
          externalChargeCode: 'PET',
          feeType: 'deposit',
        });
        petDeposit.amount = petDeposit.absolutePrice;
        publishedLease.additionalCharges[petDeposit.id] = petDeposit;

        const petRent = await createAFee({
          propertyId: property.id,
          absolutePrice: 30,
          feeName: 'PetRent',
          externalChargeCode: 'PET',
          feeType: 'service',
        });
        petRent.amount = petRent.absolutePrice;
        publishedLease.additionalCharges[petRent.id] = petRent;
      }
      // sign the lease
      const lease = await executeLease(matcher, leaseTestData, publishedLease, false);
      const { leaseEndDate, leaseStartDate, moveInDate } = lease.baselineData.publishedLease;

      setPostXMLFunc(fakePostXML({ nameId, requests, unitId, leaseEndDate, leaseStartDate, moveInDate }));
      setGetXMLFunc(() => undefined);

      const doc = await getMatchingDocument(ctx, party.id, DALTypes.PartyEventType.LEASE_SIGNED);
      const { document } = doc;

      return { document, lease };
    };

    describe('and SelectUnit step return "The selected prospect is already assigned to the given Unit" error', () => {
      it('should mark SelectUnit as done and move to the next step in the export', async () => {
        const nameId = getRandomNameId();
        const requests = [
          {
            reqFilename: '05 guestCard-req.xml',
            respFilename: '02 guestCard-resp.xml',
          },
          {
            reqFilename: '06 petInformation-req.xml',
            respFilename: '07 petInformation-resp.xml',
          },
          {
            reqFilename: '08 vehicleInformation-req.xml',
            respFilename: '09 vehicleInformation-resp.xml',
          },
          {
            reqFilename: '10 selectUnit-req.xml',
            respFilename: '11 selectUnit-resp-error.xml',
          },
          {
            reqFilename: '12 rentDetails-req.xml',
            respFilename: '13 rentDetails-resp.xml',
          },
        ];
        const { document, lease } = await setupLeaseTest({
          nameId,
          unitId: unit.externalId || 'test-unit',
          requests,
        });
        const data = await getExportLeaseData(ctx, document, leaseTestData.partyId, lease.id);
        const guestCardSteps = await generateGuestCardsExportSteps(ctx, document, data, true);
        const exportSteps = addIndex([
          guestCardSteps[0],
          ExportType.PetInformation,
          ExportType.VehicleInformation,
          ExportType.SelectUnit,
          ExportType.RentDetails,
        ]);

        await saveMriExportQueueMessage(ctx, {
          partyId: party.id,
          exportData: { exportSteps, data },
        });

        const payload = {
          msgCtx: ctx,
          partyId: party.id,
        };
        await exportToMri(payload);
      });
    });

    describe('on a new lease workflow', () => {
      it('should export a Guest Card, PetInformation, VehicleInformation, RentDetails, RentableItemsAndFees, AcceptLease, ConfirmLease, AssignItems', async () => {
        const nameId = getRandomNameId();
        const requests = [
          {
            reqFilename: '05 guestCard-req.xml',
            respFilename: '02 guestCard-resp.xml',
          },
          {
            reqFilename: '01 guestCardChild-req.xml',
            respFilename: '02 guestCard-resp.xml',
          },
          {
            reqFilename: '06 petInformation-req.xml',
            respFilename: '07 petInformation-resp.xml',
          },
          {
            reqFilename: '08 vehicleInformation-req.xml',
            respFilename: '09 vehicleInformation-resp.xml',
          },
          {
            reqFilename: '12 rentDetails-req.xml',
            respFilename: '13 rentDetails-resp.xml',
          },
          {
            reqFilename: '22 rentables-req.xml',
            respFilename: '23 rentables-resp.xml',
          },
          {
            reqFilename: '22 rentables-concessions-req.xml',
            respFilename: '23 rentables-resp.xml',
          },
          {
            reqFilename: '14 acceptLease-req.xml',
            respFilename: '15 acceptLease-resp.xml',
          },
          {
            reqFilename: '16 confirmLease-req.xml',
            respFilename: '17 confirmLease-resp.xml',
          },
          {
            reqFilename: '18 assignItems-req.xml',
            respFilename: '19 assignItem-resp.xml',
          },
        ];
        const { document, lease } = await setupLeaseTest({
          nameId,
          unitId: unit.externalId || 'test-unit',
          requests,
          useFee: true,
          useOneTimeConcession: true,
          useSecurityDeposit: true,
        });
        const data = await getExportLeaseData(ctx, document, leaseTestData.partyId, lease.id);
        const guestCardSteps = await generateGuestCardsExportSteps(ctx, document, data, true);
        const exportSteps = addIndex([
          guestCardSteps[0],
          guestCardSteps[2],
          ExportType.PetInformation,
          ExportType.VehicleInformation,
          ExportType.RentDetails,
          ExportType.RentableItemsAndFees,
          ExportType.AcceptLease,
          ExportType.ConfirmLease,
          ExportType.AssignItems,
        ]);

        await saveMriExportQueueMessage(ctx, {
          partyId: party.id,
          exportData: { exportSteps, data },
        });

        const payload = {
          msgCtx: ctx,
          partyId: party.id,
        };
        await exportToMri(payload);
      });

      it('should export the concessions for the leased unit as RentableItemsAndFees ', async () => {
        const nameId = getRandomNameId();
        const requests = makeRequests('24 rentables concessions-req.xml', '23 rentables-resp.xml');
        const { document, lease } = await setupLeaseTest({ nameId, requests, useOneTimeConcession: true, useSecurityDeposit: true });

        const exportSteps = addIndex([ExportType.RentableItemsAndFees]);

        const data = await getExportLeaseData(ctx, document, leaseTestData.partyId, lease.id);
        await setExternalInfo(nameId, document.id, data);

        await saveMriExportQueueMessage(ctx, {
          partyId: party.id,
          exportData: { exportSteps, data },
        });

        const payload = {
          msgCtx: ctx,
          partyId: party.id,
        };
        await exportToMri(payload);
      });

      it('should not export a GAR fee through RentableItemsAndFees ', async () => {
        const nameId = getRandomNameId();
        const { document, lease } = await setupLeaseTest(
          { nameId, requests: makeRequests('22 rentables-req.xml', '23 rentables-resp.xml') },
          { useUndergroundParkingRent: true, useSecurityDeposit: true },
        );

        const exportSteps = addIndex([ExportType.RentableItemsAndFees]);

        const data = await getExportLeaseData(ctx, document, leaseTestData.partyId, lease.id);
        await setExternalInfo(nameId, document.id, data);

        await saveMriExportQueueMessage(ctx, {
          partyId: party.id,
          exportData: { exportSteps, data },
        });

        const payload = {
          msgCtx: ctx,
          partyId: party.id,
        };

        await exportToMri(payload);
      });

      it('should call ConfirmLease and fail if timeout message is received', async () => {
        const nameId = getRandomNameId();
        const requests = makeRequests('16 confirmLease-req.xml', '27 confirmLease-timeout-resp.xml');
        const { document, lease } = await setupLeaseTest({ nameId, requests, useOneTimeConcession: true, useSecurityDeposit: true });

        const exportSteps = addIndex([ExportType.ConfirmLease]);

        const data = await getExportLeaseData(ctx, document, leaseTestData.partyId, lease.id);
        await setExternalInfo(nameId, document.id, data);

        await saveMriExportQueueMessage(ctx, {
          partyId: party.id,
          exportData: { exportSteps, data },
        });

        const payload = {
          msgCtx: ctx,
          partyId: party.id,
        };
        const promise = exportToMri(payload);

        expect(promise).to.be.rejectedWith(
          Error,
          'Execution Timeout Expired.  The timeout period elapsed prior to completion of the operation or the server is not responding.',
        );
      });

      it('should call ConfirmLease and not fail if the response omits the Result tag', async () => {
        const nameId = getRandomNameId();
        const requests = makeRequests('16 confirmLease-req.xml', '28 confirmLease-noResultTag-resp.xml');
        const { document, lease } = await setupLeaseTest({ nameId, requests, useOneTimeConcession: true, useSecurityDeposit: true });

        const exportSteps = addIndex([ExportType.ConfirmLease]);

        const data = await getExportLeaseData(ctx, document, leaseTestData.partyId, lease.id);
        await setExternalInfo(nameId, document.id, data);

        await saveMriExportQueueMessage(ctx, {
          partyId: party.id,
          exportData: { exportSteps, data },
        });

        const payload = {
          msgCtx: ctx,
          partyId: party.id,
        };
        exportToMri(payload);

        const p = exportToMri(payload);
        expect(p).to.be.fullfilled;
      });

      it('should call ConfirmLease and send recurring concessions as RECURRING', async () => {
        const nameId = getRandomNameId();
        const requests = makeRequests('25 confirmLease recurring concessions-req.xml', '17 confirmLease-resp.xml');
        const { document, lease } = await setupLeaseTest({ nameId, requests, useRecurringConcession: true, useSecurityDeposit: true });

        const exportSteps = addIndex([ExportType.ConfirmLease]);

        const data = await getExportLeaseData(ctx, document, leaseTestData.partyId, lease.id);
        await setExternalInfo(nameId, document.id, data);

        await saveMriExportQueueMessage(ctx, {
          partyId: party.id,
          exportData: { exportSteps, data },
        });

        const payload = {
          msgCtx: ctx,
          partyId: party.id,
        };
        await exportToMri(payload);
      });

      it('should call ConfirmLease and send the amount for the Admin Fee', async () => {
        const nameId = getRandomNameId();
        const requests = makeRequests('29 confirmLease admin fee-req.xml', '17 confirmLease-resp.xml');
        const { document, lease } = await setupLeaseTest({ nameId, requests, useRecurringConcession: true, useAdminFee: true, useSecurityDeposit: true });

        const exportSteps = addIndex([ExportType.ConfirmLease]);

        const data = await getExportLeaseData(ctx, document, leaseTestData.partyId, lease.id);
        await setExternalInfo(nameId, document.id, data);

        await saveMriExportQueueMessage(ctx, {
          partyId: party.id,
          exportData: { exportSteps, data },
        });

        const payload = {
          msgCtx: ctx,
          partyId: party.id,
        };
        await exportToMri(payload);
      });

      describe('when there is a Pet fee added', () => {
        it('should export with ConfirmLease the Pet deposit and rent', async () => {
          const nameId = getRandomNameId();
          const requests = makeRequests('/ConfirmLease appfee/petDeposit-req.xml', '17 confirmLease-resp.xml');
          const { document, lease } = await setupLeaseTest({ nameId, requests, addPet: true, useSecurityDeposit: true });

          const exportSteps = addIndex([ExportType.ConfirmLease]);

          const data = await getExportLeaseData(ctx, document, leaseTestData.partyId, lease.id);
          await setExternalInfo(nameId, document.id, data);

          await saveMriExportQueueMessage(ctx, {
            partyId: party.id,
            exportData: { exportSteps, data },
          });

          const payload = {
            msgCtx: ctx,
            partyId: party.id,
          };
          await exportToMri(payload);
        });
      });

      describe('when there is an invoice for an application fee', () => {
        it('should export with ConfirmLease the total app fee amount for the party', async () => {
          const nameId = getRandomNameId();
          const requests = makeRequests('/ConfirmLease appfee/confirmLease 1 appfee paid-req.xml', '17 confirmLease-resp.xml');
          const { document, lease } = await setupLeaseTest({ nameId, requests, useSecurityDeposit: true });

          const exportSteps = addIndex([ExportType.ConfirmLease]);

          const invoice = {
            id: newId(),
            personApplicationId: document.personApplications[0].id,
            applicationFeeAmount: 55,
            applicationFeeWaiverAmount: 0,
            propertyId: leaseTestData.property.id,
            paymentCompleted: true,
          };
          document.invoices = [invoice];

          const data = await getExportLeaseData(ctx, document, leaseTestData.partyId, lease.id);
          await setExternalInfo(nameId, document.id, data, 50);

          await saveMriExportQueueMessage(ctx, {
            partyId: party.id,
            exportData: { exportSteps, data },
          });

          const payload = {
            msgCtx: ctx,
            partyId: party.id,
          };
          await exportToMri(payload);
        });
      });

      describe('when there are 2 invoices for application fees, but one is waived', () => {
        it('should export with ConfirmLease the total app fee amount for the party by subtracting the waived amount', async () => {
          const nameId = getRandomNameId();
          const requests = makeRequests('/ConfirmLease appfee/confirmLease 1 appfee paid-req.xml', '17 confirmLease-resp.xml');
          const { document, lease } = await setupLeaseTest({ nameId, requests, useSecurityDeposit: true });

          const exportSteps = addIndex([ExportType.ConfirmLease]);

          document.invoices = [
            {
              id: newId(),
              personApplicationId: document.personApplications[0].id,
              applicationFeeAmount: 55,
              applicationFeeWaiverAmount: 0,
              propertyId: leaseTestData.property.id,
              paymentCompleted: true,
            },
            {
              id: newId(),
              personApplicationId: document.personApplications[1].id,
              applicationFeeAmount: 55,
              applicationFeeWaiverAmount: 55,
              propertyId: leaseTestData.property.id,
              paymentCompleted: true,
            },
          ];

          const data = await getExportLeaseData(ctx, document, leaseTestData.partyId, lease.id);
          await setExternalInfo(nameId, document.id, data);

          await saveMriExportQueueMessage(ctx, {
            partyId: party.id,
            exportData: { exportSteps, data },
          });

          const payload = {
            msgCtx: ctx,
            partyId: party.id,
          };
          await exportToMri(payload);
        });
      });

      describe('when there is an invoice for the application fee, but for a different property', () => {
        it('should export with ConfirmLease the application fee amount as 0', async () => {
          const nameId = getRandomNameId();
          const requests = makeRequests('/ConfirmLease appfee/confirmLease zero appfee-req.xml', '17 confirmLease-resp.xml');
          const { document, lease } = await setupLeaseTest({ nameId, requests, useSecurityDeposit: true });

          const exportSteps = addIndex([ExportType.ConfirmLease]);

          document.invoices = [
            {
              id: newId(),
              personApplicationId: document.personApplications[1].id,
              applicationFeeAmount: 55,
              applicationFeeWaiverAmount: 0,
              propertyId: newId(),
              paymentCompleted: true,
            },
          ];

          const data = await getExportLeaseData(ctx, document, leaseTestData.partyId, lease.id);
          await setExternalInfo(nameId, document.id, data);

          await saveMriExportQueueMessage(ctx, {
            partyId: party.id,
            exportData: { exportSteps, data },
          });

          const payload = {
            msgCtx: ctx,
            partyId: party.id,
          };
          await exportToMri(payload);
        });
      });

      describe('when there all the application fees are waived', () => {
        it('should export the app fees with the ConfirmLease request', async () => {
          const nameId = getRandomNameId();
          const requests = makeRequests('/ConfirmLease appfee/confirmLease zero appfee-req.xml', '17 confirmLease-resp.xml');
          const { document, lease } = await setupLeaseTest({ nameId, requests, useSecurityDeposit: true });

          const exportSteps = addIndex([ExportType.ConfirmLease]);

          document.invoices = [
            {
              id: newId(),
              personApplicationId: document.personApplications[0].id,
              applicationFeeAmount: 55,
              applicationFeeWaiverAmount: 55,
              paymentCompleted: true,
            },
          ];

          const data = await getExportLeaseData(ctx, document, leaseTestData.partyId, lease.id);
          await setExternalInfo(nameId, document.id, data);

          await saveMriExportQueueMessage(ctx, {
            partyId: party.id,
            exportData: { exportSteps, data },
          });

          const payload = {
            msgCtx: ctx,
            partyId: party.id,
          };
          await exportToMri(payload);
        });
      });

      describe('when there are one time concessions ', () => {
        it('should call ConfirmLease and send one time concessions as RECURRING', async () => {
          const nameId = getRandomNameId();
          const requests = makeRequests('34 confirmLease nonRecurring concessions-req.xml', '17 confirmLease-resp.xml');
          const { document, lease } = await setupLeaseTest({
            nameId,
            requests,
            useOneTimeConcession: true,
          });

          const exportSteps = addIndex([ExportType.ConfirmLease]);

          const data = await getExportLeaseData(ctx, document, leaseTestData.partyId, lease.id);
          await setExternalInfo(nameId, document.id, data);

          await saveMriExportQueueMessage(ctx, {
            partyId: party.id,
            exportData: { exportSteps, data },
          });

          const payload = {
            msgCtx: ctx,
            partyId: party.id,
          };
          await exportToMri(payload);
        });
      });
    });
    describe('on a renewal lease workflow', () => {
      it('should export PetInformation, VehicleInformation, RenewalOffer, AcceptRenewalOffer', async () => {
        const nameId = getRandomNameId();
        const requests = [
          {
            reqFilename: '06 petInformation-req.xml',
            respFilename: '07 petInformation-resp.xml',
          },
          {
            reqFilename: '08 vehicleInformation-req.xml',
            respFilename: '09 vehicleInformation-resp.xml',
          },
          {
            reqFilename: '30 renewalOffer-req.xml',
            respFilename: '31 renewalOffer-resp.xml',
          },
          {
            reqFilename: '32 acceptRenewalOffer-req.xml',
            respFilename: '33 acceptRenewalOffer-resp.xml',
          },
        ];
        const { document, lease } = await setupLeaseTest({
          nameId,
          unitId: 'test-unit',
          requests,
          useFee: true,
          useOneTimeConcession: true,
          useSecurityDeposit: true,
          addPet: true,
        });
        const data = await getExportLeaseData(ctx, document, leaseTestData.partyId, lease.id);
        data.externalInfo.externalId = nameId;
        const exportSteps = addIndex([ExportType.PetInformation, ExportType.VehicleInformation, ExportType.RenewalOffer, ExportType.AcceptRenewalOffer]);
        await saveMriExportQueueMessage(ctx, {
          partyId: party.id,
          exportData: { exportSteps, data },
        });

        const payload = {
          msgCtx: ctx,
          partyId: party.id,
        };
        await exportToMri(payload);
      });
    });
  });

  describe('when a new application payment is processed', () => {
    const setupPaymentTest = async testParams => {
      const { nameId, requests } = testParams;
      setPostXMLFunc(fakePostXML({ nameId, requests }));
      setGetXMLFunc(() => undefined);

      const paymentTask = waitForMessage(matcher, SCREENING_MESSAGE_TYPE.PAYMENT_NOTIFICATION_RECEIVED);

      await payApplicationFee(leaseTestData);
      await paymentTask;

      const doc = await getMatchingDocument(ctx, party.id, DALTypes.PartyEventType.APPLICATION_PAYMENT_PROCESSED);
      const { document } = doc;

      return { document };
    };

    it('should export a Guest Card and a Payment', async () => {
      const nameId = getRandomNameId();
      const requests = [
        {
          reqFilename: '05 guestCard-noPaidApplication-req.xml',
          respFilename: '02 guestCard-resp.xml',
        },
        {
          reqFilename: '20 applicationPayment-req.xml',
          respFilename: '21 applicationPayment-resp.xml',
        },
      ];

      const { document } = await setupPaymentTest({ nameId, requests });

      const transactionId = '13000';
      const targetId = 1;

      const pm = document.members.find(member => member.partyMember.memberType === DALTypes.MemberType.RESIDENT);

      const data = await getExportPaymentData(ctx, document, { transactionId, targetId }, {}, pm.person.id);
      await setExternalInfo(nameId, document.id, data);

      const guestCardSteps = await generateGuestCardsExportSteps(ctx, document, data);
      const exportSteps = addIndex([guestCardSteps[0], ExportType.ApplicationPayment]);

      await saveMriExportQueueMessage(ctx, {
        partyId: party.id,
        exportData: { exportSteps, data },
      });

      const payload = {
        msgCtx: ctx,
        partyId: party.id,
      };

      await exportToMri(payload);
    });

    it('should fail if the response to an exported Payment is not Success', async () => {
      const nameId = getRandomNameId();
      const requests = makeRequests('20 applicationPayment-req.xml', '26 applicationPayment-fail-resp.xml');
      const { document } = await setupPaymentTest({ nameId, requests });

      const exportSteps = addIndex([ExportType.ApplicationPayment]);

      const transactionId = '13000';
      const targetId = 1;

      const pm = document.members.find(member => member.partyMember.memberType === DALTypes.MemberType.RESIDENT);
      const data = await getExportPaymentData(ctx, document, { transactionId, targetId }, {}, pm.person.id);

      await saveMriExportQueueMessage(ctx, {
        partyId: party.id,
        exportData: { exportSteps, data },
      });

      const payload = {
        msgCtx: ctx,
        partyId: party.id,
      };
      await setExternalInfo(nameId, document.id, data);

      const promise = exportToMri(payload);
      expect(promise).to.be.rejectedWith(Error, 'Failed');
    });

    it('should export a Payment with security code set as the fee externalChargeCode for hold account', async () => {
      const nameId = getRandomNameId();
      const requests = makeRequests('20 applicationPaymentHoldDeposit-req.xml', '21 applicationPayment-resp.xml');
      const { document } = await setupPaymentTest({ nameId, requests });

      const exportSteps = addIndex([ExportType.ApplicationDepositPayment]);

      const appFeeInvoice = { transactionId: '13000', targetId: 1 };
      const holdDepositInvoice = { transactionId: '13001', targetId: 2 };

      const pm = document.members.find(member => member.partyMember.memberType === DALTypes.MemberType.RESIDENT);
      const data = await getExportPaymentData(ctx, document, appFeeInvoice, holdDepositInvoice, pm.person.id);

      await saveMriExportQueueMessage(ctx, {
        partyId: party.id,
        exportData: { exportSteps, data },
      });

      const payload = {
        msgCtx: ctx,
        partyId: party.id,
      };
      await setExternalInfo(nameId, document.id, data);

      await exportToMri(payload);
    });

    it('should add a ApplicationDepositPayment export step', async () => {
      const nameId = getRandomNameId();
      const { document } = await setupPaymentTest(nameId, makeRequests('20 applicationPaymentHoldDeposit-req.xml', '21 applicationPayment-resp.xml'));

      let appFeeInvoice;
      const holdDepositInvoice = { transactionId: '13001', targetId: 2 };

      const pm = document.members.find(member => member.partyMember.memberType === DALTypes.MemberType.RESIDENT);
      const data = await getExportPaymentData(ctx, document, appFeeInvoice, holdDepositInvoice, pm.person.id);
      const exportSteps = await getExportSteps(ctx, document, { metadata: { holdDepositInvoice } }, data);

      expect(exportSteps.length).to.equal(3);
      expect(exportSteps[2].fileType === 'ApplicationDepositPayment');
    });

    describe('when we have an aptexx setup with target accounts only for application and not for hold deposit', () => {
      it('should correctly export the hold deposit if paid', async () => {
        const nameId = getRandomNameId();
        const requests = [
          {
            reqFilename: '05 guestCard-noPaidApplication-req.xml',
            respFilename: '02 guestCard-resp.xml',
          },
          {
            reqFilename: '20 applicationPayment-req.xml',
            respFilename: '21 applicationPayment-resp.xml',
          },
          {
            reqFilename: '20 applicationPaymentHoldDepositSameAccount-req.xml',
            respFilename: '21 applicationPaymentHoldDeposit-resp.xml',
          },
        ];

        const { document } = await setupPaymentTest({ nameId, requests });

        const { invoices } = document;
        const alteredInvoice = {
          ...invoices[0],
          holdDepositTransactionId: null,
        };

        const transactionId = '13000';
        const targetId = 1;

        const pm = document.members.find(member => member.partyMember.memberType === DALTypes.MemberType.RESIDENT);
        const data = await getExportPaymentData(ctx, { ...document, invoices: [alteredInvoice] }, { transactionId, targetId }, {}, pm.person.id);
        await setExternalInfo(nameId, document.id, data);

        const guestCardSteps = await generateGuestCardsExportSteps(ctx, document, data);
        const exportSteps = addIndex([guestCardSteps[0], ExportType.ApplicationPayment, ExportType.ApplicationDepositPayment]);

        await saveMriExportQueueMessage(ctx, {
          partyId: party.id,
          exportData: {
            exportSteps,

            data: {
              ...data,
              isHoldDepositTransaction: true,
            },
          },
        });

        const payload = {
          msgCtx: ctx,
          partyId: party.id,
        };

        await exportToMri(payload);
      });
    });
  });

  describe('when a lease is voided', () => {
    const voidLease = async lease =>
      await request(app).post(`/parties/${lease.partyId}/leases/${lease.id}/void`).set(getAuthHeader(tenant.id, userId)).send().expect(200);

    const setupVoidLeaseTest = async testParams => {
      const { nameId, requests, inventoryId, quoteId, unitId, unitOnHold } = testParams;

      setPostXMLFunc(fakePostXML({ nameId, requests, unitId }));
      setGetXMLFunc(() => undefined);

      const { property, concessions } = leaseTestData;
      const publishedLease = await getPublishedLeaseData({ propertyId: property.id, concessions, timezone: property.timezone });

      publishedLease.additionalCharges = {};
      publishedLease.oneTimeCharges = {};
      publishedLease.concessions = {};

      unitOnHold && (await placeUnitOnHold(inventoryId, DALTypes.InventoryOnHoldReason.MANUAL, quoteId, false));
      // sign the lease
      const lease = await executeLease(matcher, leaseTestData, publishedLease, false);

      await voidLease(lease);

      const doc = await getMatchingDocument(ctx, party.id, DALTypes.PartyEventType.LEASE_VOIDED);
      const { document } = doc;

      return { document, lease };
    };

    it('should send a VoidLease request', async () => {
      const nameId = getRandomNameId();

      const requests = [
        {
          reqFilename: '/void lease/voidLease-req.xml',
          respFilename: '/void lease/voidLease-resp.xml',
        },
      ];

      const { document, lease } = await setupVoidLeaseTest({ nameId, requests });
      const data = await getVoidLeaseData(ctx, document, lease.id);
      data.externalInfo.externalId = nameId;
      const exportSteps = addIndex([ExportType.VoidLease]);
      await saveMriExportQueueMessage(ctx, {
        partyId: party.id,
        exportData: { exportSteps, data },
      });

      const payload = {
        msgCtx: ctx,
        partyId: party.id,
      };
      await exportToMri(payload);
    });

    describe('and a unit was on hold before', () => {
      it('should send a VoidLease request together with a SelectUnitRequest', async () => {
        const nameId = getRandomNameId();

        const requests = [
          {
            reqFilename: '/void lease/voidLease-req.xml',
            respFilename: '/void lease/voidLease-resp.xml',
          },
          {
            reqFilename: '10 selectUnit-req.xml',
            respFilename: '11 selectUnit-resp.xml',
          },
        ];

        const { document, lease } = await setupVoidLeaseTest({
          nameId,
          requests,
          inventoryId: leaseTestData.inventory.id,
          quoteId: leaseTestData.quote.id,
          unitId: leaseTestData.inventory.externalId,
          unitOnHold: true,
        });

        const data = await getVoidLeaseData(
          ctx,
          document,
          lease.id,
          leaseTestData.inventory.id,
          leaseTestData.quote.publishedQuoteData.leaseTerms[0].termLength,
        );

        data.externalInfo.externalId = nameId;
        const exportSteps = addIndex([ExportType.VoidLease, ExportType.SelectUnit]);

        await saveMriExportQueueMessage(ctx, {
          partyId: party.id,
          exportData: { exportSteps, data },
        });

        const payload = {
          msgCtx: ctx,
          partyId: party.id,
        };
        await exportToMri(payload);
      });
    });
  });

  describe('when a party with 2 members was exported', () => {
    describe('and the primary resident is removed', () => {
      describe('when the party is exported again', () => {
        it('should export all existing members as new members', async () => {
          const { primary } = await setupExportedParty();
          await removePrimary(primary);

          await completeAppointment(leaseTestData.inventory.id);
          const doc = await getMatchingDocument(ctx, party.id, DALTypes.PartyEventType.APPOINTMENT_COMPLETED);
          const { document } = doc;

          const { externalInfo } = await getExternalInfo(ctx, document, null);
          expect(externalInfo.externalId).to.be.null;
        });
      });
    });
  });

  describe('when having a party with 2 completed appointments with inventory', () => {
    it('should export inventorygroup extrnalId from the first inventory appointment', async () => {
      const firstInventory = await createAnInventory();
      await completeAppointment(firstInventory.id);
      const firstAppointmentDoc = await getMatchingDocument(ctx, party.id, DALTypes.PartyEventType.APPOINTMENT_COMPLETED);
      const firstDocument = firstAppointmentDoc.document;

      expect(firstDocument.metadata.appointmentInventory.inventoryId).to.equal(firstInventory.id);

      await completeAppointment(leaseTestData.inventory.id);
      const secondAppointmentDoc = await getMatchingDocument(ctx, party.id, DALTypes.PartyEventType.APPOINTMENT_COMPLETED);
      const secondDocument = secondAppointmentDoc.document;

      expect(secondDocument.metadata.appointmentInventory.inventoryId).to.equal(firstInventory.id);
    });
  });

  describe('when a unit is held', () => {
    const setupTest = async testParams => {
      const { nameId, requests, inventoryId, quoteId, unitId } = testParams;

      await placeUnitOnHold(inventoryId, DALTypes.InventoryOnHoldReason.MANUAL, quoteId, false);

      setPostXMLFunc(fakePostXML({ nameId, requests, unitId }));

      const doc = await getMatchingDocument(ctx, party.id, DALTypes.PartyEventType.UNIT_HELD);
      const { document } = doc;

      return { document };
    };

    it('should export a Guest Card and SelectUnit', async () => {
      const nameId = getRandomNameId();
      const requests = [
        {
          reqFilename: '/hold unit/01 guestCard-hold-unit-req.xml',
          respFilename: '/hold unit/02 guestCard-hold-unit-resp.xml',
        },
        {
          reqFilename: '10 selectUnit-req.xml',
          respFilename: '11 selectUnit-resp.xml',
        },
      ];
      const { document } = await setupTest({
        nameId,
        requests,
        inventoryId: leaseTestData.inventory.id,
        quoteId: leaseTestData.quote.id,
        unitId: leaseTestData.inventory.externalId,
      });

      const data = await getUnitHeldData(ctx, {
        partyDocument: document,
        inventoryId: leaseTestData.inventory.id,
        leaseTermLength: leaseTestData.quote.publishedQuoteData.leaseTerms[0].termLength,
      });
      const guestCardSteps = await generateGuestCardsExportSteps(ctx, document, data);
      const exportSteps = addIndex([guestCardSteps[0], ExportType.SelectUnit]);
      await saveMriExportQueueMessage(ctx, {
        partyId: party.id,
        exportData: { exportSteps, data },
      });

      const payload = {
        msgCtx: ctx,
        partyId: party.id,
      };
      await exportToMri(payload);
    });

    describe('and then released', () => {
      it('should export ClearSelectedUnit', async () => {
        const nameId = getRandomNameId();
        const requests = [
          {
            reqFilename: '/hold unit/03 clearSelectedUnit-req.xml',
            respFilename: '/hold unit/04 clearSelectedUnit-resp.xml',
          },
        ];

        await setupTest({
          nameId,
          requests,
          inventoryId: leaseTestData.inventory.id,
          quoteId: leaseTestData.quote.id,
          unitId: leaseTestData.inventory.externalId,
        });

        await releaseInventory(ctx, {
          inventoryId: leaseTestData.inventory.id,
          reasons: [DALTypes.InventoryOnHoldReason.MANUAL, DALTypes.InventoryOnHoldReason.AUTOMATIC],
          partyId: party.id,
        });

        setPostXMLFunc(fakePostXML({ nameId, requests }));

        const doc = await getMatchingDocument(ctx, party.id, DALTypes.PartyEventType.UNIT_RELEASED);
        const { document } = doc;

        const data = await getUnitHeldData(ctx, {
          partyDocument: document,
          inventoryId: leaseTestData.inventory.id,
          leaseTermLength: leaseTestData.quote.publishedQuoteData.leaseTerms[0].termLength,
        });
        data.externalInfo.externalId = nameId;
        const exportSteps = addIndex([ExportType.ClearSelectedUnit]);
        await saveMriExportQueueMessage(ctx, {
          partyId: party.id,
          exportData: { exportSteps, data },
        });

        const payload = {
          msgCtx: ctx,
          partyId: party.id,
        };
        await exportToMri(payload);
      });
    });
  });

  describe('when a lease is edited', () => {
    const editLease = async lease =>
      await request(app).post(`/parties/${lease.partyId}/leases/${lease.id}/publish`).set(getAuthHeader(tenant.id, userId)).send(lease).expect(200);

    const setupEditLeaseTest = async testParams => {
      const { nameId, requests, unitId } = testParams;

      setPostXMLFunc(fakePostXML({ nameId, requests, unitId }));
      setGetXMLFunc(() => undefined);

      const { property, concessions } = leaseTestData;
      const publishedLease = await getPublishedLeaseData({ propertyId: property.id, concessions, timezone: property.timezone });

      publishedLease.additionalCharges = {};
      publishedLease.oneTimeCharges = {};
      publishedLease.concessions = {};

      const lease = await executeLease(matcher, leaseTestData, publishedLease, false);

      await editLease(lease);

      const doc = await getMatchingDocument(ctx, party.id, DALTypes.PartyEventType.LEASE_VERSION_CREATED);
      const { document } = doc;

      return { document, lease };
    };
    describe('if the lease is not signed', () => {
      it('should export ClearSelectedUnit, GuestCard and SelectUnit', async () => {
        const nameId = getRandomNameId();

        const requests = [
          {
            reqFilename: '/hold unit/03 clearSelectedUnit-req.xml',
            respFilename: '/hold unit/04 clearSelectedUnit-resp.xml',
          },
          {
            reqFilename: '/edit lease/01 guestCard-edit-lease-req.xml',
            respFilename: '/edit lease/02 guestCard-edit-lease-resp.xml',
          },
          {
            reqFilename: '10 selectUnit-req.xml',
            respFilename: '11 selectUnit-resp.xml',
          },
        ];

        const { document, lease } = await setupEditLeaseTest({ nameId, requests, unitId: leaseTestData.inventory.externalId });
        const data = await getEditLeaseData(
          ctx,
          document,
          lease.id,
          lease.baselineData.publishedLease.termLength,
          lease.baselineData.publishedLease.leaseStartDate,
        );
        data.externalInfo.externalId = nameId;

        const guestCardSteps = await generateGuestCardsExportSteps(ctx, document, data);
        const exportSteps = addIndex([ExportType.ClearSelectedUnit, guestCardSteps[0], ExportType.SelectUnit]);

        await saveMriExportQueueMessage(ctx, {
          partyId: party.id,
          exportData: { exportSteps, data },
        });

        const payload = {
          msgCtx: ctx,
          partyId: party.id,
        };
        await exportToMri(payload);
      });
    });

    describe('if the lease is signed', () => {
      it('should export ClearSelectedUnit, VoidLease, GuestCard and SelectUnit', async () => {
        const nameId = getRandomNameId();

        const requests = [
          {
            reqFilename: '/hold unit/03 clearSelectedUnit-req.xml',
            respFilename: '/hold unit/04 clearSelectedUnit-resp.xml',
          },
          {
            reqFilename: '/void lease/voidLease-req.xml',
            respFilename: '/void lease/voidLease-resp.xml',
          },
          {
            reqFilename: '/edit lease/01 guestCard-edit-lease-req.xml',
            respFilename: '/edit lease/02 guestCard-edit-lease-resp.xml',
          },
          {
            reqFilename: '10 selectUnit-req.xml',
            respFilename: '11 selectUnit-resp.xml',
          },
        ];

        const { document, lease } = await setupEditLeaseTest({ nameId, requests, unitId: leaseTestData.inventory.externalId });
        const data = await getEditLeaseData(
          ctx,
          document,
          lease.id,
          lease.baselineData.publishedLease.termLength,
          lease.baselineData.publishedLease.leaseStartDate,
        );
        data.externalInfo.externalId = nameId;
        const guestCardSteps = await generateGuestCardsExportSteps(ctx, document, data);
        const exportSteps = addIndex([ExportType.ClearSelectedUnit, ExportType.VoidLease, guestCardSteps[0], ExportType.SelectUnit]);

        await saveMriExportQueueMessage(ctx, {
          partyId: party.id,
          exportData: { exportSteps, data },
        });

        const payload = {
          msgCtx: ctx,
          partyId: party.id,
        };
        await exportToMri(payload);
      });
    });
  });
});
