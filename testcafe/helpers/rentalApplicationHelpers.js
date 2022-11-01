/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import path from 'path';
import { Selector as $ } from 'testcafe';
import { t as trans } from 'i18next';
import { mergeConditions } from './redConstants';
import { now, formatMoment } from '../../common/helpers/moment-utils';
import { TIME_PERIOD_FORMAT_WITHOUT_SPACE } from '../../common/date-constants';

import {
  expectVisible,
  expectNotVisible,
  expectTextIsEqual,
  expectTextIsNotEqual,
  addUniqueIdToEmail,
  setDropdownValues,
  expectInputIsEqual,
  expectNotPresent,
  expectBtnDisabled,
  expectBtnEnabled,
  getPathName,
  getTenantURL,
  reloadURL,
  clickOnElement,
  clearTextElement,
  sanitizedTextIsEqual,
  isElementVisible,
  getText,
  elementNotExist,
  withRetries,
  executeSequentially,
  expectTextContains,
  expectCheckboxState,
} from './helpers';
import { checkForNoMatchInParties, checkForDuplicatesInParties } from './managePartyHelpers';
import { mockAmenitiesData, LeaseTypes } from './mockDataHelpers';
import { checkActivityLogEntryByIndex } from './activityLogHelpers';

import { setChildInfo, setPetInfo, setVehicleInfo, selectPartyQualificationQuestions } from './partyAdditionalInfo';

import PersonCardPage from '../pages/personCardPage';
import PartyDetailPage from '../pages/partyDetailPage';
import ManagePartyPage from '../pages/managePartyPage';
import ApplicationPage from '../pages/applicationPage';
import ActivityLogPage from '../pages/activityLogPage';
import WelcomeApplicationPage from '../pages/welcomeApplicationPage';
import QuoteDraftPage from '../pages/quoteDraftPage';
import DashboardPage from '../pages/dashboardPage';
import sleep from '../../common/helpers/sleep';
import LeaseApplicationPage from '../pages/leaseApplicationPage';
import PublishedQuotePage from '../pages/publishedQuotePage';
import LeaseFormPage from '../pages/leaseFormPage';
import BasePage from '../pages/basePage';
import loggerInstance from '../../common/helpers/logger';
import { APP_LINK } from './regex';

const logger = loggerInstance.child({ subType: 'rentalApplicationHelpers' });
import { DALTypes } from '../../common/enums/DALTypes';
import { verifyTasks } from './leasingApplicationHelpers';
import PartyPhaseOne from '../pages/partyPhaseOne';

export const getApplicantDocumentPath = fileName => path.resolve(__dirname, '../resources/applicant', fileName);

const getContactInfo = contactInfo => ({
  contactName: !contactInfo.companyName ? contactInfo.legalName : contactInfo.companyName,
  contactPreferredName: !contactInfo.companyName ? contactInfo.preferredName : contactInfo.contactName,
  writeNameFn: !contactInfo.companyName ? 'writeLegalName' : 'writeCompanyName',
  writePreferredNameFn: !contactInfo.companyName ? 'writePreferredName' : 'writePointOfContactName',
  clickOnContactNameBtnFn: !contactInfo.companyName ? 'clickOnAddPreferredNameBtn' : 'clickOnAddPointOfContactNameBtn',
});

export const checkEmailSentInCommsPanel = async (t, contactInfo, subjectMsg, index) => {
  const partyDetailPage = new PartyDetailPage(t);
  const selector = partyDetailPage.selectors.emailThreadContactName.replace('Index', index);
  await expectVisible(t, { selector });
  await expectTextIsEqual(t, { selector, text: contactInfo.legalName });
  await partyDetailPage.checkEmailSubjectTextInCommsPanel(index, subjectMsg);
};

const mergePartiesFromDialog = async (t, userInfo, mergeParties = false, mergeDialogBody = trans('NO_DUPLICATE_PARTY_FOUND_INFO6')) => {
  const partyDetailPage = new PartyDetailPage(t);
  await expectVisible(t, { selector: partyDetailPage.selectors.mergePartiesDialog });
  if (mergeParties) {
    await clickOnElement(t, { selector: $(partyDetailPage.selectors.employeeSelectorBtn) });
    await partyDetailPage.selectAgentInMergePartiesDialog(userInfo.fullName);
    await clickOnElement(t, { selector: $(partyDetailPage.selectors.mergePartiesBtn) });
    return;
  }
  await clickOnElement(t, { selector: partyDetailPage.selectors.doNotMergePartiesBtn });
  await checkForNoMatchInParties(t, mergeDialogBody);
};

export const mergePersons = async (t, condition, userInfo, mergeDialogBody = trans('NO_DUPLICATE_PARTY_FOUND_INFO1')) => {
  await withRetries(
    t,
    async () => {
      const personCardDialog = new PersonCardPage(t);
      const partyDetailPage = new PartyDetailPage(t);
      await clickOnElement(t, { selector: personCardDialog.selectors.samePersonYesBtn });
      await expectVisible(t, { selector: partyDetailPage.selectors.mergePersonsDialog });
      await clickOnElement(t, { selector: partyDetailPage.selectors.mergePersonsBtn, requireVisibility: true });
    },
    { fnName: 'mergePersons', delayBetweenRetries: 500, maxAttempts: 20 },
  );

  const { mergePersonsAndParties, mergeOnlyPersonsDiffProp, mergeOnlyPersonsSameProp } = mergeConditions;
  switch (condition) {
    case mergePersonsAndParties:
      await mergePartiesFromDialog(t, userInfo, true, mergeDialogBody);
      break;
    case mergeOnlyPersonsDiffProp:
      await checkForNoMatchInParties(t, mergeDialogBody);
      break;
    case mergeOnlyPersonsSameProp:
      await mergePartiesFromDialog(t, userInfo, false, mergeDialogBody);
      break;
    default:
      break;
  }
};

export const createPerson = async (t, personInfo, { userInfo = {}, mergePersonCondition = '', mergeDialogBody } = {}) => {
  const personCardDialog = new PersonCardPage(t);
  await personCardDialog.writeLegalName(personInfo.legalName);
  await expectVisible(t, { selector: personCardDialog.selectors.createPersonBtn });
  if (personInfo.preferredName) {
    await withRetries(
      t,
      async () => {
        await personCardDialog.clickOnAddPreferredNameBtn();
        await personCardDialog.writePreferredName(personInfo.preferredName);
      },
      { fnName: 'createPerson', delayBetweenRetries: 500, maxAttempts: 20 },
    );
  }
  if (personInfo.phone) {
    await personCardDialog.clickAndSetPhoneNumber(personInfo.phone);
    await personCardDialog.clickVerifyPhoneButton();
    await expectVisible(t, { selector: personCardDialog.selectors.phoneNumberOne });
  }
  if (personInfo.email) {
    await personCardDialog.clickAddEmailButton();
    await personCardDialog.writeEmail(addUniqueIdToEmail(t, personInfo.email));
    await personCardDialog.clickVerifyEmailButton();
  }
  await expectVisible(t, { selector: personCardDialog.selectors.createPersonBtn });
  await t.wait(600);

  if (mergePersonCondition) {
    await mergePersons(t, mergePersonCondition, userInfo, mergeDialogBody);
  } else {
    await personCardDialog.clickCreatePersonButton(t);
  }
};

export const mergePartiesFromMenu = async (t, partiesHaveCoincidences = false, mergeDialogBody = trans('NO_DUPLICATE_PARTY_FOUND_INFO1')) => {
  const partyDetailPage = new PartyDetailPage(t);
  await clickOnElement(t, { selector: partyDetailPage.selectors.partyCardMenu });
  await clickOnElement(t, { selector: partyDetailPage.selectors.mergePartiesItem });
  if (!partiesHaveCoincidences) {
    await checkForNoMatchInParties(t, mergeDialogBody);
    return;
  }
  await checkForDuplicatesInParties(t, mergeDialogBody);
};

export const checkPartyMergeDialogDifferentProperties = async (t, propertyOne, propertyTwo) => {
  const partyDetailPage = new PartyDetailPage(t);
  await expectVisible(t, { selector: partyDetailPage.selectors.mergePartiesDialog });
  await expectVisible(t, { selector: partyDetailPage.selectors.propertySelectorBtn });
  await clickOnElement(t, { selector: partyDetailPage.selectors.propertySelectorBtn });
  await expectVisible(t, { selector: partyDetailPage.selectors.propertySelectorDropdown });
  await expectVisible(t, { selector: $(partyDetailPage.selectors.propertySelectorDropdown).withText(propertyOne) });
  await expectVisible(t, { selector: $(partyDetailPage.selectors.propertySelectorDropdown).withText(propertyTwo) });
};

export const verifyOverlappingAppointmentWarningIsDisplayed = async t => {
  const partyDetailPage = new PartyDetailPage(t);
  const selector = partyDetailPage.selectors.warningScheduledAppointment;
  await expectTextIsEqual(t, { selector, text: trans('SCHEDULE_APPOINTMENT_FORM_WARNING_YOU_HAVE_OVERLAPING_EVENTS') });
};

export const selectCalendarSlot = async (t, slotTime) => {
  const partyDetailPage = new PartyDetailPage(t);
  const selectorTpl = partyDetailPage.getCalendarSlotTimeSelector(slotTime);
  await clickOnElement(t, { selector: selectorTpl });
  await clickOnElement(t, { selector: `${partyDetailPage.selectors.scheduleAppointmentDialog} #done` });

  const element = $(partyDetailPage.selectors.warningScheduledAppointment);
  if ((await element.exists) && (await element.visible)) {
    await verifyOverlappingAppointmentWarningIsDisplayed(t);
    await clickOnElement(t, { selector: `${partyDetailPage.selectors.scheduleAppointmentDialog} #done` });
  }
};

export const scheduleAppointmentFromMenu = async (t, slotTime) => {
  const partyDetailPage = new PartyDetailPage(t);
  await clickOnElement(t, { selector: partyDetailPage.selectors.partyCardMenu });
  await clickOnElement(t, { selector: partyDetailPage.selectors.scheduleAppointmentItem });
  await expectVisible(t, { selector: partyDetailPage.selectors.scheduleAppointmentDialog });
  await setDropdownValues(t, { id: partyDetailPage.selectors.scheduleAppointmentTourTypeDropdown, values: [trans('VIRTUAL_TOUR')] });
  await selectCalendarSlot(t, slotTime);
};

export const generateScheduleTimeForAppointment = (slotTime, timezone, hour) => {
  const currentDate = now({ timezone });
  const appointmentDateTime = currentDate.set({ hour, minute: 0, second: 0 });
  return formatMoment(appointmentDateTime, { format: TIME_PERIOD_FORMAT_WITHOUT_SPACE, timezone });
};

export const checkAppointmentScheduledCorrect = async (t, scheduledTime, contactInfo, slotTime, index) => {
  const partyDetailPage = new PartyDetailPage(t);
  await expectVisible(t, { selector: partyDetailPage.selectors.todoSection });
  await expectVisible(t, { selector: partyDetailPage.selectors.appointmentRow });
  const mockTasks = [
    {
      text: trans('APPOINTMENT_WITH', { guestsNames: ` ${contactInfo}` }),
      name: DALTypes.TaskNames.APPOINTMENT,
    },
  ];
  await verifyTasks(t, mockTasks, index);
};

export const checkTaskOwner = async (t, taskOwnerName) => {
  const partyPhaseOne = new PartyPhaseOne(t);
  await expectVisible(t, { selector: `${partyPhaseOne.selectors.TaskOwner}`, text: taskOwnerName });
};

export const createInitialPartyValidation = async (t, contactInfo, isCorporatePartyWithCompanyDetails = true) => {
  const personCardDialog = new PersonCardPage(t);
  const { contactName, contactPreferredName, writeNameFn, writePreferredNameFn, clickOnContactNameBtnFn } = getContactInfo(contactInfo);

  if (isCorporatePartyWithCompanyDetails) {
    await personCardDialog[writeNameFn](contactName);
    await personCardDialog[clickOnContactNameBtnFn]();
  }
  await personCardDialog[writePreferredNameFn](contactPreferredName);
  if (contactInfo.phone) {
    await personCardDialog.clickAndSetPhoneNumber(contactInfo.phone);
    await expectVisible(t, { selector: personCardDialog.selectors.verifyPhoneNumberBtn });
    await personCardDialog.clickVerifyPhoneButton();
    await expectTextIsEqual(t, { selector: personCardDialog.selectors.phoneNumberOne, text: contactInfo.formattedPhone });
  }
  if (contactInfo.email) {
    await personCardDialog.clickAddEmailButton();
    await personCardDialog.writeEmail(addUniqueIdToEmail(t, contactInfo.email));
    await expectVisible(t, { selector: personCardDialog.selectors.verifyEmailAddressBtn });
    await personCardDialog.clickVerifyEmailButton();
    await expectTextIsEqual(t, { selector: personCardDialog.selectors.emailOne, text: addUniqueIdToEmail(t, contactInfo.email) });
  }
};

export const addAGuarantor = async (t, guarantorInfo, { userInfo = {}, mergePersonCondition = '' } = {}) => {
  const managePartyPage = new ManagePartyPage(t);
  await managePartyPage.clickOnAddGuarantorBtn();
  await createPerson(t, guarantorInfo, { userInfo, mergePersonCondition });
};

export const linkGuarantorToResident = async (t, residentInfo, guarantorInfo) => {
  const managePartyPage = new ManagePartyPage(t);
  const residentCardSelector = managePartyPage.getCommonPersonCardByComponent(residentInfo, managePartyPage.selectors.personCardComponent);
  await expectVisible(t, { selector: residentCardSelector });
  await clickOnElement(t, { selector: residentCardSelector });
  await clickOnElement(t, {
    selector: $(managePartyPage.selectors.commonPersonCardMenuListItem).withText(trans('LINK_MEMBER_TYPE', { memberType: 'guarantor' })),
  });
  await setDropdownValues(t, { id: managePartyPage.selectors.selectGuarantorDropdown, values: [guarantorInfo.legalName] });
  await managePartyPage.clickBtnInDialogByCommand(managePartyPage.selectors.linkGuarantorResidentDialog, managePartyPage.selectors.okBtnDialogCommand);
};

export const removeGuarantorLinkFromResident = async t => {
  const managePartyPage = new ManagePartyPage(t);
  await expectVisible(t, { selector: managePartyPage.selectors.commonPersonCard });
  await clickOnElement(t, { selector: managePartyPage.selectors.commonPersonCard });
  await clickOnElement(t, {
    selector: $(managePartyPage.selectors.commonPersonCardMenuListItem).withText(trans('EDIT_MEMBER_TYPE_LINK', { memberType: 'guarantor' })),
  });
  await expectVisible(t, { selector: managePartyPage.selectors.linkGuarantorResidentDialog });
  await managePartyPage.clickBtnInDialogByCommand(managePartyPage.selectors.linkGuarantorResidentDialog, managePartyPage.selectors.extraBtnDialogCommand);
};

export const linkResidentToGuarantor = async (t, guarantorInfo, residentInfo) => {
  const managePartyPage = new ManagePartyPage(t);
  const guarantorCardSelector = managePartyPage.getCommonPersonCardByComponent(guarantorInfo, managePartyPage.selectors.personCardComponent);
  await expectVisible(t, { selector: guarantorCardSelector });
  await clickOnElement(t, { selector: guarantorCardSelector });
  await clickOnElement(t, {
    selector: $(managePartyPage.selectors.commonPersonCardMenuListItem).withText(trans('LINK_MEMBER_TYPE', { memberType: 'resident' })),
  });
  await setDropdownValues(t, { id: managePartyPage.selectors.selectResidentDropdown, values: [residentInfo.legalName] });
  await managePartyPage.clickDropdownDoneBtn(managePartyPage.selectors.selectResidentDropdown);
  await managePartyPage.clickBtnInDialogByCommand(managePartyPage.selectors.linkGuarantorResidentDialog, managePartyPage.selectors.okBtnDialogCommand);
};

export const validateMissingResidentLink = async (t, guarantorInfo) => {
  const managePartyPage = new ManagePartyPage(t);
  const guarantorCardSelector = managePartyPage.getCommonPersonCardByComponent(guarantorInfo, managePartyPage.selectors.personCardComponent);
  await expectVisible(t, { selector: guarantorCardSelector });
  await expectVisible(t, { selector: `${guarantorCardSelector} ${managePartyPage.selectors.residentMissingWarning}` });
};

export const editResidentLinkFromGuarantor = async (t, guarantorInfo, residentInfo) => {
  const managePartyPage = new ManagePartyPage(t);
  const guarantorCardSelector = managePartyPage.getCommonPersonCardByComponent(guarantorInfo, managePartyPage.selectors.personCardComponent);
  const residentListItemSelector = managePartyPage.getCommonPersonListItemByComponent(residentInfo, managePartyPage.selectors.personListItemComponent);
  await expectVisible(t, { selector: guarantorCardSelector });
  await clickOnElement(t, { selector: guarantorCardSelector });
  await clickOnElement(t, {
    selector: $(managePartyPage.selectors.commonPersonCardMenuListItem).withText(trans('EDIT_MEMBER_TYPE_LINK', { memberType: 'resident' })),
  });
  await managePartyPage.clickDropdownBtnInDialog(managePartyPage.selectors.selectResidentDropdown);

  // clicks on checkbox item in the list
  await clickOnElement(t, { selector: residentListItemSelector });
  await managePartyPage.clickDropdownDoneBtn(managePartyPage.selectors.selectResidentDropdown);
  await managePartyPage.clickBtnInDialogByCommand(managePartyPage.selectors.linkGuarantorResidentDialog, managePartyPage.selectors.okBtnDialogCommand);
};

export const editGuarantorLinkFromResident = async (t, residentInfo, guarantorInfo) => {
  const managePartyPage = new ManagePartyPage(t);
  const residentCardSelector = managePartyPage.getCommonPersonCardByComponent(residentInfo, managePartyPage.selectors.personCardComponent);
  await expectVisible(t, { selector: residentCardSelector });
  await clickOnElement(t, { selector: residentCardSelector });
  await clickOnElement(t, {
    selector: $(managePartyPage.selectors.commonPersonCardMenuListItem).withText(trans('EDIT_MEMBER_TYPE_LINK', { memberType: 'guarantor' })),
  });
  // select the given guarantor
  await setDropdownValues(t, { id: managePartyPage.selectors.selectGuarantorDropdown, values: [guarantorInfo.legalName] });
  await managePartyPage.clickBtnInDialogByCommand(managePartyPage.selectors.linkGuarantorResidentDialog, managePartyPage.selectors.okBtnDialogCommand);
};

export const movePersonResidentToGuarantor = async (t, residentInfo) => {
  const managePartyPage = new ManagePartyPage(t);
  const residentCardSelector = managePartyPage.getCommonPersonCardByComponent(residentInfo, managePartyPage.selectors.personCardComponent);
  await expectVisible(t, { selector: residentCardSelector });
  await clickOnElement(t, { selector: residentCardSelector });
  await clickOnElement(t, { selector: $(managePartyPage.selectors.commonPersonCardMenuListItem).withText(trans('MOVE_TO_GUARANTORS')) });
};

export const movePersonGuarantorToResident = async (t, guarantorInfo) => {
  const managePartyPage = new ManagePartyPage(t);
  const guarantorCardSelector = managePartyPage.getCommonPersonCardByComponent(guarantorInfo, managePartyPage.selectors.personCardComponent);
  await expectVisible(t, { selector: guarantorCardSelector });
  await clickOnElement(t, { selector: guarantorCardSelector });
  await clickOnElement(t, { selector: $(managePartyPage.selectors.commonPersonCardMenuListItem).withText(trans('MOVE_TO_RESIDENTS')) });
};

export const addChildInPartyDetails = async (t, childInfo) => {
  const managePartyPage = new ManagePartyPage(t);
  await managePartyPage.clickAddBtnInCollectionPanel(managePartyPage.selectors.childCollectionPanel);
  await managePartyPage.checkForVisibleSection(managePartyPage.selectors.childSection);
  await setChildInfo(t, childInfo);

  // save child info
  await managePartyPage.clickOkBtnInCollectionPanel(managePartyPage.selectors.childCollectionPanel);
  await managePartyPage.checkForEntityAdded(managePartyPage.selectors.childCollectionPanel, childInfo.text);
};

export const addChildInApplication = async (t, childInfo) => {
  const applicationPage = new ApplicationPage(t);
  const managePartyPage = new ManagePartyPage(t);
  await setChildInfo(t, childInfo);
  await clickOnElement(t, { selector: managePartyPage.selectors.addNewEntityBtn });
  await clickOnElement(t, { selector: applicationPage.selectors.nextStepBtn });
};

export const addPetInPartyDetails = async (t, petInfo, setPetAsServiceAnimal = false) => {
  const managePartyPage = new ManagePartyPage(t);
  await managePartyPage.clickAddBtnInCollectionPanel(managePartyPage.selectors.petCollectionPanel);
  await managePartyPage.checkForVisibleSection(managePartyPage.selectors.petSection);
  await setPetInfo(t, petInfo, setPetAsServiceAnimal);

  // save pet info
  await managePartyPage.clickOkBtnInCollectionPanel(managePartyPage.selectors.petCollectionPanel);
  await managePartyPage.checkForEntityAdded(managePartyPage.selectors.petCollectionPanel, petInfo.text);
};

export const addPetInApplication = async (t, petInfo) => {
  const applicationPage = new ApplicationPage(t);
  const managePartyPage = new ManagePartyPage(t);
  await setPetInfo(t, petInfo);
  await clickOnElement(t, { selector: managePartyPage.selectors.addNewEntityBtn });
  await clickOnElement(t, { selector: applicationPage.selectors.nextStepBtn });
};

export const addVehicleInPartyDetails = async (t, vehicleInfo) => {
  const managePartyPage = new ManagePartyPage(t);
  await managePartyPage.clickAddBtnInCollectionPanel(managePartyPage.selectors.vehicleCollectionPanel);
  await managePartyPage.checkForVisibleSection(managePartyPage.selectors.vehicleSection);
  await setVehicleInfo(t, vehicleInfo);

  // save vehicle info
  await managePartyPage.clickOkBtnInCollectionPanel(managePartyPage.selectors.vehicleCollectionPanel);
  await managePartyPage.checkForEntityAdded(managePartyPage.selectors.vehicleCollectionPanel, vehicleInfo.text);
};

export const addOccupantInPartyDetails = async (t, occupantInfo, closeDialogOnAdd = true) => {
  const managePartyPage = new ManagePartyPage(t);
  const partyDetailPage = new PartyDetailPage(t);
  await clickOnElement(t, { selector: $(partyDetailPage.selectors.headerPartyDetail) });
  await managePartyPage.clickOnAddOccupantBtn();
  await createPerson(t, occupantInfo);
  await managePartyPage.checkForEntityAdded(managePartyPage.selectors.occupantCollectionPanel, occupantInfo.legalName);

  const occupantCard = `${managePartyPage.selectors.occupantCollectionPanel} ${managePartyPage.selectors.commonPersonCard}`;
  await expectVisible(t, { selector: occupantCard });
  closeDialogOnAdd && (await managePartyPage.closeManageParty());
};

export const validateOccupantsSection = async (t, partyType) => {
  const managePartyPage = new ManagePartyPage(t);
  if (partyType === 'corporate') {
    const occupantCard = `${managePartyPage.selectors.occupantCollectionPanel} ${managePartyPage.selectors.commonPersonCard}`;
    await clickOnElement(t, { selector: occupantCard });

    const occupantCardMenuListItem = `${managePartyPage.selectors.occupantCollectionPanel} ${managePartyPage.selectors.commonPersonCardMenuListItem}`;
    await expectNotPresent(t, {
      selector: occupantCardMenuListItem,
      text: trans('MOVE_TO_RESIDENTS'),
    });

    await expectNotPresent(t, {
      selector: occupantCardMenuListItem,
      text: trans('MOVE_TO_GUARANTORS'),
    });
  } else {
    managePartyPage.checkOcupantLinkTo();
  }
};

export const addVehicleInApplication = async (t, vehicleInfo) => {
  const applicationPage = new ApplicationPage(t);
  const managePartyPage = new ManagePartyPage(t);
  await setVehicleInfo(t, vehicleInfo);
  await clickOnElement(t, { selector: managePartyPage.selectors.addNewEntityBtn });
  await clickOnElement(t, { selector: applicationPage.selectors.nextStepBtn });
};

export const validatePartyDataCreation = async (t, { propertyName, contactInfo, qualificationInfo }) => {
  const partyDetailPage = new PartyDetailPage(t);
  await expectVisible(t, { selector: partyDetailPage.selectors.guestTitleTag });
  await expectTextIsEqual(t, { selector: partyDetailPage.selectors.guestTitleTag, text: contactInfo.legalName });
  await expectVisible(t, { selector: partyDetailPage.selectors.numBedroomsText });
  await expectTextIsEqual(t, { selector: partyDetailPage.selectors.numBedroomsText, text: qualificationInfo.bedrooms });
  await expectTextIsEqual(t, { selector: partyDetailPage.selectors.propertyNameInfoText, text: propertyName });
};

export const setPartyCreationDetails = async (t, { partyInfo, propertyName, userInfo, leaseType, skipPropertySelection }) => {
  const dashboardPage = new DashboardPage(t);
  await clickOnElement(t, { selector: dashboardPage.selectors.createPartyBtn });
  const managePartyPage = new ManagePartyPage(t);

  if (userInfo.user === 'admin@reva.tech') {
    await setDropdownValues(t, { id: managePartyPage.selectors.assignedPropertyDropdown, values: [propertyName] });
    if (userInfo.team && propertyName !== 'Acme Apartments') {
      await setDropdownValues(t, { id: managePartyPage.selectors.teamDropdown, values: [userInfo.team] });
    }
  } else if (!skipPropertySelection) {
    // select property, team, lease type and channel
    if (userInfo.user !== 'bill@reva.tech') {
      await setDropdownValues(t, { id: managePartyPage.selectors.assignedPropertyDropdown, values: [propertyName] });
    }

    if (userInfo.team && propertyName !== 'The Cove at Tiburon') {
      await setDropdownValues(t, { id: managePartyPage.selectors.teamDropdown, values: [userInfo.team] });
    }
  }

  if (await isElementVisible(t, { selector: `#${managePartyPage.selectors.leaseTypeDropdown}` })) {
    await setDropdownValues(t, { id: managePartyPage.selectors.leaseTypeDropdown, values: [leaseType] });

    leaseType === LeaseTypes.RENEWAL_LEASE &&
      (await expectTextIsEqual(t, { selector: managePartyPage.selectors.contactChannelListValue, text: trans('CE_TYPE_OTHER') }));
  }

  await setDropdownValues(t, { id: managePartyPage.selectors.firstContactChannelDropdown, values: [partyInfo.channel] });

  // click to create a party
  await clickOnElement(t, { selector: managePartyPage.selectors.submitAssignedPropertyBtn });
};

export const createAParty = async (
  t,
  {
    partyInfo,
    propertyName,
    contactInfo,
    userInfo,
    qualificationInfo,
    companyInfo,
    leaseType = LeaseTypes.NEW_LEASE,
    skipPropertySelection,
    mergeDialogBody = trans('NO_DUPLICATE_PARTY_FOUND_INFO1'),
  },
  mergePersonCondition = '',
) => {
  const isCorporateParty = !!companyInfo;

  await setPartyCreationDetails(t, { partyInfo, propertyName, userInfo, leaseType, skipPropertySelection });
  const partyDetailPage = new PartyDetailPage(t);

  isCorporateParty && (await clickOnElement(t, { selector: partyDetailPage.selectors.changePartyTypeBtn }));
  // set legal name and email
  const partyMemberInfo = !isCorporateParty ? contactInfo : companyInfo;
  await createInitialPartyValidation(t, partyMemberInfo);

  if (mergePersonCondition) {
    await mergePersons(t, mergePersonCondition, userInfo, mergeDialogBody);
  } else {
    const personCardDialog = new PersonCardPage(t);
    // Finish createPerson
    await personCardDialog.clickCreatePersonButton(t);
  }

  const managePartyPage = new ManagePartyPage(t);

  leaseType === LeaseTypes.RENEWAL_LEASE && (await managePartyPage.clickContinueToRenewalBtn());

  if (leaseType === LeaseTypes.NEW_LEASE && mergePersonCondition !== mergeConditions.mergePersonsAndParties) {
    // answer the qualification questions
    await selectPartyQualificationQuestions(t, qualificationInfo, !isCorporateParty);

    // save qualification questions
    await clickOnElement(t, { selector: partyDetailPage.selectors.saveAndContinueBtn });
  }
};

export const checkCorporateWarnings = async t => {
  const partyDetailPage = new PartyDetailPage(t);
  const basePage = new BasePage(t);
  const managePartyPage = new ManagePartyPage(t);
  await clickOnElement(t, { selector: $(partyDetailPage.selectors.headerPartyDetail) });
  await expectVisible(t, { selector: `${basePage.selectors.dialogOverlay} ${basePage.selectors.title}`, text: trans('MISSING_COMPANY_NAME_TITLE') });
  await expectVisible(t, { selector: `${basePage.selectors.dialogOverlay} ${basePage.selectors.text}`, text: trans('MISSING_COMPANY_NAME_MESSAGE') });
  await clickOnElement(t, { selector: `${basePage.selectors.dialogActions} ${basePage.selectors.okBtn}` });
  await expectVisible(t, {
    selector: `${managePartyPage.selectors.companyDetailsSection} ${managePartyPage.selectors.missingCompanyContent}`,
    text: trans('COMPANY_DETAILS_LABEL'),
  });
};

export const checkNoCorporateWarnings = async t => {
  const basePage = new BasePage(t);
  await expectNotVisible(t, { selector: `${basePage.selectors.dialogOverlay} ${basePage.selectors.title}`, text: trans('MISSING_COMPANY_NAME_TITLE') });
  await expectNotVisible(t, { selector: `${basePage.selectors.dialogOverlay} ${basePage.selectors.text}`, text: trans('MISSING_COMPANY_NAME_MESSAGE') });
};

export const checkCompanyDetailsSectionWhenNoPOC = async t => {
  const managePartyPage = new ManagePartyPage(t);
  const partyDetailPage = new PartyDetailPage(t);
  await expectVisible(t, {
    selector: `${managePartyPage.selectors.companyDetailsSection} ${partyDetailPage.selectors.sectionTitle}`,
    text: 'Company Details',
  });
  await expectVisible(t, { selector: `${managePartyPage.selectors.companyDetailsSection} ${managePartyPage.selectors.addCompanyButton}` });
  await clickOnElement(t, { selector: `${managePartyPage.selectors.companyDetailsSection} ${managePartyPage.selectors.addCompanyButton}` });
};

export const addCompanyDetails = async (t, companyNameText) => {
  const basePage = new BasePage(t);
  const managePartyPage = new ManagePartyPage(t);
  await expectVisible(t, { selector: `${basePage.selectors.dialogOverlay} ${managePartyPage.selectors.companyNameDropdown}` });
  await t.typeText($(managePartyPage.selectors.companyNameDropdown), companyNameText);
  await clickOnElement(t, { selector: `${basePage.selectors.dialogActions} ${basePage.selectors.okBtn}` });
};

export const checkCompanyDetailsSectionWithPOC = async (t, companyNameText) => {
  const managePartyPage = new ManagePartyPage(t);
  const partyDetailPage = new PartyDetailPage(t);
  await expectVisible(t, {
    selector: `${managePartyPage.selectors.companyDetailsSection} ${partyDetailPage.selectors.sectionTitle}`,
    text: 'Company Details',
  });
  await expectNotVisible(t, { selector: `${managePartyPage.selectors.companyDetailsSection} ${managePartyPage.selectors.addCompanyButton}` });
  await expectNotVisible(t, {
    selector: `${managePartyPage.selectors.companyDetailsSection} ${managePartyPage.selectors.missingCompanyContent}`,
    text: trans('COMPANY_DETAILS_LABEL'),
  });
  await expectVisible(t, { selector: $(managePartyPage.selectors.companyDetailsSection).withText(companyNameText) });
};

export const editCompanyDetails = async (t, companyNameBeforeEdit, companyNameAfterEdit) => {
  const managePartyPage = new ManagePartyPage(t);
  const basePage = new BasePage(t);
  await clickOnElement(t, { selector: $(managePartyPage.selectors.companyName), text: companyNameBeforeEdit });
  await clickOnElement(t, { selector: '[data-component="list-item"][data-action="edit"]' });
  await clickOnElement(t, { selector: managePartyPage.selectors.companyNameDropdown });
  await clearTextElement(t, { selector: managePartyPage.selectors.companyNameDropdownInput });
  await t.typeText($(managePartyPage.selectors.companyNameDropdown), companyNameAfterEdit);
  await clickOnElement(t, { selector: `${basePage.selectors.dialogActions} ${basePage.selectors.okBtn}` });
};

export const checkEditCompanyDetailsForActiveLease = async (t, companyName) => {
  const managePartyPage = new ManagePartyPage(t);
  const basePage = new BasePage(t);
  await clickOnElement(t, { selector: $(managePartyPage.selectors.companyName), text: companyName });
  await clickOnElement(t, { selector: '[data-component="list-item"][data-action="edit"]' });
  await expectVisible(t, { selector: managePartyPage.selectors.dialogOverlay, text: trans('CANNOT_EDIT_COMPANY_DETAILS') });
  await clickOnElement(t, { selector: `${basePage.selectors.dialogActions} ${basePage.selectors.okBtn}` });
};

export const createCorporatePartyWithoutCompanyDetails = async (
  t,
  { partyInfo, propertyName, userInfo, qualificationInfo, companyInfo, leaseType = LeaseTypes.NEW_LEASE, skipPropertySelection },
  mergePersonCondition = '',
) => {
  await setPartyCreationDetails(t, { partyInfo, propertyName, userInfo, leaseType, skipPropertySelection });
  const partyDetailPage = new PartyDetailPage(t);
  await clickOnElement(t, { selector: partyDetailPage.selectors.changePartyTypeBtn });
  await expectVisible(t, { selector: `${partyDetailPage.selectors.companyDetailsSection} ${partyDetailPage.selectors.sectionTitle}`, text: 'Company Details' });
  await createInitialPartyValidation(t, companyInfo, false);
  if (mergePersonCondition) {
    await mergePersons(t, mergePersonCondition, userInfo);
  } else {
    const personCardDialog = new PersonCardPage(t);
    await personCardDialog.clickCreatePersonButton(t);
  }
  const managePartyPage = new ManagePartyPage(t);
  leaseType === LeaseTypes.RENEWAL_LEASE && (await managePartyPage.clickContinueToRenewalBtn());
  await selectPartyQualificationQuestions(t, qualificationInfo, false);
  await clickOnElement(t, { selector: partyDetailPage.selectors.saveAndContinueBtn });
};

export const searchUnitInInventory = async (t, quoteInfo, showInventoryFilterBar) => {
  const partyDetailPage = new PartyDetailPage(t);
  if (showInventoryFilterBar) {
    await expectVisible(t, { selector: partyDetailPage.selectors.communicationToggleBtn });
    await clickOnElement(t, { selector: partyDetailPage.selectors.communicationToggleBtn });
  }
  await expectVisible(t, { selector: partyDetailPage.selectors.inventoryFilterBar });
  await clearTextElement(t, { selector: partyDetailPage.selectors.inventoryFilterInput });
  await partyDetailPage.searchUnitByNameInInventory(quoteInfo.unitName);
  await partyDetailPage.existUnitNameInInventory(quoteInfo.unitName);
};

export const validateQuoteDraftTitleSection = async (t, quoteInfo) => {
  const quoteDraftPage = new QuoteDraftPage(t);
  // TEST-15:Title section quote draft
  await expectVisible(t, { selector: quoteDraftPage.selectors.quoteExpirationLabelText });
  await expectTextIsEqual(t, {
    selector: quoteDraftPage.selectors.quoteExpirationLabelText,
    text: trans('QUOTE_DRAFT_EXIRES_AT_TEXT', {
      number: 'two',
      period: 'days',
    }),
  });

  const { quote, state, displayName, layout } = quoteInfo;
  await expectTextIsEqual(t, { selector: quoteDraftPage.selectors.leaseTermsDropdownSelectedLabelText, text: quote.defaultLeaseTerm });
  await expectTextIsEqual(t, { selector: quoteDraftPage.selectors.inventoryStateText, text: state });
  await expectTextIsEqual(t, { selector: quoteDraftPage.selectors.inventoryNameText, text: displayName });
  await expectTextIsEqual(t, { selector: quoteDraftPage.selectors.inventoryLayoutText, text: layout });

  if (quote.complimentaryItems.textLabel && quote.complimentaryItems.item) {
    await expectTextIsEqual(t, { selector: quoteDraftPage.selectors.includesComplimentaryItemText, text: quote.complimentaryItems.textLabel });
    await expectTextContains(t, { selector: quoteDraftPage.selectors.complimentaryItems, text: quote.complimentaryItems.item });
  }

  await quoteDraftPage.checkLeaseTermVisibility(quote.leaseTerms);
};

export const createAQuote = async (t, quoteInfo, showInventoryFilterBar = true, { leaseStartDate, timezone } = {}) => {
  await searchUnitInInventory(t, quoteInfo, showInventoryFilterBar);

  await withRetries(
    t,
    async () => {
      const partyDetailPage = new PartyDetailPage(t);
      await partyDetailPage.clickOnUnitToCreateQuote(quoteInfo.unitName, quoteInfo.leaseType);
      const quoteDraftPage = new QuoteDraftPage(t);
      await quoteDraftPage.checkVisibilityQuoteHeader(`(${trans('DRAFT')})`);
    },
    { fnName: 'createAQuote', delayBetweenRetries: 500, maxAttempts: 20 },
  );

  const quoteDraftPage = new QuoteDraftPage(t);

  if (leaseStartDate || quoteInfo.leaseStartDate === '1') {
    const date = leaseStartDate || now();
    await quoteDraftPage.selectLeaseDate(t, quoteDraftPage.selectors.leaseStartDateTxt, date, timezone);
    await validateQuoteDraftTitleSection(t, quoteInfo);
  }
};

export const selectLeaseTermInQuote = async (t, leaseTerms) => {
  const quoteDraftPage = new QuoteDraftPage(t);
  await quoteDraftPage.selectLeaseTerms(leaseTerms);
};

export const selectConcessionsInQuote = async t => {
  const quoteDraftPage = new QuoteDraftPage(t);
  const concessionCheckBoxSelectors = [`${quoteDraftPage.selectors.monthFreeConcessionCheckBox}`];
  await quoteDraftPage.selectConcession(concessionCheckBoxSelectors);
};

export const createAQuoteDraft = async (t, quoteInfo, showInventoryFilterBar = true) => {
  const quoteDraftPage = new QuoteDraftPage(t);
  const partyDetailPage = new PartyDetailPage(t);
  await createAQuote(t, quoteInfo, showInventoryFilterBar);
  await quoteDraftPage.close();
  await partyDetailPage.checkVisibilityOfSelectorWithIndex(partyDetailPage.selectors.quoteRow, quoteInfo.index);
};

const revisitQuoteAfterCreated = async (t, quoteInfo) => {
  const partyDetailPage = new PartyDetailPage(t);
  await expectVisible(t, { selector: partyDetailPage.selectors.inventoryFilterBar });
  await partyDetailPage.existUnitNameInInventory(quoteInfo.unitName);
  await partyDetailPage.clickOnUnitToCreateQuote(quoteInfo.unitName);
};

export const checkAQuoteDraftFromUnitList = async (t, quoteInfo) => {
  const quoteDraftPage = new QuoteDraftPage(t);
  await revisitQuoteAfterCreated(t, quoteInfo);
  await quoteDraftPage.clickOkBtnOnDialog();
  await expectTextIsEqual(t, { selector: quoteDraftPage.selectors.quoteTitleDialog, text: `Quote for Unit ${quoteInfo.unitName} (draft)` });
  await quoteDraftPage.close();
};

export const publishAQuote = async (t, contactInfo, quoteInfo = { leaseType: LeaseTypes.NEW_LEASE }) => {
  const quoteDraftPage = new QuoteDraftPage(t);
  await quoteDraftPage.checkVisibilityQuoteHeader(`(${trans('DRAFT')})`);

  // pick lease start date
  if (quoteInfo.leaseType === LeaseTypes.RENEWAL_LEASE) {
    await clickOnElement(t, { selector: quoteDraftPage.selectors.leaseStartDateTxt });
    await clickOnElement(t, { selector: quoteDraftPage.selectors.leaseStartDateCalendarOkBtn });
  }

  await expectVisible(t, { selector: quoteDraftPage.selectors.publishButton });
  await clickOnElement(t, { selector: quoteDraftPage.selectors.publishButton });
  await expectVisible(t, { selector: quoteDraftPage.selectors.sendPublishedQuoteDialog });

  // TEST-1216: Create a quote for a unit available in a party type of "New lease"
  await expectVisible(t, { selector: quoteDraftPage.selectors.sendPublishedQuoteBtn });
  await expectVisible(t, { selector: quoteDraftPage.selectors.sendPublishedQuoteLaterBtn });

  const partyDetailPage = new PartyDetailPage(t);

  await quoteDraftPage.clickOkBtnPublishQuoteDialog();
  quoteInfo.leaseType !== LeaseTypes.RENEWAL_LEASE &&
    quoteInfo.leaseType !== LeaseTypes.CORPORATE_LEASE &&
    (await partyDetailPage.checkVisibilityOfSelectorWithIndex(partyDetailPage.selectors.applicationStatusText, contactInfo.index));
};

export const sendLaterAPublishQuote = async t => {
  const quoteDraftPage = new QuoteDraftPage(t);
  await quoteDraftPage.checkVisibilityQuoteHeader(`(${trans('DRAFT')})`);
  await expectVisible(t, { selector: quoteDraftPage.selectors.publishButton });
  await clickOnElement(t, { selector: quoteDraftPage.selectors.publishButton });
  await expectVisible(t, { selector: quoteDraftPage.selectors.sendPublishedQuoteDialog });
  await quoteDraftPage.clickCancelBtnPublishQuoteDialog();
  await quoteDraftPage.close();
};

export const publishAQuoteDraft = async (t, { quoteInfo, contactInfo }) => {
  const partyDetailPage = new PartyDetailPage(t);
  // TEST-97: Send Quote published
  await partyDetailPage.checkVisibilityOfSelectorWithIndex(partyDetailPage.selectors.quoteRowStatusTag, quoteInfo.index);
  await partyDetailPage.clickOnSelectorRow(partyDetailPage.selectors.quoteRowStatusTag, quoteInfo.index);
  await publishAQuote(t, contactInfo);
  await partyDetailPage.checkVisibilityOfSelectorWithIndex(partyDetailPage.selectors.applicationStatusText, contactInfo.index);
};

export const sendLaterAPublishQuoteDraft = async (t, quoteInfo) => {
  const partyDetailPage = new PartyDetailPage(t);

  await expectVisible(t, { selector: partyDetailPage.selectors.communicationToggleBtn });
  await clickOnElement(t, { selector: partyDetailPage.selectors.communicationToggleBtn });
  await partyDetailPage.checkVisibilityOfSelectorWithIndex(partyDetailPage.selectors.quoteRowStatusTag, quoteInfo.index);
  await partyDetailPage.clickOnSelectorRow(partyDetailPage.selectors.quoteRowStatusTag, quoteInfo.index);
  await sendLaterAPublishQuote(t);
  await t.expect($(partyDetailPage.selectors.emailSubject).count).eql(0);
};

export const checkQuoteApplicationStatus = async (t, text) => {
  const partyDetailPage = new PartyDetailPage(t);
  await expectVisible(t, { selector: partyDetailPage.selectors.quoteScreeningStatusTxt });
  await expectTextIsEqual(t, { selector: partyDetailPage.selectors.quoteScreeningStatusTxt, text });
};

export const verifyQuotedItemMenuOptions = async (t, quoteInfo) => {
  const partyDetailPage = new PartyDetailPage(t);
  await partyDetailPage.clickOnSelectorRow(partyDetailPage.selectors.quoteRowMenu, quoteInfo.index);
  await expectVisible(t, { selector: $(partyDetailPage.selectors.rowApplicationListItems).withText(trans('REVIEW_SCREENING')) });
  await expectVisible(t, { selector: $(partyDetailPage.selectors.rowApplicationListItems).withText(trans('VIEW_QUOTE')) });
  await expectVisible(t, { selector: $(partyDetailPage.selectors.rowApplicationListItems).withText(trans('HOLD_UNIT')) });
};

export const verifyComplimentaryItemsTxt = async (t, selector, layout, additionalText) => {
  await sanitizedTextIsEqual(t, { selector, text: `${layout} ${additionalText}` });
};

export const verifyUnitScreeningInfo = async (t, quoteInfo) => {
  const leaseApplicationPage = new LeaseApplicationPage(t);
  await expectVisible(t, { selector: leaseApplicationPage.selectors.applicationSummaryQuoteImage });
  await expectTextIsEqual(t, { selector: leaseApplicationPage.selectors.applicationSummaryQuoteInfo, text: quoteInfo.displayName });
  const additionalText = 'floorplan';
  await verifyComplimentaryItemsTxt(t, leaseApplicationPage.selectors.summaryComplimentaryItemsTxt, quoteInfo.layout, additionalText);
};

export const requestLeaseApproval = async t => {
  const leaseApplicationPage = new LeaseApplicationPage(t);
  await clickOnElement(t, { selector: leaseApplicationPage.selectors.requestApprovalBtn });
};

export const checkAmenitiesData = async (t, amenitiesData) => {
  const quoteDraftPage = new QuoteDraftPage(t);
  await expectVisible(t, { selector: quoteDraftPage.selectors.highValueAmenities });
  await expectTextIsEqual(t, { selector: quoteDraftPage.selectors.highValueAmenities, text: amenitiesData.highValue });
  await expectVisible(t, { selector: quoteDraftPage.selectors.propertyAmenities });
  await expectTextIsEqual(t, { selector: quoteDraftPage.selectors.propertyAmenities, text: amenitiesData.property });
};

export const checkCreatedQuoteAmenities = async (t, amenitiesData) => {
  const quoteDraftPage = new QuoteDraftPage(t);
  await expectTextIsEqual(t, { selector: quoteDraftPage.selectors.leaseAmenitiesTxt, text: `${amenitiesData.highValue}${amenitiesData.property}` });
};

export const verifyCreatedQuoteLeaseTerm = async (t, selector, leaseTerm) => {
  const selectorText = await getText(selector);
  const regex = /(.*)\s+lease/g;
  const filteredText = await regex.exec(selectorText);
  await t.expect(filteredText[1]).eql(leaseTerm);
};

export const verifyCreatedQuoteFloorplan = async (t, selector, layout, additionalText) => {
  const selectorText = await getText(selector);
  let filteredText = await selectorText.replace(/([\r\n]+|\n+|\r+|\s+)/gi, ' ');
  const removeSpace = /\s+/gi;
  filteredText = await filteredText.match(/(\d\s+bed.*?,.*floorplan)/gi);
  const mockedText = `${layout} ${additionalText}`;
  await t.expect(filteredText[0].replace(removeSpace, '')).eql(mockedText.replace(removeSpace, ''));
};

export const verifyUnitName = async (t, selector, quoteInfo) => {
  const selectorText = await getText(selector);
  const unitNameRegex = /Unit\s+(.*?),/g;
  const filteredText = unitNameRegex.exec(selectorText);
  await t.expect(filteredText[1]).eql(quoteInfo.unitName);
};

export const verifyCreatedQuoteData = async (t, quoteInfo, isLeasePriceIncreased = false) => {
  const quoteDraftPage = new QuoteDraftPage(t);
  const leaseApplicationPage = new LeaseApplicationPage(t);
  await expectVisible(t, { selector: leaseApplicationPage.selectors.viewQuoteBtn });
  await clickOnElement(t, { selector: leaseApplicationPage.selectors.viewQuoteBtn });
  const additionalText = 'floorplan';
  await verifyUnitName(t, quoteDraftPage.selectors.leaseUnitDescriptionTxt, quoteInfo);
  await verifyCreatedQuoteFloorplan(t, quoteDraftPage.selectors.leaseUnitDescriptionTxt, quoteInfo.layout, additionalText);
  await verifyCreatedQuoteLeaseTerm(t, quoteDraftPage.selectors.createdQuoteLeaseTerm, quoteInfo.quote.defaultLeaseTerm);
  const amenitiesData = mockAmenitiesData[1];
  await checkCreatedQuoteAmenities(t, amenitiesData);
  const quotePrice = isLeasePriceIncreased ? quoteInfo.increasedLeasePrice : quoteInfo.leasePrice;
  await expectTextIsEqual(t, {
    selector: quoteDraftPage.selectors.leasePriceTxt,
    text: quotePrice,
  });
};

export const checkAmenitiesInQuoteDraft = async (t, quoteInfo) => {
  const partyDetailPage = new PartyDetailPage(t);
  await partyDetailPage.checkVisibilityOfSelectorWithIndex(partyDetailPage.selectors.quoteRowStatusTag, quoteInfo.index);
  await partyDetailPage.clickOnSelectorRow(partyDetailPage.selectors.quoteRowStatusTag, quoteInfo.index);
  const amenitiesData = mockAmenitiesData[0];
  await checkAmenitiesData(t, amenitiesData);
};

export const deleteAQuoteDraft = async (t, quoteInfo) => {
  const quoteDraftPage = new QuoteDraftPage(t);
  const partyDetailPage = new PartyDetailPage(t);
  await partyDetailPage.checkVisibilityOfSelectorWithIndex(partyDetailPage.selectors.quoteRowStatusTag, quoteInfo.index);
  await partyDetailPage.clickOnSelectorRow(partyDetailPage.selectors.quoteRowStatusTag, quoteInfo.index);
  await expectVisible(t, { selector: quoteDraftPage.selectors.publishButton });
  await clickOnElement(t, { selector: quoteDraftPage.selectors.deleteButton });
  await quoteDraftPage.clickOkBtnOnDialog();
  await expectVisible(t, { selector: partyDetailPage.selectors.communicationToggleBtn });
  await clickOnElement(t, { selector: partyDetailPage.selectors.communicationToggleBtn });
  await sleep(500);
};

export const increaseQuoteLeasePrice = async (t, quoteLeasePrice) => {
  const quoteDraftPage = new QuoteDraftPage(t);

  await clickOnElement(t, { selector: quoteDraftPage.selectors.baseRentLeaseTerm.replace('length', quoteLeasePrice.selectedLeaseTerm) });
  const selectorTpl = quoteDraftPage.selectors.increaseLeaseInput.replace('length', quoteLeasePrice.selectedLeaseTerm);

  await t.selectText(selectorTpl).pressKey('delete');
  await t.typeText(selectorTpl, quoteLeasePrice.newPrice);

  await clickOnElement(t, { selector: quoteDraftPage.selectors.flyoutDialogDoneBtn });
};

export const verifyPendingApprovalData = async (t, quoteInfo, verifyIncreasedPrice = false) => {
  const partyDetailPage = new PartyDetailPage(t);

  await expectVisible(t, { selector: partyDetailPage.selectors.applicationPendingApproval });
  await expectTextIsEqual(t, { selector: partyDetailPage.selectors.applicationApprovalDateTxt, text: 'Approval requested today' });

  const leasePrice = verifyIncreasedPrice ? quoteInfo.increasedLeasePrice : quoteInfo.leasePrice;

  await expectTextIsEqual(t, { selector: partyDetailPage.selectors.pendingApprovalAmount, text: leasePrice });
  await sanitizedTextIsEqual(t, { selector: partyDetailPage.selectors.applicationLayoutInfoTxt, text: quoteInfo.leaseComplimentaryInfo });
  await expectVisible(t, { selector: partyDetailPage.selectors.reviewApplicationBtn });
};

export const checkPersonApplicationStatus = async (t, contactInfo, statusValue) => {
  const partyDetailPage = new PartyDetailPage(t);

  await partyDetailPage.checkVisibilityOfSelectorWithIndex(partyDetailPage.selectors.residentRow, contactInfo.index);
  await partyDetailPage.checkScreeningStatusValue(contactInfo.index, statusValue);
};

export const checkStatusQuoteDraft = async (t, quoteInfo) => {
  const partyDetailPage = new PartyDetailPage(t);

  // TEST-98 Status unit card after quote published
  await expectVisible(t, { selector: partyDetailPage.selectors.communicationToggleBtn });
  await clickOnElement(t, { selector: partyDetailPage.selectors.communicationToggleBtn });
  await sleep(500);
  await clickOnElement(t, { selector: partyDetailPage.selectors.communicationToggleBtn });
  await expectVisible(t, { selector: partyDetailPage.selectors.inventoryFilterBar });
  await clickOnElement(t, { selector: partyDetailPage.selectors.inventoryFilterBar });
  await sleep(500);
  await clickOnElement(t, { selector: '#inventoryFilterBar [data-component="textbox-clear"]' });
  await t.typeText('#inventoryFilterBar [data-component="toolbar-item"] [data-component="textbox"]', quoteInfo.unitName);
  await expectVisible(t, { selector: '[data-id="inventoryCard"]' });
  await expectTextIsEqual(t, { selector: '[data-id="unitName"]', text: quoteInfo.unitName });
  await expectVisible(t, { selector: `#tag-${quoteInfo.unitName}-Quoted_truncate` });
  await expectTextIsEqual(t, { selector: `#tag-${quoteInfo.unitName}-Quoted_truncate [data-component="caption"]`, text: 'Quoted' });
};

export const validateWaiveFeeMenuOptions = async (t, contactInfo, isWaived) => {
  const partyDetailPage = new PartyDetailPage(t);

  await partyDetailPage.clickOnMemberRowApplicationMenu(contactInfo.index, contactInfo.memberType);
  await partyDetailPage.checkVisibleFlyOutList(contactInfo.index, contactInfo.memberType);
  if (isWaived) {
    await expectTextIsEqual(t, { selector: partyDetailPage.selectors.waiveApplicationFeeOption, text: trans('WAIVE_APPLICATION_CANCEL') });
    return;
  }

  await expectTextIsEqual(t, { selector: partyDetailPage.selectors.waiveApplicationFeeOption, text: trans('WAIVE_APPLICATION_EXECUTE') });
  await partyDetailPage.clickOnMemberRowApplicationMenu(contactInfo.index, contactInfo.memberType);
};

export const waiveApplicationFee = async (t, contactInfo, feeWaiveReason = 'This is a test') => {
  const isWaived = false;
  await validateWaiveFeeMenuOptions(t, contactInfo, isWaived);
  const partyDetailPage = new PartyDetailPage(t);

  await partyDetailPage.clickOnMemberRowApplicationMenu(contactInfo.index, contactInfo.memberType);
  await partyDetailPage.checkVisibleFlyOutList(contactInfo.index, contactInfo.memberType);

  // Waive application fee
  await clickOnElement(t, { selector: partyDetailPage.selectors.waiveApplicationFeeOption });

  // TEST-433 Make a waive to party member
  await expectTextIsEqual(t, {
    selector: partyDetailPage.selectors.waiveApplicationFeeDialogTitle,
    text: trans('WAIVE_APPLICATION_DIALOG_TITLE', { memberName: contactInfo.legalName }),
  });
  await expectTextIsEqual(t, {
    selector: partyDetailPage.selectors.waiveApplicationFeeDialogBodyTxt,
    text: trans('WAIVE_APPLICATION_DIALOG_TEXT'),
  });
  await expectBtnDisabled(t, { selector: partyDetailPage.selectors.waiveApplicationFeeDialogOkBtn });
  await expectBtnEnabled(t, {
    selector: partyDetailPage.selectors.waiveApplicationFeeDialogCancelBtn,
  });

  await withRetries(
    t,
    async () => {
      await t.typeText(partyDetailPage.selectors.waiveApplicationFeeReasonText, feeWaiveReason);
      await expectBtnEnabled(t, { selector: partyDetailPage.selectors.waiveApplicationFeeDialogOkBtn });
      await clickOnElement(t, { selector: partyDetailPage.selectors.waiveApplicationFeeDialogOkBtn });
    },
    { fnName: 'waiveApplicationFee', delayBetweenRetries: 500, maxAttempts: 20 },
  );
};

const checkApplicationFeeWaiver = async (t, rowIndex, isWaived) => {
  const partyDetailPage = new PartyDetailPage(t);
  const selectorTpl = partyDetailPage.selectors.feeWaivedText.replace('Index', rowIndex);
  if (isWaived) {
    await expectTextIsEqual(t, { selector: selectorTpl, text: trans('APPLICATION_FEE_WAIVED') });
    return;
  }

  await elementNotExist(t, { selector: selectorTpl });
};

export const checkApplicationFeeIsWaived = async (t, rowIndex) => {
  const isWaived = true;
  await checkApplicationFeeWaiver(t, rowIndex, isWaived);
};

export const checkApplicationFeeIsNotWaived = async (t, rowIndex) => {
  const isNotWaived = false;
  await checkApplicationFeeWaiver(t, rowIndex, isNotWaived);
};

export const validateApplicationFeeWaiver = async (t, contactInfo, isWaived) => {
  const partyDetailPage = new PartyDetailPage(t);
  const { index } = contactInfo;
  await partyDetailPage.checkVisibilityOfSelectorWithIndex(partyDetailPage.selectors.residentRow, index);

  if (isWaived) {
    await checkApplicationFeeIsWaived(t, index);
    return;
  }

  await checkApplicationFeeIsNotWaived(t, index);
};

export const cancelApplicationFeeWaiver = async (t, contactInfo) => {
  const partyDetailPage = new PartyDetailPage(t);
  const isWaived = true;
  await validateWaiveFeeMenuOptions(t, contactInfo, isWaived);
  await clickOnElement(t, { selector: partyDetailPage.selectors.waiveApplicationFeeOption });
};

export const editApplication = async (t, contactInfo) => {
  const partyDetailPage = new PartyDetailPage(t);
  await partyDetailPage.clickOnMemberRowApplicationMenu(contactInfo.index, contactInfo.memberType);
  await clickOnElement(t, { selector: partyDetailPage.selectors.editApplicationOption });
};

const completeAddressHistory = async (t, applicantData) => {
  logger.debug({ applicantData }, 'completeAddressHistory');
  const applicationPage = new ApplicationPage(t);

  await t.typeText(applicationPage.selectors.addressLine1Txt, `${applicantData.addressLine1}`);
  await t.pressKey('tab'); // force a blur to hide the google autocomplete overlay and prevent failure of setting the city
  await t.typeText(applicationPage.selectors.cityTxt, `${applicantData.city}`);
  await setDropdownValues(t, { id: applicationPage.selectors.stateDropdown, values: [`${applicantData.state}`] });
  await t.typeText(applicationPage.selectors.zipCodeTxt, `${applicantData.zipCode}`);
  await clickOnElement(t, { selector: applicationPage.selectors.nextStepBtn });
  await setDropdownValues(t, { id: applicationPage.selectors.rentOrOwnDropdown, values: ['Rent'] });
  await t.typeText(applicationPage.selectors.ownerName, `${applicantData.ownerName}`);
  await clickOnElement(t, { selector: applicationPage.selectors.nextStepBtn });
};

const verifyUploadDocuments = async (t, { fileUploaderId, documents = [], stepName }) => {
  const applicationPage = new ApplicationPage(t);
  for (let i = 0; i < documents.length; i++) {
    await applicationPage.verifyUploadDocument(fileUploaderId, documents[i]);
  }

  const validFiles = documents.filter(it => !!it.removeIconName);
  if (validFiles.length) {
    await reloadURL();
    await expectVisible(t, { selector: applicationPage.selectors.additionalInfoStepper });
    await sleep(600);

    await applicationPage.openAdditionalInfoStep(stepName);
    await sleep(400);

    const node = await $(`${fileUploaderId} [data-component="fileQueueItem"]`);
    await t.expect(node.count).eql(validFiles.length);

    for (let i = 0; i < validFiles.length; i++) {
      await applicationPage.verifyDocumentDataStored(fileUploaderId, validFiles[i]);
    }
  }
};

const completePrivateDocuments = async (t, documents = []) => {
  const applicationPage = new ApplicationPage(t);
  await verifyUploadDocuments(t, {
    fileUploaderId: applicationPage.selectors.privateFileUploader,
    stepName: applicationPage.selectors.privateDocumentsSection,
    documents,
  });

  await clickOnElement(t, { selector: applicationPage.selectors.nextStepBtn });
};

const completeDisclosures = async t => {
  const applicationPage = new ApplicationPage(t);
  await applicationPage.clickOnDisclosureCheckbox(
    0,
    {
      checkboxTitle: 'I have a water bed.',
      checkboxCaption: 'Provide more details about the bed including its size. This may increase your required security deposit.',
      checkboxText: 'King Bed',
    },
    true,
  );
  await applicationPage.clickOnDisclosureCheckbox(1, {
    checkboxTitle: 'I have been convicted of crime.',
    checkboxCaption: 'Provide more details about your personal situation. This will not prohibit you from being approved.',
    checkboxText: '',
  });
  await applicationPage.clickOnDisclosureCheckbox(2, {
    checkboxTitle: 'I have been evicted in the last 5 years.',
    checkboxCaption: 'Provide more details about your personal situation. This will not prohibit you from being approved.',
    checkboxText: '',
  });
  await clickOnElement(t, { selector: applicationPage.selectors.nextStepBtn });
  await applicationPage.verifyCheckedDisclosures(0, { checkboxTitle: 'I have a water bed.', checkboxText: 'King Bed' });
};

export const selectDoNotHaveChild = async t => {
  const applicationPage = new ApplicationPage(t);
  await clickOnElement(t, { selector: applicationPage.selectors.childDoNotHaveCheckbox });
  await clickOnElement(t, { selector: applicationPage.selectors.nextStepBtn });
};

export const selectPetDoNotHave = async t => {
  const applicationPage = new ApplicationPage(t);
  await clickOnElement(t, { selector: applicationPage.selectors.petDoNotHaveCheckbox });
  await clickOnElement(t, { selector: applicationPage.selectors.nextStepBtn });
};

export const selectVehicleDoNotHave = async t => {
  const applicationPage = new ApplicationPage(t);
  await clickOnElement(t, { selector: applicationPage.selectors.vehicleDoNotHaveCheckbox });
  await clickOnElement(t, { selector: applicationPage.selectors.nextStepBtn });
};

const completeSharedDocuments = async (t, documents = [], isResident = true) => {
  const applicationPage = new ApplicationPage(t);
  await verifyUploadDocuments(t, {
    fileUploaderId: applicationPage.selectors.sharedFileUploader,
    stepName: applicationPage.selectors.sharedDocumentsSection,
    documents,
  });

  if (!isResident) {
    // If no Resident then clicks on Done Btn
    await clickOnElement(t, { selector: applicationPage.selectors.doneStepBtn });
    return;
  }

  await clickOnElement(t, { selector: applicationPage.selectors.nextStepBtn });
};

const completeRenterInsurance = async t => {
  const applicationPage = new ApplicationPage(t);
  await clickOnElement(t, { selector: applicationPage.selectors.option1RenterInsuranceCheckbox });
  const doneStepBtn = $(applicationPage.selectors.doneStepBtn);
  await t.setTestSpeed(0.7).hover(doneStepBtn).expect(doneStepBtn.hasAttribute('disabled')).notOk({ timeout: 5000 });
  await clickOnElement(t, { selector: applicationPage.selectors.doneStepBtn });
};

export const completeBasicInfoApplicationPart1 = async (t, applicantData, propertyName, applicationLink) => {
  const contactInfoParts = applicantData.legalName.split(' ');

  if (!applicationLink) {
    const partyDetailPage = new PartyDetailPage(t);
    await partyDetailPage.clickOnMemberRowApplicationMenu(applicantData.index, applicantData.memberType);

    await clickOnElement(t, {
      selector: $(partyDetailPage.selectors.rowApplicationListItems).withText(trans('APPLY_ON_BEHALF_OF', { name: applicantData.legalName, propertyName })),
    });
  } else {
    // Navigate from the application link sent to applicant
    await t.navigateTo(applicationLink);
  }

  const welcomeApplicationPage = new WelcomeApplicationPage(t);

  await welcomeApplicationPage.verifyWelcomeApplicationPageVisible(t);
  await expectTextIsEqual(t, { selector: welcomeApplicationPage.selectors.applicantNameTxt, text: `${applicantData.preferredName}!` });

  await clickOnElement(t, { selector: welcomeApplicationPage.selectors.attestationCheckbox });
  await clickOnElement(t, { selector: welcomeApplicationPage.selectors.continueBtn });

  const applicationPage = new ApplicationPage(t);

  await expectInputIsEqual(t, { selector: applicationPage.selectors.firstNameTxt, text: contactInfoParts[0] });
  await expectInputIsEqual(t, { selector: applicationPage.selectors.lastNameTxt, text: contactInfoParts[1] });
  await t.typeText(applicationPage.selectors.dateOfBirthTxt, `${applicantData.dateOfBirth}`);
  await t.typeText(applicationPage.selectors.grossIncomeTxt, `${applicantData.grossIncome}`);
  await setDropdownValues(t, { id: applicationPage.selectors.incomeFrequencyDropdown, values: ['Monthly'] });
  await t.typeText(applicationPage.selectors.addressLine1Txt, `${applicantData.addressLine1}`);
  await t.pressKey('tab'); // force a blur to hide the google autocomplete overlay and prevent failure of setting the city
  await t.typeText(applicationPage.selectors.cityTxt, `${applicantData.city}`);
  await setDropdownValues(t, { id: applicationPage.selectors.stateDropdown, values: [`${applicantData.state}`] });
  await t.typeText(applicationPage.selectors.zipCodeTxt, `${applicantData.zipCode}`);
  await clickOnElement(t, { selector: applicationPage.selectors.nextStepBtn });
};

export const completeApplicationPart1 = async (t, applicantData, propertyName, applicationLink) => {
  const applicationPage = new ApplicationPage(t);
  await completeBasicInfoApplicationPart1(t, applicantData, propertyName, applicationLink);
  await expectVisible(t, { selector: applicationPage.selectors.doneStepBtn });
  await clickOnElement(t, { selector: applicationPage.selectors.doneStepBtn });
};

const validateRequiredSectionErrorDialog = async (t, hasRequiredSteppers, section) => {
  if (!hasRequiredSteppers) return;
  const applicationPage = new ApplicationPage(t);
  await applicationPage.clickIAmDoneBtn();
  await expectVisible(t, { selector: applicationPage.selectors.incompleteRequiredSectionDialog });
  const requiredSectionErrorMsg = 'This section is incomplete'; // TODO: CPM-15079 this msg needs to be loaded through translations
  const notificationBannerSelectorTpl = `${section} ${applicationPage.selectors.notificationBanner}`;
  await expectTextIsEqual(t, { selector: notificationBannerSelectorTpl, text: requiredSectionErrorMsg });
  await applicationPage.clickOkBtnRequiredSectionDialog();
};

const validateSectionIsFilled = async (t, section, errorMsg) => {
  const applicationPage = new ApplicationPage(t);
  const notificationBannerSelectorTpl = `${section} ${applicationPage.selectors.notificationBanner}`;
  await expectNotPresent(t, { selector: notificationBannerSelectorTpl, text: errorMsg });
};

const validateRequiredApplicationSections = async (t, requiredSteps) => {
  const applicationPage = new ApplicationPage(t);
  const sections = applicationPage.sections;
  const selectors = applicationPage.selectors;
  const requiredSectionErrorMsg = 'This section is incomplete'; // TODO: CPM-15079 this msg needs to be loaded through translations

  await applicationPage.clickIAmDoneBtn();

  await executeSequentially(sections, async section => {
    const isRequiredSection = requiredSteps.some(step => step === section);
    const notificationBannerSelectorTpl = `${section} ${selectors.notificationBanner}`;

    if (isRequiredSection) {
      await expectTextIsEqual(t, { selector: notificationBannerSelectorTpl, text: requiredSectionErrorMsg });
      return;
    }

    await validateSectionIsFilled(t, section, requiredSectionErrorMsg);
  });

  await applicationPage.clickOkBtnRequiredSectionDialog();
};

export const completeApplicationPart2Guarantor = async (t, applicantData) => {
  const applicationPage = new ApplicationPage(t);
  const { incomeSourcesSection } = applicationPage.selectors;
  const isResident = applicantData.memberType === 'Resident';

  await completeAddressHistory(t, applicantData);
  await validateSectionIsFilled(t, incomeSourcesSection);
  await completePrivateDocuments(t, applicantData.privateDocuments);
  await completeSharedDocuments(t, applicantData.sharedDocuments, isResident);
  await applicationPage.clickIAmDoneBtn();
};

export const completeApplicationPart2 = async (t, applicantData, skipSteppers, hasRequiredSteppers = false) => {
  const applicationPage = new ApplicationPage(t);
  const { incomeSourcesSection, childrenSection, petsSection, vehiclesSection, rentersInsuranceSection } = applicationPage.selectors;
  const requiredSteps = [incomeSourcesSection, childrenSection, petsSection, vehiclesSection, rentersInsuranceSection];

  hasRequiredSteppers && (await validateRequiredApplicationSections(t, requiredSteps));

  // TEST-470 & TEST-492
  await validateRequiredSectionErrorDialog(t, hasRequiredSteppers, incomeSourcesSection);
  await completeAddressHistory(t, applicantData);
  await validateSectionIsFilled(t, incomeSourcesSection);

  if (!skipSteppers) {
    await completePrivateDocuments(t, applicantData.privateDocuments);
    await completeDisclosures(t);

    // TEST-489 & TEST-477
    await validateRequiredSectionErrorDialog(t, hasRequiredSteppers, childrenSection);
    await addChildInApplication(t, { fullName: 'Daniel Smith', preferredName: 'Smith' });
    await validateSectionIsFilled(t, childrenSection);

    // TEST-483 & TEST-479
    await validateRequiredSectionErrorDialog(t, hasRequiredSteppers, petsSection);
    await addPetInApplication(t, { name: 'Boby', type: 'Dog', breed: 'Beagle', size: '0-5lbs', sex: '' });
    await validateSectionIsFilled(t, childrenSection);

    // TEST-478 & TEST-490
    await validateRequiredSectionErrorDialog(t, hasRequiredSteppers, vehiclesSection);
    await addVehicleInApplication(t, {
      type: 'Car',
      makeAndModel: 'Toyota Corolla',
      makeYear: '2018',
      color: 'black',
      tagNumber: '00027',
      state: 'Alaska (AK)',
      text: 'Toyota Corolla',
    });
    await validateSectionIsFilled(t, childrenSection);

    await completeSharedDocuments(t, applicantData.sharedDocuments);

    // TEST-169
    await validateRequiredSectionErrorDialog(t, hasRequiredSteppers, rentersInsuranceSection);

    await completeRenterInsurance(t);
    await validateSectionIsFilled(t, rentersInsuranceSection);
  }
  await applicationPage.clickIAmDoneBtn();
};

export const payApplicationFee = async (t, applicantData) => {
  const applicationPage = new ApplicationPage(t);
  await expectVisible(t, { selector: applicationPage.selectors.paymentDialog });
  await t.switchToIframe(applicationPage.selectors.paymentFrame);
  await t.typeText(applicationPage.selectors.fullNameTxt, `${applicantData.cardInfo.name}`);
  await t.typeText(applicationPage.selectors.cardNumberTxt, `${applicantData.cardInfo.number}`);
  await t.typeText(applicationPage.selectors.cvvTxt, `${applicantData.cardInfo.cvv}`);

  const expirationDateSelect = $(applicationPage.selectors.cardExpirationDateDropdown);
  const expirationDateOption = expirationDateSelect.find('option');
  await clickOnElement(t, { selector: applicationPage.selectors.cardExpirationDateDropdown });
  await clickOnElement(t, { selector: $(expirationDateOption).withText(`${applicantData.cardInfo.expirationDate}`), requireVisibility: false });

  const expirationYearSelect = $(applicationPage.selectors.cardExpirationYearDropdown);
  const expirationYearOption = expirationYearSelect.find('option');
  await clickOnElement(t, { selector: applicationPage.selectors.cardExpirationYearDropdown });
  await clickOnElement(t, { selector: $(expirationYearOption).withText(`${applicantData.cardInfo.expirationYear}`), requireVisibility: false });
  await clickOnElement(t, { selector: applicationPage.selectors.reviewPaymentBtn });

  await t.switchToMainWindow();
  // We found that after payment the application page is reloaded,
  // and a navigateTo immediately after might fail silently.
  await t.wait(3000);
};

export const checkCurrentPartyCreationDetails = async (t, property) => {
  const managePartyPage = new ManagePartyPage(t);
  await managePartyPage.checkCurrentAssignedPropertyByValue(property);
};

export const updatePartyCreationDetails = async (t, userInfo, property) => {
  const managePartyPage = new ManagePartyPage(t);
  await setDropdownValues(t, { id: managePartyPage.selectors.assignedPropertyDropdown, values: [property] });
  await setDropdownValues(t, { id: managePartyPage.selectors.teamDropdown, values: [userInfo] });
  await clickOnElement(t, { selector: managePartyPage.selectors.submitAssignedPropertyBtn });
};

export const goToChangePrimaryPropertyOption = async t => {
  const partyDetailPage = new PartyDetailPage(t);
  await clickOnElement(t, { selector: partyDetailPage.selectors.partyCardMenu });
  await clickOnElement(t, { selector: partyDetailPage.selectors.changePropertyMenuItem });
  await expectVisible(t, { selector: partyDetailPage.selectors.propertySelectionDialog });
};

export const validateChangePrimaryPropertySuccessful = async (t, propertyName) => {
  const managePartyPage = new ManagePartyPage(t);
  await goToChangePrimaryPropertyOption(t);
  await checkCurrentPartyCreationDetails(t, propertyName);
  await clickOnElement(t, { selector: managePartyPage.selectors.cancelAssignedPropertyBtn });
};

export const changePrimaryProperty = async (t, userInfo, initialProperty, changedProperty) => {
  await goToChangePrimaryPropertyOption(t);
  await checkCurrentPartyCreationDetails(t, initialProperty);
  await updatePartyCreationDetails(t, userInfo, changedProperty);
};

export const updateQualificationQuestions = async (t, updatedQualificationInfo, saveResults) => {
  const managePartyPage = new ManagePartyPage(t);
  await clickOnElement(t, { selector: managePartyPage.selectors.updateAnswersBtn });
  await selectPartyQualificationQuestions(t, updatedQualificationInfo);
  if (saveResults) {
    await clickOnElement(t, { selector: managePartyPage.selectors.updateQQBtn });
  } else {
    await clickOnElement(t, { selector: managePartyPage.selectors.cancelQQBtn });
  }
};

export const validateQualificationsQuestionsValues = async (t, qualificationInfo) => {
  const managePartyPage = new ManagePartyPage(t);
  if (qualificationInfo.dropdownLeaseType === 'Corporate') {
    await expectTextIsEqual(t, { selector: managePartyPage.selectors.numberOfUnitsTxt, text: qualificationInfo.companyQualificationInfo.numberOfUnits });
    await expectTextIsEqual(t, { selector: managePartyPage.selectors.lengthLeaseTxt, text: qualificationInfo.lengthLeaseTxt });
  } else {
    // Corporates doesn't have this question
    await expectTextIsEqual(t, { selector: managePartyPage.selectors.monthlyIncomeTxt, text: qualificationInfo.incomeQuestion });
  }
  await expectTextIsEqual(t, { selector: managePartyPage.selectors.numberOfBedroomsTxt, text: qualificationInfo.bedrooms });
  await expectTextIsEqual(t, { selector: managePartyPage.selectors.leaseTypeTxt, text: qualificationInfo.dropdownLeaseType });
  await expectTextIsEqual(t, { selector: managePartyPage.selectors.moveInDatePreferenceTxt, text: qualificationInfo.moveInTimeQuestion });
};

export const changePartyType = async (t, changeType) => {
  const managePartyPage = new ManagePartyPage(t);
  await expectVisible(t, { selector: managePartyPage.selectors.changePartyTypeDialog });
  if (changeType) {
    await managePartyPage.clickBtnInDialogByCommand(managePartyPage.selectors.changePartyTypeDialog, managePartyPage.selectors.cancelBtnDialogCommand);
  } else {
    await managePartyPage.clickBtnInDialogByCommand(managePartyPage.selectors.changePartyTypeDialog, managePartyPage.selectors.okBtnDialogCommand);
  }
};

export const waivePartyMember = async (t, contactInfo, userInfo) => {
  const activityLogPage = new ActivityLogPage(t);
  const feeWaiveReason = 'This is a test';
  const isWaived = true;
  await waiveApplicationFee(t, contactInfo, feeWaiveReason);
  await validateApplicationFeeWaiver(t, contactInfo, isWaived);
  const waiveFeeActivityLogDetails = `Application fee waiver issued for ${contactInfo.legalName}. Waiver reason is: ${feeWaiveReason}`;
  await checkActivityLogEntryByIndex(t, { userInfo, action: 'new', component: 'application (#1)', details: waiveFeeActivityLogDetails });
  await activityLogPage.closeActivityLog();
};

export const cancelWaive = async (t, contactInfo, userInfo) => {
  const activityLogPage = new ActivityLogPage(t);
  const isWaived = false;
  await cancelApplicationFeeWaiver(t, contactInfo);
  await validateApplicationFeeWaiver(t, contactInfo, isWaived);
  const cancelWaiveFeeActivityLogDetails = `Application fee waiver revoked for ${contactInfo.legalName}`;
  await checkActivityLogEntryByIndex(t, { userInfo, action: 'remove', component: 'application (#1)', details: cancelWaiveFeeActivityLogDetails });
  await activityLogPage.closeActivityLog();
};

const checkFeesName = async t => {
  const applicationPage = new ApplicationPage(t);
  await expectTextIsEqual(t, { selector: applicationPage.selectors.feeName1, text: 'Application fee' });
  await expectTextIsEqual(t, { selector: applicationPage.selectors.feeName2, text: 'Application fee waiver' });
};

const checkFeesAmount = async (t, { feeAmount, feeWaivedAmount }) => {
  const applicationPage = new ApplicationPage(t);
  await expectTextIsEqual(t, { selector: applicationPage.selectors.feeAmount1, text: feeAmount });
  await expectTextIsEqual(t, { selector: applicationPage.selectors.feeAmount2, text: feeWaivedAmount });
};

export const checkApplicationFeesToPay = async t => {
  const feeAmount = '$50';
  const feeWaivedAmount = '-$50';
  await checkFeesName(t);
  await checkFeesAmount(t, { feeAmount, feeWaivedAmount });
};

export const checkContinueButton = async t => {
  const applicationPage = new ApplicationPage(t);
  await expectTextIsEqual(t, { selector: applicationPage.selectors.doneStepBtn, text: 'Continue' });
  await clickOnElement(t, { selector: applicationPage.selectors.doneStepBtn });

  await expectTextIsEqual(t, {
    selector: applicationPage.selectors.accountMessage,
    text:
      'Your account has been created and an email with a link to complete your registration was sent.  Once registered, you can continue your application at any time.',
  });
};

export const makePaymentForAPartyMemberWaived = async (t, propertyName, applicantData) => {
  const location = await getPathName();
  await completeBasicInfoApplicationPart1(t, applicantData, propertyName);
  await checkApplicationFeesToPay(t);
  await checkContinueButton(t);
  await t.navigateTo(`${getTenantURL('')}${location}`);
};

export const checkTransactionsPayments = async (t, { feeAmount, feeWaivedAmount }) => {
  const partyDetailPage = new PartyDetailPage(t);
  await expectTextIsEqual(t, { selector: partyDetailPage.selectors.transactionAmount1, text: feeAmount });
  await expectTextIsEqual(t, { selector: partyDetailPage.selectors.transactionAmount2, text: feeWaivedAmount });
};

export const backToDashboard = async t => {
  const partyDetailPage = new PartyDetailPage(t);
  await clickOnElement(t, { selector: partyDetailPage.selectors.navigateBackBtn });
};

export const logOut = async t => {
  await clickOnElement(t, { selector: '#side-nav' });
  await clickOnElement(t, { selector: '#logout' });
};

export const verifyPublishedQuoteConcessions = async (t, { concessions, total }) => {
  const publishedQuotePage = new PublishedQuotePage(t);
  await executeSequentially(concessions, ({ name, amount }) => publishedQuotePage.checkConcession(name, amount));
  await expectTextIsEqual(t, { selector: publishedQuotePage.selectors.concessionsTotal, text: total });
};

export const verifyPublishedQuoteFees = async (t, { fees, total }) => {
  const publishedQuotePage = new PublishedQuotePage(t);
  await executeSequentially(fees, ({ name, amount }) => publishedQuotePage.checkQuoteFee(name, amount));
  await expectTextIsEqual(t, { selector: publishedQuotePage.selectors.feesTotal, text: total });
};

const findCommByEmail = (emailIdentifier, comms) => comms.find(c => c.message.to[0].includes(emailIdentifier));

export const getApplicationLinkForUser = (emailIdentifier, comms = []) => {
  const comm = findCommByEmail(emailIdentifier, comms);

  const {
    message: { html },
  } = comm;

  const [link] = html.match(APP_LINK) || [];

  return (link || '').replace(/"/g, '');
};

export const checkRentWithMinAmountLimit = async (t, quoteInfo) => {
  const leaseFormPage = new LeaseFormPage(t);
  const leaseApplicationPage = new LeaseApplicationPage(t);
  const baseRentLeaseTermEditorSelector = leaseFormPage.selectors.baseRentLeaseTermEditor.replace('Index', quoteInfo.quote.termLength);
  const baseRentLeaseTermInputSelector = leaseFormPage.selectors.baseRentLeaseTermInput.replace('Index', quoteInfo.quote.termLength);

  await clickOnElement(t, { selector: baseRentLeaseTermEditorSelector });
  await clearTextElement(t, { selector: baseRentLeaseTermInputSelector });
  await t.typeText(baseRentLeaseTermInputSelector, '500');
  await expectVisible(t, { selector: $('div').withText(trans('THIS_AMOUNT_LOWER_THAN_MIN_LIMIT')) });

  await clickOnElement(t, { selector: leaseApplicationPage.selectors.flyoutDialogDoneBtn });
  await expectVisible(t, { selector: $(baseRentLeaseTermEditorSelector).withText(quoteInfo.displayedBaseRent) });

  await clickOnElement(t, { selector: baseRentLeaseTermEditorSelector });
  await clearTextElement(t, { selector: baseRentLeaseTermInputSelector });
  await t.typeText(baseRentLeaseTermInputSelector, '1500');
  await clickOnElement(t, { selector: leaseApplicationPage.selectors.flyoutDialogDoneBtn });
  await expectVisible(t, { selector: $(baseRentLeaseTermEditorSelector).withText('$1,500') });
};

export const checkConcessionWithMaxAmountLimit = async t => {
  const leaseApplicationPage = new LeaseApplicationPage(t);
  const quoteDraftPage = new QuoteDraftPage(t);
  const specialOneTimeConcessionAmount = quoteDraftPage.selectors.specialOneTimeConcessionAmount;
  const specialOneTimeConcessionAmountEditor = quoteDraftPage.selectors.specialOneTimeConcessionAmountEditor;

  await clickOnElement(t, { selector: specialOneTimeConcessionAmount });
  await clearTextElement(t, { selector: specialOneTimeConcessionAmountEditor });
  await t.typeText(specialOneTimeConcessionAmountEditor, '600');
  await expectVisible(t, { selector: $('div').withText(trans('THIS_AMOUNT_EXCEEDS_THE_MAX_LIMIT')) });

  await clickOnElement(t, { selector: leaseApplicationPage.selectors.flyoutDialogDoneBtn });
  await expectVisible(t, { selector: $(specialOneTimeConcessionAmount).withText('$500.00') });
  await expectCheckboxState(t, { selector: '#concessionspecialOneTimeIncentive_checkBox', selected: false });

  await clickOnElement(t, { selector: specialOneTimeConcessionAmount });
  await clearTextElement(t, { selector: specialOneTimeConcessionAmountEditor });
  await t.typeText(specialOneTimeConcessionAmountEditor, '300');

  await clickOnElement(t, { selector: leaseApplicationPage.selectors.flyoutDialogDoneBtn });
  await expectVisible(t, { selector: $(specialOneTimeConcessionAmount).withText('$300.00') });
  await expectCheckboxState(t, { selector: '#concessionspecialOneTimeIncentive_checkBox', selected: true });
};

export const checkAppointmentTourTypesAvailable = async t => {
  const partyDetailPage = new PartyDetailPage(t);

  // open appointment editor
  await clickOnElement(t, { selector: partyDetailPage.selectors.appointmentRowCardMenu });
  await clickOnElement(t, { selector: partyDetailPage.selectors.appointmentRowCardMenuEdit });

  // verify IMPORTED_TOUR is the selected tourType
  await expectTextIsEqual(t, { selector: partyDetailPage.selectors.scheduleAppointmentTourTypeSelectedText, text: trans('IMPORTED_TOUR') });

  // change the selected tourType to VIRTUAL_TOUR
  await setDropdownValues(t, { id: partyDetailPage.selectors.scheduleAppointmentTourTypeDropdown, values: [trans('VIRTUAL_TOUR')] });
  await clickOnElement(t, { selector: `${partyDetailPage.selectors.scheduleAppointmentDialog} #done` });

  // open appointment editor
  await clickOnElement(t, { selector: partyDetailPage.selectors.appointmentRowCardMenu });
  await clickOnElement(t, { selector: partyDetailPage.selectors.appointmentRowCardMenuEdit });

  // verify VIRTUAL_TOUR is the selected tourType
  await expectTextIsEqual(t, { selector: partyDetailPage.selectors.scheduleAppointmentTourTypeSelectedText, text: trans('VIRTUAL_TOUR') });

  // check if IMPORTED_TOUR is not available anymore
  await clickOnElement(t, { selector: `#${partyDetailPage.selectors.scheduleAppointmentTourTypeDropdown}` });
  const tourTypesAvailableInDropdown = $(partyDetailPage.selectors.scheduleAppointmentTourTypeDropdownItems);
  const count = await tourTypesAvailableInDropdown.count;

  for (let i = 0; i < count; i++) {
    await expectTextIsNotEqual(t, { selector: tourTypesAvailableInDropdown.nth(i), text: trans('IMPORTED_TOUR') });
  }
};

export const cannotMergePersonsDialogIsDisplayed = async t => {
  await withRetries(
    t,
    async () => {
      const personCardDialog = new PersonCardPage(t);
      const partyDetailPage = new PartyDetailPage(t);
      await clickOnElement(t, { selector: personCardDialog.selectors.samePersonYesBtn });
      await expectVisible(t, { selector: partyDetailPage.selectors.mergePersonsDialog });
      await clickOnElement(t, { selector: partyDetailPage.selectors.mergePersonsBtn, requireVisibility: true });
    },
    { fnName: 'mergePersons', delayBetweenRetries: 500, maxAttempts: 20 },
  );
  const basePage = new BasePage(t);
  await expectVisible(t, { selector: `${basePage.selectors.dialogOverlay} ${basePage.selectors.title}`, text: trans('MERGE_ERROR_TITLE') });
  await expectVisible(t, { selector: `${basePage.selectors.dialogOverlay} ${basePage.selectors.text}`, text: trans('MERGE_ERROR_EXISTING_APPLICATIONS_TEXT') });
  await expectVisible(t, { selector: `${basePage.selectors.dialogOverlay} ${basePage.selectors.okBtn}` });
  await clickOnElement(t, { selector: `${basePage.selectors.dialogOverlay} ${basePage.selectors.okBtn}` });
};

export const cancelTask = async t => {
  const partyDetailPage = new PartyDetailPage(t);
  const basePage = new BasePage(t);
  await clickOnElement(t, { selector: partyDetailPage.selectors.taskRowCardMenu });
  await clickOnElement(t, { selector: partyDetailPage.selectors.taskRowCardMenuCancel });
  await clickOnElement(t, { selector: `${basePage.selectors.dialogOverlay} ${basePage.selectors.dataActionOkBtn}` });
};
