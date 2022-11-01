/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import { DALTypes } from '../../../../../../common/enums/DALTypes';

const generateMember = ({ id, memberType, guaranteedBy, firstName, lastName, grossIncomeMonthly }) => ({
  partyMember: {
    id,
    personId: newId(),
    memberType,
    guaranteedBy,
  },
  personApplication: {
    persondId: newId(),
    applicationData: {
      firstName,
      lastName,
      grossIncomeMonthly,
    },
  },
});

const roommateOneId = newId();
const roommateTwoId = newId();
const roommateThreeId = newId();
const roommateFourId = newId();

const guarantorOneId = newId();
const guarantorTwoId = newId();

const ZERO_INCOME = 0;
const SEVEN_HUNDRED_INCOME = 700;
const ONE_THOUSAND_AND_THREE_HUNDRED_INCOME = 1300;
const SEVEN_THOUSAND_INCOME = 7000;
const SIX_THOUSAND_INCOME = 6000;
const THREE_THOUSAND_INCOME = 3000;
const TWO_THOUSAND_INCOME = 2000;
const TWO_THOUSAND_AND_FIVE_HUNDRED_INCOME = 2500;
const THREE_THOUSAND_AND_FIVE_HUNDRED_INCOME = 3500;

const FIRST_CASE_ROOMMATES_COMBINED_INCOME = (ZERO_INCOME + SEVEN_HUNDRED_INCOME + SEVEN_HUNDRED_INCOME + ONE_THOUSAND_AND_THREE_HUNDRED_INCOME) / 4;

export const CASE_FOUR_ROOMMATES_AND_ONE_GUARANTOR_LINKED_TO_THREE = {
  members: [
    generateMember({
      id: roommateOneId,
      memberType: DALTypes.MemberType.RESIDENT,
      firstName: 'Jonh',
      lastName: 'Walker',
      grossIncomeMonthly: ZERO_INCOME,
      guaranteedBy: guarantorOneId,
    }),
    generateMember({
      id: roommateTwoId,
      memberType: DALTypes.MemberType.RESIDENT,
      firstName: 'Jose',
      lastName: 'Sanchez',
      grossIncomeMonthly: SEVEN_HUNDRED_INCOME,
      guaranteedBy: guarantorOneId,
    }),
    generateMember({
      id: roommateThreeId,
      memberType: DALTypes.MemberType.RESIDENT,
      firstName: 'Tom',
      lastName: 'Boyle',
      grossIncomeMonthly: SEVEN_HUNDRED_INCOME,
      guaranteedBy: guarantorOneId,
    }),
    generateMember({
      id: roommateFourId,
      memberType: DALTypes.MemberType.RESIDENT,
      firstName: 'Jack',
      lastName: 'Hack',
      grossIncomeMonthly: ONE_THOUSAND_AND_THREE_HUNDRED_INCOME,
    }),
    generateMember({
      id: guarantorOneId,
      memberType: DALTypes.MemberType.GUARANTOR,
      firstName: 'Trustful',
      lastName: 'Holmes',
      grossIncomeMonthly: SEVEN_THOUSAND_INCOME,
    }),
  ],
  expectedResidents: [
    {
      id: roommateOneId,
      grossIncomeMonthly: FIRST_CASE_ROOMMATES_COMBINED_INCOME,
      guaranteedBy: guarantorOneId,
    },
    {
      id: roommateTwoId,
      grossIncomeMonthly: FIRST_CASE_ROOMMATES_COMBINED_INCOME,
      guaranteedBy: guarantorOneId,
    },
    {
      id: roommateThreeId,
      grossIncomeMonthly: FIRST_CASE_ROOMMATES_COMBINED_INCOME,
      guaranteedBy: guarantorOneId,
    },
    {
      id: roommateFourId,
      grossIncomeMonthly: FIRST_CASE_ROOMMATES_COMBINED_INCOME,
      guaranteedBy: guarantorOneId,
    },
  ],
  expectedGuarantors: [
    {
      id: guarantorOneId,
      grossIncomeMonthly: SEVEN_THOUSAND_INCOME,
    },
  ],
};

export const CASE_FOUR_ROOMMATES_AND_ONE_GUARANTOR_LINKED_TO_THREE_WITH_INDIVIDUAL_AND_PRORATED_POOL_POLICIES = {
  members: [
    generateMember({
      id: roommateOneId,
      memberType: DALTypes.MemberType.RESIDENT,
      firstName: 'Jonh',
      lastName: 'Walker',
      grossIncomeMonthly: ZERO_INCOME,
      guaranteedBy: guarantorOneId,
    }),
    generateMember({
      id: roommateTwoId,
      memberType: DALTypes.MemberType.RESIDENT,
      firstName: 'Jose',
      lastName: 'Sanchez',
      grossIncomeMonthly: SEVEN_HUNDRED_INCOME,
      guaranteedBy: guarantorOneId,
    }),
    generateMember({
      id: roommateThreeId,
      memberType: DALTypes.MemberType.RESIDENT,
      firstName: 'Tom',
      lastName: 'Boyle',
      grossIncomeMonthly: SEVEN_HUNDRED_INCOME,
      guaranteedBy: guarantorOneId,
    }),
    generateMember({
      id: roommateFourId,
      memberType: DALTypes.MemberType.RESIDENT,
      firstName: 'Jack',
      lastName: 'Hack',
      grossIncomeMonthly: ONE_THOUSAND_AND_THREE_HUNDRED_INCOME,
    }),
    generateMember({
      id: guarantorOneId,
      memberType: DALTypes.MemberType.GUARANTOR,
      firstName: 'Trustful',
      lastName: 'Holmes',
      grossIncomeMonthly: SEVEN_THOUSAND_INCOME,
    }),
  ],
  expectedResidents: [
    {
      id: roommateOneId,
      grossIncomeMonthly: ZERO_INCOME,
      guaranteedBy: guarantorOneId,
    },
    {
      id: roommateTwoId,
      grossIncomeMonthly: SEVEN_HUNDRED_INCOME,
      guaranteedBy: guarantorOneId,
    },
    {
      id: roommateThreeId,
      grossIncomeMonthly: SEVEN_HUNDRED_INCOME,
      guaranteedBy: guarantorOneId,
    },
    {
      id: roommateFourId,
      grossIncomeMonthly: ONE_THOUSAND_AND_THREE_HUNDRED_INCOME,
      guaranteedBy: guarantorOneId,
    },
  ],
  expectedGuarantors: [
    {
      id: guarantorOneId,
      grossIncomeMonthly: SEVEN_THOUSAND_INCOME,
    },
  ],
};

export const CASE_FOUR_ROOMMATES_AND_ONE_GUARANTOR_LINKED_TO_THREE_WITH_COMBINED_AND_INDIVIDUAL_POLICIES = {
  members: [
    generateMember({
      id: roommateOneId,
      memberType: DALTypes.MemberType.RESIDENT,
      firstName: 'Jonh',
      lastName: 'Walker',
      grossIncomeMonthly: ZERO_INCOME,
      guaranteedBy: guarantorOneId,
    }),
    generateMember({
      id: roommateTwoId,
      memberType: DALTypes.MemberType.RESIDENT,
      firstName: 'Jose',
      lastName: 'Sanchez',
      grossIncomeMonthly: SEVEN_HUNDRED_INCOME,
      guaranteedBy: guarantorOneId,
    }),
    generateMember({
      id: roommateThreeId,
      memberType: DALTypes.MemberType.RESIDENT,
      firstName: 'Tom',
      lastName: 'Boyle',
      grossIncomeMonthly: SEVEN_HUNDRED_INCOME,
      guaranteedBy: guarantorOneId,
    }),
    generateMember({
      id: roommateFourId,
      memberType: DALTypes.MemberType.RESIDENT,
      firstName: 'Jack',
      lastName: 'Hack',
      grossIncomeMonthly: ONE_THOUSAND_AND_THREE_HUNDRED_INCOME,
    }),
    generateMember({
      id: guarantorOneId,
      memberType: DALTypes.MemberType.GUARANTOR,
      firstName: 'Trustful',
      lastName: 'Holmes',
      grossIncomeMonthly: SEVEN_THOUSAND_INCOME,
    }),
  ],
  expectedResidents: [
    {
      id: roommateOneId,
      grossIncomeMonthly: FIRST_CASE_ROOMMATES_COMBINED_INCOME,
      guaranteedBy: guarantorOneId,
    },
    {
      id: roommateTwoId,
      grossIncomeMonthly: FIRST_CASE_ROOMMATES_COMBINED_INCOME,
      guaranteedBy: guarantorOneId,
    },
    {
      id: roommateThreeId,
      grossIncomeMonthly: FIRST_CASE_ROOMMATES_COMBINED_INCOME,
      guaranteedBy: guarantorOneId,
    },
    {
      id: roommateFourId,
      grossIncomeMonthly: FIRST_CASE_ROOMMATES_COMBINED_INCOME,
    },
  ],
  expectedGuarantors: [
    {
      id: guarantorOneId,
      grossIncomeMonthly: SEVEN_THOUSAND_INCOME,
    },
  ],
};

const SECOND_CASE_FIRST_GUARANTOR_INCOME = (SIX_THOUSAND_INCOME + SEVEN_THOUSAND_INCOME) * ((4 - 2 + 1) / 4);

export const CASE_FOUR_ROOMMATES_AND_TWO_GUARANTORS_LINKED_TO_THREE = {
  members: [
    generateMember({
      id: roommateOneId,
      memberType: DALTypes.MemberType.RESIDENT,
      firstName: 'Jonh',
      lastName: 'Walker',
      grossIncomeMonthly: ZERO_INCOME,
      guaranteedBy: guarantorOneId,
    }),
    generateMember({
      id: roommateTwoId,
      memberType: DALTypes.MemberType.RESIDENT,
      firstName: 'Jose',
      lastName: 'Sanchez',
      grossIncomeMonthly: SEVEN_HUNDRED_INCOME,
      guaranteedBy: guarantorOneId,
    }),
    generateMember({
      id: roommateThreeId,
      memberType: DALTypes.MemberType.RESIDENT,
      firstName: 'Tom',
      lastName: 'Boyle',
      grossIncomeMonthly: SEVEN_HUNDRED_INCOME,
      guaranteedBy: guarantorTwoId,
    }),
    generateMember({
      id: roommateFourId,
      memberType: DALTypes.MemberType.RESIDENT,
      firstName: 'Jack',
      lastName: 'Hack',
      grossIncomeMonthly: ONE_THOUSAND_AND_THREE_HUNDRED_INCOME,
    }),
    generateMember({
      id: guarantorOneId,
      memberType: DALTypes.MemberType.GUARANTOR,
      firstName: 'Trustful',
      lastName: 'Holmes',
      grossIncomeMonthly: SIX_THOUSAND_INCOME,
    }),
    generateMember({
      id: guarantorTwoId,
      memberType: DALTypes.MemberType.GUARANTOR,
      firstName: 'Trusty',
      lastName: 'Holmes',
      grossIncomeMonthly: SEVEN_THOUSAND_INCOME,
    }),
  ],
  expectedResidents: [
    {
      id: roommateOneId,
      grossIncomeMonthly: FIRST_CASE_ROOMMATES_COMBINED_INCOME,
      guaranteedBy: guarantorOneId,
    },
    {
      id: roommateTwoId,
      grossIncomeMonthly: FIRST_CASE_ROOMMATES_COMBINED_INCOME,
      guaranteedBy: guarantorOneId,
    },
    {
      id: roommateThreeId,
      grossIncomeMonthly: FIRST_CASE_ROOMMATES_COMBINED_INCOME,
      guaranteedBy: guarantorOneId,
    },
    {
      id: roommateFourId,
      grossIncomeMonthly: FIRST_CASE_ROOMMATES_COMBINED_INCOME,
      guaranteedBy: guarantorTwoId,
    },
  ],
  expectedGuarantors: [
    {
      id: guarantorOneId,
      grossIncomeMonthly: SECOND_CASE_FIRST_GUARANTOR_INCOME,
    },
    {
      id: guarantorTwoId,
      grossIncomeMonthly: SEVEN_THOUSAND_INCOME + SIX_THOUSAND_INCOME - SECOND_CASE_FIRST_GUARANTOR_INCOME,
    },
  ],
};

export const CASE_FOUR_ROOMMATES_AND_TWO_GUARANTORS_LINKED_TO_THREE_WITH_PERMUTATED_POLICIES_WITH_INDIVIDUAL_AND_PRORATED_POOL_POLICIES = {
  members: [
    generateMember({
      id: roommateOneId,
      memberType: DALTypes.MemberType.RESIDENT,
      firstName: 'Jonh',
      lastName: 'Walker',
      grossIncomeMonthly: ZERO_INCOME,
      guaranteedBy: guarantorOneId,
    }),
    generateMember({
      id: roommateTwoId,
      memberType: DALTypes.MemberType.RESIDENT,
      firstName: 'Jose',
      lastName: 'Sanchez',
      grossIncomeMonthly: SEVEN_HUNDRED_INCOME,
      guaranteedBy: guarantorOneId,
    }),
    generateMember({
      id: roommateThreeId,
      memberType: DALTypes.MemberType.RESIDENT,
      firstName: 'Tom',
      lastName: 'Boyle',
      grossIncomeMonthly: SEVEN_HUNDRED_INCOME,
      guaranteedBy: guarantorTwoId,
    }),
    generateMember({
      id: roommateFourId,
      memberType: DALTypes.MemberType.RESIDENT,
      firstName: 'Jack',
      lastName: 'Hack',
      grossIncomeMonthly: ONE_THOUSAND_AND_THREE_HUNDRED_INCOME,
    }),
    generateMember({
      id: guarantorOneId,
      memberType: DALTypes.MemberType.GUARANTOR,
      firstName: 'Trustful',
      lastName: 'Holmes',
      grossIncomeMonthly: SIX_THOUSAND_INCOME,
    }),
    generateMember({
      id: guarantorTwoId,
      memberType: DALTypes.MemberType.GUARANTOR,
      firstName: 'Trusty',
      lastName: 'Holmes',
      grossIncomeMonthly: SEVEN_THOUSAND_INCOME,
    }),
  ],
  expectedResidents: [
    {
      id: roommateOneId,
      grossIncomeMonthly: ZERO_INCOME,
      guaranteedBy: guarantorOneId,
    },
    {
      id: roommateTwoId,
      grossIncomeMonthly: SEVEN_HUNDRED_INCOME,
      guaranteedBy: guarantorOneId,
    },
    {
      id: roommateThreeId,
      grossIncomeMonthly: SEVEN_HUNDRED_INCOME,
      guaranteedBy: guarantorOneId,
    },
    {
      id: roommateFourId,
      grossIncomeMonthly: ONE_THOUSAND_AND_THREE_HUNDRED_INCOME,
      guaranteedBy: guarantorTwoId,
    },
  ],
  expectedGuarantors: [
    {
      id: guarantorOneId,
      grossIncomeMonthly: SECOND_CASE_FIRST_GUARANTOR_INCOME,
    },
    {
      id: guarantorTwoId,
      grossIncomeMonthly: SEVEN_THOUSAND_INCOME + SIX_THOUSAND_INCOME - SECOND_CASE_FIRST_GUARANTOR_INCOME,
    },
  ],
};

export const CASE_FOUR_ROOMMATES_AND_TWO_GUARANTORS_LINKED_TO_THREE_WITH_PERMUTATED_POLICIES_WITH_COMBINED_AND_INDIVIDUAL_POLICIES = {
  members: [
    generateMember({
      id: roommateOneId,
      memberType: DALTypes.MemberType.RESIDENT,
      firstName: 'Jonh',
      lastName: 'Walker',
      grossIncomeMonthly: ZERO_INCOME,
      guaranteedBy: guarantorOneId,
    }),
    generateMember({
      id: roommateTwoId,
      memberType: DALTypes.MemberType.RESIDENT,
      firstName: 'Jose',
      lastName: 'Sanchez',
      grossIncomeMonthly: SEVEN_HUNDRED_INCOME,
      guaranteedBy: guarantorOneId,
    }),
    generateMember({
      id: roommateThreeId,
      memberType: DALTypes.MemberType.RESIDENT,
      firstName: 'Tom',
      lastName: 'Boyle',
      grossIncomeMonthly: SEVEN_HUNDRED_INCOME,
      guaranteedBy: guarantorTwoId,
    }),
    generateMember({
      id: roommateFourId,
      memberType: DALTypes.MemberType.RESIDENT,
      firstName: 'Jack',
      lastName: 'Hack',
      grossIncomeMonthly: ONE_THOUSAND_AND_THREE_HUNDRED_INCOME,
    }),
    generateMember({
      id: guarantorOneId,
      memberType: DALTypes.MemberType.GUARANTOR,
      firstName: 'Trustful',
      lastName: 'Holmes',
      grossIncomeMonthly: SIX_THOUSAND_INCOME,
    }),
    generateMember({
      id: guarantorTwoId,
      memberType: DALTypes.MemberType.GUARANTOR,
      firstName: 'Trusty',
      lastName: 'Holmes',
      grossIncomeMonthly: SEVEN_THOUSAND_INCOME,
    }),
  ],
  expectedResidents: [
    {
      id: roommateOneId,
      grossIncomeMonthly: FIRST_CASE_ROOMMATES_COMBINED_INCOME,
      guaranteedBy: guarantorOneId,
    },
    {
      id: roommateTwoId,
      grossIncomeMonthly: FIRST_CASE_ROOMMATES_COMBINED_INCOME,
      guaranteedBy: guarantorOneId,
    },
    {
      id: roommateThreeId,
      grossIncomeMonthly: FIRST_CASE_ROOMMATES_COMBINED_INCOME,
      guaranteedBy: guarantorTwoId,
    },
    {
      id: roommateFourId,
      grossIncomeMonthly: FIRST_CASE_ROOMMATES_COMBINED_INCOME,
    },
  ],
  expectedGuarantors: [
    {
      id: guarantorOneId,
      grossIncomeMonthly: SIX_THOUSAND_INCOME,
    },
    {
      id: guarantorTwoId,
      grossIncomeMonthly: SEVEN_THOUSAND_INCOME,
    },
  ],
};

const THIRD_CASE_ROOMMATES_COMBINED_INCOME = (ZERO_INCOME + SEVEN_HUNDRED_INCOME + SEVEN_HUNDRED_INCOME + SEVEN_HUNDRED_INCOME) / 4;
const THIRD_CASE_FIRST_GUARANTOR_INCOME = (THREE_THOUSAND_INCOME + SEVEN_THOUSAND_INCOME) * ((4 - 2 + 1) / 4);

export const CASE_FOUR_ROOMMATES_AND_TWO_GUARANTORS_LINKED_TO_ALL_WITH_LOWER_INCOMES = {
  members: [
    generateMember({
      id: roommateOneId,
      memberType: DALTypes.MemberType.RESIDENT,
      firstName: 'Jonh',
      lastName: 'Walker',
      grossIncomeMonthly: ZERO_INCOME,
      guaranteedBy: guarantorOneId,
    }),
    generateMember({
      id: roommateTwoId,
      memberType: DALTypes.MemberType.RESIDENT,
      firstName: 'Jose',
      lastName: 'Sanchez',
      grossIncomeMonthly: SEVEN_HUNDRED_INCOME,
      guaranteedBy: guarantorOneId,
    }),
    generateMember({
      id: roommateThreeId,
      memberType: DALTypes.MemberType.RESIDENT,
      firstName: 'Tom',
      lastName: 'Boyle',
      grossIncomeMonthly: SEVEN_HUNDRED_INCOME,
      guaranteedBy: guarantorTwoId,
    }),
    generateMember({
      id: roommateFourId,
      memberType: DALTypes.MemberType.RESIDENT,
      firstName: 'Jack',
      lastName: 'Hack',
      grossIncomeMonthly: SEVEN_HUNDRED_INCOME,
      guaranteedBy: guarantorTwoId,
    }),
    generateMember({
      id: guarantorOneId,
      memberType: DALTypes.MemberType.GUARANTOR,
      firstName: 'Trustful',
      lastName: 'Holmes',
      grossIncomeMonthly: THREE_THOUSAND_INCOME,
    }),
    generateMember({
      id: guarantorTwoId,
      memberType: DALTypes.MemberType.GUARANTOR,
      firstName: 'Trusty',
      lastName: 'Holmes',
      grossIncomeMonthly: SEVEN_THOUSAND_INCOME,
    }),
  ],
  expectedResidents: [
    {
      id: roommateOneId,
      grossIncomeMonthly: THIRD_CASE_ROOMMATES_COMBINED_INCOME,
      guaranteedBy: guarantorOneId,
    },
    {
      id: roommateTwoId,
      grossIncomeMonthly: THIRD_CASE_ROOMMATES_COMBINED_INCOME,
      guaranteedBy: guarantorOneId,
    },
    {
      id: roommateThreeId,
      grossIncomeMonthly: THIRD_CASE_ROOMMATES_COMBINED_INCOME,
      guaranteedBy: guarantorOneId,
    },
    {
      id: roommateFourId,
      grossIncomeMonthly: THIRD_CASE_ROOMMATES_COMBINED_INCOME,
      guaranteedBy: guarantorTwoId,
    },
  ],
  expectedGuarantors: [
    {
      id: guarantorOneId,
      grossIncomeMonthly: THIRD_CASE_FIRST_GUARANTOR_INCOME,
    },
    {
      id: guarantorTwoId,
      grossIncomeMonthly: THREE_THOUSAND_INCOME + SEVEN_THOUSAND_INCOME - THIRD_CASE_FIRST_GUARANTOR_INCOME,
    },
  ],
};

const FOUR_CASE_ROOMMATES_COMBINED_INCOME = (TWO_THOUSAND_INCOME + TWO_THOUSAND_AND_FIVE_HUNDRED_INCOME) / 2;

export const CASE_TWO_ROOMMATES_AND_ONE_GUARANTOR_LINKED_TO_ONE = {
  members: [
    generateMember({
      id: roommateOneId,
      memberType: DALTypes.MemberType.RESIDENT,
      firstName: 'Jonh',
      lastName: 'Walker',
      grossIncomeMonthly: TWO_THOUSAND_INCOME,
      guaranteedBy: guarantorOneId,
    }),
    generateMember({
      id: roommateTwoId,
      memberType: DALTypes.MemberType.RESIDENT,
      firstName: 'Jose',
      lastName: 'Sanchez',
      grossIncomeMonthly: TWO_THOUSAND_AND_FIVE_HUNDRED_INCOME,
    }),
    generateMember({
      id: guarantorOneId,
      memberType: DALTypes.MemberType.GUARANTOR,
      firstName: 'Trustful',
      lastName: 'Holmes',
      grossIncomeMonthly: THREE_THOUSAND_AND_FIVE_HUNDRED_INCOME,
    }),
  ],
  expectedResidents: [
    {
      id: roommateOneId,
      grossIncomeMonthly: FOUR_CASE_ROOMMATES_COMBINED_INCOME,
      guaranteedBy: guarantorOneId,
    },
    {
      id: roommateTwoId,
      grossIncomeMonthly: FOUR_CASE_ROOMMATES_COMBINED_INCOME,
      guaranteedBy: guarantorOneId,
    },
  ],
  expectedGuarantors: [
    {
      id: guarantorOneId,
      grossIncomeMonthly: THREE_THOUSAND_AND_FIVE_HUNDRED_INCOME,
    },
  ],
};

export const CASE_TWO_ROOMMATES_AND_ONE_GUARANTOR_LINKED_TO_ONE_WITH_PERMUTATED_POLICIES_WITH_COMBINED_AND_INDIVIDUAL_POLICIES = {
  members: [
    generateMember({
      id: roommateOneId,
      memberType: DALTypes.MemberType.RESIDENT,
      firstName: 'Jonh',
      lastName: 'Walker',
      grossIncomeMonthly: TWO_THOUSAND_INCOME,
      guaranteedBy: guarantorOneId,
    }),
    generateMember({
      id: roommateTwoId,
      memberType: DALTypes.MemberType.RESIDENT,
      firstName: 'Jose',
      lastName: 'Sanchez',
      grossIncomeMonthly: TWO_THOUSAND_AND_FIVE_HUNDRED_INCOME,
    }),
    generateMember({
      id: guarantorOneId,
      memberType: DALTypes.MemberType.GUARANTOR,
      firstName: 'Trustful',
      lastName: 'Holmes',
      grossIncomeMonthly: THREE_THOUSAND_AND_FIVE_HUNDRED_INCOME,
    }),
  ],
  expectedResidents: [
    {
      id: roommateOneId,
      grossIncomeMonthly: FOUR_CASE_ROOMMATES_COMBINED_INCOME,
      guaranteedBy: guarantorOneId,
    },
    {
      id: roommateTwoId,
      grossIncomeMonthly: FOUR_CASE_ROOMMATES_COMBINED_INCOME,
    },
  ],
  expectedGuarantors: [
    {
      id: guarantorOneId,
      grossIncomeMonthly: THREE_THOUSAND_AND_FIVE_HUNDRED_INCOME,
    },
  ],
};
