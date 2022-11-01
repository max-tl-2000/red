/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import BasePage from 'lib/BasePage';
import { expect } from 'chai';
import config from 'config';
import logger from 'helpers/logger';
import sleep from 'helpers/sleep';
import { execWithRetry } from 'lib/exec-with-retry';
import { LA_TIMEZONE } from '../../../../common/date-constants';
import { now } from '../../../../common/helpers/moment-utils';
import { getTeams } from '../../../lib/utils/apiHelper';
import { tenant } from '../../../support/dbHelper';

const { cucumber } = config;

export default class partyDetailsPhaseTwo extends BasePage {
  constructor() {
    super();
    this.url = this.baseURL;
  }

  async checkForPartyDetailsPhaseTwoPage() {
    const isVisible = await this.isVisible('[data-component="partyPage"][data-phase="phaseII"]');
    expect(isVisible).to.equal(true);
  }

  async unitsCardsShouldContain(info) {
    const unitCards = await this.findElements('[data-id="inventoryCard"]');
    const infoPromises = unitCards.map(c => this.findElement('[data-id="unitInfo"]', c));
    const infoElements = await Promise.all(infoPromises);
    const elmInfo = await Promise.all(infoElements.map(e => e.getText()));
    return expect(elmInfo.sort()).to.deep.equal(Array(elmInfo.length).fill(info).sort());
  }

  async doUnitCardsContainInfo(info) {
    const unitCards = await this.findElements('[data-id="inventoryCard"]');
    const infoPromises = unitCards.map(c => this.findElement('[data-id="unitInfo"]', c));
    const infoElements = await Promise.all(infoPromises);
    const elmInfo = await Promise.all(infoElements.map(e => e.getText()));
    return expect(elmInfo).to.include(info);
  }

  async checkUnitCardsAreAvailable() {
    const unitCards = await this.findElements('[data-id="inventoryCard"]');
    const infoPromises = unitCards.map(c => this.findElement('[data-id="unitInfo"]', c));
    const infoElements = await Promise.all(infoPromises);
    const elmInfo = await Promise.all(infoElements.map(e => e.getText()));
    return expect(elmInfo).to.have.length.of.at.least(1);
  }

  async checkAllUnitCardsHaveImages() {
    const unitCards = await this.findElements('[data-id="inventoryCard"]');
    const infoPromises = unitCards.map(c => this.findElement('[data-id="unitInfo"]', c));

    const infoElements = await Promise.all(infoPromises);
    const elmInfo = await Promise.all(infoElements.map(e => e.getText()));

    const imagesPromises = unitCards.map(c => this.findElement('[class^="inventory-card-image-bg"][data-id]', c));
    const imagesElements = await Promise.all(imagesPromises);

    const elmImages = await Promise.all(imagesElements.map(e => e.getAttribute('data-id')));
    return expect(elmInfo.length).to.deep.equal(elmImages.length);
  }

  async clickTourUnitCard(unit) {
    const tourButtonId = `tour-${unit}`;
    return this.clickOnElement(`[data-id="${tourButtonId}"]`);
  }

  async appointmentDialogContains(fieldName, text) {
    const appDialog = await this.findElement('#scheduleAppointment');
    const guestsField = await this.findElement(`[data-id="${fieldName}"]`, appDialog);
    const spansElm = await this.findElements('span', guestsField);
    const spansTextProm = spansElm.map(s => s.getText());
    const spansText = await Promise.all(spansTextProm);
    logger.info({ spansText }, 'found text in spans');
    return expect(spansText).to.include(text);
  }

  async checkCalendarSlot(text) {
    const appDialog = await this.findElement('#scheduleAppointment');
    const calendarElm = await this.findElement('[data-id="fullCalendar"]', appDialog);
    this.executeScript('arguments[0].scrollTop=2000;', calendarElm);
    const calendarSlot = await this.findElement('tr[data-time="15:00:00"] td:last-child');
    return await this.findElementByXpath(`//*[contains(text(), "${text}")]`, calendarSlot);
  }

  async checkIfTeamCalendarIsDisplayed() {
    const condFunc = async () => {
      logger.trace('Check if team calendar is displayed');
      const calendarDaysElements = await this.findElements('div.fc-time-grid-container td.fc-day');
      return calendarDaysElements.length > 1;
    };
    await this.waitForCondition('time to check if team calendar is displayed.', condFunc, cucumber.selenium.defaultTimeout);
  }

  async setTeamCalendarSlot(slotTime) {
    await this.checkIfTeamCalendarIsDisplayed();
    await this.clickOnElement(`tr[data-time="${slotTime}"] td:last-child`);
  }

  async checkIfAgentCalendarIsDisplayed() {
    const condFunc = async () => {
      logger.trace('Check if agent calendar is displayed');
      const calendarDaysElements = await this.findElements('div.fc-time-grid-container td.fc-day');
      return calendarDaysElements.length === 1;
    };
    await this.waitForCondition('time to check if team calendar is displayed.', condFunc, cucumber.selenium.defaultTimeout);
  }

  async setAgentCalendarSlot(slotTime) {
    await this.checkIfAgentCalendarIsDisplayed();
    this.clickOnElement(`tr[data-time="${slotTime}"] td:last-child`);
  }

  async checkAppointment(guestName, unitName, notes) {
    const guests = await this.getText('[data-id="appointmentSection"] [data-id="guests"]');
    const units = (await this.getText('[data-id="appointmentSection"] [data-id="units"]')).replace('visiting ', '');
    const note = await this.getText('[data-id="appointmentSection"] [data-id="notes"]');

    expect(guestName).to.equal(guests);
    expect(unitName).to.equal(units);
    expect(notes).to.equal(note);
  }

  async checkIfPartyTitleContainsGuestName(guestName) {
    const condFunc = async () => {
      logger.trace(`Check if party exists for: '${guestName}'.`);
      const partyTitle = await this.getText(`[data-id="appBar"] [data-id="${guestName}"]`);
      return partyTitle.indexOf(guestName) !== -1;
    };
    await this.waitForCondition(`time to check if guestName: '${guestName}' exists in party's title.`, condFunc, cucumber.selenium.defaultTimeout);
  }

  setSearchProperty(property) {
    return this.setValue('div[data-component="gemini-scrollbar"] [type="text"]', property);
  }

  selectProperty(property) {
    return this.clickOnElement(`[data-property-card-name="${property}"]`);
  }

  async clickQuoteUnitCard(unit) {
    const quoteButtonId = `quote-${unit}`;
    return this.clickOnElement(`[data-id="${quoteButtonId}"]`);
  }

  async checkQuoteDraftDisplayed() {
    const text = await this.getText('[data-title="Quote (draft)"]');
    await expect(text).to.contain('Quote for Unit');
    const draft = await this.getText('[data-title="Quote (draft)"] span');
    return expect(draft).to.contain('(draft)');
  }

  async _clickReviewOrPromoteApplication(unit) {
    this.clickOnElement(`#quote-card-menu-${unit} [data-component="card-menu"]`);
    // it is better to wait for the opening animation to complete
    // as sometimes the element is in the DOM already but doesn't have the handler
    // so the click won't work even when webdriver already dispatched the click successfully
    await sleep(600);
    await this.clickOnElement('[name="review-promote-application"]');
    // TODO. Add this flow separate as now the default lease term will just be one (taken from the rent matrix)
    // await this.isVisible('#lease-term-selector-dialog');
  }

  // Only Corporate parties will be promoted from here. Traditionals will go to review instead.
  async clickReviewOrPromoteApplication(unit) {
    const fnName = '_clickReviewOrPromoteApplication';
    logger.trace(`${fnName} start`);
    await execWithRetry(() => this._clickReviewOrPromoteApplication(unit), { fnName, logger });
  }

  async clickRequestApproval() {
    return this.clickOnElement('[name="btnRequestApproval"]');
  }

  async clickReviewApplication() {
    return this.clickOnElement('[name="btnReviewApplication"]');
  }

  async scrollPage(value) {
    return this.scrollTop('[data-layout="left-panel"]', value);
  }

  async checkPromotionUnitItem(unit) {
    // Scroll down
    await this.scrollPage(1800);
    const qualifiedName = await this.getText(`#row${unit} [data-id="qualifiedName"]`);
    expect(`${qualifiedName}`).to.contain(`${unit}`);
  }

  async checkLeaseTermSelectorDialog(unit) {
    await this.elementContainsText('#dialog-header', `Select a lease term for unit ${unit}`);
  }

  async selectLeaseTerm(lease) {
    const length = lease.split(' ', 2);

    // Select a Lease term
    // NOTE: This selector is not specific enough it was matching other selects in the party page
    // I didn't fix this because we're planning to move to testcafe and it should be fixed there
    await this.clickOnElement('[name="menu-down"] g');
    await this.selectElement(`#term${length[0]}`);
  }

  // TODO: should be able to handle multiple quotes, too
  async checkPromotionDetails(promoteTable) {
    const expectedPromotionDetails = promoteTable.raw();
    // Remove first row because of label
    expectedPromotionDetails.shift();

    const currentDate = now({ timezone: LA_TIMEZONE });
    const startDate = currentDate.format('MM/DD/YYYY');

    expectedPromotionDetails.forEach(detail => {
      detail[0] = startDate;
    });

    const fnName = 'checkPromotionDetails';
    logger.trace(`${fnName} start`);
    await execWithRetry(() => this._checkPromotionDetails(expectedPromotionDetails), { fnName, logger });
  }

  async _checkPromotionDetails(expectedPromotionDetails) {
    logger.trace({ expectedPromotionDetails }, 'checking against promoteTable');

    await this.waitForCondition('element is visible', () => this.isVisible('[data-type="application-status"]'));

    const getDetailsForLeaseTermRow = async leaseTermRow => {
      const [leaseStartEl, leaseTermEl, applicationStatusEl] = await this.findElements('[data-component="cell"]', leaseTermRow);

      const leaseTermValueEl = await this.findElement('[data-component="time-duration-value"]', leaseTermEl);
      const leaseTermUnitEl = await this.findElement('[data-component="time-duration-unit"]', leaseTermEl);

      const leaseTermValue = await leaseTermValueEl.getText();
      const leaseTermUnit = await leaseTermUnitEl.getText();
      const appStatus = await applicationStatusEl.getText();
      const leaseStart = await leaseStartEl.getText();
      return [leaseStart, `${leaseTermValue} ${leaseTermUnit}`, appStatus];
    };

    // Map promotion Details
    const quoteRows = await this.findElements('[data-component="quote-list-row"]');
    const leaseTermRows = await this.findElements('[data-component="lease-term-row"]', quoteRows[0]);
    const promotionQuoteData = await Promise.all(leaseTermRows.map(row => getDetailsForLeaseTermRow(row)));
    logger.trace({ leaseTermRows }, 'found lease term rows');
    logger.trace({ promotionQuoteData, expectedPromotionDetails }, 'comparing');

    expect(expectedPromotionDetails).to.deep.equal(promotionQuoteData);
  }

  sectionIdFromTitle(title) {
    return title
      .split(/\s+/)
      .map((it, idx) => {
        if (idx === 0) return it.toLowerCase();

        return it[0].toUpperCase() + it.substring(1).toLowerCase();
      })
      .join('');
  }

  async checkSection(title) {
    const titleId = `[data-id=${this.sectionIdFromTitle(title)}]`;
    // Scroll up
    await this.scrollPage(1000);
    await this.waitForCondition('Wait for section', () => this.isVisible(titleId));
    return expect(await this.isVisible(titleId)).to.equal(true);
  }

  async checkForApplicationPendingApproval(applicationData) {
    const expectedApplicationDetails = applicationData.raw();

    // Remove first row because of label
    expectedApplicationDetails.shift();

    const startdate = now({ timezone: LA_TIMEZONE });
    const newDate = startdate.clone().add(1, 'month');

    const movingInDate = newDate.format('MMM DD');

    expectedApplicationDetails[1] = [`${expectedApplicationDetails[1]} ${movingInDate}`];
    logger.trace({ expectedApplicationDetails }, 'checking against Application approval Details');

    const getDetailsForApplicationPendingApprovalSection = async applicationDetailsRow => {
      const baseRentEl = await this.findElement('span[data-component="money"]', applicationDetailsRow);
      const baseRentPeriodEl = await this.findElement('span[data-component="subheader"]:not([data-part="decimal"])', applicationDetailsRow);
      const movingEl = await this.findElement('[data-id="moveDate"]', applicationDetailsRow);
      const includesListEl = await this.findElement('span[data-component="text"]', applicationDetailsRow);

      const applicationbaseRent = await baseRentEl.getText();
      const applicationPeriod = await baseRentPeriodEl.getText();
      const movingIn = await movingEl.getText();
      const includesList = await includesListEl.getText();

      return [[`${applicationbaseRent}${applicationPeriod}`], [movingIn], [`Includes: ${includesList}`]];
    };

    // Map application pending approval section
    const applicationApprovalSection = await this.findElements('[data-id="applicationPendingApproval"]');
    const [applicationDetailsData] = await Promise.all(applicationApprovalSection.map(row => getDetailsForApplicationPendingApprovalSection(row)));
    logger.trace({ applicationDetailsData }, 'found application approval section');
    logger.trace({ applicationDetailsData, expectedApplicationDetails }, 'comparing');
    expect(expectedApplicationDetails[0].sort()).to.deep.equal(applicationDetailsData[0].sort());
    // TODO: this is temporary until we fix the time mess
    const movingInExpected = expectedApplicationDetails[1][0].split(' ').slice(0, 2).sort();
    const movingInActual = applicationDetailsData[1][0].split(' ').slice(0, 2).sort(); // just get '6 month'. Should be enough for now
    expect(movingInExpected).to.deep.equal(movingInActual);
    expect(expectedApplicationDetails[2].sort()).to.deep.equal(applicationDetailsData[2].sort());
  }

  async clickAbandonApprovalRequest() {
    await this.clickOnElement('[data-id="applicationPendingApproval"] [data-component="card-menu"]');
    await sleep(600);
    await this.clickOnElement('#abandonRequestApproval');
    expect(await this.isVisible('#abandonApprovalRequestContent', 20)).to.equal(true);
  }

  async validateThatApproveApplicationIsDisplayed() {
    const isVisible = await this.isVisible('[data-id="btnApproveApplication"]');
    expect(isVisible).to.equal(true);
  }

  async clickApproveApplication() {
    await this.clickOnElement('[data-id="btnApproveApplication"]');
  }

  async clickAbortApproval() {
    return this.clickOnElement('[data-command="OK"]');
  }

  async checkForAbandonApprovalDialog() {
    await this.elementContainsText('#dialog-header', 'Abandon approval request');
    await this.elementContainsText(
      '[data-component="dialog-body"]',
      'The request for approval will be canceled. You can promote a different quote and term after doing this.',
    );
  }

  async getMaximumUnitDepositValue(value) {
    const numberInString = /\(([^"]*)x/g;
    const extractUnitDeposit = /([(x])+/g;
    let maximumUnitDeposit;

    maximumUnitDeposit = value.match(numberInString);
    maximumUnitDeposit = maximumUnitDeposit[0].replace(extractUnitDeposit, '');

    return maximumUnitDeposit;
  }

  async increaseDepositCondition(value) {
    const maxUnitDepositValue = await this.getMaximumUnitDepositValue(value);
    const depositAmountId = `depositAmount_${maxUnitDepositValue}`;

    await this.clickOnElement('#increaseDeposit');
    await this.clickOnElement('#depositDropdown');

    const expectedAmountText = await this.getText(`#${depositAmountId}`);
    expect(expectedAmountText).to.equal(value);
    await this.selectElement(`#${depositAmountId}`);
  }

  async openManageParty() {
    await this.clickOnElement('[data-component="party-guests"]');
    await this.isVisible('#manage-party-details-dialog');
  }

  async checkHoldScreeningBannerExists() {
    await this.isVisible('[data-component="partyPage"] [data-id="holdScreeningNotification"]');
  }

  async checkBannerContainsHoldType(holdType) {
    await this.elementContainsText('[data-id="holdScreeningNotification"] [data-id="messageHoldTypes"]', holdType);
  }

  async validatePersonAplicationStatus(status) {
    await this.elementContainsText('[class^="appStatus"] [data-component="text"]', status);
  }

  async validateGuarantorSection() {
    await this.isVisible('[class^="group-title-outer"] [class^="group-title"]');
  }

  async validateApplicationsAndQuotes() {
    await this.isVisible('[class^="title-section"] [data-component="text"]');
  }

  async checkSignLeaseButton() {
    await this.isVisible('[data-id="signatureButton"]');
  }

  async clickSignLeaseButton() {
    await this.clickOnElement('[data-id="signatureButton"]');
  }

  async checkThatLeaseIsSigned() {
    await this.elementContainsText('[class*="lease-sent"]', 'Signed');
  }

  async checkCountersignLeaseButton() {
    await this.isVisible('[data-id="counterSignatureButton"]');
  }

  async clickCountersignLeaseButton() {
    await this.clickOnElement('[data-id="counterSignatureButton"]');
  }

  async selectValueFromDropDown(container, selectorId, value) {
    const baseComponent = await this.findElement(`${container}`);
    this.clickOnElement(`${selectorId}`);
    const searchPath = `//div[p[contains(text(), "${value}")]]`;
    const listItems = await this.findElements('[data-component="list-item"] [data-component="subheader"]', baseComponent);
    const items = await Promise.all(listItems.map(c => this.findElementByXpath(searchPath, c)));
    return this.clickOnElement(items[0]);
  }

  async appointmentCalendarClickTomorrow() {
    await this.checkIfAgentCalendarIsDisplayed();
    await this.clickOnElement('div[data-component="weekDay"]:nth-child(2)');
  }

  async selectTeamFromDropDown(selectorId, teamName) {
    const dropDownElement = await this.findElement(`${selectorId}`);
    await this.clickOnWebdriverElement(dropDownElement);
    const { teams } = await getTeams(tenant);
    const teamThatIWant = teams.find(t => t.displayName === teamName).id;
    const searchInputElement = await this.findElement('input', dropDownElement);
    await searchInputElement.sendKeys(teamName);
    const teamCard = await this.findElement(`#teams_${teamThatIWant}`, dropDownElement);
    await this.clickOnWebdriverElement(teamCard);
  }

  async checkIfAgentInTeamSelector(agentName, expectedLength) {
    const searchEmployees = await this.findElement('#teamCalendarEmployeeSearch');
    const searchInputElement = await this.findElement('input', searchEmployees);
    await searchInputElement.sendKeys(agentName);
    await this.waitForCondition('check if agent found', async () => {
      const elements = await this.findElements('div[data-component="list-item"]', searchEmployees);
      return elements.length === expectedLength;
    });
  }

  async selectTourTypeFromDropDown(selectorId, tourType) {
    const dropDownElement = await this.findElement(`${selectorId}`);
    await this.clickOnWebdriverElement(dropDownElement);
    const listItems = await this.findElements('[data-component="list-item"]', dropDownElement);
    const searchPath = `//div[contains(text(), "${tourType}")]`;
    const items = await Promise.all(listItems.map(c => this.findElementByXpath(searchPath, c)));
    return this.clickOnWebdriverElement(items[0]);
  }
}
