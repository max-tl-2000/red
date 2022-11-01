/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const completeCreditReport = {
  hasCompletedCreditReport: true,
  hasCompilingCreditReport: false,
  hasPendingCreditReport: false,
  hasCreditFreeze: false,
  hasDisputedCreditReport: false,
  hasAddressErroredCreditReport: false,
  hasErroredCreditReport: false,
  hasExpiredCreditReport: false,
};

const completeCriminalReport = {
  hasCompletedCriminalReport: true,
  hasCompilingCriminalReport: false,
  hasPendingCriminalReport: false,
  hasDisputedCriminalReport: false,
  hasAddressErroredCriminalReport: false,
  hasErroredCriminalReport: false,
  hasExpiredCriminalReport: false,
};

const notApplicableCreditReport = {
  ...Object.keys(completeCreditReport).reduce((acc, key) => {
    acc[key] = null;
    return acc;
  }, {}),
};

const notApplicableCriminalReport = {
  ...Object.keys(completeCriminalReport).reduce((acc, key) => {
    acc[key] = null;
    return acc;
  }, {}),
};

export const completeReports = {
  ...completeCreditReport,
  ...completeCriminalReport,
};

export const pendingCreditReport = {
  ...completeReports,
  hasPendingCreditReport: true,
  hasCompletedCreditReport: false,
};

export const pendingCriminalReport = {
  ...completeReports,
  hasPendingCriminalReport: true,
  hasCompletedCriminalReport: false,
};

export const credCompleteCrimNotApplicable = {
  ...completeCreditReport,
  ...notApplicableCriminalReport,
};

export const credNotApplicableCrimComplete = {
  ...notApplicableCreditReport,
  ...completeCriminalReport,
};

export const pendingReports = {
  ...completeReports,
  hasPendingCreditReport: true,
  hasPendingCriminalReport: true,
  hasExpiredCreditReport: null,
  hasExpiredCriminalReport: null,
  hasCompletedCreditReport: false,
  hasCompletedCriminalReport: false,
};

export const credNotApplicableCrimPending = {
  ...pendingReports,
  ...notApplicableCreditReport,
};

export const compilingReports = {
  ...completeReports,
  hasCompilingCreditReport: true,
  hasCompilingCriminalReport: true,
  hasExpiredCreditReport: null,
  hasExpiredCriminalReport: null,
  hasCompletedCreditReport: false,
  hasCompletedCriminalReport: false,
};

export const compilingCredCrimNotApplicable = {
  ...notApplicableCriminalReport,
  hasCompilingCreditReport: true,
  hasExpiredCreditReport: null,
  hasCompletedCreditReport: false,
};

export const compilingCrimCredNotApplicable = {
  ...notApplicableCreditReport,
  hasCompilingCriminalReport: true,
  hasExpiredCriminalReport: null,
  hasCompletedCriminalReport: false,
};

export const credErrorCrimNotApplicable = {
  ...completeCreditReport,
  ...notApplicableCriminalReport,
  hasErroredCreditReport: true,
  hasCompletedCreditReport: false,
};

export const credPendingCrimNotApplicable = {
  ...pendingReports,
  ...notApplicableCriminalReport,
  hasCompletedCreditReport: false,
};
