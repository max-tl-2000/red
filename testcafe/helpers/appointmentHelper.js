/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/* eslint-disable semi-spacing */
import { t as trans } from 'i18next';
import { Selector as $ } from 'testcafe';
import { mapSeries } from 'bluebird';
import { selectCalendarSlot } from './rentalApplicationHelpers';
import { createAnAppointmentForParty } from '../../cucumber/lib/utils/apiHelper';
import loggerInstance from '../../common/helpers/logger';
import { TEST_TENANT_ID } from '../../common/test-helpers/tenantInfo';
import { expectVisible, clickOnElement, setDropdownValues, expectNotPresent, expectTextIsEqual } from './helpers';
import { now, toMoment, formatMoment } from '../../common/helpers/moment-utils';
import { LA_TIMEZONE, SHORT_DAY_OF_MONTH_FORMAT, SHORT_DATE_FORMAT, TIME_MERIDIEM_FORMAT } from '../../common/date-constants';
import { getCommunicationByPartyIdAndType } from './dbQueries';
import PartyDetailPage from '../pages/partyDetailPage';
import PartyPhaseOne from '../pages/partyPhaseOne';
import LeaseApplicationPage from '../pages/leaseApplicationPage';

const logger = loggerInstance.child({ subType: 'appointmentHelper' });

export const createAppointment = async ({ partyId, tourType, salesPersonId, loadActivePartyMembers = false }) => {
  try {
    return createAnAppointmentForParty({ tenantId: TEST_TENANT_ID, salesPersonId, partyId, tourType, loadActivePartyMembers });
  } catch (err) {
    logger.error({ err, partyId }, '>>> failed to create appointment for party');
    throw err;
  }
};

export const calendarSelectors = {
  agentSelector: '[data-id="agent-selector"]',
  fullCalendarHeader: '[data-id="fullCalendarHeader"]',
  chevronLeft: '#chevron-left',
  chevronRight: '#chevron-right',
  weekDay: '[data-id="fullCalendarHeader"] [data-id="weekDay-dayDate"]',
};

export const openScheduleAppointmentDialog = async t => {
  const partyDetailPage = new PartyDetailPage(t);
  await partyDetailPage.clickOnPartyCardMenuBtn();
  await clickOnElement(t, { selector: partyDetailPage.selectors.scheduleAppointmentItem });
  await expectVisible(t, { selector: partyDetailPage.selectors.scheduleAppointmentDialog });
};

export const searchLeasingAgent = async (t, floatingAgentName) => {
  logger.info(`Searching for leasing agent ${floatingAgentName}`);
  const partyDetailPage = new PartyDetailPage(t);
  logger.info(`Clicking on agent selector ${floatingAgentName}`);
  await clickOnElement(t, { selector: calendarSelectors.agentSelector });
  logger.info(`Typing agent name ${floatingAgentName}`);
  await t.typeText(`${partyDetailPage.selectors.scheduleAppointmentDialog} ${partyDetailPage.selectors.employeeSearchForm} input`, floatingAgentName);
};

export const getDayDate = date => toMoment(date, { timezone: LA_TIMEZONE }).format(SHORT_DAY_OF_MONTH_FORMAT);

export const getDaySelector = date => calendarSelectors.weekDay.replace('dayDate', getDayDate(date));

export const checkCalendarStructure = async t => {
  await expectVisible(t, { selector: calendarSelectors.fullCalendarHeader, boundTestRun: t });
  await expectVisible(t, { selector: `${calendarSelectors.fullCalendarHeader} ${calendarSelectors.chevronLeft}`, boundTestRun: t });
  await expectVisible(t, { selector: `${calendarSelectors.fullCalendarHeader} ${calendarSelectors.chevronRight}`, boundTestRun: t });
  const days = [...Array(7).keys()];
  await mapSeries(days, async elem => {
    await expectVisible(t, {
      selector: getDaySelector(now({ timezone: LA_TIMEZONE }).add(elem, 'days')),
      boundTestRun: t,
    });
  });
};

export const selectAFloatingAgent = async (t, team, agentName, agentType) => {
  logger.info(`selectAFloatingAgent ${team} ${agentName} ${agentType}`);
  const agentClass = '[data-id="employeeSearchFormList"] [data-id="agent_optionItem"] p[title="agentType: team"]'
    .replace('agentType', agentType)
    .replace('agent', agentName.replace(/\s+/g, ''))
    .replace('team', team);
  logger.info(`selectAFloatingAgent class is ${agentClass}`);
  const floatingAgentCard = $(agentClass).nth(-1);
  await expectVisible(t, { selector: floatingAgentCard, boundTestRun: t, ensureInView: true });
  await clickOnElement(t, { selector: floatingAgentCard, boundTestRun: t });
};

export const checkAvailabilityPerTeam = async (t, elem) => {
  await checkCalendarStructure(t);
  const unavailableContainerSelector = $('.fc-time-grid-event [class="fc-content"]').withText(trans('UNAVAILABLE')).with({ boundTestRun: t });
  await mapSeries(elem.unavailableDays, async day => {
    await clickOnElement(t, { selector: getDaySelector(day), boundTestRun: t });
    await expectVisible(t, { selector: unavailableContainerSelector, boundTestRun: t });
    await t.expect(await $(unavailableContainerSelector).find('div').with({ boundTestRun: t }).getAttribute('data-full')).eql('12:00 AM - 12:00 AM');
  });

  await mapSeries(elem.availableDays, async day => {
    await clickOnElement(t, { selector: getDaySelector(day), boundTestRun: t });
    if (elem.unavailableHours) {
      await t.expect(await $(unavailableContainerSelector).find('div').with({ boundTestRun: t }).getAttribute('data-full', elem.unavailableHours[0])).ok();
      await t.expect(await $(unavailableContainerSelector).find('div').with({ boundTestRun: t }).getAttribute('data-full', elem.unavailableHours[1])).ok();
      await expectNotPresent(t, {
        selector: $(unavailableContainerSelector).find('div').with({ boundTestRun: t }).withAttribute('data-full', elem.availableHours),
      });
    } else {
      await expectNotPresent(t, {
        selector: $(unavailableContainerSelector),
        boundTestRun: t,
      });
    }
  });
};

export const checkAgentsAvailabilityForAppointments = async (t, mockData) => {
  await openScheduleAppointmentDialog(t);
  logger.info(`searching for leasing agent ${mockData.floatingAgentName}`);
  await searchLeasingAgent(t, mockData.floatingAgentName);
  await mapSeries(mockData.avabilityDaysPerTeam, async elem => {
    logger.info(`checking availability for ${mockData.floatingAgentName} on team ${elem.team}... selecting agent`);
    await selectAFloatingAgent(t, elem.team, mockData.floatingAgentName, mockData.floatingAgentType);
    logger.info(`checking availability on team ${elem.team}`);
    await checkAvailabilityPerTeam(t, elem);
    await clickOnElement(t, { selector: $(calendarSelectors.agentSelector).with({ boundTestRun: t }) });
  });
};

export const scheduleAppointmentForSpecificAgent = async (t, mockAppointmentData) => {
  await openScheduleAppointmentDialog(t);
  const partyDetailPage = new PartyDetailPage(t);
  await setDropdownValues(t, { id: partyDetailPage.selectors.scheduleAppointmentTourTypeDropdown, values: [trans('IN_PERSON_TOUR')] });
  await searchLeasingAgent(t, mockAppointmentData.floatingAgentName);
  await selectAFloatingAgent(t, mockAppointmentData.team, mockAppointmentData.floatingAgentName, mockAppointmentData.floatingAgentType);
  await clickOnElement(t, { selector: getDaySelector(mockAppointmentData.appointmentDate), boundTestRun: t });
  await selectCalendarSlot(t, mockAppointmentData.slotTime);
};

export const checkAppoimentDialog = async (t, guests, leasingAgent) => {
  const partyDetailPage = new PartyDetailPage(t);
  await expectVisible(t, { selector: partyDetailPage.selectors.scheduleAppointmentDialog });
  await expectVisible(t, {
    selector: `[for="${partyDetailPage.selectors.scheduleAppointmentTourTypeDropdown}"]`,
    values: [trans('SCHEDULE_APPOINTMENT_FORM_TOUR_TYPES')],
  });
  const partyPhaseOne = new PartyPhaseOne(t);
  await clickOnElement(t, { selector: partyPhaseOne.AppointementSelectors.guests, boundTestRun: t });
  await t.expect(await $('[data-id="guests"]').withText(guests)).ok();
  const agentName = leasingAgent.replace(/\s/g, '');
  await expectVisible(t, { selector: `[data-id="agent-selector"] [data-id="${agentName}_contactCard"]`, boundTestRun: t });
  await clickOnElement(t, { selector: partyPhaseOne.AppointementSelectors.notes, boundTestRun: t });
};

export const selectUnitForScheduleAppointment = async (t, { index, unitName }) => {
  const partyPhaseOne = new PartyPhaseOne(t);
  const partyDetailPage = new PartyDetailPage(t);
  const leaseApplicationPage = new LeaseApplicationPage(t);
  await clickOnElement(t, { selector: partyPhaseOne.AppointementSelectors.units, boundTestRun: t });
  await t.typeText(partyDetailPage.selectors.scheduleAppointmentUnitField, unitName, { replace: true });
  const unitSelector = $(`${leaseApplicationPage.getInventoryItemSelector(index)} #inventorySelectorSecondLine`)
    .find('span')
    .withText(`${unitName.toUpperCase()},`)
    .with({ boundTestRun: t });
  await expectVisible(t, { selector: unitSelector });
  await clickOnElement(t, { selector: unitSelector });
  await expectVisible(t, {
    selector: `${partyPhaseOne.AppointementSelectors.units} [data-id^="selectedLabelTxt_"]`,
    text: unitName,
    boundTestRun: t,
  });
};

export const selectDateTimeForScheduleAppointment = async (t, mockAppointmentData) => {
  await clickOnElement(t, { selector: getDaySelector(mockAppointmentData.appointmentDate), boundTestRun: t });
  await selectCalendarSlot(t, mockAppointmentData.slotTime);
};

export const addAppointmentNotes = async (t, notes) => {
  const partyPhaseOne = new PartyPhaseOne(t);
  await clickOnElement(t, { selector: partyPhaseOne.AppointementSelectors.notes, boundTestRun: t });
  await t.typeText(partyPhaseOne.AppointementSelectors.notes, notes);
  await t.expect(await $(partyPhaseOne.AppointementSelectors.notes).value).eql(notes);
};

export const checkAndCloseGuestsNoContactInfoNotification = async (t, guestNoContactInfo) => {
  const partyDetailPage = new PartyDetailPage(t);
  await expectVisible(t, {
    selector: `${partyDetailPage.selectors.dialogOverlay} ${partyDetailPage.selectors.title}`,
    text: trans('APPOINTMENT_NOTIFICATION'),
    requireVisibility: true,
  });
  await expectVisible(t, {
    selector: partyDetailPage.selectors.dialogBody,
    text: trans('GUESTS_WITH_NO_CONTACT_INFO'),
    requireVisibility: true,
  });
  await expectVisible(t, {
    selector: `${partyDetailPage.selectors.dialogBody} li`,
    text: guestNoContactInfo,
    requireVisibility: true,
  });
  await clickOnElement(t, { selector: `${partyDetailPage.selectors.dialogOverlay}  ${partyDetailPage.selectors.okBtn}`, requireVisibility: true });
};

export const checkAppointmentStateAndNote = async (t, state, note) => {
  const partyPhaseOne = new PartyPhaseOne(t);
  await expectVisible(t, { selector: partyPhaseOne.selectors.taskDetailsSection, text: state });
  await expectVisible(t, { selector: partyPhaseOne.selectors.taskDetailsSection, text: note });
  await clickOnElement(t, { selector: partyPhaseOne.selectors.appointmenstSectionButton });
  await expectVisible(t, { selector: `${partyPhaseOne.selectors.appointmentCard}`, text: state });
  await expectVisible(t, { selector: `${partyPhaseOne.selectors.appointmentCard}`, text: note });
  await clickOnElement(t, { selector: partyPhaseOne.selectors.appointmenstSectionButton });
};

export const generateScheduleDateTimeForAppointment = (appointmentDate, timezone, hour) => {
  const appointmentDateTime = appointmentDate.set({ hour, minute: 0, second: 0 });
  return `${appointmentDate.format(SHORT_DATE_FORMAT).toString()}, ${formatMoment(appointmentDateTime, { format: TIME_MERIDIEM_FORMAT, timezone })}`;
};

export const schedulePastTour = async (t, slotTime) => {
  const partyDetailPage = new PartyDetailPage(t);
  await clickOnElement(t, { selector: partyDetailPage.selectors.partyCardMenu });
  await clickOnElement(t, { selector: partyDetailPage.selectors.scheduleAppointmentItem });
  await expectVisible(t, { selector: partyDetailPage.selectors.scheduleAppointmentDialog });
  await setDropdownValues(t, { id: partyDetailPage.selectors.scheduleAppointmentTourTypeDropdown, values: [trans('VIRTUAL_TOUR')] });
  await clickOnElement(t, { selector: partyDetailPage.selectors.scheduleAppointmentUnitField });
  await t.typeText(partyDetailPage.selectors.scheduleAppointmentUnitField, '01-101', { replace: true });
  await clickOnElement(t, { selector: partyDetailPage.selectors.scheduleAppointmentFirstUnitItem });
  await clickOnElement(t, { selector: partyDetailPage.selectors.scheduleAppointmentBackArrow });
  await selectCalendarSlot(t, slotTime);
};

export const markTourAsDone = async (t, notes) => {
  const partyDetailPage = new PartyDetailPage(t);
  await clickOnElement(t, { selector: partyDetailPage.selectors.appointmentRowCardMenu });
  await clickOnElement(t, { selector: partyDetailPage.selectors.appointmentRowCardMenuMarkDone });
  await t.typeText('[placeholder="Notes about the appointment"]', notes);
  await clickOnElement(t, { selector: partyDetailPage.selectors.markAsDoneBtn });
};

export const markTourAsUndone = async t => {
  const partyDetailPage = new PartyDetailPage(t);
  await clickOnElement(t, { selector: partyDetailPage.selectors.appointmentRowCardMenu });
  await clickOnElement(t, { selector: partyDetailPage.selectors.appointmentRowCardMenuMarkAsUndone });
};

export const markTourAsUndoneAfterCancel = async t => {
  const partyDetailPage = new PartyDetailPage(t);
  await clickOnElement(t, { selector: partyDetailPage.selectors.manualTaskMenuBtn });
  await clickOnElement(t, { selector: partyDetailPage.selectors.appointmentRowCardMenuMarkAsUndone });
};

export const markTourAsNoShow = async (t, notes) => {
  const partyDetailPage = new PartyDetailPage(t);
  await clickOnElement(t, { selector: partyDetailPage.selectors.appointmentRowCardMenu });
  await clickOnElement(t, { selector: partyDetailPage.selectors.appointmentRowCardMenuMarkAsNoShow });
  await t.typeText('[data-component="textbox"]', notes);
  await clickOnElement(t, { selector: partyDetailPage.selectors.markAsDoneBtn });
};

export const markTourAsCancelled = async (t, notes) => {
  const partyDetailPage = new PartyDetailPage(t);
  await clickOnElement(t, { selector: partyDetailPage.selectors.appointmentRowCardMenu });
  await clickOnElement(t, { selector: partyDetailPage.selectors.appointmentRowCardMenuMarkAsCancelled });
  await t.typeText('[data-component="textbox"]', notes);
  await clickOnElement(t, { selector: '[data-component="checkbox"]' });
  await clickOnElement(t, { selector: partyDetailPage.selectors.markAsDoneBtn });
};

export const checkPropertySelectorDropdown = async t => {
  const partyDetailPage = new PartyDetailPage(t);
  await expectVisible(t, {
    selector: `${partyDetailPage.selectors.dialogOverlay} ${partyDetailPage.selectors.title}`,
    text: trans('APPOINTMENT_PROPERTY_SELECTOR_TITLE'),
    requireVisibility: true,
  });
};

export const areSelectorPropertyDropdownItemsDisplayed = async (t, properties) => {
  await mapSeries(
    properties,
    async propertyName => await expectVisible(t, { selector: '[data-component="list-item"]', text: propertyName, boundTestRun: true }),
  );
};

export const checkPropertySelectorDialog = async (t, correctDefaultPropertyAddress, correctPropertyAddress, properties, propertyForAppointment) => {
  const partyDetailPage = new PartyDetailPage(t);
  await expectVisible(t, {
    selector: `${partyDetailPage.selectors.dialogOverlay} ${partyDetailPage.selectors.title}`,
    text: trans('APPOINTMENT_PROPERTY_SELECTOR_TITLE'),
    requireVisibility: true,
  });
  await expectVisible(t, {
    selector: partyDetailPage.selectors.dialogBody,
    text: trans('APPOINTMENT_PROPERTY_SELECTOR_CONTENT'),
    requireVisibility: true,
  });
  await expectTextIsEqual(t, { selector: partyDetailPage.selectors.assignedPropertyForAppointmentDropdownButton, text: correctDefaultPropertyAddress });
  await clickOnElement(t, { selector: partyDetailPage.selectors.assignedPropertyForAppointmentDropdownButton });
  await areSelectorPropertyDropdownItemsDisplayed(t, properties);
  await clickOnElement(t, { selector: '[data-id="overlay-assignedProperty"]', text: propertyForAppointment });
  await expectTextIsEqual(t, { selector: partyDetailPage.selectors.assignedPropertyForAppointmentDropdownButton, text: correctPropertyAddress });
  await clickOnElement(t, { selector: partyDetailPage.selectors.submitAssignedPropertyButton });
};

export const editAppointmentDateAndTime = async t => {
  const partyDetailPage = new PartyDetailPage(t);
  await clickOnElement(t, { selector: partyDetailPage.selectors.appointmentRowCardMenu });
  await clickOnElement(t, { selector: partyDetailPage.selectors.appointmentRowCardMenuEdit });
};

export const editAppointmentOwner = async (t, userName) => {
  const partyDetailPage = new PartyDetailPage(t);
  await clickOnElement(t, { selector: partyDetailPage.selectors.appointmentRowCardMenu });
  await clickOnElement(t, { selector: partyDetailPage.selectors.appointmentRowCardMenuAssign });
  await partyDetailPage.selectAgentInEmployeeSelector(userName);
};

export const checkCommunicationType = async (t, ctx, partyId, communicationType) => {
  const communicationTypes = await getCommunicationByPartyIdAndType(ctx, partyId, communicationType);
  const commType = communicationTypes[0].type;
  await t.expect(commType).eql(communicationType);
};
