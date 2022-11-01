/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'test-helpers';
import { getVisibleCloseReasons } from '../party';
import { DALTypes } from '../../../common/enums/DALTypes';
const reasons = DALTypes.ClosePartyReasons;

describe('party', () => {
  describe('close reasons when there is a non resident party and the user is not an admin', () => {
    it('should return the corresponding close reasons', () => {
      const isAdmin = false;
      const isResident = false;
      const closeReasons = getVisibleCloseReasons(isAdmin, isResident);
      const closeReasonsList = [
        reasons.FOUND_ANOTHER_PLACE,
        reasons.NO_LONGER_MOVING,
        reasons.NOT_INTERESTED,
        reasons.NO_INVENTORY_MATCH,
        reasons.CANT_AFFORD,
        reasons.NO_RESPONSE,
        reasons.INITIAL_HANGUP,
        reasons.ALREADY_A_RESIDENT,
        reasons.NOT_LEASING_BUSINESS,
        reasons.MARKED_AS_SPAM,
        reasons.APPLICATION_DECLINED,
        reasons.MID_LEASE_SCREENING,
      ];
      const expectedCloseReasons = Object.keys(reasons).filter(key => closeReasonsList.includes(reasons[key]));

      expect(closeReasons).to.deep.equal(expectedCloseReasons);
    });
  });

  describe('close reasons when there is a non resident party and the user is an admin', () => {
    it('should return the corresponding close reasons', () => {
      const isAdmin = true;
      const isResident = false;
      const closeReasons = getVisibleCloseReasons(isAdmin, isResident);
      const closeReasonsList = [
        reasons.REVA_TESTING,
        reasons.FOUND_ANOTHER_PLACE,
        reasons.NO_LONGER_MOVING,
        reasons.NOT_INTERESTED,
        reasons.NO_INVENTORY_MATCH,
        reasons.CANT_AFFORD,
        reasons.NO_RESPONSE,
        reasons.INITIAL_HANGUP,
        reasons.ALREADY_A_RESIDENT,
        reasons.NOT_LEASING_BUSINESS,
        reasons.MARKED_AS_SPAM,
        reasons.APPLICATION_DECLINED,
        reasons.MID_LEASE_SCREENING,
      ];
      const expectedCloseReasons = Object.keys(reasons).filter(key => closeReasonsList.includes(reasons[key]));

      expect(closeReasons).to.deep.equal(expectedCloseReasons);
    });
  });

  describe('close reasons when there is a resident party and the user is not admin', () => {
    it('should return the corresponding close reasons', () => {
      const isAdmin = false;
      const isResident = true;
      const closeReasons = getVisibleCloseReasons(isAdmin, isResident);
      const closeReasonsList = [reasons.EVICTION, reasons.ABANDON, reasons.INTEGRATION_ISSUES, reasons.PROPERTY_SOLD];
      const expectedCloseReasons = Object.keys(reasons).filter(key => closeReasonsList.includes(reasons[key]));

      expect(closeReasons).to.deep.equal(expectedCloseReasons);
    });
  });

  describe('close reasons when there is a resident party and the user is an admin', () => {
    it('should return the corresponding close reasons', () => {
      const isAdmin = true;
      const isResident = true;
      const closeReasons = getVisibleCloseReasons(isAdmin, isResident);
      const closeReasonsList = [reasons.REVA_TESTING, reasons.EVICTION, reasons.ABANDON, reasons.INTEGRATION_ISSUES, reasons.PROPERTY_SOLD];
      const expectedCloseReasons = Object.keys(reasons).filter(key => closeReasonsList.includes(reasons[key]));

      expect(closeReasons).to.deep.equal(expectedCloseReasons);
    });
  });
});
