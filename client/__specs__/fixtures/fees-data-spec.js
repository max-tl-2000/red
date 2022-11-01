/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import Immutable from 'immutable';

const generateFee = (
  id,
  displayName,
  quoteSectionName,
  children,
  isAdditional = false,
  firstFee = false,
  selected = false,
  visible = false,
  price = 10,
  quantity = 1,
  maxAmountPerItem = 20,
) => {
  price = price || 10;
  const maxAmount = maxAmountPerItem * quantity;
  const amount = price * quantity;
  displayName = displayName || 'foo';
  return {
    id,
    name: displayName,
    displayName,
    quoteSectionName: quoteSectionName || 'bar',
    selected: (isAdditional && visible) || selected,
    visible: firstFee || selected || visible,
    isAdditional,
    price,
    amount,
    quantity,
    children: children || [],
    maxAmountPerItem,
    maxAmount,
    variableAdjustmentAmount: amount,
  };
};

const generateLeaseTerm = (id, adjustedMarketRent, termLength, period = 'month') => {
  const lt = {
    id,
    adjustedMarketRent,
    termLength,
    period,
  };
  return lt;
};

const generateRelativeAmount = (leaseTermId, amount) => {
  const relativeAmount = {
    leaseTermId,
    amount,
  };
  return relativeAmount;
};

// returns field from object, regardless if object immutable or not
const getField = (obj, fieldName) => (Immutable.Iterable.isIterable(obj) ? obj.get(fieldName) : obj[fieldName]);

// returns the actual fee object by ID;  works on either mutable or immutable structures
const feeById = (structure, idToFind) => getField(structure, 'fees').find(fee => getField(fee, 'id') === idToFind);

// contains a new fee object with only the id and children set
const feeReferenceById = (structure, idToFind) => {
  const matchingFee = feeById(structure, idToFind);
  return generateFee(getField(matchingFee, 'id'), null, null, [...getField(matchingFee, 'children')]);
};

// deep-clone structure and apply updateFn to the clone
const updatedStructure = (structure, updateFn) => {
  const newStructure = JSON.parse(JSON.stringify(structure));
  updateFn(newStructure);
  return newStructure;
};

/* properties constants */
/* These are here to make calls to generateFunction more clear */
const FIRST_FEE = true;
const IS_ADDITIONAL = true;
// const SELECTED = true;
// const VISIBLE = true;
const NO_CHILDREN = null;

/* quoteSectionName */
const APPLIANCE = 'appliance';
const PARKING = 'parking';
const PET = 'pet';
const UTILITY = 'utility';
const STORAGE = 'storage';
const DEPOSIT = 'deposit';
// const APPLICATION = 'application';

const SIMPLE_FEE_STRUCTURE = new Immutable.Map({
  name: 'month',
  fees: [
    generateFee('1', 'Air conditioner (Window Unit)', APPLIANCE, NO_CHILDREN, !IS_ADDITIONAL, FIRST_FEE),
    generateFee('2', 'Boat slip (per linear foot)', PARKING, NO_CHILDREN, !IS_ADDITIONAL, FIRST_FEE),
    generateFee('3', 'Cable TV', UTILITY, NO_CHILDREN, !IS_ADDITIONAL, FIRST_FEE),
    generateFee('10', 'Parking covered', PARKING, NO_CHILDREN, !IS_ADDITIONAL, FIRST_FEE),
    generateFee('11', 'Parking indoor', PARKING, NO_CHILDREN, !IS_ADDITIONAL, FIRST_FEE),
    generateFee('4', 'Pet large (26-60 lb)', PET, ['16'], !IS_ADDITIONAL, FIRST_FEE),
    generateFee('5', 'Pet small (25 lb or less)', PET, ['15'], !IS_ADDITIONAL, FIRST_FEE),
    generateFee('12', 'Storage', STORAGE, NO_CHILDREN, !IS_ADDITIONAL, FIRST_FEE),
    generateFee('13', 'Washer-Dryer combo', APPLIANCE, ['17'], !IS_ADDITIONAL, FIRST_FEE),
    generateFee('6', 'Wine locker', STORAGE, NO_CHILDREN, !IS_ADDITIONAL, FIRST_FEE),
    generateFee('17', 'Appliance deposit', DEPOSIT, NO_CHILDREN, IS_ADDITIONAL, !FIRST_FEE),
    generateFee('7', 'Gas', UTILITY, NO_CHILDREN, IS_ADDITIONAL, FIRST_FEE),
    generateFee('15', 'Pet deposit', DEPOSIT, NO_CHILDREN, IS_ADDITIONAL, !FIRST_FEE),
    generateFee('16', 'Pet deposit', DEPOSIT, NO_CHILDREN, IS_ADDITIONAL, !FIRST_FEE),
    generateFee('8', 'Security deposit', DEPOSIT, NO_CHILDREN, IS_ADDITIONAL, FIRST_FEE),
    generateFee('9', 'Water, Sewage, Trash', UTILITY, NO_CHILDREN, IS_ADDITIONAL, FIRST_FEE),
  ],
});

const mapToObject = map => JSON.parse(JSON.stringify(map));

const FEES_STRUCTURE = [
  {
    feesWithPeriods: [
      mapToObject(SIMPLE_FEE_STRUCTURE),
      mapToObject(
        updatedStructure(SIMPLE_FEE_STRUCTURE, structure => {
          structure.name = 'week';
          structure.fees = structure.fees.filter(fee => fee.id === '8');
        }),
      ),
      mapToObject(
        updatedStructure(SIMPLE_FEE_STRUCTURE, structure => {
          structure.name = 'day';
          structure.fees = structure.fees.filter(fee => fee.id === '8');
        }),
      ),
      mapToObject(
        updatedStructure(SIMPLE_FEE_STRUCTURE, structure => {
          structure.name = 'hour';
          structure.fees = structure.fees.filter(fee => fee.id === '8');
        }),
      ),
    ],
    expectedFeesForMonthPeriod: {
      additionalCharges: [
        mapToObject(
          updatedStructure(SIMPLE_FEE_STRUCTURE, structure => {
            const _fees = ['1', '13'];
            structure.name = 'appliance';
            structure.fees = structure.fees.filter(fee => _fees.some(f => f === fee.id));
          }),
        ),
        mapToObject(
          updatedStructure(SIMPLE_FEE_STRUCTURE, structure => {
            const _fees = ['2', '10', '11'];
            structure.name = 'parking';
            structure.fees = structure.fees.filter(fee => _fees.some(f => f === fee.id));
          }),
        ),
        mapToObject(
          updatedStructure(SIMPLE_FEE_STRUCTURE, structure => {
            const _fees = ['4', '5'];
            structure.name = 'pet';
            structure.fees = structure.fees.filter(fee => _fees.some(f => f === fee.id));
          }),
        ),
        mapToObject(
          updatedStructure(SIMPLE_FEE_STRUCTURE, structure => {
            const _fees = ['12', '6'];
            structure.name = 'storage';
            structure.fees = structure.fees.filter(fee => _fees.some(f => f === fee.id));
          }),
        ),
        mapToObject(
          updatedStructure(SIMPLE_FEE_STRUCTURE, structure => {
            const _fees = ['3', '7', '9'];
            structure.name = 'utility';
            structure.fees = structure.fees.filter(fee => _fees.some(f => f === fee.id));
          }),
        ),
      ],
      oneTimeCharges: [
        mapToObject(
          updatedStructure(SIMPLE_FEE_STRUCTURE, structure => {
            const _fees = ['17', '15', '16', '8'];
            structure.name = 'deposit';
            structure.fees = structure.fees.filter(fee => _fees.some(f => f === fee.id));
          }),
        ),
      ],
    },
    expectedFeesForWeekPeriod: {
      additionalCharges: [],
      oneTimeCharges: [
        mapToObject(
          updatedStructure(SIMPLE_FEE_STRUCTURE, structure => {
            const _fees = ['8'];
            structure.name = 'deposit';
            structure.fees = structure.fees.filter(fee => _fees.some(f => f === fee.id));
          }),
        ),
      ],
    },
    expectedFeesForDayPeriod: {
      additionalCharges: [],
      oneTimeCharges: [
        mapToObject(
          updatedStructure(SIMPLE_FEE_STRUCTURE, structure => {
            const _fees = ['8'];
            structure.name = 'deposit';
            structure.fees = structure.fees.filter(fee => _fees.some(f => f === fee.id));
          }),
        ),
      ],
    },
    expectedFeesForHourPeriod: {
      additionalCharges: [],
      oneTimeCharges: [
        mapToObject(
          updatedStructure(SIMPLE_FEE_STRUCTURE, structure => {
            const _fees = ['8'];
            structure.name = 'deposit';
            structure.fees = structure.fees.filter(fee => _fees.some(f => f === fee.id));
          }),
        ),
      ],
    },
  },
];

// Storage IG link with additional fees for each IG
const SIMPLE_STORAGE_STRUCTURE = new Immutable.Map({
  name: 'month',
  fees: [
    generateFee('1', 'Large Storage', STORAGE, ['1-1'], !IS_ADDITIONAL, FIRST_FEE),
    generateFee('2', 'Medimun Storage', STORAGE, ['2-1'], !IS_ADDITIONAL, FIRST_FEE),
    generateFee('3', 'Small Storage', STORAGE, ['3-1'], !IS_ADDITIONAL, FIRST_FEE),
    generateFee('1-1', 'Storage Deposit', DEPOSIT, NO_CHILDREN, IS_ADDITIONAL),
    generateFee('2-1', 'Storage Deposit', DEPOSIT, NO_CHILDREN, IS_ADDITIONAL),
    generateFee('3-1', 'Storage Deposit', DEPOSIT, NO_CHILDREN, IS_ADDITIONAL),
  ],
});

// structure to show that selecting a fee also selects its children
const SELECT_FEE = [
  {
    structure: [].concat(mapToObject(SIMPLE_STORAGE_STRUCTURE)),
    feeToSelect: feeReferenceById(SIMPLE_STORAGE_STRUCTURE, '1'),
    expectedResult: [].concat(
      updatedStructure(SIMPLE_STORAGE_STRUCTURE, structure => {
        feeById(structure, '1').selected = true;
        feeById(structure, '1').visible = true;
        feeById(structure, '1-1').selected = true;
        feeById(structure, '1-1').visible = true;
      }),
    ),
  },
  {
    structure: [].concat(mapToObject(SIMPLE_STORAGE_STRUCTURE)),
    feeToSelect: feeReferenceById(SIMPLE_STORAGE_STRUCTURE, '2'),
    expectedResult: [].concat(
      updatedStructure(SIMPLE_STORAGE_STRUCTURE, structure => {
        feeById(structure, '2').selected = true;
        feeById(structure, '2').visible = true;
        feeById(structure, '2-1').selected = true;
        feeById(structure, '2-1').visible = true;
      }),
    ),
  },
  {
    structure: [].concat(mapToObject(SIMPLE_STORAGE_STRUCTURE)),
    feeToSelect: feeReferenceById(SIMPLE_STORAGE_STRUCTURE, '3'),
    expectedResult: [].concat(
      updatedStructure(SIMPLE_STORAGE_STRUCTURE, structure => {
        feeById(structure, '3').selected = true;
        feeById(structure, '3').visible = true;
        feeById(structure, '3-1').selected = true;
        feeById(structure, '3-1').visible = true;
      }),
    ),
  },
];

const changeQuantityById = idFee =>
  new Immutable.Map(
    updatedStructure(SIMPLE_STORAGE_STRUCTURE, structure => {
      feeById(structure, idFee).price = 12;
      feeById(structure, idFee).amount = 12;
    }),
  );

const CHANGE_QUANTITY_FEE = [
  {
    structure: [].concat(mapToObject(changeQuantityById('1-1'))),
    feeToSelect: feeReferenceById(SIMPLE_STORAGE_STRUCTURE, '1'),
    newQuantity: 4,
    expectedResult: [].concat(
      updatedStructure(SIMPLE_STORAGE_STRUCTURE, structure => {
        feeById(structure, '1').quantity = 4;
        feeById(structure, '1').amount = 40;
        feeById(structure, '1').variableAdjustmentAmount = 40;
        feeById(structure, '1').maxAmount = 80;
        feeById(structure, '1').selected = true;
        feeById(structure, '1').visible = true;
        feeById(structure, '1-1').quantity = 4;
        feeById(structure, '1-1').price = 12;
        feeById(structure, '1-1').amount = 48;
        feeById(structure, '1-1').maxAmount = 80;
        feeById(structure, '1-1').selected = true;
        feeById(structure, '1-1').visible = true;
      }),
    ),
  },
  {
    structure: [].concat(mapToObject(changeQuantityById('2-1'))),
    feeToSelect: feeReferenceById(SIMPLE_STORAGE_STRUCTURE, '2'),
    newQuantity: 4,
    expectedResult: [].concat(
      updatedStructure(SIMPLE_STORAGE_STRUCTURE, structure => {
        feeById(structure, '2').quantity = 4;
        feeById(structure, '2').amount = 40;
        feeById(structure, '2').variableAdjustmentAmount = 40;
        feeById(structure, '2').maxAmount = 80;
        feeById(structure, '2').selected = true;
        feeById(structure, '2').visible = true;
        feeById(structure, '2-1').quantity = 4;
        feeById(structure, '2-1').price = 12;
        feeById(structure, '2-1').amount = 48;
        feeById(structure, '2-1').maxAmount = 80;
        feeById(structure, '2-1').selected = true;
        feeById(structure, '2-1').visible = true;
      }),
    ),
  },
  {
    structure: [].concat(mapToObject(changeQuantityById('3-1'))),
    feeToSelect: feeReferenceById(SIMPLE_STORAGE_STRUCTURE, '3'),
    newQuantity: 4,
    expectedResult: [].concat(
      updatedStructure(SIMPLE_STORAGE_STRUCTURE, structure => {
        feeById(structure, '3').quantity = 4;
        feeById(structure, '3').amount = 40;
        feeById(structure, '3').variableAdjustmentAmount = 40;
        feeById(structure, '3').maxAmount = 80;
        feeById(structure, '3').selected = true;
        feeById(structure, '3').visible = true;
        feeById(structure, '3-1').quantity = 4;
        feeById(structure, '3-1').price = 12;
        feeById(structure, '3-1').amount = 48;
        feeById(structure, '3-1').maxAmount = 80;
        feeById(structure, '3-1').selected = true;
        feeById(structure, '3-1').visible = true;
      }),
    ),
  },
];

const DIFFERENT_DEPOSIT_FOR_EACH_LEASE_TERM = [generateLeaseTerm('123', 1800, 1), generateLeaseTerm('456', 1500, 6), generateLeaseTerm('789', 1200, 12)];

const DIFFERENT_DEPOSIT_RELATIVE_AMOUNTS = [generateRelativeAmount('123', 1800), generateRelativeAmount('456', 1500), generateRelativeAmount('789', 1200)];

const SAME_DEPOSIT_FOR_EACH_LEASE_TERM = [generateLeaseTerm('123', 988, 1), generateLeaseTerm('456', 988, 6), generateLeaseTerm('789', 988, 12)];

const SAME_DEPOSIT_RELATIVE_AMOUNTS = [generateRelativeAmount('123', 988), generateRelativeAmount('456', 988), generateRelativeAmount('789', 988)];

export {
  FEES_STRUCTURE,
  SELECT_FEE,
  CHANGE_QUANTITY_FEE,
  DIFFERENT_DEPOSIT_FOR_EACH_LEASE_TERM,
  SAME_DEPOSIT_FOR_EACH_LEASE_TERM,
  DIFFERENT_DEPOSIT_RELATIVE_AMOUNTS,
  SAME_DEPOSIT_RELATIVE_AMOUNTS,
};
