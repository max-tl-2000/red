/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Selector as $ } from 'testcafe';
import { t as trans } from 'i18next';
import capitalize from 'lodash/capitalize';
import { mapSeries } from 'bluebird';
import loggerInstance from '../../common/helpers/logger';
import { BouncedCommunicationStatuses } from '../../common/helpers/party-utils';
import { ScreeningDecision } from '../../common/enums/applicationTypes';
import {
  expectVisible,
  elementNotExist,
  expectTextIsEqual,
  replaceBlankSpaceWithCharacter,
  clickOnElement,
  expectDashboardLaneContains,
  clickOnCard,
  verifyEmptyCheckbox,
  getSelectorWithIndex,
  sanitizedTextIsEqual,
  getText,
  expectBtnDisabled,
  expectPlaceholderIsEqual,
  expectCheckboxState,
  doesElementExists,
  executeSequentially,
  clearTextElement,
  expectNotVisible,
} from './helpers';
import { getPartyCommunications } from './communicationHelpers';
import ManagePartyPage from '../pages/managePartyPage';
import PersonCardPage from '../pages/personCardPage';
import PartyDetailPage from '../pages/partyDetailPage';
import LeaseApplicationPage from '../pages/leaseApplicationPage';
import DashboardPage from '../pages/dashboardPage';
import LeaseFormPage from '../pages/leaseFormPage';
import { getShortFormatRentableItem, getLayoutSummary } from '../../client/helpers/inventory';
import { formatDateAgo } from '../../common/helpers/date-utils';
import { formatMoney } from '../../common/money-formatter';
import { verifyUnitScreeningInfo } from './rentalApplicationHelpers';
import { convertToCamelCaseAndRemoveBrackets } from '../../common/helpers/strings';
import { DALTypes } from '../../common/enums/DALTypes';
const logger = loggerInstance.child({ subType: 'appointmentHelper' });

const getEmailSubjects = async partyId => {
  const comms = await getPartyCommunications(partyId);
  const emailSubjectsReceived = comms.map(comm => comm.message?.subject);
  return emailSubjectsReceived;
};

const getEmailStatus = async partyId => {
  const comms = await getPartyCommunications(partyId);
  const emailStatusesReceived = comms.map(comm => comm.status?.status[0].status);
  return emailStatusesReceived;
};

export const checkForReceivedEmails = async (t, partyId, emailSubjectsToCheck) => {
  let emailSubjectsReceived = await getEmailSubjects(partyId);
  const emailStatusesReceived = await getEmailStatus(partyId);

  const areThereBouncedCommunicationStatuses = emailStatusesReceived.some(status => BouncedCommunicationStatuses.includes(status));
  if (areThereBouncedCommunicationStatuses) throw new Error('Some emails failed to be delivered');

  let retries = 5;
  // delaying the test by a maximum of ~10 seconds to compensate for the posibility of having late-received emails
  while (emailSubjectsToCheck.length > emailSubjectsReceived.length && retries > 0) {
    logger.info({ emailSubjectsToCheck, emailSubjectsReceived }, 'Waiting 2 more seconds...');
    t.wait(2000);
    emailSubjectsReceived = await getEmailSubjects(partyId);
    retries -= 1;
  }
  const updateRemainingEmailsList = emailSubjectName => {
    const index = emailSubjectsReceived.indexOf(emailSubjectName);
    if (index >= 0) {
      emailSubjectsReceived.splice(index, 1);
    }
  };
  const checkForEmail = subjectName => {
    logger.info(`>>> Checking if an email with the subject '${subjectName}' was received...`);
    if (emailSubjectsReceived.includes(subjectName)) {
      logger.info('>>> The Email was received!');
      updateRemainingEmailsList(subjectName);
    } else {
      throw new Error(`No email with the subject '${subjectName}' was received`);
    }
  };

  emailSubjectsToCheck.map(emailSubject => checkForEmail(emailSubject));
};

export const verifyScreeningData = async (t, quoteInfo, openScreenSummaryPage = false) => {
  const partyDetailPage = new PartyDetailPage(t);
  const leaseApplicationPage = new LeaseApplicationPage(t);
  if (openScreenSummaryPage) {
    await clickOnElement(t, { selector: $(partyDetailPage.selectors.rowApplicationListItems).withText(trans('REVIEW_SCREENING')) });
  }
  await expectVisible(t, { selector: leaseApplicationPage.selectors.requestApprovalBtn });
  await expectVisible(t, { selector: leaseApplicationPage.selectors.approvalSummaryCloseBtn });
  await verifyUnitScreeningInfo(t, quoteInfo);

  // TODO: Left summary sections cant be found by expectVisible functions at the moment. No validation are done to them at the moment.
};

export const requestScreeningApproval = async (t, quoteInfo, openQuoteRowMenu = true) => {
  const partyDetailPage = new PartyDetailPage(t);
  const leaseApplicationPage = new LeaseApplicationPage(t);
  if (openQuoteRowMenu) {
    await partyDetailPage.clickOnSelectorRow(partyDetailPage.selectors.quoteRowMenu, quoteInfo.index);
  }
  await clickOnElement(t, { selector: $(partyDetailPage.selectors.rowApplicationListItems).withText(trans('REVIEW_SCREENING')) });
  await verifyScreeningData(t, quoteInfo);
  await clickOnElement(t, { selector: leaseApplicationPage.selectors.requestApprovalBtn });
};

export const approveIncompleteScreening = async (t, quoteInfo) => {
  const partyDetailPage = new PartyDetailPage(t);
  const leaseApplicationPage = new LeaseApplicationPage(t);
  await partyDetailPage.clickOnSelectorRow(partyDetailPage.selectors.quoteRowMenu, quoteInfo.index);
  await clickOnElement(t, { selector: $('[data-component="list-item"]').withText(trans('REVIEW_SCREENING')) });
  await clickOnElement(t, { selector: leaseApplicationPage.selectors.applicationSummaryApproveBtn });
  await leaseApplicationPage.clickOkScreeningIncompleteDialog();
  await t.typeText(leaseApplicationPage.selectors.internalNotesTxt, 'Test');
  await leaseApplicationPage.clickOkBtnDialog();
};

export const verifyDeclineDialog = async t => {
  const leaseApplicationPage = new LeaseApplicationPage(t);
  await expectTextIsEqual(t, {
    selector: `${leaseApplicationPage.selectors.declineDialog} ${leaseApplicationPage.selectors.dialogOverlay} ${leaseApplicationPage.selectors.title}`,
    text: trans('DECLINE_DIALOG_TITLE'),
  });
  await expectTextIsEqual(t, {
    selector: `${leaseApplicationPage.selectors.declineDialog} ${leaseApplicationPage.selectors.dialogOverlay} ${leaseApplicationPage.selectors.dialogBody}`,
    text: trans('DECLINE_DIALOG_SUBTITLE'),
  });
  await expectPlaceholderIsEqual(t, {
    selector: `${leaseApplicationPage.selectors.declineDialog} ${leaseApplicationPage.selectors.dialogNotesInput}`,
    text: trans('DIALOG_INTERNAL_ADDITIONAL_NOTES'),
  });
  await expectTextIsEqual(t, {
    selector: `${leaseApplicationPage.selectors.declineDialog} ${leaseApplicationPage.selectors.dialogOverlay} ${leaseApplicationPage.selectors.dataActionOkBtn}`,
    text: trans('DECLINE'),
  });
};

export const revokeApprovedApplication = async t => {
  const partyDetailPage = new PartyDetailPage(t);
  await clickOnElement(t, { selector: partyDetailPage.selectors.pendingApprovalMenu });
  await clickOnElement(t, { selector: partyDetailPage.selectors.abandonRequestApproval });

  await partyDetailPage.clickDialogBtnOk();
};

const verifyReviewApplicationOption = async t => {
  const partyDetailPage = new PartyDetailPage(t);
  const leaseApplicationPage = new LeaseApplicationPage(t);
  await clickOnElement(t, { selector: partyDetailPage.selectors.pendingApprovalMenu });
  await clickOnElement(t, { selector: partyDetailPage.selectors.reviewApplication });
  await expectVisible(t, { selector: leaseApplicationPage.selectors.approvalSummary });

  await clickOnElement(t, { selector: leaseApplicationPage.selectors.approvalSummaryCloseBtn });
};

const checkQuotesMenu = async (t, isLaa, hideOrViewAllQuotes) => {
  const partyDetailPage = new PartyDetailPage(t);
  await expectTextIsEqual(t, { selector: partyDetailPage.selectors.hideOrViewAllQuotes, text: hideOrViewAllQuotes });
  isLaa && (await expectTextIsEqual(t, { selector: partyDetailPage.selectors.reviewApplication, text: trans('REVIEW_APPLICATION') }));
  await expectTextIsEqual(t, { selector: partyDetailPage.selectors.abandonRequestApproval, text: trans('ABANDON_APPROVAL_REQUEST') });
};

export const viewAllQuotesMenu = async (t, isLaa = true) => {
  const partyDetailPage = new PartyDetailPage(t);
  await clickOnElement(t, { selector: partyDetailPage.selectors.pendingApprovalMenu });
  await checkQuotesMenu(t, isLaa, trans('VIEW_ALL_QUOTES'));
  await clickOnElement(t, { selector: partyDetailPage.selectors.hideOrViewAllQuotes });

  const firstQuoteRow = getSelectorWithIndex(partyDetailPage.selectors.quoteRow, 0);
  await expectVisible(t, { selector: firstQuoteRow });

  await clickOnElement(t, { selector: partyDetailPage.selectors.pendingApprovalMenu });
  await checkQuotesMenu(t, isLaa, trans('HIDE_ALL_QUOTES'));
  await clickOnElement(t, { selector: partyDetailPage.selectors.hideOrViewAllQuotes });

  await elementNotExist(t, { selector: firstQuoteRow });

  isLaa && (await verifyReviewApplicationOption(t));
};

const verifyReviewScreeningTask = async t => {
  const dashboardPage = new DashboardPage(t);
  const checkboxName = 'checkbox-blank-outline';
  await verifyEmptyCheckbox(t, { selector: dashboardPage.selectors.applicantCardTask0CheckBox, checkboxName });
  await expectTextIsEqual(t, { selector: dashboardPage.selectors.applicantCardTask0Name, text: trans('REVIEW_APPLICATION') });
};

const verifyApplicantDocumentsAndInfo = async (t, applicantData) => {
  const managePartyPage = new ManagePartyPage(t);
  const leaseApplicationPage = new LeaseApplicationPage(t);
  await clickOnElement(t, { selector: leaseApplicationPage.selectors.privateDocument0 });

  await expectTextIsEqual(t, { selector: leaseApplicationPage.selectors.resident0FullName, text: applicantData.fullName });
  await expectTextIsEqual(t, { selector: leaseApplicationPage.selectors.resident0DateOfBirth, text: applicantData.dateOfBirth });
  await expectTextIsEqual(t, { selector: leaseApplicationPage.selectors.resident0Income, text: applicantData.income });
  await expectTextIsEqual(t, { selector: leaseApplicationPage.selectors.resident0Address, text: applicantData.address });
  await expectTextIsEqual(t, { selector: managePartyPage.selectors.childFullNameLblTxt, text: applicantData.childName });
  await expectTextIsEqual(t, { selector: managePartyPage.selectors.petNameLblTxT, text: applicantData.petName });
  await expectTextIsEqual(t, { selector: managePartyPage.selectors.makeAndModelLblTxt, text: applicantData.modelCar });
};

const checkSummaryPageLeftSide = async t => {
  const leaseApplicationPage = new LeaseApplicationPage(t);
  await expectVisible(t, { selector: leaseApplicationPage.selectors.leftPanel });
  await t.switchToIframe(leaseApplicationPage.selectors.applicationSummaryFrame);
  await expectVisible(t, { selector: leaseApplicationPage.selectors.screeningRecommendationSection });
  await expectVisible(t, { selector: leaseApplicationPage.selectors.screeningReportSummarySection });
  await expectVisible(t, { selector: leaseApplicationPage.selectors.viewFullReportBtn });

  await clickOnElement(t, { selector: leaseApplicationPage.selectors.resident0ExpandButton });
  const applicantData = {
    address: '422 Massachusetts Avenue Northwest, Washington, MA, 02474',
    fullName: 'Kathe Johnson',
    dateOfBirth: '1985-03-30',
    income: '$3,500 (Monthly)',
    childName: 'Daniel Smith',
    petName: 'Boby',
    modelCar: 'Toyota Corolla',
  };
  await verifyApplicantDocumentsAndInfo(t, applicantData);

  await t.switchToMainWindow();
};

const checkSummaryPageRightSide = async (t, quoteData) => {
  const leaseApplicationPage = new LeaseApplicationPage(t);
  await expectVisible(t, { selector: leaseApplicationPage.selectors.rightPanel });
  await expectVisible(t, { selector: leaseApplicationPage.selectors.applicationSummaryQuoteImage });
  await expectTextIsEqual(t, { selector: leaseApplicationPage.selectors.applicationSummaryQuoteInfo, text: quoteData.displayName });
};

const checkSummaryPageHeader = async t => {
  const leaseApplicationPage = new LeaseApplicationPage(t);
  await expectVisible(t, { selector: leaseApplicationPage.selectors.applicationSummaryDeclineBtn });
  await expectVisible(t, { selector: leaseApplicationPage.selectors.applicationSummaryRequireWorkBtn });
  await expectVisible(t, { selector: leaseApplicationPage.selectors.applicationSummaryApproveBtn });
};

const checkSummaryPage = async (t, quoteData) => {
  const leaseApplicationPage = new LeaseApplicationPage(t);
  await expectVisible(t, { selector: leaseApplicationPage.selectors.approvalSummary });
  await checkSummaryPageHeader(t);
  await checkSummaryPageLeftSide(t);
  await checkSummaryPageRightSide(t, quoteData);
};

const approveApplication = async t => {
  const leaseApplicationPage = new LeaseApplicationPage(t);
  await clickOnElement(t, { selector: leaseApplicationPage.selectors.applicationSummaryApproveBtn });
  await clickOnElement(t, { selector: leaseApplicationPage.selectors.increaseDeposit });
  await expectVisible(t, { selector: leaseApplicationPage.selectors.depositDropdown });
  await clickOnElement(t, { selector: leaseApplicationPage.selectors.increaseDeposit });
  await elementNotExist(t, { selector: leaseApplicationPage.selectors.depositDropdown });

  await t.typeText(leaseApplicationPage.selectors.internalNotesTxt, 'Test');
  await leaseApplicationPage.clickOkBtnDialog();
};

export const declineScreeningApproval = async (t, quoteInfo) => {
  const partyDetailPage = new PartyDetailPage(t);
  const leaseApplicationPage = new LeaseApplicationPage(t);
  await clickOnElement(t, { selector: partyDetailPage.selectors.reviewApplicationBtn });
  await verifyUnitScreeningInfo(t, quoteInfo);
  await checkSummaryPageHeader(t);
  await clickOnElement(t, { selector: leaseApplicationPage.selectors.applicationSummaryDeclineBtn });
  await verifyDeclineDialog(t);
  await t.typeText(`${leaseApplicationPage.selectors.declineDialog} ${leaseApplicationPage.selectors.dialogNotesInput}`, 'Testing');
  await clickOnElement(t, { selector: `${leaseApplicationPage.selectors.dialogOverlay} ${leaseApplicationPage.selectors.dataActionOkBtn}` });
};

const approveWithConditions = async t => {
  const leaseApplicationPage = new LeaseApplicationPage(t);
  await clickOnElement(t, { selector: leaseApplicationPage.selectors.applicationSummaryApproveBtn });
  await clickOnElement(t, { selector: leaseApplicationPage.selectors.increaseDeposit });
  await expectVisible(t, { selector: leaseApplicationPage.selectors.depositDropdown });

  await clickOnElement(t, { selector: leaseApplicationPage.selectors.depositDropdown });
  await clickOnElement(t, { selector: leaseApplicationPage.selectors.depositAmountOther });
  await expectVisible(t, { selector: leaseApplicationPage.selectors.depositAmountTxt });
  await t.typeText(leaseApplicationPage.selectors.depositAmountTxt, '4500');

  await clickOnElement(t, { selector: leaseApplicationPage.selectors.depositDropdown });
  await clickOnElement(t, { selector: leaseApplicationPage.selectors.depositAmount2 });
  await elementNotExist(t, { selector: leaseApplicationPage.selectors.depositAmountTxt });
  await leaseApplicationPage.clickOkBtnDialog();
};

const checkLeaseDraft = async (t, leaseTitle) => {
  const leaseApplicationPage = new LeaseApplicationPage(t);
  await expectVisible(t, { selector: leaseApplicationPage.selectors.publishLeaseBtn });
  await expectVisible(t, { selector: leaseApplicationPage.selectors.viewRelatedQuoteBtn });
  await expectTextIsEqual(t, { selector: leaseApplicationPage.selectors.leaseFormTitle, text: leaseTitle });
  await clickOnElement(t, { selector: leaseApplicationPage.selectors.leaseFormCloseBtn });
};

export const verifyLeaseItemMenuOptions = async t => {
  const partyDetailPage = new PartyDetailPage(t);
  await expectVisible(t, { selector: $(partyDetailPage.selectors.rowApplicationListItems).withText(trans('VIEW_EDIT_LEASE')) });
  await expectVisible(t, { selector: $(partyDetailPage.selectors.rowApplicationListItems).withText(trans('VOID_LEASE')) });
  await expectVisible(t, { selector: $(partyDetailPage.selectors.rowApplicationListItems).withText(trans('FETCH_LEASE_STATUS')) });
};

export const verifyExecutedLeaseItemMenuOptions = async t => {
  const partyDetailPage = new PartyDetailPage(t);
  await expectVisible(t, { selector: $(partyDetailPage.selectors.rowApplicationListItems).withText(trans('VIEW_EDIT_LEASE')) });
  await expectVisible(t, { selector: $(partyDetailPage.selectors.rowApplicationListItems).withText(trans('VOID_LEASE')) });
};

export const verifyTasks = async (t, tasks, index = 0) => {
  const partyDetailPage = new PartyDetailPage(t);
  return await executeSequentially(tasks, async task => {
    const selectorWithName = partyDetailPage.getTaskSelectorWithName(task.name);
    let i = index;
    let taskSelector = getSelectorWithIndex(selectorWithName, i);

    while (!(await doesElementExists(taskSelector))) {
      i += 1;
      taskSelector = getSelectorWithIndex(selectorWithName, i);
    }

    await expectVisible(t, { selector: taskSelector });
    await expectTextIsEqual(t, { selector: taskSelector, text: task.text });
    return;
  });
};

const verifyLeaseSection = async (t, { leaseState, reviewLeaseBtn }) => {
  const partyDetailPage = new PartyDetailPage(t);
  await expectTextIsEqual(t, { selector: partyDetailPage.selectors.leaseState, text: leaseState });
  await expectTextIsEqual(t, { selector: partyDetailPage.selectors.reviewLeaseBtn, text: reviewLeaseBtn });
};

export const verifyApplicantCard = async (t, agentName) => {
  const expectedCard = { lane: '#applicants', cardText: agentName };
  await expectDashboardLaneContains(t, expectedCard);

  await verifyReviewScreeningTask(t);

  await clickOnCard(t, expectedCard);
  await expectVisible(t, { selector: '[data-component="partyPage"][data-phase="phaseII"]' });
};

export const reviewApplicationByLaaAgent = async (t, quoteData, mockTasks, { screeningDecision }) => {
  const partyDetailPage = new PartyDetailPage(t);
  await clickOnElement(t, { selector: partyDetailPage.selectors.reviewApplicationBtn });

  await checkSummaryPage(t, quoteData);

  if (screeningDecision === ScreeningDecision.APPROVED) {
    await approveApplication(t);
  } else {
    await approveWithConditions(t);
  }

  const leaseTitle = 'Lease for Unit swparkme-350AR-1010';
  await checkLeaseDraft(t, leaseTitle);

  const leaseState = trans('LEASE_CREATED');
  const reviewLeaseBtn = trans('REVIEW_LEASE');
  await verifyLeaseSection(t, { leaseState, reviewLeaseBtn });
  await verifyTasks(t, mockTasks);
};

export const approveLease = async (t, openLeasePage = false) => {
  const partyDetailPage = new PartyDetailPage(t);
  const leaseApplicationPage = new LeaseApplicationPage(t);
  if (openLeasePage) {
    await clickOnElement(t, { selector: partyDetailPage.selectors.reviewApplicationBtn });
  }

  await expectVisible(t, { selector: leaseApplicationPage.getApproveLeaseAppBtnSelector() });
  await clickOnElement(t, { selector: $(leaseApplicationPage.getApproveLeaseAppBtnSelector()) });
  await expectVisible(t, { selector: leaseApplicationPage.getApproveLeaseAppBtnSelector() });
  await t.typeText(leaseApplicationPage.selectors.internalNotesTxt, 'Test');
  await leaseApplicationPage.clickOkBtnDialog();
};

export const reviewScreening = async (t, quoteInfo) => {
  const partyDetailPage = new PartyDetailPage(t);
  await partyDetailPage.clickOnSelectorRow(partyDetailPage.selectors.quoteRowMenu, quoteInfo.index);
  await clickOnElement(t, { selector: $(partyDetailPage.selectors.rowApplicationListItems).withText(trans('REVIEW_SCREENING')) });
};

export const promoteQuoteToLease = async (t, quoteInfo) => {
  const partyDetailPage = new PartyDetailPage(t);
  await partyDetailPage.clickOnSelectorRow(partyDetailPage.selectors.quoteRowMenu, quoteInfo.index);
  await clickOnElement(t, { selector: $(partyDetailPage.selectors.rowApplicationListItems).withText(trans('PROMOTE_TO_LEASE')) });
};

export const verifyVoidLeaseDialog = async (t, verifyPartyMembersNotificationMsg) => {
  const leaseApplicationPage = new LeaseApplicationPage(t);
  await expectVisible(t, { selector: leaseApplicationPage.selectors.voidLeaseDialog });
  await expectTextIsEqual(t, {
    selector: `${leaseApplicationPage.selectors.dialogOverlay} ${leaseApplicationPage.selectors.title}`,
    text: trans('LEASE_VOID_QUESTION'),
  });

  if (verifyPartyMembersNotificationMsg) {
    await expectTextIsEqual(t, {
      selector: `${leaseApplicationPage.selectors.dialogOverlay} ${leaseApplicationPage.selectors.dialogBody}`,
      text: `${trans('LEASE_VOID_MESSAGE')} ${trans('LEASE_VOID_MESSAGE_NOTIFIED')}${trans('LEASE_VOID_CONFIRMATION')}`,
    });
  } else {
    await expectTextIsEqual(t, {
      selector: `${leaseApplicationPage.selectors.dialogOverlay} ${leaseApplicationPage.selectors.dialogBody}`,
      text: `${trans('LEASE_VOID_MESSAGE')}${trans('LEASE_VOID_CONFIRMATION')}`,
    });
  }

  await expectTextIsEqual(t, {
    selector: `${leaseApplicationPage.selectors.dialogOverlay} ${leaseApplicationPage.selectors.cancelBtn}`,
    text: trans('CANCEL'),
  });
  await expectTextIsEqual(t, {
    selector: `${leaseApplicationPage.selectors.dialogOverlay} ${leaseApplicationPage.selectors.okBtn}`,
    text: trans('VOID_LEASE_BUTTON').toUpperCase(),
  });
};

export const voidLease = async (t, verifyPartyMembersNotificationMsg = false) => {
  const partyDetailPage = new PartyDetailPage(t);
  await partyDetailPage.clickOnLeaseMenuBtn();
  await verifyLeaseItemMenuOptions(t);
  await clickOnElement(t, { selector: partyDetailPage.selectors.voidLeaseOption, requireVisibility: true });
  await verifyVoidLeaseDialog(t, verifyPartyMembersNotificationMsg);
  await partyDetailPage.clickDialogBtnOk();
};

export const voidLeaseDraft = async t => {
  const partyDetailPage = new PartyDetailPage(t);
  await clickOnElement(t, { selector: partyDetailPage.selectors.leaseDraftMenuBtn });
  await clickOnElement(t, { selector: partyDetailPage.selectors.voidLeaseDraftBtn });
  await partyDetailPage.clickDialogBtnOk();
};

export const voidExecutedLease = async t => {
  const partyDetailPage = new PartyDetailPage(t);
  await partyDetailPage.clickOnLeaseMenuBtn();
  await clickOnElement(t, { selector: partyDetailPage.selectors.voidLeaseOption, requireVisibility: true });
  await partyDetailPage.clickDialogBtnOk();
};

const validateOptions = async (t, { selector, options }) => {
  const items = await $(selector);
  await t.expect(items.count).eql(options.length);
  await executeSequentially(
    Array.from(Array(options.length)),
    async (_, index) => await expectVisible(t, { selector: items.nth(index).withText(options[index]) }),
  );
};

const validatePublishedLeaseOptions = async t => {
  const partyDetailPage = new PartyDetailPage(t);
  const { leaseOptionsSection } = partyDetailPage.selectors;
  const options = [trans('VIEW_EDIT_LEASE'), trans('VOID_LEASE'), trans('FETCH_LEASE_STATUS')];
  await validateOptions(t, { selector: `${leaseOptionsSection} [data-menu-item] [data-component="text"]`, options });
};

const validateViewOrEditLeaseDialog = async t => {
  const partyDetailPage = new PartyDetailPage(t);
  const { editLeaseDialogDialog, dialogHeader, dialogBody, dialogActions, markdown, okBtn, cancelBtn } = partyDetailPage.selectors;

  await expectTextIsEqual(t, {
    selector: `${editLeaseDialogDialog} ${dialogHeader} [data-component="title"]`,
    text: trans('VIEW_EDIT_LEASE'),
  });

  await expectTextIsEqual(t, {
    selector: `${editLeaseDialogDialog} ${dialogBody} ${markdown}`,
    text: trans('LEASE_EDIT_WARNING').replace(/<br\/>/g, ''),
  });

  await expectTextIsEqual(t, { selector: `${editLeaseDialogDialog} ${dialogActions} ${okBtn}`, text: trans('ACCEPT_LEASE_EDIT_WARNING') });
  await expectTextIsEqual(t, { selector: `${editLeaseDialogDialog} ${dialogActions} ${cancelBtn}`, text: trans('MSG_BOX_BTN_CANCEL') });
};

export const viewOrEditLease = async t => {
  const partyDetailPage = new PartyDetailPage(t);
  await partyDetailPage.clickOnLeaseMenuBtn();
  await validatePublishedLeaseOptions(t);
  await clickOnElement(t, { selector: partyDetailPage.selectors.editLeaseOption });
  await validateViewOrEditLeaseDialog(t);
  await partyDetailPage.clickDialogBtnOk();
};

export const verifyLeaseDatesAndBaseRent = async (t, leaseData, timezone) => {
  const leaseFormPage = new LeaseFormPage(t);
  return await leaseFormPage.verifyDatesAndBaseRent(leaseData, timezone);
};

export const verifyConcessions = async (t, concessions) =>
  await executeSequentially(Object.keys(concessions), async key => {
    const { amount } = concessions[key];
    await expectCheckboxState(t, { selector: `#${key}_checkBox`, selected: true });
    const { result: amountFormatted } = formatMoney({ amount, currency: 'USD' });
    await expectTextIsEqual(t, { selector: `[data-id="${key}_amountFormatted"]`, text: amountFormatted });
  });

export const verifyConcessionsSelected = async (t, concessionsName, concessionsAmount) => {
  await executeSequentially([...Array(concessionsName)], async (_element, i) => {
    const amount = concessionsAmount[i];
    await expectCheckboxState(t, { selector: `#concession${convertToCamelCaseAndRemoveBrackets(concessionsName[i])}_checkBox`, selected: true });
    const { result: amountFormatted } = formatMoney({ amount, currency: 'USD' });
    return await expectTextIsEqual(t, {
      selector: `[data-id="${convertToCamelCaseAndRemoveBrackets(concessionsName[i])}_concessionAmount"]`,
      text: amountFormatted,
    });
  });
};

export const editLeaseForm = async (t, leaseData, timezone) => {
  const leaseFormPage = new LeaseFormPage(t);
  const { leaseStartDate, leaseMoveInDate, leaseEndDate } = leaseData.leaseDates;
  // Error messages
  await leaseFormPage.setLeaseDates(leaseEndDate, leaseMoveInDate, leaseStartDate, {
    moveInDateError: trans('LEASE_FORM_MOVE_IN_DATE_VALIDATION_1'),
    endDateError: trans('LEASE_FORM_LEASE_END_DATE_VALIDATION_1'),
    timezone,
  });

  await leaseFormPage.verifyPublishButtonState(false);
  // set the right values in order
  await leaseFormPage.setLeaseDates(leaseStartDate, leaseMoveInDate, leaseEndDate, {
    timezone,
  });

  await leaseFormPage.verifyPublishButtonState();

  await leaseFormPage.editConcessionAmount(
    leaseFormPage.selectors.baseRentLeaseTermEditor.replace('Index', leaseData.promotedLeaseTerm.termLength),
    leaseFormPage.selectors.baseRentLeaseTermInput.replace('Index', leaseData.promotedLeaseTerm.termLength),
    leaseData.baseRent,
  );
};

export const createLease = async t => {
  const leaseApplicationPage = new LeaseApplicationPage(t);
  await expectVisible(t, { selector: leaseApplicationPage.selectors.createLeaseBtn });
  await clickOnElement(t, { selector: leaseApplicationPage.selectors.createLeaseBtn });
};

export const checkSectionIsHidden = async (t, selector) => await elementNotExist(t, { selector });

export const verifyQuoteList = async t => {
  const partyDetailPage = new PartyDetailPage(t);
  return await expectVisible(t, { selector: partyDetailPage.selectors.quoteList });
};

export const verifyVoidedLeaseSubHeaderTxt = async (t, text) => {
  const partyDetailPage = new PartyDetailPage(t);
  await expectTextIsEqual(t, {
    selector: `${partyDetailPage.selectors.leaseVoidedSection} ${partyDetailPage.selectors.subHeader}`,
    text,
  });
};

export const verifyLeaseIsExecuted = async (t, quoteInfo) => {
  const partyDetailPage = new PartyDetailPage(t);
  await expectTextIsEqual(t, {
    selector: `${partyDetailPage.selectors.leaseSection} ${partyDetailPage.selectors.sectionTitle}`,
    text: trans('LEASE_EXECUTED', { unit: quoteInfo.leaseUnitName }),
  });
};

export const getLeaseTermByIndex = (leaseTerms, leaseTermIndex) => leaseTerms[leaseTermIndex].term;

export const verifyVoidedLeaseDescriptionTxt = async (t, quoteInfo, leaseTermIndex = 0, compareIncreasedPrice = false) => {
  const partyDetailPage = new PartyDetailPage(t);
  const { leaseUnitName, increasedLeasePrice, leasePrice } = quoteInfo;
  const leasePeriodTerm = getLeaseTermByIndex(quoteInfo.quote.leaseTerms, leaseTermIndex);
  await sanitizedTextIsEqual(t, { selector: partyDetailPage.selectors.leasePeriodTermsTxt, text: leasePeriodTerm.slice(0, -1) });

  const leaseForUnitTxt = trans('LEASE_FOR_UNIT');
  await sanitizedTextIsEqual(t, { selector: partyDetailPage.selectors.leaseQuoteForUnitTxt, text: leaseForUnitTxt });
  await sanitizedTextIsEqual(t, { selector: partyDetailPage.selectors.leaseUnitNameTxt, text: leaseUnitName });

  const leaseUnitPrice = (await compareIncreasedPrice) ? increasedLeasePrice : leasePrice;
  await sanitizedTextIsEqual(t, { selector: partyDetailPage.selectors.leaseMoneyTxt, text: leaseUnitPrice });

  const leaseWasVoidedTxt = trans('WAS_VOIDED');
  await sanitizedTextIsEqual(t, { selector: partyDetailPage.selectors.leaseWasVoidedTxt, text: leaseWasVoidedTxt });
  await sanitizedTextIsEqual(t, { selector: partyDetailPage.selectors.leaseVoidedDateTxt, text: 'Today.' });
};

export const verifyCreatedLeaseDescriptionTxt = async (t, quoteInfo, increasedLeasePrice, leaseTermIndex = 0) => {
  const partyDetailPage = new PartyDetailPage(t);
  const leasePeriodTerm = getLeaseTermByIndex(quoteInfo.quote.leaseTerms, leaseTermIndex);
  await sanitizedTextIsEqual(t, { selector: partyDetailPage.selectors.leaseTerm, text: leasePeriodTerm.slice(0, -1) });
  const leaseUnitName = quoteInfo.leaseUnitName;
  await sanitizedTextIsEqual(t, { selector: partyDetailPage.selectors.leaseUnitName, text: leaseUnitName });
  const leaseUnitPrice = increasedLeasePrice ? quoteInfo.increasedLeasePrice : quoteInfo.leasePrice;
  await sanitizedTextIsEqual(t, { selector: partyDetailPage.selectors.leaseBaseRent, text: leaseUnitPrice });
  await sanitizedTextIsEqual(t, { selector: partyDetailPage.selectors.leaseCreatedDate, text: 'Today.' });
};

export const verifyLeaseStatus = async (t, contactInfo, statusText) => {
  const partyDetailPage = new PartyDetailPage(t);
  await expectTextIsEqual(t, { selector: partyDetailPage.selectors.residentSignatureStatus, text: trans(statusText) });
  await expectTextIsEqual(t, { selector: partyDetailPage.selectors.leaseResidentName.replace('Index', 1), text: contactInfo.legalName });
};

export const sendEmailFromPartyDetail = async t => {
  const partyDetailPage = new PartyDetailPage(t);
  await clickOnElement(t, { selector: partyDetailPage.selectors.sendEmailLeaseBtn });
};

export const verifyExecutedLeaseMenuOptions = async t => {
  const partyDetailPage = new PartyDetailPage(t);
  await clickOnElement(t, { selector: partyDetailPage.selectors.leaseMenuBtn });
  await expectVisible(t, { selector: $(partyDetailPage.selectors.rowApplicationListItems).withText(trans('VIEW_LEASE')) });
  await expectVisible(t, { selector: $(partyDetailPage.selectors.rowApplicationListItems).withText(trans('VOID_LEASE')) });
};

export const verifyPreviousDayExecutedLeaseMenuOptions = async t => {
  const partyDetailPage = new PartyDetailPage(t);
  await clickOnElement(t, { selector: partyDetailPage.selectors.leaseMenuBtn });
  await expectVisible(t, { selector: $(partyDetailPage.selectors.rowApplicationListItems).withText(trans('VIEW_LEASE')) });
  await expectNotVisible(t, { selector: $(partyDetailPage.selectors.rowApplicationListItems).withText(trans('VOID_LEASE')) });
};

export const viewOrEditPublishedLease = async t => {
  const partyDetailPage = new PartyDetailPage(t);
  await clickOnElement(t, { selector: partyDetailPage.selectors.leaseMenuBtn });
  await clickOnElement(t, { selector: partyDetailPage.selectors.editLeaseOption });
  await partyDetailPage.clickDialogBtnOk();
};

export const downloadLease = async t => {
  const partyDetailPage = new PartyDetailPage(t);
  const leaseApplicationPage = new LeaseApplicationPage(t);
  const downloadLeaseBtnSelector = leaseApplicationPage.selectors.downloadLeaseBtn;
  await clickOnElement(t, { selector: $(partyDetailPage.selectors.rowApplicationListItems).withText(trans('VIEW_LEASE')) });
  await expectVisible(t, { selector: downloadLeaseBtnSelector });
  await clickOnElement(t, { selector: downloadLeaseBtnSelector });
};

export const verifyNewPromoteAppTaskAdded = async (t, index) => {
  const partyDetailPage = new PartyDetailPage(t);
  await expectVisible(t, { selector: partyDetailPage.selectors.todoSection });
  await t.expect($(partyDetailPage.selectors.appointmentRow).count).eql(1);
  const mockTasks = [
    {
      text: trans('PROMOTE_APPLICATION'),
      name: DALTypes.TaskNames.PROMOTE_APPLICATION,
    },
  ];
  await verifyTasks(t, mockTasks, index);
};

export const verifyTaskIsDone = async (t, index) => {
  const partyDetailPage = new PartyDetailPage(t);
  await expectVisible(t, { selector: partyDetailPage.selectors.todoSection });
  await clickOnElement(t, { selector: $(partyDetailPage.selectors.button).withText(trans('COMPLETED_TASKS', { action: 'SHOW' })) });
  const mockTasks = [
    {
      text: trans('PROMOTE_APPLICATION'),
      name: DALTypes.TaskNames.PROMOTE_APPLICATION,
    },
  ];
  await verifyTasks(t, mockTasks, index);
  await expectVisible(t, { selector: partyDetailPage.selectors.check });
};

export const verifyCompanyName = async (t, companyInfo) => {
  const leaseApplicationPage = new LeaseApplicationPage(t);
  await expectTextIsEqual(t, { selector: leaseApplicationPage.selectors.companyNameTxt, text: companyInfo.companyName });
};

export const verifyPointOfContact = async (t, companyInfo) => {
  const leaseApplicationPage = new LeaseApplicationPage(t);
  await expectTextIsEqual(t, { selector: leaseApplicationPage.selectors.pointOfContactCategoryTxt, text: companyInfo.contactName });
};

export const verifyOccupantName = async (t, occupantInfo) => {
  const leaseApplicationPage = new LeaseApplicationPage(t);
  await expectTextIsEqual(t, { selector: leaseApplicationPage.selectors.occupantsCategoryTxt, text: occupantInfo.legalName });
};

export const verifyUnitNotAvailableMsg = async (t, quoteInfo, user) => {
  const leaseApplicationPage = new LeaseApplicationPage(t);
  const warningMsgSelector = leaseApplicationPage.selectors.leaseWarningMsg;
  await expectVisible(t, { selector: warningMsgSelector });
  await expectTextIsEqual(t, {
    selector: warningMsgSelector,
    text: `${trans('UNIT_RESERVED_WARNING', { unitName: quoteInfo.unitName, agent: user.fullName })}${capitalize(trans('VIEW_PARTY'))}`,
  });
};

export const verifyLeaseCannotBePublished = async t => {
  const leaseApplicationPage = new LeaseApplicationPage(t);
  const publishBtnSelector = leaseApplicationPage.selectors.publishLeaseBtn;
  await expectVisible(t, { selector: publishBtnSelector });
  await clickOnElement(t, { selector: publishBtnSelector });
  await expectVisible(t, { selector: leaseApplicationPage.selectors.unitHoldingWarningDialog });
  await expectTextIsEqual(t, {
    selector: `${leaseApplicationPage.selectors.unitHoldingWarningDialog} ${leaseApplicationPage.selectors.title}`,
    text: trans('LEASE_CANT_BE_PUBLISHED_TITLE'),
  });
};

export const checkInventoryItems = async (t, inventoryFee) => {
  await executeSequentially(inventoryFee, async pickItemLink => {
    const selector = `${convertToCamelCaseAndRemoveBrackets(pickItemLink)}`;
    selector !== 'doorFob' && (await clickOnElement(t, { selector: `#${selector}_additionalMonthlyFeeCheckBox` }));
    await expectVisible(t, { selector: `#${selector}_pickItemSelector`, text: trans('INV_SELECTION_LINK').toUpperCase() });
  });
};

export const checkIsPublishBtnDisabled = async (t, inventoryFee) => {
  const leaseApplicationPage = new LeaseApplicationPage(t);
  await expectVisible(t, { selector: leaseApplicationPage.selectors.leaseSummarySection });
  await expectBtnDisabled(t, { selector: leaseApplicationPage.selectors.publishLeaseBtn });
  await checkInventoryItems(t, inventoryFee);
};

export const selectInventoryItems = async (t, inventoryFees, inventoryFeeChildren) =>
  await mapSeries(inventoryFees, async (fee, i) => {
    const feeSelector = convertToCamelCaseAndRemoveBrackets(fee);
    const pickItemSelector = `#${feeSelector}_pickItemSelector`;
    const inputSelector = `[data-id="selectedLabelTxt_${feeSelector}TextInput"] #${feeSelector}TextInput`;
    const inventoryPickItemDoneBtn = `#${feeSelector}_DoneBtn`;

    await clickOnElement(t, { selector: pickItemSelector, boundTestRun: t });
    await expectVisible(t, { selector: inputSelector, boundTestRun: t });
    await t.typeText(inputSelector, inventoryFeeChildren[i], { speed: 0.5 });
    const leaseApplicationPage = new LeaseApplicationPage(t);
    const inventoryFirstItemSelector = leaseApplicationPage.getInventoryItemSelector(0);
    await clickOnElement(t, { selector: inventoryFirstItemSelector, boundTestRun: t });
    await clickOnElement(t, { selector: inventoryPickItemDoneBtn, boundTestRun: t });
  });

export const validateSnackbarMessage = async (t, message) => {
  const snackbar = $('[data-component="snackbar"] [data-id="snackbarText"]');
  await snackbar().visible;
  await t.expect(snackbar.innerText).eql(message);
};

export const validateNoSnackbar = async (t, message) =>
  await expectNotVisible(t, { selector: '[data-component="snackbar"] [data-id="snackbarText"]', text: message });

export const editLease = async (t, leaseDetails) => {
  await t.wait(3000);
  if (leaseDetails && leaseDetails.leaseDates) {
    const { leaseStartDate, leaseMoveInDate, leaseEndDate, moveInDateError, endDateError } = leaseDetails.leaseDates;
    const leaseFormPage = new LeaseFormPage(t);
    await leaseFormPage.setLeaseDates(leaseStartDate, leaseMoveInDate, leaseEndDate, { moveInDateError, endDateError, timezone: leaseDetails.timezone });
  }
};

export const publishLease = async (t, leaseDetails) => {
  // sadly we need to be sure the lease is fully loaded before
  // attempting to interact with the form
  await t.wait(3000);
  const leaseApplicationPage = new LeaseApplicationPage(t);
  if (leaseDetails && leaseDetails.companyInfo) {
    await expectVisible(t, { selector: leaseApplicationPage.selectors.companyNameTxt });
    await expectVisible(t, { selector: leaseApplicationPage.selectors.pointOfContactCategoryTxt });
    await verifyCompanyName(t, leaseDetails.companyInfo);
    await verifyPointOfContact(t, leaseDetails.companyInfo);
  }
  if (leaseDetails && leaseDetails.occupantInfo) {
    await expectVisible(t, { selector: leaseApplicationPage.selectors.occupantsCategoryTxt });
    await verifyOccupantName(t, leaseDetails.occupantInfo);
  }

  if (leaseDetails && leaseDetails.leaseDates) {
    const { leaseStartDate, leaseMoveInDate, leaseEndDate } = leaseDetails.leaseDates;
    const leaseFormPage = new LeaseFormPage(t);
    await leaseFormPage.setLeaseDates(leaseStartDate, leaseMoveInDate, leaseEndDate, { timezone: leaseDetails.timezone });
  }

  if (leaseDetails && leaseDetails.areChargeSectionsVisible) {
    // TODO: no concessions for unit 1016
    // await expectVisible(t, { selector: leaseApplicationPage.selectors.concessionsSectionBtn });
    // await clickOnElement(t, { selector: leaseApplicationPage.selectors.concessionsSectionBtn });

    await expectVisible(t, { selector: leaseApplicationPage.selectors.additionalChargesSectionBtn });
    await clickOnElement(t, { selector: leaseApplicationPage.selectors.additionalChargesSectionBtn });

    await expectVisible(t, { selector: leaseApplicationPage.selectors.oneTimeChargesSectionBtn });
    await clickOnElement(t, { selector: leaseApplicationPage.selectors.oneTimeChargesSectionBtn });
  }

  await expectVisible(t, { selector: leaseApplicationPage.selectors.publishLeaseBtn });
  await clickOnElement(t, { selector: leaseApplicationPage.selectors.publishLeaseBtn });
  await leaseApplicationPage.expectPublishAndSendLeaseDialogVisible();
  await expectVisible(t, { selector: leaseApplicationPage.selectors.publishStatusSuccessSection });

  leaseDetails && leaseDetails.viewAndEdit && (await validateSnackbarMessage(t, trans('VOID_LEASE_EMAIL_SUCCESS')));

  const sendLater = leaseDetails ? leaseDetails.sendLater : false;
  const handlerButtonSelector = leaseApplicationPage.getPublishLeaseBtnSelector(sendLater);
  await expectVisible(t, { selector: handlerButtonSelector });
  const nameInput = $(handlerButtonSelector);
  await nameInput.with({ visibilityCheck: true })();
  await clickOnElement(t, { selector: handlerButtonSelector });

  if (leaseDetails && leaseDetails.snackbarMessage) {
    await validateSnackbarMessage(t, leaseDetails.snackbarMessage);
  }
};

const validateLeaseActionState = async (t, message) => {
  const leaseApplicationPage = new LeaseApplicationPage(t);
  const partyDetailPage = new PartyDetailPage(t);
  await expectTextIsEqual(t, {
    selector: `${leaseApplicationPage.selectors.leaseSection} ${partyDetailPage.selectors.leaseState}`,
    text: message,
  });
};

const getLeaseDescription = async (t, dataId) => {
  const leaseApplicationPage = new LeaseApplicationPage(t);
  const { leaseSection, leaseDescriptionTxt } = leaseApplicationPage.selectors;

  return ((await getText(t, { selector: `${leaseSection} ${leaseDescriptionTxt} ${dataId}` })) || '').trim();
};

export const validateLeaseBaseRent = async (t, rent) => {
  const partyDetailPage = new PartyDetailPage(t);
  const { leaseBaseRent } = partyDetailPage.selectors;
  const baseRentExtracted = await getLeaseDescription(t, leaseBaseRent);
  const { result: baseRentFormatted } = formatMoney({ amount: rent, currency: 'USD' });

  await t.expect(baseRentExtracted).eql(baseRentFormatted);
};

export const validateLeaseDescription = async (t, { inventory, promotedLeaseTerm, leaseSignedOrCreatedAt, _baseRent }) => {
  const partyDetailPage = new PartyDetailPage(t);

  const { leaseTerm: leaseTermSelector, leaseUnitName, leaseBaseRent, leaseCreatedDate } = partyDetailPage.selectors;

  const leaseTermExtracted = await getLeaseDescription(t, leaseTermSelector);
  const unitShortHandExtracted = await getLeaseDescription(t, leaseUnitName);
  const baseRentExtracted = await getLeaseDescription(t, leaseBaseRent);
  const createdAtExtracted = await getLeaseDescription(t, leaseCreatedDate);
  const { timezone } = inventory.property;

  const unitShortHand = getShortFormatRentableItem(inventory);
  const layoutSummary = getLayoutSummary(inventory);
  const createdAt = `${formatDateAgo(leaseSignedOrCreatedAt, timezone).toLowerCase()}.`;
  const { termLength, period, rent } = promotedLeaseTerm;
  const leaseTerm = `${termLength} ${period}`;
  const { result: baseRentFormatted } = formatMoney({ amount: rent, currency: 'USD' });

  await t.expect(leaseTermExtracted).eql(leaseTerm);
  await t.expect(unitShortHandExtracted).eql(unitShortHand);
  await t.expect(baseRentExtracted).eql(baseRentFormatted);
  await t.expect(createdAtExtracted).eql(createdAt);

  const layoutExtracted = ((await getText(t, { selector: partyDetailPage.selectors.applicationLayoutInfoTxt })) || '').trim();
  await t.expect(layoutExtracted).eql(layoutSummary);
};

export const validateLeaseSectionText = async (t, { leaseStatus, inventory, promotedLeaseTerm, leaseSignedOrCreatedAt, baseRent }) => {
  await validateLeaseActionState(t, leaseStatus);
  await validateLeaseDescription(t, { leaseStatus, inventory, promotedLeaseTerm, leaseSignedOrCreatedAt, baseRent });
};

export const sendEmailLease = async (t, { rowIndex, memberType, legalName, previousStatus, nextStatus }) => {
  const leaseApplicationPage = new LeaseApplicationPage(t);
  await leaseApplicationPage.checkPersonLeaseStatus(memberType, { rowIndex, status: previousStatus, legalName });

  await leaseApplicationPage.sendEmailLease(memberType, { rowIndex });
  await validateSnackbarMessage(t, trans('SIGN_LEASE_EMAIL_SUCCESS'));

  await leaseApplicationPage.checkPersonLeaseStatus(memberType, { rowIndex, status: nextStatus, legalName });
};

export const signLease = async (t, contactInfo) => {
  const leaseApplicationPage = new LeaseApplicationPage(t);
  const legalName = replaceBlankSpaceWithCharacter(contactInfo.legalName, '_');
  await expectVisible(t, { selector: leaseApplicationPage.selectors.signatureButton });
  await clickOnElement(t, { selector: leaseApplicationPage.selectors.signatureButton });
  await expectVisible(t, { selector: `#${legalName}` });
  await clickOnElement(t, { selector: leaseApplicationPage.selectors.signLeaseCheckbox });
  await clickOnElement(t, { selector: leaseApplicationPage.selectors.startSignatureBtn });
  await expectVisible(t, { selector: `#${legalName}` });
  await clickOnElement(t, { selector: leaseApplicationPage.selectors.signButton });
  await expectTextIsEqual(t, {
    selector: '#infoMessages',
    text: trans('SIGNATURE_COMPLETE_THANK_YOU_MESSAGE'),
  });
};

export const counterSignLease = async (t, userInfo) => {
  const partyDetailPage = new PartyDetailPage(t);
  const leaseApplicationPage = new LeaseApplicationPage(t);
  const fullName = replaceBlankSpaceWithCharacter(userInfo.fullName, '_');

  // TODO: this will only work for the first counter signature (index = 1)
  const counterSignatureStatusSelector = getSelectorWithIndex(partyDetailPage.selectors.countersignerSignatureStatusNotSent, userInfo.index || 1);
  await expectVisible(t, { selector: counterSignatureStatusSelector });
  await expectTextIsEqual(t, { selector: counterSignatureStatusSelector, text: trans('LEASE_READY_FOR_SIGNATURE') });

  await clickOnElement(t, { selector: leaseApplicationPage.selectors.counterSignatureBtn });
  await expectVisible(t, { selector: '[data-component="fake-u-sign-page"]' });
  await expectTextIsEqual(t, { selector: `#${fullName}`, text: `${userInfo.fullName}!` });
  await clickOnElement(t, { selector: leaseApplicationPage.selectors.signButton });
  await expectTextIsEqual(t, {
    selector: '#infoMessages',
    text: trans('SIGNATURE_COMPLETE_THANK_YOU_MESSAGE'),
  });
};

export const verifyLeaseIsSignedByCounterSigner = async (t, index) => {
  const partyDetailPage = new PartyDetailPage(t);
  await expectTextIsEqual(t, { selector: getSelectorWithIndex(partyDetailPage.selectors.countersignerSignatureStatusSigned, index), text: trans('SIGNED') });
};

export const verifyLeaseIsSignedByApplicant = async (t, index) => {
  const partyDetailPage = new PartyDetailPage(t);
  await expectTextIsEqual(t, { selector: getSelectorWithIndex(partyDetailPage.selectors.applicantSignatureStatusSigned, index), text: trans('SIGNED') });
};

export const updatePersonContactInformation = async (t, mockResidentInfo, isPersonDetails = false) => {
  const personCardDialog = new PersonCardPage(t);
  await personCardDialog.clearLegalName();
  await personCardDialog.writeLegalName(mockResidentInfo.legalName);
  await personCardDialog.clearPreferredName();

  await personCardDialog.writePreferredName(mockResidentInfo.preferredName);

  await personCardDialog.clickAndSetPhoneNumber(mockResidentInfo.phone);

  await personCardDialog.clickVerifyPhoneButton();
  await expectTextIsEqual(t, { selector: personCardDialog.selectors.phoneNumberTwo, text: mockResidentInfo.phone });
  await personCardDialog.clickMakePrimaryPhoneTwoButton();
  await expectTextIsEqual(t, { selector: personCardDialog.selectors.primaryLabelPhoneTwo, text: trans('PRIMARY') });
  await personCardDialog.clickAddEmailButton();
  await personCardDialog.writeEmail(mockResidentInfo.email);
  await personCardDialog.clickVerifyEmailButton();
  await expectTextIsEqual(t, { selector: personCardDialog.selectors.emailTwo, text: mockResidentInfo.email });
  await personCardDialog.clickMakePrimaryEmailTwoButton();
  await expectTextIsEqual(t, { selector: personCardDialog.selectors.primaryLabelEmailTwo, text: trans('PRIMARY') });
  await personCardDialog.clickCreatePersonButton(t);
  if (!isPersonDetails) {
    const managePartyPage = new ManagePartyPage(t);
    const personPhones = trans('PERSON_SUMMARY_PHONE', { count: 2 });
    const personEmails = trans('PERSON_SUMMARY_EMAIL', { count: 2 });
    await expectTextIsEqual(t, { selector: managePartyPage.selectors.contactSummaryResident, text: `${personPhones}, ${personEmails}` });
  }
};

export const verifyGuarantorNotLinked = async t => {
  const partyDetailPage = new PartyDetailPage(t);
  const applicationScreeningOnHold = trans('APPLICATION_SCREENING_ON_HOLD');
  const guarantorNotLinkedWarningMessage = trans('GUARANTOR_LINK_HOLD_WARNING_MESSAGE');
  const learnMoreLink = trans('LEARN_MORE');
  const messageInQuoteSection = `${applicationScreeningOnHold} ${guarantorNotLinkedWarningMessage}  ${learnMoreLink}`;
  await partyDetailPage.messageGuarantorNotLinkedInQuoteSection(messageInQuoteSection);
  await partyDetailPage.messageGuarantorNotLinkedInGuarantorSection(trans('MISSING_RESIDENT'));
};

export const closeLeaseForm = async (t, shouldDiscardChanges = false) => {
  const leaseApplicationPage = new LeaseApplicationPage(t);
  await clickOnElement(t, { selector: $(leaseApplicationPage.selectors.leaseFormCloseBtn) });

  shouldDiscardChanges && leaseApplicationPage.clickConfirmDialogBtn();
};

export const verifyDates = async (t, leaseDates, timezone) => {
  const leaseFormPage = new LeaseFormPage(t);
  await leaseFormPage.verifiyDates(leaseDates, timezone);
};

export const checkFeeNegativeAmount = async (t, selectorsForFee, feeAmount) => {
  const leaseApplicationPage = new LeaseApplicationPage(t);

  await clickOnElement(t, { selector: selectorsForFee.amount });
  await clearTextElement(t, { selector: selectorsForFee.amountEditor });
  await t.typeText(selectorsForFee.amountEditor, '-');
  await expectVisible(t, { selector: $('div').withText(trans('THIS_FIELD_ONLY_ALLOWS_NUMBERS')) });

  await t.typeText(selectorsForFee.amountEditor, '500');
  await expectVisible(t, { selector: $('div').withText(trans('THIS_AMOUNT_LOWER_THAN_MIN_LIMIT')) });

  await clickOnElement(t, { selector: leaseApplicationPage.selectors.flyoutDialogDoneBtn });
  await expectVisible(t, { selector: $(selectorsForFee.amount).withText(feeAmount) });
  await expectCheckboxState(t, { selector: selectorsForFee.checkBox, selected: false });
};

export const checkFeeQuantityChanges = async (t, selectorsForFee, feeAmount) => {
  await clickOnElement(t, { selector: selectorsForFee.dropdownButton });
  await clickOnElement(t, { selector: $(selectorsForFee.quantityItem).withText('2') });

  await expectVisible(t, { selector: $(selectorsForFee.amount).withText(feeAmount) });
  await expectCheckboxState(t, { selector: selectorsForFee.checkBox, selected: true });
};

export const checkFeeCheckBoxState = async (t, selectorsForFee) => {
  await clickOnElement(t, { selector: selectorsForFee.checkBox });
  await expectCheckboxState(t, { selector: selectorsForFee.checkBox, selected: true });
};

export const checkFeeValidAmountChanges = async (t, selectorsForFee, feeAmount) => {
  const leaseApplicationPage = new LeaseApplicationPage(t);

  await clickOnElement(t, { selector: selectorsForFee.amount });
  await clearTextElement(t, { selector: selectorsForFee.amountEditor });
  await t.typeText(selectorsForFee.amountEditor, feeAmount);

  await clickOnElement(t, { selector: leaseApplicationPage.selectors.flyoutDialogDoneBtn });
  await expectVisible(t, { selector: $(selectorsForFee.amount).withText(`$${feeAmount}.00`) });
  await expectCheckboxState(t, { selector: selectorsForFee.checkBox, selected: true });
};

export const viewExecutedLease = async t => {
  const partyDetailPage = new PartyDetailPage(t);
  await clickOnElement(t, { selector: $(partyDetailPage.selectors.rowApplicationListItems).withText(trans('VIEW_LEASE')) });
};

export const selectOrUnselctConcession = async (t, concessionSelectors, isSelecting = false) => {
  const leaseApplicationPage = new LeaseApplicationPage(t);
  await clickOnElement(t, { selector: concessionSelectors.checkBox });

  // only if we want to select an editable concession
  if (isSelecting && concessionSelectors.isEditable) {
    await t.typeText(concessionSelectors.amountEditor, concessionSelectors.amountValue);
    await clickOnElement(t, { selector: leaseApplicationPage.selectors.flyoutDialogDoneBtn });
  }
};

export const verifyWarningMsg = async (t, warningMsgText) => {
  const warningMsgSelector = '[data-id="invalid-email-warning"]';
  await expectVisible(t, {
    selector: `${warningMsgSelector} p`,
    text: warningMsgText,
  });
  await expectVisible(t, {
    selector: `${warningMsgSelector} a`,
    text: trans('ADD_EMAIL_ADDRESS'),
  });
};

export const verifyLeaseCannotBePublishedWithIncompleteInfo = async t => {
  const leaseApplicationPage = new LeaseApplicationPage(t);
  const publishBtnSelector = leaseApplicationPage.selectors.publishLeaseBtn;
  await expectVisible(t, { selector: publishBtnSelector });
  await clickOnElement(t, { selector: publishBtnSelector });

  await expectTextIsEqual(t, {
    selector: `${leaseApplicationPage.selectors.dialogOverlay} ${leaseApplicationPage.selectors.dialogHeader}`,
    text: trans('CANNOT_PUBLISH_LEASE'),
  });
  await expectTextIsEqual(t, {
    selector: `${leaseApplicationPage.selectors.dialogOverlay} ${leaseApplicationPage.selectors.dialogBody}`,
    text: trans('MISSING_EMAIL_WARNING_CONTENT'),
  });
  const okBtn = `${leaseApplicationPage.selectors.dialogOverlay} ${leaseApplicationPage.selectors.dialogActions} ${leaseApplicationPage.selectors.okBtn}`;
  const cancelBtn = `${leaseApplicationPage.selectors.dialogOverlay} ${leaseApplicationPage.selectors.dialogActions} ${leaseApplicationPage.selectors.cancelBtn}`;
  await expectVisible(t, { selector: okBtn });
  await expectVisible(t, { selector: cancelBtn });

  await clickOnElement(t, { selector: cancelBtn });

  await clickOnElement(t, { selector: publishBtnSelector });
  await clickOnElement(t, { selector: okBtn });
};

export const verifyManageInfoCard = async (t, contactInfo) => {
  const firstPartyMembersWitoutEmail = contactInfo
    .filter(c => c.email === null)
    .sort((a, b) => a.legalName.localeCompare(b.legalName))
    .shift();
  const personCardDialog = new PersonCardPage(t);
  await personCardDialog.verifyCardLegalName(firstPartyMembersWitoutEmail);
};

export const addEmailAddressAsContactInfo = async (t, contactInfo, options = { isGuarantor: false, makePrimary: false }) => {
  const managePartyPage = new ManagePartyPage(t);
  if (options.isGuarantor) {
    await managePartyPage.clickOnGuarantorCardByPersonName(contactInfo);
    await managePartyPage.clickEditContactInfoGuarantor();
  } else {
    await managePartyPage.clickOnResidentCardByPersonName(contactInfo);
    await managePartyPage.clickEditContactOptionForResident(contactInfo);
  }
  const personCardDialog = new PersonCardPage(t);
  await personCardDialog.clickAddEmailButton();
  await personCardDialog.writeEmail(contactInfo.email);
  await personCardDialog.clickVerifyEmailButton();
  if (options.makePrimary) await personCardDialog.clickMakePrimaryEmailTwoButton();
  await personCardDialog.clickCreatePersonButton(t);
};

export const removeAnonymousEmailAddressAsContactInfo = async (t, contactInfo, options = { isGuarantor: false }) => {
  const managePartyPage = new ManagePartyPage(t);
  const personCardDialog = new PersonCardPage(t);
  if (options.isGuarantor) {
    await managePartyPage.clickOnGuarantorCardByPersonName(contactInfo);
    await managePartyPage.clickEditContactInfoGuarantor();
  } else {
    await managePartyPage.clickOnResidentCardByPersonName(contactInfo);
    await managePartyPage.clickEditContactOptionForResident(contactInfo);
  }
  await expectVisible(t, { selector: '[data-id="invalidContactEmail"]', text: `${contactInfo.email}` });
  await clickOnElement(t, { selector: '[data-id="invalidContactEmail"] [ data-component="button"]', text: 'REMOVE' });
  await t.wait(300);
  await personCardDialog.clickCreatePersonButton(t);
};

export const verifyWarningUnitNotAvailableMsg = async (t, quoteInfo, user) => {
  const leaseApplicationPage = new LeaseApplicationPage(t);
  const applicationSummaryFrame = $(leaseApplicationPage.selectors.applicationSummaryFrame, { timeout: 5000 });
  await t.switchToIframe(applicationSummaryFrame);
  await expectVisible(t, { selector: leaseApplicationPage.selectors.leaseWarningMsg, delayBetweenRetries: 1500 });
  await expectTextIsEqual(t, {
    selector: leaseApplicationPage.selectors.leaseWarningMsg,
    text: `${trans('UNIT_RESERVED_WARNING', { unitName: quoteInfo.unitName, agent: user.fullName })}${capitalize(trans('VIEW_PARTY'))}`,
  });
};

export const checkNavigationThroughViewPartyLink = async t => {
  await clickOnElement(t, { selector: 'span', text: 'View party' });
  await t.switchToMainWindow();
};

export const checkLandingPartyIsFirstParty = async (t, initialPartyPath, landingPartyPath) => {
  await t.expect(landingPartyPath).eql(initialPartyPath);
};

export const leaseDatesChecks = async (t, leaseDetails, newLeaseTerm, initialLeaseTerm) => {
  if (leaseDetails && leaseDetails.leaseDates) {
    const { leaseStartDate, moveInDateError } = leaseDetails.leaseDates;
    const leaseFormPage = new LeaseFormPage(t);
    await leaseFormPage.checkTermLengthDialogAfterTermChanges(leaseStartDate, newLeaseTerm, initialLeaseTerm, {
      moveInDateError,
      timezone: leaseDetails.timezone,
    });
  }
};

export const checkConcessionAmount = async (t, concessionSelector, amount) => {
  await expectTextIsEqual(t, { selector: concessionSelector, text: amount });
};

export const verifyOneTimeFeeAmountAndCheckBoxSelected = async (t, feeName, feeAmount) => {
  await expectCheckboxState(t, { selector: `#${convertToCamelCaseAndRemoveBrackets(feeName)}_oneTimeFeeCheckBox`, selected: true });
  return await expectTextIsEqual(t, {
    selector: `[data-id="${convertToCamelCaseAndRemoveBrackets(feeName)}_oneTimeFeeText"`,
    text: feeAmount,
  });
};

export const selectPartyRepresentative = async (t, partyRepresentativeName) => {
  const leaseFormPage = new LeaseFormPage(t);
  await clickOnElement(t, { selector: leaseFormPage.selectors.partyRepresentativeButton });
  await clickOnElement(t, { selector: leaseFormPage.selectors.partyRepresentativeDropdown, text: partyRepresentativeName });
};
