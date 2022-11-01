/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t as trans } from 'i18next';
import { loginAs, getTenantURL, getUserPassword, expectVisible, clickOnElement, expectNotVisible } from '../../helpers/helpers';
import {
  createAParty,
  addAGuarantor,
  checkAppointmentScheduledCorrect,
  generateScheduleTimeForAppointment,
  cancelTask,
} from '../../helpers/rentalApplicationHelpers';
import { setHooks } from '../../helpers/hooks';
import { validateDashboardVisible } from '../../helpers/dashboardHelpers';
import { addAResident } from '../../helpers/managePartyHelpers';
import {
  checkAppoimentDialog,
  selectUnitForScheduleAppointment,
  selectDateTimeForScheduleAppointment,
  addAppointmentNotes,
  checkAndCloseGuestsNoContactInfoNotification,
  generateScheduleDateTimeForAppointment,
  editAppointmentDateAndTime,
  markTourAsDone,
  markTourAsUndone,
  markTourAsNoShow,
  markTourAsCancelled,
  markTourAsUndoneAfterCancel,
  checkAppointmentStateAndNote,
} from '../../helpers/appointmentHelper';
import { validateSnackbarMessage, validateNoSnackbar } from '../../helpers/leasingApplicationHelpers';
import PartyDetailPage from '../../pages/partyDetailPage';
import PartyPhaseOne from '../../pages/partyPhaseOne';
import { DALTypes } from '../../../common/enums/DALTypes';
import { mockPartyData, getPartyOwnerNameByEmail } from '../../helpers/mockDataHelpers';
import { now, formatMoment } from '../../../common/helpers/moment-utils';
import { LA_TIMEZONE, MONTH_DATE_YEAR_LONG_FORMAT, TIME_MERIDIEM_FORMAT } from '../../../common/date-constants';

setHooks(fixture('Seed - Scheduling Appointments from a Party with multiple party members'), {
  fixtureName: 'schedulingAppointmentMultipleMembers',
  testlinkFlows: ['TEST-21', 'TEST-23', 'TEST-24', 'TEST-32', 'TEST-33', 'TEST-394', 'TEST-26', 'TEST-47'],
});

test.skip('TEST-21:Create an appointment from a Party with multiple party members', async t => {
  // User logs in LAA agent
  const userInfo = { user: 'admin@reva.tech', password: getUserPassword(), fullName: 'Reva Admin', team: 'Parkmerced Leasing' };
  await t.navigateTo(getTenantURL('/'));
  await loginAs(t, userInfo);
  await validateDashboardVisible(t);
  // defines party and contact info
  const { partyInfo, qualificationInfo } = mockPartyData;
  const contactInfo = {
    residentA: {
      legalName: 'Billy Hagler',
      email: 'qatest+billi@reva.tech',
    },
    guarantor: {
      legalName: 'Devon Murphy',
      email: 'qatest+devon@reva.tech',
      phone: '+1 908 555 4622',
      formattedPhone: '(908) 555-4622',
    },
    residentB: {
      legalName: 'Lillie Black',
      phone: '+1 908 555 4623',
      formattedPhone: '(908) 555-4623',
    },
    residentC: {
      legalName: 'Myrtle Johnson',
    },
  };
  const propertyName = partyInfo.properties[0].displayName; // Parkmerced Apartments
  await createAParty(t, { partyInfo, propertyName, contactInfo: contactInfo.residentA, userInfo, qualificationInfo });
  const partyDetailPage = new PartyDetailPage(t);
  await expectVisible(t, { selector: partyDetailPage.selectors.headerPartyDetail });
  await partyDetailPage.clickOnPartyDetailTitle();
  await addAGuarantor(t, contactInfo.guarantor);
  await addAResident(t, contactInfo.residentB);
  await addAResident(t, contactInfo.residentC);
  await partyDetailPage.closeManagePartyDetailsPage();
  await partyDetailPage.clickOnPartyCardMenuBtn();
  await partyDetailPage.checkPartyCardMenuItems();
  await partyDetailPage.clickOnScheduleAppointmentMenuItem();
  const guests = [contactInfo.residentA.legalName, contactInfo.residentB.legalName, contactInfo.residentC.legalName, contactInfo.guarantor.legalName]
    .sort()
    .join(', ');
  const agentName = getPartyOwnerNameByEmail(userInfo.user);
  await checkAppoimentDialog(t, guests, agentName);
  const unit = 'swparkme-350AR-1020';
  await selectUnitForScheduleAppointment(t, { index: 0, unitName: unit });
  const mockAppointmentDataBeforeEdit = {
    appointmentDate: now({ timezone: LA_TIMEZONE }).add(1, 'days'),
    slotTime: '14:00:00',
    hour: 14,
  };
  const mockAppointmentDataAfterEdit = {
    appointmentDate: now({ timezone: LA_TIMEZONE }).add(2, 'days'),
    slotTime: '13:00:00',
    hour: 13,
  };
  const mockAppointmentDataPastDate = {
    appointmentDate: now({ timezone: LA_TIMEZONE }).add(-1, 'days'),
    slotTime: '13:00:00',
    hour: 13,
  };
  const formatedDateTime = {
    parkmercedAppointmentLongDate: now({ timezone: LA_TIMEZONE }).add(1, 'days').format(MONTH_DATE_YEAR_LONG_FORMAT),
    parkmercedTourTimeFormated: formatMoment(
      mockAppointmentDataBeforeEdit.appointmentDate.set({ hour: mockAppointmentDataBeforeEdit.hour, minute: 0, second: 0 }),
      {
        format: TIME_MERIDIEM_FORMAT,
      },
    ),
  };
  const appointmentDateTime = generateScheduleTimeForAppointment(
    mockAppointmentDataBeforeEdit.appointmentDate,
    LA_TIMEZONE,
    mockAppointmentDataBeforeEdit.hour,
  );
  const time = generateScheduleDateTimeForAppointment(mockAppointmentDataBeforeEdit.appointmentDate, LA_TIMEZONE, mockAppointmentDataBeforeEdit.hour);
  await addAppointmentNotes(t, 'Please be there 2 minutes in advance');
  const appointmentType = Object.keys(DALTypes.TourTypes).find(key => DALTypes.TourTypes[key] === DALTypes.TourTypes.IN_PERSON_TOUR);
  await partyDetailPage.selectAppointmentType(appointmentType);
  await selectDateTimeForScheduleAppointment(t, mockAppointmentDataBeforeEdit);
  await validateSnackbarMessage(t, (trans('SCHEDULE_APPOINTMENT_FORM_SCHEDULED_FOR_SELF'), time));
  await validateSnackbarMessage(t, (trans('APPOINTMENT_CONFIRMATION_SMS_SUCCESS'), contactInfo.residentB.legalName));
  await validateSnackbarMessage(t, (trans('APPOINTMENT_CONFIRMATION_SMS_SUCCESS'), contactInfo.guarantor.legalName));
  await validateSnackbarMessage(t, trans('APPOINTMENT_CONFIRMATION_EMAIL_SUCCESS'));
  await validateSnackbarMessage(t, trans('APPOINTMENT_CONFIRMATION_EMAIL_SUCCESS'));
  await checkAndCloseGuestsNoContactInfoNotification(t, contactInfo.residentC.legalName);
  const appointmentFormatedGuests = `${contactInfo.residentA.legalName}, ${contactInfo.residentB.legalName}, ${contactInfo.residentC.legalName}, ${contactInfo.guarantor.legalName}`;
  await checkAppointmentScheduledCorrect(t, appointmentDateTime, appointmentFormatedGuests, mockAppointmentDataBeforeEdit.slotTime, 1);
  const partyPhaseOne = new PartyPhaseOne(t);
  const appointmentMessageInfo = {
    subject: `Appointment confirmed - ${propertyName}`,
    smsContent: `Your appointment has been confirmed for ${formatedDateTime.parkmercedAppointmentLongDate} at ${formatedDateTime.parkmercedTourTimeFormated}. You will meet with
       ${agentName} at our Leasing Office located at 4 Jersey St Boston, MA  02215. If you would like to modify or cancel this appointment, simply reply to this text message
       with your change.`,
  };
  await partyPhaseOne.checkEmailStructure(appointmentMessageInfo.subject, contactInfo.residentA.legalName, 0);
  await partyPhaseOne.checkEmailStructure(appointmentMessageInfo.subject, contactInfo.guarantor.legalName, 1);
  await partyPhaseOne.checkSmsStructure(appointmentMessageInfo.smsContent, contactInfo.guarantor.legalName, 2);
  await partyPhaseOne.checkSmsStructure(appointmentMessageInfo.smsContent, contactInfo.residentB.legalName, 3);

  // TEST - 23 Edit appointment owner
  await cancelTask(t);
  // TO DO: when CPM-20498 ixs fixed
  // const newAppointmentOwner = 'Bill Smith';
  // await editAppointmentOwner(t, newAppointmentOwner);
  // await checkTaskOwner(newAppointmentOwner);

  // TEST - 24 Edit date and time for current appointment
  await editAppointmentDateAndTime(t);
  const formatedDateTimeTwo = {
    parkmercedAppointmentLongDate: now({ timezone: LA_TIMEZONE }).add(1, 'days').format(MONTH_DATE_YEAR_LONG_FORMAT),
    parkmercedTourTimeFormated: formatMoment(
      mockAppointmentDataAfterEdit.appointmentDate.set({ hour: mockAppointmentDataAfterEdit.hour, minute: 0, second: 0 }),
      {
        format: TIME_MERIDIEM_FORMAT,
      },
    ),
  };
  const appointmentDateTimeTwo = generateScheduleTimeForAppointment(
    mockAppointmentDataAfterEdit.appointmentDate,
    LA_TIMEZONE,
    mockAppointmentDataAfterEdit.hour,
  );
  const timeTwo = generateScheduleDateTimeForAppointment(mockAppointmentDataAfterEdit.appointmentDate, LA_TIMEZONE, mockAppointmentDataAfterEdit.hour);
  await selectDateTimeForScheduleAppointment(t, mockAppointmentDataAfterEdit);
  await checkAndCloseGuestsNoContactInfoNotification(t, contactInfo.residentC.legalName);
  await validateSnackbarMessage(t, (trans('SCHEDULE_APPOINTMENT_FORM_SCHEDULED_FOR_SELF'), timeTwo));
  await validateSnackbarMessage(t, (trans('APPOINTMENT_UPDATE_SMS_SUCCESS'), contactInfo.residentB.legalName));
  await validateSnackbarMessage(t, (trans('APPOINTMENT_UPDATE_SMS_SUCCESS'), contactInfo.guarantor.legalName));
  await validateSnackbarMessage(t, trans('APPOINTMENT_UPDATE_EMAIL_SUCCESS'));
  await validateSnackbarMessage(t, trans('APPOINTMENT_UPDATE_EMAIL_SUCCESS'));
  await checkAppointmentScheduledCorrect(t, appointmentDateTimeTwo, appointmentFormatedGuests, mockAppointmentDataAfterEdit.slotTime, 0);
  const appointmentMessageInfoTwo = {
    subject: `Appointment updated - ${propertyName}`,
    smsContent: `Your appointment has been moved to ${formatedDateTimeTwo.parkmercedAppointmentLongDate} at ${formatedDateTimeTwo.parkmercedTourTimeFormated}. You will meet with
       ${agentName} at our Leasing Office located at 4 Jersey St Boston, MA  02215. If you would like to modify or cancel this appointment, simply reply to this text message
       with your change.`,
  };
  await partyPhaseOne.checkEmailStructure(appointmentMessageInfoTwo.subject, contactInfo.residentA.legalName, 1);
  await partyPhaseOne.checkEmailStructure(appointmentMessageInfoTwo.subject, contactInfo.guarantor.legalName, 2);
  await partyPhaseOne.checkSmsStructure(appointmentMessageInfoTwo.smsContent, contactInfo.guarantor.legalName, 3);
  await partyPhaseOne.checkSmsStructure(appointmentMessageInfoTwo.smsContent, contactInfo.residentB.legalName, 0);

  // TEST - 32,33,47 Mark as done, as undone and no-show the appointment
  await editAppointmentDateAndTime(t);
  const appointmentDateTimeThree = generateScheduleTimeForAppointment(
    mockAppointmentDataPastDate.appointmentDate,
    LA_TIMEZONE,
    mockAppointmentDataPastDate.hour,
  );
  await clickOnElement(t, { selector: `${'[data-id="chevron-left"]'}` });
  await selectDateTimeForScheduleAppointment(t, mockAppointmentDataPastDate);
  await checkAndCloseGuestsNoContactInfoNotification(t, contactInfo.residentC.legalName);
  await validateSnackbarMessage(t, (trans('SCHEDULE_APPOINTMENT_FORM_SCHEDULED_FOR_SELF'), time));
  await validateNoSnackbar(t, (trans('APPOINTMENT_UPDATE_SMS_SUCCESS'), contactInfo.residentB.legalName));
  await validateNoSnackbar(t, (trans('APPOINTMENT_UPDATE_SMS_SUCCESS'), contactInfo.guarantor.legalName));
  await validateNoSnackbar(t, trans('APPOINTMENT_UPDATE_EMAIL_SUCCESS'));
  await checkAppointmentScheduledCorrect(t, appointmentDateTimeThree, appointmentFormatedGuests, mockAppointmentDataPastDate.slotTime, 0);
  const markAsDoneMessage = 'Message one';
  await markTourAsDone(t, markAsDoneMessage);
  await validateNoSnackbar(t, (trans('SCHEDULE_APPOINTMENT_FORM_SCHEDULED_FOR_SELF'), time));
  await partyPhaseOne.clickOnShowCompletedTaskButton();
  const completeState = trans('COMPLETE');
  await checkAppointmentStateAndNote(t, completeState, markAsDoneMessage);
  await markTourAsUndone(t);
  await validateNoSnackbar(t, (trans('SCHEDULE_APPOINTMENT_FORM_SCHEDULED_FOR_SELF'), time));
  await checkAppointmentScheduledCorrect(t, appointmentDateTimeThree, appointmentFormatedGuests, mockAppointmentDataPastDate.slotTime, 0);
  const noShowMessage = 'Message two';
  await markTourAsNoShow(t, noShowMessage);
  const noShowState = trans('NO_SHOW');
  await checkAppointmentStateAndNote(t, noShowState, noShowMessage);
  await markTourAsUndone(t);
  const cancellationNote = 'Message three';
  await markTourAsCancelled(t, cancellationNote);
  await expectNotVisible(t, { selector: partyPhaseOne.selectors.taskDetailsSection, text: trans('CANCELLED') });

  // TEST - 26,394 Cancel appointment
  await markTourAsUndoneAfterCancel(t);
  await editAppointmentDateAndTime(t);
  await clickOnElement(t, { selector: `${'[data-id="chevron-right"]'}` });
  await selectDateTimeForScheduleAppointment(t, mockAppointmentDataAfterEdit);
  await checkAndCloseGuestsNoContactInfoNotification(t, contactInfo.residentC.legalName);
  const cancellationNoteTwo = 'Message four';
  await markTourAsCancelled(t, cancellationNoteTwo);
  await validateSnackbarMessage(t, (trans('APPOINTMENT_CANCELLED_SMS_SUCCESS'), contactInfo.residentB.legalName));
  await validateSnackbarMessage(t, (trans('APPOINTMENT_CANCELLED_SMS_SUCCESS'), contactInfo.guarantor.legalName));
  await validateSnackbarMessage(t, trans('APPOINTMENT_CANCELLED_EMAIL_SUCCESS'));
  await validateSnackbarMessage(t, trans('APPOINTMENT_CANCELLED_EMAIL_SUCCESS'));
  const appointmentMessageInfoThree = {
    subject: `Appointment cancelled - ${propertyName}`,
    smsContent: `Your appointment on ${formatedDateTime.parkmercedAppointmentLongDate} at ${formatedDateTime.parkmercedTourTimeFormated} has been cancelled. If you would like to schedule a new appointment, reply to this text message.`,
  };
  await partyPhaseOne.checkEmailStructure(appointmentMessageInfoThree.subject, contactInfo.residentA.legalName, 0);
  await partyPhaseOne.checkEmailStructure(appointmentMessageInfoThree.subject, contactInfo.guarantor.legalName, 1);
  await partyPhaseOne.checkSmsStructure(appointmentMessageInfoThree.smsContent, contactInfo.guarantor.legalName, 2);
  await partyPhaseOne.checkSmsStructure(appointmentMessageInfoThree.smsContent, contactInfo.residentB.legalName, 3);
  const cancelledState = trans('CANCELLED');
  await checkAppointmentStateAndNote(t, cancelledState, cancellationNoteTwo);
});
