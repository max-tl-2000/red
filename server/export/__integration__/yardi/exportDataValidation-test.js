/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import fse from 'fs-extra';
import { expect } from 'chai';

import { LA_TIMEZONE } from '../../../../common/date-constants';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { SCREENING_MESSAGE_TYPE } from '../../../helpers/message-constants';
import { clearPartyEvents } from '../../../dal/partyEventsRepo';
import { getPrimaryExternalInfoByParty, getPrimaryExternalInfoByPartyAndProperty } from '../../../dal/exportRepo';
import { createACompany, createAnAppointment, createAQuotePromotion, createAnInventory, createAnInventoryOnHold } from '../../../testUtils/repoHelper';

import { tenant } from '../../../testUtils/setupTestGlobalContext';

import * as helper from './exportValidationTestHelper.js';

import { updateParty, updatePartyMember } from '../../../services/party';

import {
  createTestData,
  cleanUp,
  doExport,
  waitForMessage,
  markAppointmentAsCompleted,
  getPublishedLeaseData,
  publishLease,
  executeLease,
  payApplicationFee,
  generateExportLogData,
  triggerExportToYardi,
  exportFolder,
  cleanUpExportFolder,
} from '../exportTestHelper';
import { createTestQuote, createTestPartyData } from '../../../testUtils/leaseTestHelper';

const ctx = { tenantId: tenant.id, authUser: {} };

describe('export-data-validation', () => {
  let matcher;
  let party;
  let userId;
  let leaseTestData;

  const setup = async (data = {}) => {
    leaseTestData = await createTestData(data);
    party = leaseTestData.party;
    userId = leaseTestData.userId;
    matcher = leaseTestData.matcher;
  };

  // cleanup generated export files after each test
  afterEach(cleanUp);

  describe('test leases that start today', () => {
    beforeEach(async () => await setup({ backendMode: DALTypes.BackendMode.YARDI }));

    describe('when a party without an application or lease is closed', () => {
      it('should not export ResTenants, ResProspects', async () => {
        await helper.closeParty(userId, party.id);

        await doExport(ctx, matcher, party, DALTypes.PartyEventType.PARTY_CLOSED);

        if (fse.existsSync(exportFolder)) {
          const files = fse.readdirSync(exportFolder);
          expect(files.length).to.equal(0, `No export files should be generated. Files: ${files}`);
        }
      });
    });

    describe('when a party without an application or lease is closed', () => {
      it('should export ResTenants, ResProspects', async () => {
        const { property } = leaseTestData;
        await updateParty(ctx, {
          id: party.id,
          metadata: {
            ...party.metadata,
            creationType: 'import',
          },
        });
        await helper.closeParty(userId, party.id);

        await doExport(ctx, matcher, party, DALTypes.PartyEventType.PARTY_CLOSED);

        const baselineFolder = path.resolve(__dirname, './export/1 closeParty/');
        await helper.compareWithBaselineFiles(baselineFolder, { timezone: property.timezone });
      });
    });

    describe('when a party pays the application fee', () => {
      it('should export ResTenants, ResProspects, FinCharges, FinReceipts', async () => {
        const { property } = leaseTestData;
        const paymentTask = waitForMessage(matcher, SCREENING_MESSAGE_TYPE.PAYMENT_NOTIFICATION_RECEIVED);

        await payApplicationFee(leaseTestData);
        await paymentTask;

        await doExport(ctx, matcher, party, DALTypes.PartyEventType.APPLICATION_PAYMENT_PROCESSED);

        const baselineFolder = path.resolve(__dirname, './export/2 payApplicationFee/');
        await helper.compareWithBaselineFiles(baselineFolder, { timezone: property.timezone });
      });
    });

    describe('when a party pays the application fee, but the fee is waived', () => {
      it('should export ResTenants, ResProspects, FinCharges', async () => {
        const { property } = leaseTestData;
        const paymentTask = waitForMessage(matcher, SCREENING_MESSAGE_TYPE.PAYMENT_NOTIFICATION_RECEIVED);
        const applicationFeeWaiverAmount = leaseTestData.applicationFee.absolutePrice;
        await payApplicationFee({ ...leaseTestData, holdDepositFee: {}, applicationFeeWaiverAmount });
        await paymentTask;

        await doExport(ctx, matcher, party, DALTypes.PartyEventType.APPLICATION_PAYMENT_PROCESSED);

        const baselineFolder = path.resolve(__dirname, './export/8 waivedApplication/');
        await helper.compareWithBaselineFiles(baselineFolder);
        await helper.compareWithBaselineFiles(baselineFolder, { timezone: property.timezone });
      });
    });

    describe('when a party pays the application fee, the app fee is waived and we have a deposit', () => {
      it('should export ResTenants, ResProspects, FinCharges and FinReceipts', async () => {
        const { property } = leaseTestData;
        const paymentTask = waitForMessage(matcher, SCREENING_MESSAGE_TYPE.PAYMENT_NOTIFICATION_RECEIVED);
        const applicationFeeWaiverAmount = leaseTestData.applicationFee.absolutePrice;
        await payApplicationFee({ ...leaseTestData, applicationFeeWaiverAmount });
        await paymentTask;

        await doExport(ctx, matcher, party, DALTypes.PartyEventType.APPLICATION_PAYMENT_PROCESSED);

        const baselineFolder = path.resolve(__dirname, './export/14 waivedApplication + hold deposit/');
        await helper.compareWithBaselineFiles(baselineFolder);
        await helper.compareWithBaselineFiles(baselineFolder, { timezone: property.timezone });
      });
    });

    describe('when a lease is signed for a party', () => {
      describe('and the application fee has not been paid', () => {
        it('should export ResTenants, ResProspects, ResRoommates and ResLeaseCharges', async () => {
          const { property, concessions } = leaseTestData;
          const publishedLease = await getPublishedLeaseData({ propertyId: property.id, concessions, timezone: property.timezone });
          await executeLease(matcher, leaseTestData, publishedLease, false);

          await doExport(ctx, matcher, party, DALTypes.PartyEventType.LEASE_SIGNED);

          const baselineFolder = path.resolve(__dirname, './export/3 leaseSigned without appFee/');
          await helper.compareWithBaselineFiles(baselineFolder, { timezone: property.timezone });
        });
      });

      describe('and an application fee has been paid', () => {
        it('should export ResTenants, ResProspects, ResRoommates, ResLeaseCharges and FinCharges', async () => {
          const paymentTask = waitForMessage(matcher, SCREENING_MESSAGE_TYPE.PAYMENT_NOTIFICATION_RECEIVED);
          await payApplicationFee(leaseTestData);
          await paymentTask;

          const { property, concessions } = leaseTestData;
          const publishedLease = await getPublishedLeaseData({ propertyId: property.id, concessions, timezone: property.timezone });
          await executeLease(matcher, leaseTestData, publishedLease, false);

          await doExport(ctx, matcher, party, DALTypes.PartyEventType.LEASE_SIGNED);

          const baselineFolder = path.resolve(__dirname, './export/4 lease signed with appFee');
          await helper.compareWithBaselineFiles(baselineFolder, { timezone: property.timezone });
        });
      });
    });

    describe('when an appointment is marked as completed', () => {
      it('should export ResProspects', async () => {
        const { property } = leaseTestData;
        const { id: appointmentId } = await createAnAppointment({
          partyId: party.id,
          salesPersonId: userId,
        });

        await markAppointmentAsCompleted(appointmentId, userId);
        await doExport(ctx, matcher, party, DALTypes.PartyEventType.APPOINTMENT_COMPLETED);

        const baselineFolder = path.resolve(__dirname, './export/6 mark appointment as completed/');
        await helper.compareWithBaselineFiles(baselineFolder, { timezone: property.timezone });
      });
    });

    describe('when a second appointment is marked as completed', () => {
      it('should NOT export ResProspects', async () => {
        const { id: appointmentId } = await createAnAppointment({
          partyId: party.id,
          salesPersonId: userId,
        });

        await markAppointmentAsCompleted(appointmentId, userId);
        await doExport(ctx, matcher, party, DALTypes.PartyEventType.APPOINTMENT_COMPLETED);

        const { id: secondAppointmentId } = await createAnAppointment({
          partyId: party.id,
          salesPersonId: userId,
        });

        await markAppointmentAsCompleted(secondAppointmentId, userId);
        await doExport(ctx, matcher, party, DALTypes.PartyEventType.APPOINTMENT_COMPLETED);

        if (fse.existsSync(exportFolder)) {
          const files = fse.readdirSync(exportFolder);
          expect(files.length).to.equal(1, `No new export files should be generated, as this is not the first completed appointment. Files: ${files}`);
        }
      });
    });

    describe('when a lease is voided, without being previously signed', () => {
      it('should not export anything', async () => {
        const { property, concessions, team } = leaseTestData;

        await payApplicationFee(leaseTestData);
        await waitForMessage(matcher, SCREENING_MESSAGE_TYPE.PAYMENT_NOTIFICATION_RECEIVED);
        await cleanUp();

        const publishedLease = await getPublishedLeaseData({ propertyId: property.id, concessions, timezone: property.timezone });
        const { lease } = await publishLease(matcher, leaseTestData, publishedLease);

        await helper.voidLease(userId, team, lease);
        await doExport(ctx, matcher, party, DALTypes.PartyEventType.LEASE_VOIDED);

        if (fse.existsSync(exportFolder)) {
          const files = fse.readdirSync(exportFolder);
          expect(files.length).to.equal(0, `No export files should be generated. Files: ${files}`);
        }
      });
    });
  });

  describe('with a party with no promoted quote', () => {
    beforeEach(
      async () =>
        await setup({
          backendMode: DALTypes.BackendMode.YARDI,
          appSettings: { shouldInsertQuotePromotion: false, shouldAddGuarantorToParty: false, includeHoldDepositeFee: false },
          createSecondQuote: true,
        }),
    );

    describe('when a manual hold is triggered for a party', () => {
      describe('and the application fee has not been paid', () => {
        it('should export ResTenants and ResProspects', async () => {
          const { property, quote } = leaseTestData;
          await helper.manualHoldUnit(userId, quote.inventoryId, party.id, quote.id);

          await doExport(ctx, matcher, party, DALTypes.PartyEventType.UNIT_HELD);

          const baselineFolder = path.resolve(__dirname, './export/12 manualHoldUnit/');
          await helper.compareWithBaselineFiles(baselineFolder, { timezone: property.timezone });
        });
      });
    });

    describe('when a second manual hold is triggered for a party', () => {
      describe('and is on a different property that the first one', () => {
        it('should export ResTenants and ResProspects', async () => {
          let baselineFolder;
          const { property, quote, secondQuote } = leaseTestData;
          await helper.manualHoldUnit(userId, quote.inventoryId, party.id, quote.id);

          await doExport(ctx, matcher, party, DALTypes.PartyEventType.UNIT_HELD);

          baselineFolder = path.resolve(__dirname, './export/15 manualHoldUnitTwoProperties/1 holdUnitFirstProperty');
          await helper.compareWithBaselineFiles(baselineFolder, { timezone: property.timezone });

          await cleanUpExportFolder();

          await helper.manualHoldReleaseUnit(userId, quote.inventoryId, party.id);
          await doExport(ctx, matcher, party, DALTypes.PartyEventType.UNIT_RELEASED);

          baselineFolder = path.resolve(__dirname, './export/15 manualHoldUnitTwoProperties/2 releaseUnitFirstProperty');
          await helper.compareWithBaselineFiles(baselineFolder, { timezone: property.timezone });

          const externalInfo = await getPrimaryExternalInfoByParty(ctx, party.id);

          await cleanUpExportFolder();

          await helper.manualHoldUnit(userId, secondQuote.inventoryId, party.id, secondQuote.id);
          await doExport(ctx, matcher, party, DALTypes.PartyEventType.UNIT_HELD);

          const newExternalInfo = await getPrimaryExternalInfoByParty(ctx, party.id);

          expect(externalInfo.externalId).to.not.equal(newExternalInfo.externalId);
          expect(externalInfo.propertyId).to.not.equal(newExternalInfo.propertyId);

          baselineFolder = path.resolve(__dirname, './export/15 manualHoldUnitTwoProperties/3 holdUnitSecondProperty');
          await helper.compareWithBaselineFiles(baselineFolder, { timezone: property.timezone });

          await cleanUpExportFolder();

          await helper.manualHoldReleaseUnit(userId, secondQuote.inventoryId, party.id);
          await doExport(ctx, matcher, party, DALTypes.PartyEventType.UNIT_RELEASED);

          baselineFolder = path.resolve(__dirname, './export/15 manualHoldUnitTwoProperties/4 releaseUnitSecondProperty');
          await helper.compareWithBaselineFiles(baselineFolder, { timezone: property.timezone });

          await cleanUpExportFolder();

          await helper.manualHoldUnit(userId, quote.inventoryId, party.id, quote.id);

          await doExport(ctx, matcher, party, DALTypes.PartyEventType.UNIT_HELD);

          baselineFolder = path.resolve(__dirname, './export/15 manualHoldUnitTwoProperties/1 holdUnitFirstProperty');
          await helper.compareWithBaselineFiles(baselineFolder, { timezone: property.timezone });

          const lastExternalInfo = await getPrimaryExternalInfoByParty(ctx, party.id);
          expect(lastExternalInfo.externalId).to.equal(externalInfo.externalId);
          expect(lastExternalInfo.propertyId).to.equal(externalInfo.propertyId);
        });
      });

      describe('and is on a different property that the first one', () => {
        describe('and then we release the first hold', () => {
          it('should export ResTenants and ResProspects', async () => {
            let baselineFolder;
            const { property, quote, secondQuote } = leaseTestData;

            // hold 1st unit on property A
            await helper.manualHoldUnit(userId, quote.inventoryId, party.id, quote.id);
            await doExport(ctx, matcher, party, DALTypes.PartyEventType.UNIT_HELD);

            baselineFolder = path.resolve(__dirname, './export/15 manualHoldUnitTwoProperties/1 holdUnitFirstProperty');
            await helper.compareWithBaselineFiles(baselineFolder, { timezone: property.timezone });

            await cleanUpExportFolder();

            const externalInfo = await getPrimaryExternalInfoByParty(ctx, party.id);

            // hold 2nd unit on property B
            await helper.manualHoldUnit(userId, secondQuote.inventoryId, party.id, secondQuote.id);
            await doExport(ctx, matcher, party, DALTypes.PartyEventType.UNIT_HELD);

            const newExternalInfo = await getPrimaryExternalInfoByParty(ctx, party.id);

            expect(externalInfo.externalId).to.not.equal(newExternalInfo.externalId);
            expect(externalInfo.propertyId).to.not.equal(newExternalInfo.propertyId);
            expect(newExternalInfo.propertyId).to.equal(secondQuote.propertyId);

            const oldExternalInfo = await getPrimaryExternalInfoByPartyAndProperty(ctx, party.id, quote.propertyId, null, true);
            expect(oldExternalInfo.endDate).is.not.null;

            baselineFolder = path.resolve(__dirname, './export/15 manualHoldUnitTwoProperties/3 holdUnitSecondProperty');
            await helper.compareWithBaselineFiles(baselineFolder, { timezone: property.timezone });

            await cleanUpExportFolder();

            // release 1st unit on property A - should export second unit again
            await helper.manualHoldReleaseUnit(userId, quote.inventoryId, party.id);
            await doExport(ctx, matcher, party, DALTypes.PartyEventType.UNIT_RELEASED);

            baselineFolder = path.resolve(__dirname, './export/15 manualHoldUnitTwoProperties/3 holdUnitSecondProperty');
            await helper.compareWithBaselineFiles(baselineFolder, { timezone: property.timezone });

            const lastExternalInfo = await getPrimaryExternalInfoByParty(ctx, party.id);
            expect(lastExternalInfo.externalId).to.equal(newExternalInfo.externalId);
            expect(lastExternalInfo.propertyId).to.equal(newExternalInfo.propertyId);
          });
        });
      });
    });

    describe('when a manual hold release is triggered for a party', () => {
      describe('and the application fee has not been paid', () => {
        it('should export ResTenants and ResProspects', async () => {
          const { property, quote } = leaseTestData;
          await createAnInventoryOnHold(quote.inventoryId, party.id, userId);

          await helper.manualHoldReleaseUnit(userId, quote.inventoryId, party.id);

          await doExport(ctx, matcher, party, DALTypes.PartyEventType.UNIT_RELEASED);

          const baselineFolder = path.resolve(__dirname, './export/13 manualHoldReleased/');
          await helper.compareWithBaselineFiles(baselineFolder, { timezone: property.timezone });
        });
      });

      describe('and a second manual hold already exists', () => {
        it('should export ResTenants and ResProspects for the second inventory hold', async () => {
          const { property, quote } = leaseTestData;

          const { id: inventoryId } = await createAnInventory({
            propertyId: property.id,
          });
          await createAnInventoryOnHold(inventoryId, party.id, userId);
          await createAnInventoryOnHold(quote.inventoryId, party.id, userId);

          await helper.manualHoldReleaseUnit(userId, inventoryId, party.id);

          await doExport(ctx, matcher, party, DALTypes.PartyEventType.UNIT_RELEASED);

          const baselineFolder = path.resolve(__dirname, './export/12 manualHoldUnit/');
          await helper.compareWithBaselineFiles(baselineFolder, { timezone: property.timezone });
        });
      });
    });
  });

  describe('when a lease is signed for a party, then voided', () => {
    it('should export canceled lease charges', async () => {
      await setup({
        backendMode: DALTypes.BackendMode.YARDI,
        daysFromNow: 1,
        timezone: LA_TIMEZONE,
        isCorporateParty: false,
      });

      const { team } = leaseTestData;

      await payApplicationFee(leaseTestData);
      await waitForMessage(matcher, SCREENING_MESSAGE_TYPE.PAYMENT_NOTIFICATION_RECEIVED);
      await cleanUp();

      const { property, concessions } = leaseTestData;
      const publishedLease = await getPublishedLeaseData({ propertyId: property.id, concessions, timezone: property.timezone, daysFromNow: 1 });
      const lease = await executeLease(matcher, leaseTestData, publishedLease, false);

      await doExport(ctx, matcher, party, DALTypes.PartyEventType.LEASE_SIGNED);
      await cleanUp();

      await helper.voidLease(userId, team, lease);
      await doExport(ctx, matcher, party, DALTypes.PartyEventType.LEASE_VOIDED);

      const folderName = './export/5 void signed lease';
      const baselineFolder = path.resolve(__dirname, folderName);
      await helper.compareWithBaselineFiles(baselineFolder, { isVoidedLease: true, daysFromNow: 1, timezone: property.timezone });
    });
  });

  describe('when a manual hold is exported for a corporate party', () => {
    describe('and a second hold is done for a different property', () => {
      describe('and then we release the first hold', () => {
        it('should export ResTenants and ResProspects', async () => {
          await setup({
            backendMode: DALTypes.BackendMode.YARDI,
            isCorporateParty: true,
            createSecondQuote: true,
            appSettings: { shouldInsertQuotePromotion: false },
          });

          await cleanUp();

          let baselineFolder;
          const { property, quote, secondQuote } = leaseTestData;

          // // hold 1st unit on property A
          await helper.manualHoldUnit(userId, quote.inventoryId, party.id, quote.id);
          await doExport(ctx, matcher, party, DALTypes.PartyEventType.UNIT_HELD);

          baselineFolder = path.resolve(__dirname, './export/16 manualHoldCorporate/holdUnitFirstProperty');
          await helper.compareWithBaselineFiles(baselineFolder, { timezone: property.timezone });

          await cleanUpExportFolder();

          const externalInfo = await getPrimaryExternalInfoByParty(ctx, party.id);

          // hold 2nd unit on property B
          await helper.manualHoldUnit(userId, secondQuote.inventoryId, party.id, secondQuote.id);
          await doExport(ctx, matcher, party, DALTypes.PartyEventType.UNIT_HELD);

          const newExternalInfo = await getPrimaryExternalInfoByPartyAndProperty(ctx, party.id, secondQuote.propertyId, null, true);

          expect(externalInfo.externalId).to.not.equal(newExternalInfo.externalId);
          expect(externalInfo.propertyId).to.not.equal(newExternalInfo.propertyId);
          expect(newExternalInfo.propertyId).to.equal(secondQuote.propertyId);

          const oldExternalInfo = await getPrimaryExternalInfoByPartyAndProperty(ctx, party.id, quote.propertyId);
          expect(oldExternalInfo.endDate).is.null;

          baselineFolder = path.resolve(__dirname, './export/16 manualHoldCorporate/holdUnitSecondProperty');
          await helper.compareWithBaselineFiles(baselineFolder, { timezone: property.timezone });

          await cleanUpExportFolder();

          // release 1st unit on property A - should export second unit again
          await helper.manualHoldReleaseUnit(userId, quote.inventoryId, party.id);
          await doExport(ctx, matcher, party, DALTypes.PartyEventType.UNIT_RELEASED);

          baselineFolder = path.resolve(__dirname, './export/16 manualHoldCorporate/releaseUnitFirstProperty');
          await helper.compareWithBaselineFiles(baselineFolder, { timezone: property.timezone }, true);
        });
      });
    });
  });

  describe('when a lease is signed for a corporate party, then voided', () => {
    it.skip('should export canceled lease charges', async () => {
      await setup({
        backendMode: DALTypes.BackendMode.YARDI,
        daysFromNow: 1,
        timezone: LA_TIMEZONE,
        isCorporateParty: true,
      });

      const { team } = leaseTestData;
      await cleanUp();

      const { property, concessions } = leaseTestData;
      const publishedLease = await getPublishedLeaseData({ propertyId: property.id, concessions, timezone: property.timezone, daysFromNow: 1 });
      const lease = await executeLease(matcher, leaseTestData, publishedLease, false);

      await doExport(ctx, matcher, party, DALTypes.PartyEventType.LEASE_SIGNED);
      await cleanUp();

      await helper.voidLease(userId, team, lease);
      await doExport(ctx, matcher, party, DALTypes.PartyEventType.LEASE_VOIDED);

      const folderName = './export/11 void signed corporate lease';
      const baselineFolder = path.resolve(__dirname, folderName);
      await helper.compareWithBaselineFiles(baselineFolder, { isVoidedLease: true, daysFromNow: 1, timezone: property.timezone });
    });
  });

  describe('when a party without an application or lease is closed', () => {
    it('should export ResTenants, ResProspects and truncate the Email to 80 in the case of the ResProspects', async () => {
      const residentEmail = 'AReallyLongEmailThatWillHaveMoreThan80charsInItAndShouldMakeTheTestsToFailWhenUsed@aDomainAlso.tech'.toLocaleLowerCase();

      await setup({
        backendMode: DALTypes.BackendMode.YARDI,
        residentEmail,
        daysFromNow: 0,
        timezone: LA_TIMEZONE,
      });

      const { property } = leaseTestData;

      await updateParty(ctx, {
        id: party.id,
        metadata: {
          ...party.metadata,
          creationType: 'import',
        },
      });

      await helper.closeParty(userId, party.id);

      await doExport(ctx, matcher, party, DALTypes.PartyEventType.PARTY_CLOSED);

      const baselineFolder = path.resolve(__dirname, './export/1 closeParty/');

      const overrides = {
        ResProspects: { Email: `"${residentEmail.substr(0, 80)}"` },
        ResTenants: { Email: `"${residentEmail.substr(0, 80)}"` },
      };

      await helper.compareWithBaselineFiles(baselineFolder, { overrides, timezone: property.timezone });
    });
  });

  describe('collapse export data test', () => {
    beforeEach(async () => await setup({ backendMode: DALTypes.BackendMode.YARDI }));

    describe('when two parties are closed', () => {
      it('should export all the required files', async () => {
        const { property } = leaseTestData;

        await updateParty(ctx, {
          id: party.id,
          metadata: {
            ...party.metadata,
            creationType: 'import',
          },
        });

        await helper.closeParty(userId, party.id);
        await generateExportLogData(ctx, matcher, party, DALTypes.PartyEventType.PARTY_CLOSED);

        const party2Data = await createTestPartyData({ companyName: 'New Company' });
        await updateParty(ctx, {
          id: party2Data.party.id,
          metadata: {
            ...party2Data.party.metadata,
            creationType: 'import',
          },
        });
        await helper.closeParty(party2Data.user.id, party2Data.party.id);
        await generateExportLogData(ctx, matcher, party2Data.party, DALTypes.PartyEventType.PARTY_CLOSED);

        await triggerExportToYardi(ctx, matcher);

        const baselineFolder = path.resolve(__dirname, './export/10 close two parties/');
        await helper.compareWithBaselineFiles(baselineFolder, { timezone: property.timezone });
      });
    });

    describe('when a party completes a tour, pays the application fee then signs a lease', () => {
      it('should export all the required files', async () => {
        const { id: appointmentId } = await createAnAppointment({
          partyId: party.id,
          salesPersonId: userId,
        });

        // complete an appointment
        await markAppointmentAsCompleted(appointmentId, userId);
        await generateExportLogData(ctx, matcher, party, DALTypes.PartyEventType.APPOINTMENT_COMPLETED);

        // pay the app fee
        const { property, concessions } = leaseTestData;
        const paymentTask = waitForMessage(matcher, SCREENING_MESSAGE_TYPE.PAYMENT_NOTIFICATION_RECEIVED);
        await payApplicationFee(leaseTestData);
        await paymentTask;
        await generateExportLogData(ctx, matcher, party, DALTypes.PartyEventType.APPLICATION_PAYMENT_PROCESSED);

        const publishedLease = await getPublishedLeaseData({ propertyId: property.id, concessions, timezone: property.timezone });
        await executeLease(matcher, leaseTestData, publishedLease, false);
        await generateExportLogData(ctx, matcher, party, DALTypes.PartyEventType.LEASE_SIGNED);

        await triggerExportToYardi(ctx, matcher);

        const baselineFolder = path.resolve(__dirname, './export/9 tour + appfee + lease/');
        await helper.compareWithBaselineFiles(baselineFolder, { timezone: property.timezone });
      });
    });

    describe('when two leases have been signed for a corporate party', () => {
      it('should export all the required files', async () => {
        const { property, concessions, residents } = leaseTestData;

        // set the party as corporate
        await updateParty(ctx, { id: party.id, leaseType: DALTypes.LeaseType.CORPORATE });
        const company = await createACompany('export-test-company');
        await updatePartyMember(ctx, residents[0].id, { ...residents[0], companyId: company.id });

        const publishedLease = await getPublishedLeaseData({ propertyId: property.id, concessions, timezone: property.timezone });
        await executeLease(matcher, leaseTestData, publishedLease, false);

        await generateExportLogData(ctx, matcher, party, DALTypes.PartyEventType.LEASE_SIGNED);
        await clearPartyEvents(ctx);

        const { leaseTerm, inventoryGroup } = leaseTestData;

        const { quote, inventory } = await createTestQuote({ property, leaseTerm, concessions, inventoryGroup, party });
        const quotePromotion = await createAQuotePromotion(party.id, DALTypes.PromotionStatus.APPROVED, quote.id, leaseTerm.id);
        await executeLease(
          matcher,
          {
            ...leaseTestData,
            quote,
            inventory,
            promotedQuote: quotePromotion,
          },
          publishedLease,
          false,
        );

        await generateExportLogData(ctx, matcher, party, DALTypes.PartyEventType.LEASE_SIGNED);
        await triggerExportToYardi(ctx, matcher);

        const baselineFolder = path.resolve(__dirname, './export/7 corporate 2 leases signed/');
        await helper.compareWithBaselineFiles(baselineFolder, { timezone: property.timezone });
      });
    });
    describe('when a lease is voided, without being signed by all party members', () => {
      it('should not export anything', async () => {
        const { property, concessions, team } = leaseTestData;

        const publishedLease = await getPublishedLeaseData({ propertyId: property.id, concessions, timezone: property.timezone });
        const lease = await executeLease(matcher, leaseTestData, publishedLease, false, true);

        await helper.voidLease(userId, team, lease);
        await doExport(ctx, matcher, party, DALTypes.PartyEventType.LEASE_VOIDED);

        if (fse.existsSync(exportFolder)) {
          const files = fse.readdirSync(exportFolder);
          expect(files.length).to.equal(0, `No export files should be generated. Files: ${files}`);
        }
      });
    });
  });
});
