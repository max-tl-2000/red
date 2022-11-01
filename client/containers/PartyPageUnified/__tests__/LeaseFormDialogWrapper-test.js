/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { mount } from 'enzyme';
import { DALTypes } from 'enums/DALTypes';
import { LeaseFormDialogWrapper } from '../LeaseFormDialogWrapper';

const baseProps = {
  userToken: '',
  leaseFormData: {},
  unitName: '',
  readOnlyLease: false,
  leaseFormDirty: '',
  promotedQuotes: [],
  quotePromotion: {},
  promotedQuote: {},
  dlgLeaseForm: { isOpen: false },
};

describe('LeaseFormDialogWrapper', () => {
  const createLeaseFormDialogComponent = props => {
    const component = mount(<LeaseFormDialogWrapper {...baseProps} {...props} />);
    return { component, instance: component.instance() };
  };

  const inventoryLeasedDialogMsg = 'INVENTORY_UNAVAILABLE_LEASE_HOLD_MSG';
  const inventoryOnHoldDialogMsg = 'INVENTORY_UNAVAILABLE_MANUAL_HOLD_MSG';
  const inventoryLeasedAndOnHoldDialogMsg = 'INVENTORY_UNAVAILABLE_MANUAL_AND_LEASE_HOLDS_MSG';

  const partyId = '1';
  const leaseId = '1';
  const quoteId = '1';

  const tryToPublishLease = ({ component, instance }) => {
    instance.handlePublishLease(partyId, leaseId, {}, quoteId);
    return component.render().find('#inventory-holding-warning-dialog').find('.text').text();
  };

  const createQuotes = ({ inventoryHoldTypes, holdPartyId }) => [
    {
      id: quoteId,
      inventory: {
        inventoryHolds: inventoryHoldTypes.map(holdType => ({ partyId: holdPartyId, reason: holdType })),
      },
    },
  ];

  const publishLease = jest.fn(() => true);

  it('should mount the component without throwing', () => {
    const component = () => mount(<LeaseFormDialogWrapper {...baseProps} />);
    expect(component).not.toThrow();
  });

  describe('when someone tries to publish a lease', () => {
    describe('and the unit has a LEASE hold from other party', () => {
      xit('should display a dialog with the message: INVENTORY_UNAVAILABLE_LEASE_HOLD_MSG', () => {
        const quotesWithOtherPartyLeaseHold = createQuotes({ inventoryHoldTypes: [DALTypes.InventoryOnHoldReason.LEASE], holdPartyId: 2 });
        const leaseFormDialogComponent = createLeaseFormDialogComponent({ quotes: quotesWithOtherPartyLeaseHold });

        const dialogMsg = tryToPublishLease(leaseFormDialogComponent);

        expect(dialogMsg).toBe(inventoryLeasedDialogMsg);
      });
    });

    describe('and the unit has a MANUAL hold from other party', () => {
      xit('should display a dialog with the message: INVENTORY_UNAVAILABLE_MANUAL_HOLD_MSG', () => {
        const quotesWithOtherPartyManualHold = createQuotes({ inventoryHoldTypes: [DALTypes.InventoryOnHoldReason.MANUAL], holdPartyId: 2 });
        const leaseFormDialogComponent = createLeaseFormDialogComponent({ quotes: quotesWithOtherPartyManualHold });

        const dialogMsg = tryToPublishLease(leaseFormDialogComponent);

        expect(dialogMsg).toBe(inventoryOnHoldDialogMsg);
      });
    });

    describe('and the unit has a LEASE and a MANUAL hold from other party', () => {
      xit('should display a dialog with the message: INVENTORY_UNAVAILABLE_MANUAL_AND_LEASE_HOLDS_MSG', () => {
        const quotesWithOtherPartyManualAndLeaseHolds = createQuotes({
          inventoryHoldTypes: [DALTypes.InventoryOnHoldReason.MANUAL, DALTypes.InventoryOnHoldReason.LEASE],
          holdPartyId: 2,
        });
        const leaseFormDialogComponent = createLeaseFormDialogComponent({ quotes: quotesWithOtherPartyManualAndLeaseHolds });

        const dialogMsg = tryToPublishLease(leaseFormDialogComponent);

        expect(dialogMsg).toBe(inventoryLeasedAndOnHoldDialogMsg);
      });
    });

    describe('and the unit has not holds', () => {
      it('should publish the lease', () => {
        const quotesWithoutHolds = createQuotes({ inventoryHoldTypes: [], holdPartyId: 2 });
        const { instance } = createLeaseFormDialogComponent({ quotes: quotesWithoutHolds, publishLease });

        instance.handlePublishLease(partyId, leaseId, {}, quoteId);
        expect(instance.props.publishLease).toHaveBeenCalled();
      });
    });

    describe('and the unit has a LEASE hold from the same party', () => {
      it('should publish the lease', () => {
        const quotesWithSamePartyLeaseHold = createQuotes({ inventoryHoldTypes: [DALTypes.InventoryOnHoldReason.LEASE], holdPartyId: partyId });
        const { instance } = createLeaseFormDialogComponent({ quotes: quotesWithSamePartyLeaseHold, publishLease });

        instance.handlePublishLease(partyId, leaseId, {}, quoteId);
        expect(instance.props.publishLease).toHaveBeenCalled();
      });
    });

    describe('and the unit has a MANUAL hold from the same party', () => {
      it('should publish the lease', () => {
        const quotesWithSamePartyManualHold = createQuotes({ inventoryHoldTypes: [DALTypes.InventoryOnHoldReason.MANUAL], holdPartyId: partyId });
        const { instance } = createLeaseFormDialogComponent({ quotes: quotesWithSamePartyManualHold, publishLease });

        instance.handlePublishLease(partyId, leaseId, {}, quoteId);
        expect(instance.props.publishLease).toHaveBeenCalled();
      });
    });

    describe('and the unit has a LEASE and a MANUAL hold from the same party', () => {
      it('should publish the lease', () => {
        const quotesWithSamePartyManualAndLeaseHolds = createQuotes({
          inventoryHoldTypes: [DALTypes.InventoryOnHoldReason.MANUAL, DALTypes.InventoryOnHoldReason.LEASE],
          holdPartyId: partyId,
        });
        const { instance } = createLeaseFormDialogComponent({ quotes: quotesWithSamePartyManualAndLeaseHolds, publishLease });

        instance.handlePublishLease(partyId, leaseId, {}, quoteId);
        expect(instance.props.publishLease).toHaveBeenCalled();
      });
    });
  });
});
