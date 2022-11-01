/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Selector as $ } from 'testcafe';
import { mapSeries } from 'bluebird';
import { clickOnElement, getText, expectVisible } from '../helpers/helpers';
import { toMoment, parseAsInTimezone } from '../../common/helpers/moment-utils';
import { LA_TIMEZONE } from '../../common/date-constants';

export default class BasePage {
  constructor(t) {
    this.t = t;
    this.selectors = {
      okBtn: '[data-command="OK"]',
      cancelBtn: '[data-command="CANCEL"]',
      title: '[data-component="title"]',
      caption: '[data-component="caption"]',
      markdown: '[data-component="markdown"]',
      dialogHeader: '[data-component="dialog-header"]',
      dialogBody: '[data-component="dialog-body"]',
      dialogActions: '[data-component="dialog-actions"]',
      subHeader: '[data-component="subheader"]',
      dialogOverlay: '#dialog-overlay',
      activityRow: '[data-component="row"]',
      listItem: '[data-component="list-item"]',
      listItemValue: '[data-component="dropdown-item-value"]',
      table: '[data-component="table"]',
      dropDown: '[data-component="dropdown"]',
      button: '[data-component="button"]',
      dataActionOkBtn: '[data-action="OK"]',
      flyoutDialogDoneBtn: '[data-id="flyoutDoneBtn"]',
      text: '[data-component="text"]',
      leaseStartDateCalendar: '#leaseStartDateTxt_calendar',
      leaseMoveInDateCaendar: '#moveInDateTxt_calendar',
      leaseEndDateCalendar: '#leaseEndDateTxt_calendar',
      tag: '[data-component="tag"]',
      manualTaskDueDateText: '#manualTaskDueDate',
    };
  }

  editValueOnAmountEditor = async (t, selector, value) => {
    await t.typeText(selector, value, { speed: 0.5 });
    await expectVisible(t, { selector: this.selectors.flyoutDialogDoneBtn });
    await clickOnElement(t, { selector: this.selectors.flyoutDialogDoneBtn });
  };

  getMonthSelected = async (t, selector, timezone) =>
    parseAsInTimezone(await getText(t, { selector: `${selector} [data-id="monthYearNavigation"]` }), { format: 'MMMM YYYY', timezone });

  navigateToMonth = async (t, selector, { date, timezone }, selectedMonthYear) => {
    let monthYear = selectedMonthYear || (await this.getMonthSelected(t, selector, timezone));
    const dateToSelect = toMoment(date, { timezone }).startOf('day').startOf('month');

    if (monthYear.year() !== dateToSelect.year() || monthYear.month() !== dateToSelect.month()) {
      await expectVisible(t, { selector });
      await clickOnElement(t, { selector: `${selector} [data-id="${monthYear.isBefore(dateToSelect) ? 'dateSelectorRightBtn' : 'dateSelectorLeftBtn'}"]` });
      monthYear = await this.getMonthSelected(t, selector, timezone);
      await this.navigateToMonth(t, selector, { date, timezone }, monthYear);
    }
  };

  // date: must to have in moment format
  selectLeaseDate = async (t, selector, date, timezone = LA_TIMEZONE) => {
    await clickOnElement(t, { selector });

    const calendarContext = `${selector}_calendar`;
    await this.navigateToMonth(t, calendarContext, { date, timezone });
    const day = date.format('D');

    if (await this.isCalendarDayDisabled(calendarContext, day)) {
      await clickOnElement(t, { selector: `${calendarContext} [data-id="dateSelectorRightBtn"]` });
    }

    await clickOnElement(t, { selector: $(`${calendarContext} [data-id="${day}_day"]`) });
    await clickOnElement(t, { selector: `${calendarContext} [data-id="dateSelectorOkBtn"]` });
  };

  isCalendarDayDisabled = async (selector, day) => await $(`${selector} [data-id="${day}_day"]`).hasAttribute('data-day-disabled');

  checkUnselectedFees = async fees => {
    const { t } = this;
    await mapSeries(fees, async element => {
      const feeRow = $('[data-component="row"]').withText(element).with({ boundTestRun: t });
      const blankCheckBox = feeRow.find('#checkbox-blank-outline');
      await t.expect(blankCheckBox).ok();
    });
  };
}
