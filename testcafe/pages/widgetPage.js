/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Selector as $ } from 'testcafe';
import { expectVisible, clickOnElement } from '../helpers/helpers';
import { now } from '../../common/helpers/moment-utils';
import { LA_TIMEZONE, MONTH_YEAR_LONG_FORMAT, DAY_OF_WEEK_SHORT_FORMAT, SHORT_DAY_OF_MONTH_FORMAT } from '../../common/date-constants';
export default class WidgetPage {
  constructor(t) {
    this.t = t;
    this.selectors = {
      widget: '#widget',
      widgetHeader: '#widget [data-id="dateSelectorHeader"]',
      widgetHeaderTitle: '#widget [data-id="dateSelectorHeader"] [data-id="dateSelectorTitle"]',
      widgetHeaderSubTitle: '#widget [data-id="dateSelectorHeader"] [data-id="dateSelectorSubTitle"]',
      widgetContent: '#widget [data-id="wrapperContainer"]',
      widgetCalendar: '#widget [data-id="dateSelectorBody"]',
      daysContainer: '#widget [data-id="daysContainer"]',
      daysScrollerWrapper: '#widget [data-id="daysScrollerWrapper"]',
      nextArrow: '#widget [data-id="dateSelectorChevronRight"]',
      prevArrow: '#widget [data-id="dateSelectorChevronLeft"]',
      backToToday: '#widget [data-id="backToTodayButton"]',
      timeZone: '#widget [data-id="dateSelectorTimeZone"]',
      widgetTestPageTitle: 'h1',
      txtProgram: '#txtProgram',
      txtMarketingSessionId: '#txtMarketingSessionId',
      btnHitMarketingContact: '#btnHitMarketingContact',
      txtMode: '#txtMode',
      txtDynamicFields: '#txtDynamicFields',
      txtOnAppointmentSave: '#txtOnAppointmentSave',
      btnRenderWidget: '#btnRenderWidget',
      txtUnit: '#txtUnit',
      btnGenericApply: '#btn1',
      btnGenericApplyQQ: '#btnGenericApplyQQ',
      unitLabel: 'label[for="Unit"]',
      btnApplyRelatedUnit: '#btn2',
      fullNameInput: 'input[placeholder="Full name *"]',
      emailInput: 'input[placeholder="Email *"]',
      phoneInput: 'input[placeholder="Phone *"]',
      moveInDateInput: 'input[placeholder="Move-in date *"]',
      expectedTermLengthDropDown: '[data-c="dropdown"] [title="Expected term length *"]',
      numberOfPetsDropDown: '[data-c="dropdown"] [title="Number of pets *"]',
      buttonSelector: 'button[data-role="primary"] span',
    };
  }

  async validateWidgetVisible() {
    const { t } = this;
    await expectVisible(t, { selector: this.selectors.widgetTestPageTitle, text: 'Widget test playground' });

    const programSection = $('div').withText('Program').with({ boundTestRun: t });
    await expectVisible(t, { selector: programSection });
    await expectVisible(t, { selector: programSection, text: 'Also known as campaignEmail or programEmail' });
    await expectVisible(t, { selector: this.selectors.txtProgram });

    const marketingSessionId = $('div').withText('MarketingSessionId').with({ boundTestRun: t });
    await expectVisible(t, { selector: marketingSessionId });
    await expectVisible(t, { selector: marketingSessionId, text: 'The marketing SessionId to retrieve from the /marketingContact endpoint.' });
    await expectVisible(t, { selector: this.selectors.txtMarketingSessionId });
    await expectVisible(t, { selector: this.selectors.btnHitMarketingContact });

    const mode = $('div').withText('mode').with({ boundTestRun: t });
    await expectVisible(t, { selector: mode });
    await expectVisible(t, {
      selector: mode,
      text: 'Can be "create", "edit" and "cancel". If Edit and cancel is used you need to provide an appointmentToken',
    });
    await expectVisible(t, { selector: this.selectors.txtMode, value: 'create' });

    const dynamicFields = $('div').withText('DynamicFields').with({ boundTestRun: t });
    await expectVisible(t, { selector: dynamicFields });
    await expectVisible(t, {
      selector: dynamicFields,
      text: 'Fields to be added to the ContactForm in the book appointment widget',
    });
    await expectVisible(t, { selector: this.selectors.txtDynamicFields });

    const onAppointmentSave = $('div').withText('onAppointmentSave').with({ boundTestRun: t });
    await expectVisible(t, { selector: onAppointmentSave });
    await expectVisible(t, {
      selector: onAppointmentSave,
      text: 'Function used to generate the shape of the payload sent to the create appointment endpoint',
    });
    await expectVisible(t, { selector: this.selectors.txtOnAppointmentSave });

    const appointmentToken = $('div').withText('Appointment Token').with({ boundTestRun: t });
    await expectVisible(t, { selector: appointmentToken });
    await expectVisible(t, {
      selector: appointmentToken,
      text: 'The appointment token found in the confirmation email of an appointment',
    });
    await expectVisible(t, { selector: '#txtAppointmentToken' });

    const renderWidgetSection = $('div').withText('Click the button below to render the calendar widget').with({ boundTestRun: t });
    await expectVisible(t, { selector: renderWidgetSection });
    await expectVisible(t, { selector: this.selectors.btnRenderWidget });

    await expectVisible(t, { selector: this.selectors.widgetTestPageTitle, text: 'Form test playground' });

    const genericApply = $('h2').withText('This will be used to apply without selecting a unit').with({ boundTestRun: t });
    await expectVisible(t, { selector: genericApply });
    await expectVisible(t, { selector: this.selectors.btnGenericApply });

    const genericApplyQQ = $('h2')
      .withText('This will be used to apply without selecting a unit and adding default qualification questions')
      .with({ boundTestRun: t });
    await expectVisible(t, { selector: genericApplyQQ });
    await expectVisible(t, { selector: this.selectors.btnGenericApplyQQ });

    const selfQuoteUnit = $('h2').withText('This will be used to apply in the context of a unit, so a quote will be created').with({ boundTestRun: t });
    await expectVisible(t, { selector: selfQuoteUnit });
    await expectVisible(t, { selector: this.selectors.unitLabel });
    await expectVisible(t, { selector: this.selectors.txtUnit });
    await expectVisible(t, { selector: this.selectors.btnApplyRelatedUnit });
  }

  async openRenderWidget() {
    const { t } = this;
    await clickOnElement(t, { selector: this.selectors.btnRenderWidget });
    await expectVisible(t, { selector: this.selectors.widget });
  }

  async checkDisplayedDaysInterval(startDay) {
    const { t } = this;
    const currentMonth = now({ timezone: LA_TIMEZONE }).format(MONTH_YEAR_LONG_FORMAT);
    const nextMonth = now({ timezone: LA_TIMEZONE }).add(1, 'months').format(MONTH_YEAR_LONG_FORMAT);

    const currentMonthSelector = `${this.selectors.daysScrollerWrapper} > div:nth-child(1)`;
    const nextMonthSelector = `${this.selectors.daysScrollerWrapper} > div:nth-child(2)`;

    await expectVisible(t, { selector: `${currentMonthSelector} [data-id="dateSelectorMonth"]`, text: currentMonth });
    await expectVisible(t, { selector: `${nextMonthSelector} [data-id="dateSelectorMonth"]`, text: nextMonth });

    for (let index = startDay; index <= startDay + 6; index++) {
      const daySelector =
        now({ timezone: LA_TIMEZONE }).add(index, 'days').format(MONTH_YEAR_LONG_FORMAT) === currentMonth
          ? `${currentMonthSelector} [data-id="dateSlot"]:nth-child(index)`.replace('index', index + 1)
          : `${nextMonthSelector} [data-id="dateSlot"]:nth-child(index)`.replace(
              'index',
              now({ timezone: LA_TIMEZONE }).add(index, 'days').format(SHORT_DAY_OF_MONTH_FORMAT).toString(),
            );
      await expectVisible(t, {
        selector: `${daySelector} [data-id="dayOfWeek"]`,
        text: now({ timezone: LA_TIMEZONE }).add(index, 'days').format(DAY_OF_WEEK_SHORT_FORMAT).toString().toUpperCase(),
      });
      await expectVisible(t, {
        selector: `${daySelector} [data-id="dateOfTheMonth"]`,
        text: now({ timezone: LA_TIMEZONE }).add(index, 'days').format(SHORT_DAY_OF_MONTH_FORMAT).toString(),
      });
    }
  }

  async checkWidgetFunctionality() {
    const { t } = this;
    await expectVisible(t, { selector: this.selectors.widget });
    await expectVisible(t, { selector: this.selectors.widgetHeaderTitle, text: 'Book a tour' });
    await expectVisible(t, {
      selector: this.selectors.widgetHeaderSubTitle,
      text: 'If you are ready to view your future home, please select a date and time to schedule a tour below',
    });

    await expectVisible(t, { selector: this.selectors.widgetCalendar });
    await expectVisible(t, { selector: this.selectors.daysContainer });
    await expectVisible(t, { selector: this.selectors.daysScrollerWrapper });

    await expectVisible(t, { selector: this.selectors.nextArrow });
    await this.checkDisplayedDaysInterval(0); // Check 7 days are displayed starting with current date
    await clickOnElement(t, { selector: this.selectors.nextArrow });

    await this.checkDisplayedDaysInterval(1); // Check 7 days are displayed starting with next day

    await expectVisible(t, { selector: this.selectors.prevArrow });
    await clickOnElement(t, { selector: this.selectors.prevArrow });
    await this.checkDisplayedDaysInterval(0);

    await clickOnElement(t, { selector: this.selectors.nextArrow });
    await clickOnElement(t, { selector: this.selectors.nextArrow });

    await this.checkDisplayedDaysInterval(2);
    await expectVisible(t, { selector: this.selectors.backToToday, text: 'Back to Today' });
    await clickOnElement(t, { selector: `${this.selectors.backToToday} span`, text: 'Back to Today' });
    await this.checkDisplayedDaysInterval(0);

    // time zone is not currently being rendered
    // await expectVisible(t, { selector: this.selectors.timeZone, text: 'Time Zone: America/Los Angeles' });
  }
}
