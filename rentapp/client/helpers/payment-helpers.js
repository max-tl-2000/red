/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const buildInvoiceData = application => {
  const {
    quoteId,
    propertyInfo: { propertyId },
    details: {
      applicationFees: { holdDepositFees, applicationFees, waiverApplicationFees },
    },
  } = application;
  const applicationFee = (applicationFees && applicationFees[0]) || {};
  const holdDepositFee = (holdDepositFees && holdDepositFees[0]) || {};
  const applicationFeeWaiver = (waiverApplicationFees && waiverApplicationFees[0]) || {};
  return {
    invoice: {
      quoteId: quoteId || null,
      propertyId: propertyId || '',
      applicationFeeId: applicationFee.feeId,
      applicationFeeName: applicationFee.feeName,
      applicationFeeAmount: applicationFee.amount,
      holdDepositFeeId: holdDepositFee.selected ? holdDepositFee.feeId : null,
      holdDepositFeeName: holdDepositFee.selected ? holdDepositFee.feeName : null,
      holdDepositFeeIdAmount: holdDepositFee.selected ? holdDepositFee.amount : null,
      applicationFeeWaiverAmount: applicationFeeWaiver.amount || null,
    },
  };
};

export const getApplicantDetails = (model = {}) => {
  const { fields, reportCopyRequested } = model;
  return {
    firstName: fields && fields.firstName.value,
    lastName: fields && fields.lastName.value,
    email: fields && fields.email.value,
    reportCopyRequested,
  };
};

export const showPaymentDialogOrContinueToPartTwo = async (model, paymentModel, application, handlePaymentDialogFunc) => {
  if (model.valid) {
    const { personApplicationId, continueWithoutPayment } = application;
    if (!continueWithoutPayment) {
      handlePaymentDialogFunc(true);
      return;
    }
    const applicantDetails = getApplicantDetails(model);
    await paymentModel.initiatePayment(
      {
        ...buildInvoiceData(application),
        ...applicantDetails,
      },
      personApplicationId,
    );
    const openDialog = !paymentModel.shouldReprocessInitiatePayment;
    !paymentModel.response.isFeeWaived && handlePaymentDialogFunc(openDialog);
  }
};
