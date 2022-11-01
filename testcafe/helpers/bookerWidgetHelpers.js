/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Selector as $ } from 'testcafe';
import moment from 'moment'; // eslint-disable-line red/no-moment
import { now } from '../../common/helpers/moment-utils';
import { clickOnElement, expectVisible } from './helpers';
import WidgetPage from '../pages/widgetPage';

const expectedTimeFormatForWebInquiry = 'hh:mm a';

const ScheduleTime = '[data-id="dateSlot"] [data-id="dateOfTheMonth"]';

const getSlot = (day, slot) => {
  const dateSlot = $(ScheduleTime).withExactText(day);
  return dateSlot.parent(0).parent(0).find(`[data-id="appointmentsButtonContainer"] :nth-child(${slot})`);
};

const extractTimeIntervalByDateAndSlot = async (date, slot) => {
  const timeSlot = getSlot(date, slot);
  return await timeSlot.textContent;
};

const clickOnTimeIntervalByDateAndTimeSlot = async (t, day, slot) => {
  const timeSlot = getSlot(day.toString(), slot);
  return await clickOnElement(t, { selector: timeSlot });
};

export const selectTimeSlot = async (t, addDays, timeSlot, timezone = 'America/Los_Angeles') => {
  const dateSlot = now({ timezone }).add(addDays, 'days').format('D');

  const tourTime = await extractTimeIntervalByDateAndSlot(dateSlot, timeSlot);
  const tourTimeFormated = moment(tourTime, 'H:mm a').format(expectedTimeFormatForWebInquiry);

  await clickOnTimeIntervalByDateAndTimeSlot(t, dateSlot, timeSlot);
  return tourTimeFormated;
};

export const createASelfQuote = async (t, unitName, quoteMockData) => {
  const widgetPage = new WidgetPage(t);
  await t.typeText(widgetPage.selectors.txtUnit, unitName, { replace: true });
  await clickOnElement(t, { selector: widgetPage.selectors.btnApplyRelatedUnit });
  await expectVisible(t, { selector: '[data-component="Header"]', text: 'Start Application' });
  await expectVisible(t, { selector: widgetPage.selectors.fullNameInput });
  await expectVisible(t, { selector: widgetPage.selectors.emailInput });
  await expectVisible(t, { selector: widgetPage.selectors.phoneInput });
  await expectVisible(t, { selector: widgetPage.selectors.moveInDateInput });
  await expectVisible(t, { selector: widgetPage.selectors.expectedTermLengthDropDown });
  await expectVisible(t, { selector: widgetPage.selectors.numberOfPetsDropDown });
  await expectVisible(t, { selector: widgetPage.selectors.buttonSelector });

  await t.typeText(widgetPage.selectors.fullNameInput, quoteMockData.legalName, { replace: true });
  await t.typeText(widgetPage.selectors.emailInput, quoteMockData.email, { replace: true });
  await t.typeText(widgetPage.selectors.phoneInput, quoteMockData.phone, { replace: true });

  await clickOnElement(t, { selector: widgetPage.selectors.moveInDateInput });
  const selectorMoveInDate = widgetPage.selectors.moveInDateInput;
  await t.typeText(selectorMoveInDate, quoteMockData.moveInDate);

  await clickOnElement(t, { selector: widgetPage.selectors.expectedTermLengthDropDown });
  await clickOnElement(t, { selector: '[data-idx="0"]' }); // first dropdown item

  await clickOnElement(t, { selector: widgetPage.selectors.numberOfPetsDropDown });
  await clickOnElement(t, { selector: '[title="1 pet"]' });

  await clickOnElement(t, { selector: '[data-component="button"]', text: 'Start Application' });

  await expectVisible(t, {
    selector: 'p',
    text: "We've sent a link to start your application. Check your email. It only takes a few minutes to complete.",
  });
  await expectVisible(t, {
    selector: 'p',
    text: 'If you have questions or need help, give us a call or text us at',
  });
  await expectVisible(t, { selector: $('a').withAttribute('href', 'tel:+14632222232').withText('(463) 222-2232') });
  await clickOnElement(t, { selector: '[data-component="button"]', text: 'Done' });
};
