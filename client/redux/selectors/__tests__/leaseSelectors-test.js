/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getUnitReservedWarning, removeExtraWhiteSpaces, findDuplicates } from '../leaseSelectors';
import { DALTypes } from '../../../../common/enums/DALTypes';

describe('Lease Selectors', () => {
  const currentPartyId = 'party1';
  const otherPartyId = 'party2';
  const userId = 'user1';
  const unitReservedWarningModel = {
    message: 'UNIT_RESERVED_WARNING',
    agent: '',
    partyId: otherPartyId,
    unitName: 'abc',
    reservedOnThirdParty: !otherPartyId,
  };

  const createStateAndProps = inventoryHolds => {
    const quoteId = 'quote1';

    const state = {
      quotes: {
        quotes: [
          {
            id: quoteId,
            inventory: {
              inventoryHolds,
              name: 'abc',
            },
          },
        ],
      },
      globalStore: {
        get: name => ({ [name]: [{ id: userId }] }),
      },
    };

    const props = {
      party: { id: currentPartyId, workflowName: DALTypes.WorkflowName.NEW_LEASE },
      lease: { quoteId },
    };
    return [state, props];
  };

  describe('when getUnitReservedWarning gets called', () => {
    describe('and there is a unit hold of other party', () => {
      it('should return the UnitReservedWarning model', () => {
        const inventoryHolds = [
          {
            partyId: otherPartyId,
            heldBy: userId,
          },
        ];
        const result = getUnitReservedWarning(...createStateAndProps(inventoryHolds));
        expect(result).toEqual(unitReservedWarningModel);
      });
    });

    describe('and there is not a unit hold of other party', () => {
      it('should return null', () => {
        const result = getUnitReservedWarning(...createStateAndProps([]));
        expect(result).toBe(null);
      });
    });
  });

  describe('and there is a unit hold of the same party', () => {
    it('should return null', () => {
      const inventoryHolds = [
        {
          partyId: currentPartyId,
          heldBy: userId,
        },
      ];

      const result = getUnitReservedWarning(...createStateAndProps(inventoryHolds));
      expect(result).toBe(null);
    });
  });

  describe('when call removeExtraWhiteSpaces', () => {
    it('should remove extra white spaces', () => {
      expect(removeExtraWhiteSpaces(' John   Carl ')).toBe('John Carl');
      expect(removeExtraWhiteSpaces('John    ')).toBe('John');
      expect(removeExtraWhiteSpaces('  John')).toBe('John');
    });
  });

  describe('when call findDuplicates', () => {
    it('should add a flag isDuplicated to each duplicate item', () => {
      const item1 = [{ name: ' John   Carl ' }, { name: 'miguel ' }, { name: 'John Carl' }, { name: 'john carl ' }, { name: 'Miguel' }, { name: 'Carlos' }];

      const result = findDuplicates(item1);

      expect(result[0].isDuplicated).toEqual(false);
      expect(result[1].isDuplicated).toEqual(false);
      expect(result[2].isDuplicated).toEqual(true);
      expect(result[3].isDuplicated).toEqual(true);
      expect(result[4].isDuplicated).toEqual(true);
      expect(result[5].isDuplicated).toEqual(false);
    });
  });
});
