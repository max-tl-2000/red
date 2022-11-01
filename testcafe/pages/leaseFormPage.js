/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Selector as $ } from 'testcafe';
import BasePage from './basePage';
import { clickOnElement, getValue, expectTextIsEqual, clearTextElement, expectVisible, expectNotVisible } from '../helpers/helpers';
import { parseAsInTimezone } from '../../common/helpers/moment-utils';
import { MONTH_DATE_YEAR_LONG_FORMAT } from '../../common/date-constants';
import { formatMoney } from '../../common/money-formatter';

export default class LeaseFormPage extends BasePage {
  constructor(t) {
    super(t);

    this.selectors = {
      ...this.selectors,
      publishLeaseBtn: '#publishLease',
      leaseStartDateTxt: '#leaseStartDateTxt',
      moveInDateTxt: '#moveInDateTxt',
      moveInDateValidator: '#moveInDateTxt-err-msg',
      leaseEndDateTxt: '#leaseEndDateTxt',
      leaseEndDateValidator: '#leaseEndDateTxt-err-msg',
      baseRentLeaseTermEditor: '[data-id="editorAmountbaseRentLeaseTerm_IndexText"]',
      baseRentLeaseTermInput: '#flyoutAmountbaseRentLeaseTerm_IndexText',
      confirmLeaseTermDialog: '[data-id="confirmLeaseTermDialog_dialogOverlay"]',
      confirmLeaseTermDialogDropdownButton: '#confirmLeaseTermDropdown',
      partyRepresentativeButton: '#partyRepresentativeSelector',
      partyRepresentativeDropdown: '[data-id="overlay-partyRepresentativeSelector"]',
    };
  }

  getLeaseDates = async timezone => {
    const extractDate = async selector => parseAsInTimezone(await getValue(selector), { format: MONTH_DATE_YEAR_LONG_FORMAT, timezone });
    return {
      leaseStartDate: await extractDate(this.selectors.leaseStartDateTxt),
      leaseMoveInDate: await extractDate(this.selectors.moveInDateTxt),
      leaseEndDate: await extractDate(this.selectors.leaseEndDateTxt),
    };
  };

  setLeaseDates = async (leaseStartDate, leaseMoveInDate, leaseEndDate, { moveInDateError, endDateError, timezone } = {}) => {
    const { t } = this;
    await this.selectLeaseDate(t, this.selectors.leaseStartDateTxt, leaseStartDate, timezone);
    await this.confirmLeaseTermLengthIfNeeded();
    await this.selectLeaseDate(t, this.selectors.moveInDateTxt, leaseMoveInDate, timezone);
    moveInDateError && (await expectTextIsEqual(t, { selector: this.selectors.moveInDateValidator, text: moveInDateError }));
    await this.selectLeaseDate(t, this.selectors.leaseEndDateTxt, leaseEndDate, timezone);
    await this.confirmLeaseTermLengthIfNeeded();
    endDateError && (await expectTextIsEqual(t, { selector: this.selectors.leaseEndDateValidator, text: endDateError }));
  };

  verifiyDates = async (leaseDates, timezone) => {
    const { t } = this;

    const dates = await this.getLeaseDates(timezone);
    await t.expect(dates.leaseStartDate.toJSON()).eql(leaseDates.leaseStartDate.toJSON());
    await t.expect(dates.leaseMoveInDate.toJSON()).eql(leaseDates.leaseMoveInDate.toJSON());
    await t.expect(dates.leaseEndDate.toJSON()).eql(leaseDates.leaseEndDate.toJSON());
  };

  verifyDatesAndBaseRent = async ({ promotedLeaseTerm, baseRent, leaseDates }, timezone) => {
    const { t } = this;
    const { result: baseRentFormatted } = formatMoney({ amount: baseRent, currency: 'USD' });

    await this.verifiyDates(leaseDates, timezone);

    await expectTextIsEqual(t, { selector: this.selectors.baseRentLeaseTermEditor.replace('Index', promotedLeaseTerm.termLength), text: baseRentFormatted });
  };

  verifyPublishButtonState = async (enable = true) => {
    const { t } = this;
    const publishLeaseBtnSelector = enable ? $(this.selectors.publishLeaseBtn) : $(this.selectors.publishLeaseBtn).withAttribute('disabled');
    await t.expect((await publishLeaseBtnSelector).visible).eql(true);
  };

  editConcessionAmount = async (editorSelector, inpuptSelector, value) => {
    const { t } = this;
    await clickOnElement(t, { selector: editorSelector });
    await clearTextElement(t, { selector: inpuptSelector });
    await this.editValueOnAmountEditor(t, inpuptSelector, value.toString());
  };

  confirmLeaseTermLengthIfNeeded = async () => {
    const { t } = this;
    if (!(await $(this.selectors.confirmLeaseTermDialog).exists)) return;

    await clickOnElement(t, { selector: `${this.selectors.confirmLeaseTermDialog} ${this.selectors.okBtn}` });
  };

  setLeaseStartDate = async (leaseStartDate, timezone) => {
    const { t } = this;
    await this.selectLeaseDate(t, this.selectors.leaseStartDateTxt, leaseStartDate, timezone);
  };

  confirmLeaseTermLengthDialog = async (newLeaseTerm, initialLeaseTerm) => {
    const { t } = this;
    await expectVisible(t, { selector: this.selectors.confirmLeaseTermDialog });
    await clickOnElement(t, { selector: this.selectors.confirmLeaseTermDialogDropdownButton });
    await expectVisible(t, { selector: $('[data-component="list-item"]').withText(newLeaseTerm) });
    await expectVisible(t, { selector: $('[data-component="list-item"]').withText(initialLeaseTerm) });
    await clickOnElement(t, { selector: `${this.selectors.confirmLeaseTermDialog} ${this.selectors.okBtn}` });
  };

  checkTermLengthDialogAfterTermChanges = async (leaseStartDate, newLeaseTerm, initialLeaseTerm, { moveInDateError, timezone } = {}) => {
    const { t } = this;
    await this.selectLeaseDate(t, this.selectors.leaseStartDateTxt, leaseStartDate, timezone);
    await this.confirmLeaseTermLengthDialog(newLeaseTerm, initialLeaseTerm);
    moveInDateError && (await expectTextIsEqual(t, { selector: this.selectors.moveInDateValidator, text: moveInDateError }));
  };

  checkTermLengthDialogIsNotDisplayed = async () => {
    const { t } = this;
    await expectNotVisible(t, { selector: this.selectors.confirmLeaseTermDialog });
  };
}
