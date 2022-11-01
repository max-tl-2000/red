/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Selector as $ } from 'testcafe';
import { clickOnCard, expectDashboardLaneContains, expectVisible, expectTextIsEqual, elementNotExist, clickOnElement, expectTextContains } from './helpers';
import DashboardPage from '../pages/dashboardPage';

export const validateDashboardVisible = async t => {
  const dashboardPage = new DashboardPage(t);
  await expectVisible(t, { selector: dashboardPage.selectors.dashboardViewClass });
  await expectVisible(t, { selector: dashboardPage.selectors.createPartyBtn });
};

export const clickSwitchTodayOnlyToggle = async t => {
  const dashboardPage = new DashboardPage(t);
  await clickOnElement(t, { selector: dashboardPage.selectors.switchToTodayToggle });
};

export const lookForACardInDashboard = async (t, contactInfo, selector, count = 0) => {
  const dashboardPage = new DashboardPage(t);
  // Click on chevron right icon twice
  await dashboardPage.clickOnChevronIcon(count, dashboardPage.selectors.chevronRightIcon);
  await expectDashboardLaneContains(t, { lane: selector, cardText: contactInfo.legalName });
};

export const clickOnCardInDashboard = async (t, column, contactInfo) => {
  await clickOnCard(t, { lane: column, cardText: contactInfo.legalName });
};

export const verifyCardNotExists = async (t, column, contactInfo) => {
  const dashboardPage = new DashboardPage(t);
  const selector = $(`${column} ${dashboardPage.selectors.card}`).withText(contactInfo.legalName);
  await elementNotExist(t, { selector });
};

export const verifyCardTaskName = async (t, text) => {
  const dashboardPage = new DashboardPage(t);
  await expectTextIsEqual(t, { selector: dashboardPage.selectors.applicantCardTask0Name, text });
};

export const logOut = async t => {
  const dashboardPage = new DashboardPage(t);
  await expectVisible(t, { selector: dashboardPage.selectors.menuBtn });
  await dashboardPage.logOut(t);
};

export const checkAppointmentScheduledInCard = async (t, timeScheduled) => {
  const dashboardPage = new DashboardPage(t);
  await expectTextContains(t, { selector: dashboardPage.selectors.appointmentRow, text: timeScheduled });
};

export const checkCardWithWebInquiryNotification = async (t, legalName) => {
  await expectVisible(t, { selector: '[data-id="card"]', text: legalName });
  const webInquiryNotification = '[data-id="card"] [data-id="message resident"]'.replace('resident', legalName);
  await expectVisible(t, { selector: webInquiryNotification, text: legalName, boundTestRun: t });
  await expectVisible(t, { selector: webInquiryNotification, text: 'Quote sent', boundTestRun: t });
};

export const clickOnCardByResidentName = async (t, residentName) => {
  await clickOnElement(t, { selector: '[data-id="card"]', text: residentName });
};
