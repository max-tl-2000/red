/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import { expect } from 'chai';
import { showPaymentDialogOrContinueToPartTwo } from '../payment-helpers';

describe('continue or show payment dialog', () => {
  let paymentModel;
  let application;
  let shouldShowPaymentDialog = false;
  const handlePaymentDialog = shouldShowDialog => (shouldShowPaymentDialog = shouldShowDialog);
  const setIsFeeWaived = isFeeWaived => (paymentModel = { initiatePayment: () => {}, response: { isFeeWaived } });
  const setContinueWithoutPayment = continueWithoutPayment =>
    (application = {
      personApplicationId: newId(),
      propertyInfo: {},
      details: { applicationFees: {} },
      continueWithoutPayment,
    });
  const paymentDialogOrContinueToPartTwo = () => showPaymentDialogOrContinueToPartTwo({ valid: true }, paymentModel, application, handlePaymentDialog);

  describe('the agent does not cancel the waiver while filling the application', () => {
    beforeEach(() => {
      setIsFeeWaived(true);
    });

    it('should continue to part 2 when there is already a waiver', async () => {
      setContinueWithoutPayment(true);
      await paymentDialogOrContinueToPartTwo();
      expect(shouldShowPaymentDialog).to.be.false;
    });
    it('should show payment dialog when there is not already a waiver', async () => {
      setContinueWithoutPayment(false);
      await paymentDialogOrContinueToPartTwo();
      expect(shouldShowPaymentDialog).to.be.true;
    });
  });

  describe('the agent cancels the waiver while the applicant is filling the application', () => {
    beforeEach(() => {
      setIsFeeWaived(false);
    });
    it('should continue to part 2 when there is already a waiver', async () => {
      setContinueWithoutPayment(true);
      await paymentDialogOrContinueToPartTwo();
      expect(shouldShowPaymentDialog).to.be.true;
    });
    it('should show payment dialog when there is not already a waiver', async () => {
      setContinueWithoutPayment(false);
      await paymentDialogOrContinueToPartTwo();
      expect(shouldShowPaymentDialog).to.be.true;
    });
  });
});
