/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Selector as $ } from 'testcafe';
import { mapSeries } from 'bluebird';
import { expectVisible, replaceBlankSpaceWithCharacter, clickOnElement } from '../helpers/helpers';

export default class PartyPhaseOne {
  constructor(t) {
    this.t = t;
    this.selectors = {
      personCardComponent: '_PersonCard',
      webInquiryCommCard: '[data-id="webThread"]',
      message: '[data-id="webThreadMessageLabel"]',
      messageMoveInDate: '[data-id="webThreadMessageLabel"]',
      messageContent: '[data-id="webThreadMessageBody"]',
      messageHeaderLabel: '[data-id="webThreadMessageHeader"] > div > span',
      closeFlyoutButton: '#webThreadFlyout #close',
      navigateBack: '#navigateBack',
      webInquiryFlyout: '#webThreadFlyout',
      toDoSection: '[data-id="todoSection"] button span',
      taskRow: '[data-id="appointment-row"]',
      taskDetails: '[data-id="appointment-row"] [data-id="task_taskType"]',
      taskDetailsSection: '[class^="taskDetails"]',
      taskStatusDetails: '[data-id="appointment-row"] section',
      contactPartyDeclineDecisionTask: '[data-id^="task_CONTACT_PARTY_DECLINE_DECISION"]',
      appointmentCard: '[data-id="appointment-card"]',
      appointmentTitle: '[data-id="appointment-card"] div p',
      appointementGuestName: '[data-id="appointment-card"] span',
      appointementUnit: '[data-id="appointment-card"] [data-id="units"]',
      ScheduleATourButton: '[data-id="emptyStateContainer"] button span',
      TaskOwner: '[data-id="appointment-row"] [data-id="taskOwnerName"]',
      ChevronDown: '#leads [data-id="card"] [name="chevron-down"]',
      TaskSection: '#leads [data-id="card"] p',
      appointmenstSectionButton: '[class^=display-appointments-action] [data-component="button"]',
      partySummarySectionCard: '[data-id="partySummarySection"]',
      smsButton: '[data-id="appBar"] g[id="message-text"]',
      emailButton: '[data-id="appBar"] g[id="email"]',
      dropDown: '[data-component="dropdown"]',
      chip: '[data-component="chip"]',
    };

    this.WebInquirySelectors = {
      webAvatarBadge: '[data-id="webThread"] [data-part="badge"] g[id="web"]',
      campaignName: '[data-id="webThread"] p[data-component="subheader"]',
      webInquiryPerson: '[data-id="webThread"] p[data-component="caption"]',
      webInquiryMessage: '[data-id="webThread"] p',
    };

    this.SmsSelectors = {
      smsAvatarBadge: '#smsThread_Index [data-part="badge"] g[id="message-text"]',
      smsRecipient: '#smsThread_Index [data-component="subheader"]',
      smsText: '#smsThread_Index [data-id="smsText"]',
      smsFlyout: '#flyoutContainer div:nth-child(index) #smsFlyOut',
      toInputBox: '[placeholder="To"]',
      toDropDownItem: '[data-component="flyout-content"] [data-component="list-item"]',
      smsToSend: '#smsToSend',
      sendSmsButton: '#sendSms',
      smsFlyoutSelector: '#smsFlyOut',
    };

    this.EmailSelectors = {
      emailAvatarBadge: '#emailThreadCard_Index [data-part="badge"] g[id="email"]',
      emailSubject: '[data-id="emailThreadSubject_Index"] p',
      emailRecipient: '#emailThreadCard_Index [data-component="caption"] span',
      emailFlyout: '#flyoutContainer div:nth-child(index) #emailFlyout',
      emailFlyoutWithTitle: '#flyoutContainer div [data-id="email-title"]',
      subject: '#emailSubject',
      body: '#emailBody',
      editorIframe: '.fr-iframe',
      editorIframeContent: '[contenteditable="true"]',
      sendEmailButton: '#sendEmail',
    };

    this.AppointementSelectors = {
      guests: '[data-id="guests"]',
      notes: '[data-id="apptNotes"]',
      units: '[data-id="units"]',
    };
  }

  getCommonPersonCardByName = name => `[data-id="${replaceBlankSpaceWithCharacter(name, '')}${this.selectors.personCardComponent}"]`;

  checkPartyMember = async memberName => await expectVisible(this.t, { selector: $(this.getCommonPersonCardByName(memberName)) });

  clickOnWebInqury = async () => await clickOnElement(this.t, { selector: this.selectors.webInquiryCommCard });

  checkInquiryMessageHeaderLabel = async expectedText => await expectVisible(this.t, { selector: this.selectors.messageHeaderLabel, text: expectedText });

  checkInquiryMessageMoveInDate = async expectedText => await expectVisible(this.t, { selector: this.selectors.messageMoveInDate, text: expectedText });

  checkInquiryMessageContent = async expectedText => await expectVisible(this.t, { selector: this.selectors.messageContent, text: expectedText });

  checkWebInquiryStructure = async (inquiry, messageSection = false) => {
    const { t } = this;
    await expectVisible(t, { selector: this.selectors.webInquiryCommCard });
    await expectVisible(t, { selector: this.WebInquirySelectors.webAvatarBadge });
    await expectVisible(t, { selector: this.WebInquirySelectors.campaignName, text: inquiry.campaignType });
    await expectVisible(t, { selector: this.WebInquirySelectors.webInquiryPerson, text: inquiry.senderName });

    if (messageSection) await expectVisible(t, { selector: this.WebInquirySelectors.webInquiryMessage, text: inquiry.messageSection });
  };

  checkInquiryMessageHeader = async expectedText => await expectVisible(this.t, { selector: this.selectors.webInquiryFlyout, text: expectedText });

  closeFlyout = async () => await clickOnElement(this.t, { selector: this.selectors.closeFlyoutButton });

  checkSmsStructure = async (smsContent, name, threadIndex = 1) => {
    const { t } = this;
    await expectVisible(t, { selector: $(this.SmsSelectors.smsAvatarBadge.replace('Index', threadIndex)) });
    await expectVisible(t, { selector: $(this.SmsSelectors.smsRecipient.replace('Index', threadIndex)).withText(`To: ${name}`) });
    const smsSelector = this.SmsSelectors.smsText.replace('Index', threadIndex);
    await t.expect(await $(smsSelector).smsContent).eql();
  };

  checkEmailStructure = async (emailSubject, name, threadIndex = 0) => {
    const { t } = this;
    await expectVisible(t, { selector: $(this.EmailSelectors.emailAvatarBadge.replace('Index', threadIndex)) });
    await expectVisible(t, { selector: $(this.EmailSelectors.emailSubject.replace('Index', threadIndex)).withText(emailSubject) });
    const emailRecipient = this.EmailSelectors.emailRecipient.replace('Index', threadIndex);
    await expectVisible(t, {
      selector: $(emailRecipient).nth(0).withText('To: '),
    });
    await expectVisible(t, {
      selector: $(emailRecipient).nth(1).withText(name),
    });
  };

  clickOnBackButton = async () => await clickOnElement(this.t, { selector: this.selectors.navigateBack });

  clickOnShowCompletedTaskButton = async () => await clickOnElement(this.t, { selector: $(this.selectors.toDoSection).withText('SHOW COMPLETED TASKS') });

  checkExpectedTasks = async expectedTasks => {
    const { t } = this;
    await expectVisible(t, { selector: this.selectors.taskRow });
    const taskDetailsSelector = expectedTasks.isAnonymousTask
      ? this.selectors.taskDetails.replace('taskType', 'REMOVE_ANONYMOUS_EMAIL_1')
      : this.selectors.taskDetails.replace('taskType', 'APPOINTMENT_0');
    await t.expect(await $(this.selectors.taskStatusDetails).withAttribute('name', expectedTasks.status).exists).ok();
    await expectVisible(t, { selector: taskDetailsSelector, text: expectedTasks.name });
    await expectVisible(t, { selector: `${this.selectors.taskRow} p`, text: expectedTasks.details });
  };

  checkExpectedAppointmentCards = async ({ expectedAppointment, unit }) => {
    const { t } = this;
    await expectVisible(t, { selector: this.selectors.appointmentCard });
    await expectVisible(t, { selector: this.selectors.appointmentTitle, text: expectedAppointment.title });
    await expectVisible(t, { selector: this.selectors.appointementGuestName, text: expectedAppointment.legalName.substring(0, 10) });

    if (unit) await expectVisible(t, { selector: this.selectors.appointementUnit, text: expectedAppointment.unit });
  };

  checkWebInquiryNotificationUnread = async partyCardSelector => await expectVisible(this.t, { selector: partyCardSelector, text: 'Self book appointment' });

  checkDownsideArrow = async partyCardSelector => {
    const downArrow = partyCardSelector.find(this.selectors.ChevronDown);
    return await expectVisible(this.t, { selector: downArrow });
  };

  clickOnDownsideArrow = async partyCardSelector => {
    const downArrow = partyCardSelector.find(this.selectors.ChevronDown);
    return await clickOnElement(this.t, { selector: downArrow });
  };

  checkTaskSection = async date => await expectVisible(this.t, { selector: this.selectors.TaskSection, text: `${date}` });

  extractTaskOwner = async () => $(this.selectors.TaskOwner).textContent;

  moreChecksOnPartySummarySection = async expectedData => {
    const { t } = this;
    await expectVisible(t, { selector: this.selectors.partySummarySectionCard, text: expectedData.layout });
    await expectVisible(t, { selector: this.selectors.partySummarySectionCard, text: expectedData.moveInDate });
  };

  writeAMessage = async (messageMockData, option = { sendMessage: false }) => {
    const { t } = this;
    if (messageMockData.isSms) {
      await clickOnElement(t, { selector: this.selectors.smsButton });
      const smsFlyoutSelector = this.SmsSelectors.smsFlyout.replace('index', messageMockData.index);
      await expectVisible(t, { selector: smsFlyoutSelector });
      await clickOnElement(t, { selector: `${smsFlyoutSelector} ${this.SmsSelectors.toInputBox}` });
      await clickOnElement(t, {
        selector: $(`${smsFlyoutSelector} ${this.SmsSelectors.toDropDownItem}`).withText(messageMockData.residentName),
      });
      await clickOnElement(t, { selector: `${smsFlyoutSelector} ${this.SmsSelectors.smsToSend}` });
      await this.t.typeText(`${smsFlyoutSelector} ${this.SmsSelectors.smsToSend}`, messageMockData.text, { paste: true });
      option.sendMessage && (await clickOnElement(t, { selector: `${smsFlyoutSelector} ${this.SmsSelectors.sendSmsButton}` }));
    } else {
      await clickOnElement(t, { selector: this.selectors.emailButton });
      const emailFlyoutSelector = this.EmailSelectors.emailFlyout.replace('index', messageMockData.index);
      await expectVisible(t, { selector: emailFlyoutSelector });
      await clickOnElement(t, { selector: `${emailFlyoutSelector} ${this.selectors.dropDown}` });
      await mapSeries(messageMockData.residentNotSend, async element => {
        const recipientRow = $(`${emailFlyoutSelector} ${this.selectors.chip}`).withText(element).find('#close-circle').with({ boundTestRun: t });
        await clickOnElement(t, { selector: recipientRow });
      });
      await clickOnElement(t, { selector: `${emailFlyoutSelector} ${this.EmailSelectors.subject}` });
      await this.t.typeText(`${emailFlyoutSelector}  ${this.EmailSelectors.subject}`, messageMockData.subject, { paste: true });
      await t.switchToIframe(`${emailFlyoutSelector} ${this.EmailSelectors.body} ${this.EmailSelectors.editorIframe}`);
      await clickOnElement(t, { selector: `${this.EmailSelectors.editorIframeContent}` });
      await this.t.typeText(`${this.EmailSelectors.editorIframeContent}`, messageMockData.text, { replace: true, offsetX: 0 });
      await t.switchToMainWindow();
      option.sendMessage && (await clickOnElement(t, { selector: `${emailFlyoutSelector} ${this.EmailSelectors.sendEmailButton}` }));
    }
  };

  checkDraftMessageIsSaved = async messageMockData => {
    const { t } = this;
    if (messageMockData.isSms) {
      const smsFlyoutSelector = await $(this.SmsSelectors.smsFlyoutSelector).withText(messageMockData.residentName).with({ boundTestRun: t });
      await expectVisible(t, { selector: smsFlyoutSelector });
      await t.expect(await $(smsFlyoutSelector).find(this.SmsSelectors.smsToSend).value).eql(messageMockData.text);
    } else {
      const emailFlyoutSelector = this.EmailSelectors.emailFlyoutWithTitle.replace('title', messageMockData.subject);
      await expectVisible(t, { selector: emailFlyoutSelector });
      await clickOnElement(t, { selector: `${emailFlyoutSelector} ${this.selectors.dropDown}` });
      await expectVisible(t, { selector: `${emailFlyoutSelector} ${this.selectors.chip}`, text: messageMockData.residentName });
      await t.switchToIframe(`${emailFlyoutSelector} ${this.EmailSelectors.body} ${this.EmailSelectors.editorIframe}`);
      await clickOnElement(t, { selector: `${this.EmailSelectors.editorIframeContent}` });
      await t.switchToMainWindow();
      await clickOnElement(t, { selector: `${emailFlyoutSelector} ${this.EmailSelectors.subject}` });
      await t.expect(await $(`${emailFlyoutSelector} ${this.EmailSelectors.subject}`).value).eql(messageMockData.subject);
      await t.switchToIframe(`${emailFlyoutSelector} ${this.EmailSelectors.body} ${this.EmailSelectors.editorIframe}`);
      await clickOnElement(t, { selector: `${this.EmailSelectors.editorIframeContent}`, text: messageMockData.text });
      await t.switchToMainWindow();
    }
  };
}
