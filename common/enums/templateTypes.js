/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const TemplateTypes = {
  EMAIL: 'email',
  SMS: 'sms',
};

export const TemplateNames = {
  AGENT_TO_RESIDENT_QUOTE_TEMPLATE: 'application-a2r-invite-quote',
  RESIDENT_TO_GUARANTOR_QUOTE_TEMPLATE: 'application-r2g-invite-quote',
  RESIDENT_TO_RESIDENT_QUOTE_TEMPLATE: 'application-r2r-invite-quote',
  OCCUPANT_TO_RESIDENT_QUOTE_TEMPLATE: 'application-o2r-invite-quote',
  AGENT_TO_RESIDENT_APPLICATION_INVITE_TEMPLATE: 'application-a2r-invite-noquote',
  RESIDENT_TO_RESIDENT_APPLICATION_INVITE_TEMPLATE: 'application-r2r-invite-noquote',
  RESIDENT_TO_GUARANTOR_APPLICATION_INVITE_TEMPLATE: 'application-r2g-invite-noquote',
  SELF_APPLICATION_INVITE_TEMPLATE: 'application-self-invite-noquote',
  AGENT_TO_RESIDENT_RENEWAL_LETTER_TEMPLATE: 'renewal-a2r-summary-quote',
  RXP_RESIDENT_FORGOT_PASSWORD: 'rxp-resident-forgot-password',
  RXP_RESIDENT_PASSWORD_RESET_CONFIRMATION: 'rxp-resident-password-reset-confirmation',
  RXP_RESIDENT_FORGOT_PASSWORD_FOR_NO_CURRENT_USER: 'rxp-resident-forgot-password-for-no-current-user',
};

export const TemplateSections = {
  VIRTUAL_TOUR: 'virtualTour',
  IN_PERSON_TOUR: 'inPersonTour',
  IN_PERSON_SELF_GUIDED_TOUR: 'inPersonSelfGuidedTour',
  LEASING_APPOINTMENT: 'leasingAppointment',
  NOTIFICATION: 'notification',
  CONSUMER_ACCOUNT: 'consumerAccount',
  QUOTE: 'quote',
  SCREENING: 'screening',
};

export const TemplateActions = {
  CREATED_TEMPLATE: 'createdTemplate',
  CANCELLED_TEMPLATE: 'cancelledTemplate',
  UPDATED_TEMPLATE: 'updatedTemplate',
  CREATED_TEMPLATE_WITH_EDIT_LINK: 'createdTemplateWithEditLink',
  UPDATED_TEMPLATE_WITH_EDIT_LINK: 'updatedTemplateWithEditLink',
  RXP_ANNOUNCEMENT: 'rxpAnnouncement',
  RXP_ALERT: 'rxpAlert',
  RXP_DIRECT_MESSAGE: 'rxpDirectMessage',
  NEW_RESIDENT_REGISTRATION: 'newResidentRegistration',
  REGISTRATION_CONFIRMATION: 'registrationConfirmation',
  RESIDENT_INVITATION: 'residentInvitation',
  CHANGE_PASSWORD: 'changePassword',
  CHANGE_PASSWORD_CONFIRMATION: 'changePasswordConfirmation',
  RENEWAL_LETTER: 'renewalLetter',
  DECLINE_AA_LETTER: 'declineAALetter',
};
