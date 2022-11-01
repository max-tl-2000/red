/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { mapSeries } from 'bluebird';
import { handleRmsFilesReceived, handleRevaImportFilesReceived, handleInventoryUpdateReceived } from '../rmsHandler';
import { createAProperty, createAnInventoryItem, createABuilding, testCtx as ctx } from '../../../testUtils/repoHelper';
import { updateInventory } from '../../../dal/inventoryRepo';
import { updateProperty, getPropertyTimezone } from '../../../dal/propertyRepo';
import { getUnitsPricingByPropertyId } from '../../../dal/rmsPricingRepo';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { now } from '../../../../common/helpers/moment-utils';
import { YEAR_MONTH_DAY_FORMAT } from '../../../../common/date-constants';
import '../../../testUtils/setupTestGlobalContext';

describe('RMS Handler', () => {
  const propertyName = '11190';

  const createInventoriesByExternalId = async (rmsExternalIds, building) =>
    await mapSeries(rmsExternalIds, async rmsExternalId => await createAnInventoryItem({ building, rmsExternalId, shouldCreateLeaseTerm: true }));

  const unitsRmsExternalIds = [
    '01113',
    '01300',
    '01314',
    '03102',
    '03106',
    '03203',
    '03207',
    '03212',
    '03306',
    '03314',
    '04110',
    '04209',
    '04303',
    '04305',
    '04307',
    '04310',
    '04312',
  ];

  const renewalsRmsExternalIds = [
    '04305',
    '02104',
    '02301',
    '02103',
    '02113',
    '01210',
    '01306',
    '01314',
    '02305',
    '03315',
    '01300',
    '01302',
    '01101',
    '02105',
    '02303',
    '01107',
    '04107',
    '02316',
    '03310',
  ];

  const unitsAndRenewalsRmsExternalIds = [...unitsRmsExternalIds, ...renewalsRmsExternalIds];

  const executeRmsImportTest = async ({ rmsExternalIds, file, expectedPricingLength, setupParams = {} }) => {
    const unitPricing = 'unitPricing' in setupParams ? setupParams.unitPricing : true;
    const { id: propertyId } = setupParams.propertyId
      ? { ...setupParams, id: setupParams.propertyId }
      : await createAProperty({ integration: { import: { unitPricing } } }, { propertyName }, ctx);

    const building = setupParams.building || (await createABuilding({ propertyId }));
    await createInventoriesByExternalId([...new Set(rmsExternalIds)], building);

    const result = await handleRmsFilesReceived(ctx, [file]);

    expect(result).to.deep.equal({
      errors: [],
      failingFiles: [],
      file: {
        filePath: file.filePath,
        originalName: file.originalName,
        originalPath: file.originalPath,
      },
      processed: 1,
      uploaded: 1,
    });
    const rmsPricing = await getUnitsPricingByPropertyId(ctx, propertyId);
    expect(rmsPricing.length).to.equal(expectedPricingLength);
  };

  describe('LRO Provider', () => {
    describe('When a valid LRO file that only contains units is provided', () => {
      const validLroOnlyUnitsFile = {
        originalName: '1523308802997-LROPricing_11190_20180409_units.XML',
        originalPath: 'server/workers/rms/__integration__/resources/1523308802997-LROPricing_11190_20180409_units.XML',
        filePath: 'server/workers/rms/__integration__/resources/1523308802997-LROPricing_11190_20180409_units.XML',
      };

      it('Should parse and save the file successfully', async () => {
        await executeRmsImportTest({ rmsExternalIds: unitsRmsExternalIds, file: validLroOnlyUnitsFile, expectedPricingLength: unitsRmsExternalIds.length });
      });
    });

    describe('When a valid LRO file that only contains renewals is provided', () => {
      const validLroOnlyRenewalsFile = {
        originalName: '1523308802997-LROPricing_11190_20180409_renewals.XML',
        originalPath: 'server/workers/rms/__integration__/resources/1523308802997-LROPricing_11190_20180409_renewals.XML',
        filePath: 'server/workers/rms/__integration__/resources/1523308802997-LROPricing_11190_20180409_renewals.XML',
      };

      it('Should parse and save the file successfully', async () => {
        await executeRmsImportTest({
          rmsExternalIds: renewalsRmsExternalIds,
          file: validLroOnlyRenewalsFile,
          expectedPricingLength: renewalsRmsExternalIds.length,
        });
      });
    });

    describe('When a valid LRO file that contains units and renewals is provided', () => {
      const validLroUnitsAndRenewalsFile = {
        originalName: '1523308802997-LROPricing_11190_20180409_units_and_renewals.XML',
        originalPath: 'server/workers/rms/__integration__/resources/1523308802997-LROPricing_11190_20180409_units_and_renewals.XML',
        filePath: 'server/workers/rms/__integration__/resources/1523308802997-LROPricing_11190_20180409_units_and_renewals.XML',
      };

      it('Should parse the file successfully and save both pricing for a unit', async () => {
        await executeRmsImportTest({
          rmsExternalIds: unitsAndRenewalsRmsExternalIds,
          file: validLroUnitsAndRenewalsFile,
          expectedPricingLength: unitsAndRenewalsRmsExternalIds.length,
        });
      });
    });
  });

  describe('Reva Provider', () => {
    const validLroOnlyUnitsFile = {
      originalName: '1523308802997-LROPricing_11190_20180409_units.XML',
      originalPath: 'server/workers/rms/__integration__/resources/1523308802997-LROPricing_11190_20180409_units.XML',
      filePath: 'server/workers/rms/__integration__/resources/1523308802997-LROPricing_11190_20180409_units.XML',
    };

    const createInventoriesByType = async (inventoryTypes, building) =>
      await mapSeries(
        inventoryTypes,
        async type => await createAnInventoryItem({ building, type, state: DALTypes.InventoryState.VACANT_READY, shouldCreateLeaseTerm: true }),
      );

    const initialSetup = async ({ unitPricing, inventoryTypes, shouldCreateRevaRenewal }) => {
      const { id: propertyId } = await createAProperty({ integration: { import: { unitPricing } } }, { propertyName }, ctx);
      const building = await createABuilding({ propertyId });
      const inventories = await createInventoriesByType(inventoryTypes, building);

      if (shouldCreateRevaRenewal) {
        inventories.push(
          await createAnInventoryItem({
            building,
            type: DALTypes.InventoryType.UNIT,
            state: DALTypes.InventoryState.OCCUPIED_NOTICE,
            shouldCreateLeaseTerm: true,
            availabilityDate: null,
            leaseState: DALTypes.LeaseState.RENEWAL,
          }),
        );

        inventories.push(
          await createAnInventoryItem({
            building,
            type: DALTypes.InventoryType.UNIT,
            state: DALTypes.InventoryState.OCCUPIED_NOTICE,
            shouldCreateLeaseTerm: true,
            availabilityDate: null,
            leaseState: '',
          }),
        );
      }
      return { propertyId, inventories: inventories.map(({ id, state, type }) => ({ id, state, type })), building };
    };

    const executeTest = async ({
      result,
      propertyId,
      expectedUnitPricingLength,
      expectedRIPricingLength,
      expectedInventories,
      compareOnlyRentableItems,
      expectedResult,
      testRevaRenewal,
    }) => {
      expect(result).to.deep.equal(
        expectedResult || {
          errors: [],
          processed: 1,
        },
      );

      const rmsPricing = await getUnitsPricingByPropertyId(ctx, propertyId);
      expect(rmsPricing.length).to.equal(expectedUnitPricingLength + expectedRIPricingLength);

      const filterListByType = (list, filter) => list.filter(({ type }) => type === filter);

      expect(filterListByType(rmsPricing, DALTypes.InventoryType.UNIT).length).to.equal(expectedUnitPricingLength);
      expect(filterListByType(rmsPricing, DALTypes.InventoryType.STORAGE).length).to.equal(expectedRIPricingLength);

      const formattedRmsPricing = rmsPricing.map(({ inventoryId, status, type }) => ({ id: inventoryId, state: status, type }));
      const filteredRmsPricing = compareOnlyRentableItems
        ? formattedRmsPricing.filter(({ type }) => type !== DALTypes.InventoryType.UNIT)
        : formattedRmsPricing;
      expect(filteredRmsPricing).to.have.deep.members(expectedInventories);

      if (testRevaRenewal) {
        const timezone = await getPropertyTimezone(ctx, propertyId);
        const renewalsPricing = rmsPricing.filter(({ renewalDate }) => renewalDate);
        expect(renewalsPricing.length).to.equal(2);
        const [renewalPricing] = renewalsPricing;
        const startDate = now({ timezone });

        const expectedMatrix = JSON.stringify({
          12: {
            [startDate.format(YEAR_MONTH_DAY_FORMAT)]: {
              rent: 3500,
              endDate: startDate.add('years', 100).format(YEAR_MONTH_DAY_FORMAT),
            },
          },
        });
        expect(JSON.stringify(renewalPricing.rentMatrix)).to.equal(expectedMatrix);

        const newPricing = rmsPricing.find(({ renewalDate }) => !renewalDate);
        expect(JSON.stringify(newPricing.rentMatrix)).to.equal(expectedMatrix);
      }
    };

    const executeRevaImportTest = async ({
      propertyId,
      expectedUnitPricingLength,
      expectedRIPricingLength,
      expectedInventories,
      compareOnlyRentableItems,
      expectedResult,
      testRevaRenewal,
    }) => {
      const result = await handleRevaImportFilesReceived(ctx, 'test.xlsx');
      await executeTest({
        result,
        propertyId,
        expectedUnitPricingLength,
        expectedRIPricingLength,
        expectedInventories,
        compareOnlyRentableItems,
        expectedResult,
        testRevaRenewal,
      });
    };

    const executeInventoryStateChangedTest = async ({
      propertyId,
      expectedUnitPricingLength,
      expectedRIPricingLength,
      expectedInventories,
      compareOnlyRentableItems,
      expectedResult,
    }) => {
      const result = await handleInventoryUpdateReceived(ctx);
      await executeTest({
        result,
        propertyId,
        expectedUnitPricingLength,
        expectedRIPricingLength,
        expectedInventories,
        compareOnlyRentableItems,
        expectedResult,
      });
    };

    const unitInventories = [DALTypes.InventoryType.UNIT, DALTypes.InventoryType.UNIT, DALTypes.InventoryType.UNIT];
    const rentableItemInventories = [DALTypes.InventoryType.STORAGE, DALTypes.InventoryType.STORAGE];
    const inventoryTypes = [...unitInventories, ...rentableItemInventories];

    describe('When Quote Pricing is set to Reva', () => {
      const unitPricing = false;

      describe('When a REVA Import occurs', () => {
        describe('And there is not pricing inside RmsPricing table for that given property Id', () => {
          it('Should parse and save the pricing successfully', async () => {
            const { propertyId, inventories } = await initialSetup({ unitPricing, inventoryTypes, shouldCreateRevaRenewal: true });
            await executeRevaImportTest({
              propertyId,
              expectedUnitPricingLength: unitInventories.length + 3,
              expectedRIPricingLength: rentableItemInventories.length,
              expectedInventories: inventories,
              testRevaRenewal: true,
            });
          });
        });
        describe('And there is pricing inside RmsPricing table for that given property Id', () => {
          it('Should delete all pricing for that given property Id, then parse and save the pricing successfully', async () => {
            const initialInventoryTypes = [DALTypes.InventoryType.UNIT];
            const { propertyId, building, inventories } = await initialSetup({ unitPricing, inventoryTypes: initialInventoryTypes });

            // We add the initial Rms pricing that should be deleted
            await handleRevaImportFilesReceived(ctx, 'test.xlsx');
            const rmsPricing = await getUnitsPricingByPropertyId(ctx, propertyId);
            // We check if the pricing was added correctly
            expect(rmsPricing.length).to.equal(initialInventoryTypes.length);
            // We check if the state is the same as it was created
            expect(rmsPricing.map(({ status }) => status)).to.have.deep.members([DALTypes.InventoryState.VACANT_READY]);
            // We update the state of the inventory,in RmsPricing this state is different because it has not been updated yet, this will help us know if we actually updated the pricing
            const initialInventory = await updateInventory(ctx, inventories[0].id, { state: DALTypes.InventoryState.VACANT_MAKE_READY });

            // We create the new inventories where the pricing should be computed
            const newInventories = await createInventoriesByType(inventoryTypes, building);
            const expectedInventories = [...newInventories, initialInventory].map(({ id, state, type }) => ({ id, state, type }));
            await executeRevaImportTest({
              propertyId,
              expectedUnitPricingLength: unitInventories.length + initialInventoryTypes.length,
              expectedRIPricingLength: rentableItemInventories.length,
              expectedInventories,
            });
          });
        });
      });

      describe('When an RMS Import occurs', () => {
        describe('And there is not pricing inside RmsPricing table for that given property Id', () => {
          it('The pricing for that given property Id should be empty', async () => {
            const { propertyId, building } = await initialSetup({ unitPricing, inventoryTypes });
            await executeRmsImportTest({
              rmsExternalIds: unitsRmsExternalIds,
              file: validLroOnlyUnitsFile,
              expectedPricingLength: 0,
              setupParams: { propertyId, building, unitPricing },
            });
          });
        });

        describe('And there is pricing inside RmsPricing table for that given property Id', () => {
          it('The pricing for that given property Id should remain the same', async () => {
            const { propertyId, building } = await initialSetup({ unitPricing, inventoryTypes });

            // We add the initial Rms pricing that should remain
            await handleRevaImportFilesReceived(ctx, 'test.xlsx');
            const rmsPricing = await getUnitsPricingByPropertyId(ctx, propertyId);
            expect(rmsPricing.length).to.equal(inventoryTypes.length);

            await executeRmsImportTest({
              rmsExternalIds: unitsRmsExternalIds,
              file: validLroOnlyUnitsFile,
              expectedPricingLength: inventoryTypes.length,
              setupParams: { propertyId, building, unitPricing },
            });
          });
        });
      });

      describe('When a change in any of the inventories for that given property Id occurs', () => {
        describe('And there is not pricing inside RmsPricing table for that given property Id', () => {
          it('Should parse and save the pricing successfully', async () => {
            const { propertyId, inventories } = await initialSetup({ unitPricing, inventoryTypes });

            await executeInventoryStateChangedTest({
              propertyId,
              expectedUnitPricingLength: unitInventories.length,
              expectedRIPricingLength: rentableItemInventories.length,
              expectedInventories: inventories,
              expectedResult: { errors: [], processed: inventoryTypes.length },
            });

            const newState = DALTypes.InventoryState.VACANT_MAKE_READY;
            const firstUpdatedInventory = await updateInventory(ctx, inventories[0].id, { state: newState });
            const secondUpdatedInventory = await updateInventory(ctx, inventories[1].id, { state: newState });
            const updatedInventories = [firstUpdatedInventory, secondUpdatedInventory];

            // We update the expectedInventories with the new inventories states
            const expectedInventories = inventories.map(({ id, state, type }) => ({
              id,
              state: updatedInventories.find(ui => ui.id === id) ? newState : state,
              type,
            }));

            await executeInventoryStateChangedTest({
              propertyId,
              expectedUnitPricingLength: unitInventories.length,
              expectedRIPricingLength: rentableItemInventories.length,
              expectedInventories,
              expectedResult: { errors: [], processed: updatedInventories.length },
            });
          });
        });
        describe('And there is pricing inside RmsPricing table for that given property Id', () => {
          it('Should delete only the pricing for the updated inventories, parse and save the new pricing successfully', async () => {
            const { propertyId, inventories } = await initialSetup({ unitPricing, inventoryTypes });

            // We add the initial Rms pricing that should be deleted
            await handleRevaImportFilesReceived(ctx, 'test.xlsx');
            const rmsPricing = await getUnitsPricingByPropertyId(ctx, propertyId);
            // We check if the pricing was added correctly
            expect(rmsPricing.length).to.equal(inventoryTypes.length);
            // We check if the state is the same as it was created
            expect(rmsPricing.map(({ status }) => status)).to.have.deep.members(inventories.map(({ state }) => state));

            const newState = DALTypes.InventoryState.VACANT_MAKE_READY;
            // We update the state of the inventories,in RmsPricing this state is different because it has not been updated yet, this will help us know if we actually updated the pricing
            const firstUpdatedInventory = await updateInventory(ctx, inventories[0].id, { state: newState });
            const secondUpdatedInventory = await updateInventory(ctx, inventories[1].id, { state: newState });
            const updatedInventories = [firstUpdatedInventory, secondUpdatedInventory];

            // We update the expectedInventories with the new inventories states
            const expectedInventories = inventories.map(({ id, state, type }) => ({
              id,
              state: updatedInventories.find(ui => ui.id === id) ? newState : state,
              type,
            }));

            await executeInventoryStateChangedTest({
              propertyId,
              expectedUnitPricingLength: unitInventories.length,
              expectedRIPricingLength: rentableItemInventories.length,
              expectedInventories,
              expectedResult: { errors: [], processed: updatedInventories.length },
            });
          });
        });
      });
    });

    describe('When Quote Pricing is not Reva', () => {
      const unitPricing = true;

      describe('When an RMS Import occurs', () => {
        describe('And there is not pricing inside RmsPricing table for that given property Id', () => {
          it('Should parse and save the pricing successfully', async () => {
            await executeRmsImportTest({
              rmsExternalIds: unitsRmsExternalIds,
              file: validLroOnlyUnitsFile,
              expectedPricingLength: unitsRmsExternalIds.length,
            });
          });
        });
        describe('And there is pricing inside RmsPricing table for that given property Id', () => {
          it('Should delete all the UNIT pricing for that given property Id, parse and save the UNIT pricing successfully', async () => {
            // We create a property with REVA as quote pricing setting
            const { propertyId, inventories } = await initialSetup({ unitPricing: false, inventoryTypes });
            // We add REVA prices to RMS Pricing table
            await executeRevaImportTest({
              propertyId,
              expectedUnitPricingLength: unitInventories.length,
              expectedRIPricingLength: rentableItemInventories.length,
              expectedInventories: inventories,
            });

            const rmsPricing = await getUnitsPricingByPropertyId(ctx, propertyId);
            // We check if the pricing was added correctly
            expect(rmsPricing.length).to.equal(inventoryTypes.length);

            // We change the quote pricing setting to RMS
            await updateProperty(ctx, { id: propertyId }, { settings: { integration: { import: { unitPricing } } } });

            await executeRmsImportTest({
              rmsExternalIds: unitsRmsExternalIds,
              file: validLroOnlyUnitsFile,
              expectedPricingLength: unitsRmsExternalIds.length + rentableItemInventories.length,
            });
          });
        });
      });

      describe('When a REVA Import occurs', () => {
        describe('And there is not pricing inside RmsPricing table for that given property Id', () => {
          it('Should parse and save the NON-UNIT pricing successfully', async () => {
            const { propertyId, inventories } = await initialSetup({ unitPricing, inventoryTypes });
            await executeRevaImportTest({
              propertyId,
              expectedUnitPricingLength: 0,
              expectedRIPricingLength: rentableItemInventories.length,
              expectedInventories: inventories.filter(({ type }) => type !== DALTypes.InventoryType.UNIT),
            });
          });
        });
        describe('And there is pricing inside RmsPricing table for that given property Id', () => {
          it('Should delete all the NON-UNIT pricing for that given property Id, parse and save the NON-UNIT pricing successfully', async () => {
            const initialInventoryTypes = [DALTypes.InventoryType.STORAGE];
            const { propertyId, building, inventories } = await initialSetup({ unitPricing, inventoryTypes: initialInventoryTypes });
            // We add the rentable items pricing that should be deleted
            await handleRevaImportFilesReceived(ctx, 'test.xlsx');

            // We import the external RMS pricing
            await executeRmsImportTest({
              rmsExternalIds: unitsRmsExternalIds,
              file: validLroOnlyUnitsFile,
              expectedPricingLength: initialInventoryTypes.length + unitsRmsExternalIds.length,
              setupParams: { propertyId, building },
            });

            // We update the state of the rentable item,in RmsPricing this state is different because it has not been updated yet, this will help us know if we actually updated the pricing
            const initialInventory = await updateInventory(ctx, inventories[0].id, { state: DALTypes.InventoryState.VACANT_MAKE_READY });

            // We create the new inventories where the pricing should be computed
            const newInventories = await createInventoriesByType(inventoryTypes, building);

            const expectedInventories = [...newInventories, initialInventory]
              .map(({ id, state, type }) => ({ id, state, type }))
              .filter(({ type }) => type !== DALTypes.InventoryType.UNIT);
            await executeRevaImportTest({
              propertyId,
              expectedUnitPricingLength: unitsRmsExternalIds.length,
              expectedRIPricingLength: rentableItemInventories.length + 1, // We add one because we created a new rentable item
              expectedInventories,
              compareOnlyRentableItems: true,
            });
          });
        });
      });

      describe('When a change in any of the inventories for that given property Id occurs', () => {
        describe('And there is not pricing inside RmsPricing table for that given property Id', () => {
          it('Should parse and save the NON-UNIT pricing successfully', async () => {
            const { propertyId, inventories } = await initialSetup({ unitPricing, inventoryTypes });
            await executeInventoryStateChangedTest({
              propertyId,
              expectedUnitPricingLength: 0,
              expectedRIPricingLength: rentableItemInventories.length,
              expectedInventories: inventories.filter(({ type }) => type !== DALTypes.InventoryType.UNIT),
              expectedResult: { errors: [], processed: rentableItemInventories.length },
            });
          });
        });
        describe('And there is pricing inside RmsPricing table for that given property Id', () => {
          it('Should delete only the pricing for the updated NON-UNIT inventories, parse and save the new NON-UNIT pricing successfully', async () => {
            const initialInventoryTypes = [DALTypes.InventoryType.STORAGE];
            const { propertyId, building, inventories } = await initialSetup({ unitPricing, inventoryTypes: initialInventoryTypes });

            // We add the rentable items pricing that should be deleted
            await handleRevaImportFilesReceived(ctx, 'test.xlsx');

            // We import the external RMS pricing
            await executeRmsImportTest({
              rmsExternalIds: unitsRmsExternalIds,
              file: validLroOnlyUnitsFile,
              expectedPricingLength: initialInventoryTypes.length + unitsRmsExternalIds.length,
              setupParams: { propertyId, building },
            });

            // We update the state of the rentable item,in RmsPricing this state is different because it has not been updated yet, this will help us know if we actually updated the pricing
            const initialInventory = await updateInventory(ctx, inventories[0].id, { state: DALTypes.InventoryState.VACANT_MAKE_READY });

            // We create the new inventories where the pricing should be computed
            const newInventories = await createInventoriesByType(inventoryTypes, building);
            const expectedInventories = [...newInventories, initialInventory]
              .map(({ id, state, type }) => ({ id, state, type }))
              .filter(({ type }) => type !== DALTypes.InventoryType.UNIT);

            await executeInventoryStateChangedTest({
              propertyId,
              expectedUnitPricingLength: unitsRmsExternalIds.length,
              expectedRIPricingLength: rentableItemInventories.length + 1, // We add one because we created a new rentable item
              expectedInventories,
              compareOnlyRentableItems: true,
              expectedResult: { errors: [], processed: expectedInventories.length },
            });
          });
        });
      });
    });
  });
});
