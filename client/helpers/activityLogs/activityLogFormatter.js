/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import mapKeys from 'lodash/mapKeys';
import omitBy from 'lodash/omitBy';
import lowerCase from 'lodash/lowerCase';
import { t } from 'i18next';
import { ACTIVITY_TYPES, COMPONENT_TYPES, SUB_COMPONENT_TYPES } from '../../../common/enums/activityLogTypes';
import { ACTIVITY_LOG_SYMBOLS as ALS, HIDDEN_FIELD_SUFFIX } from './activityLogSymbols';
import { DALTypes } from '../../../common/enums/DALTypes';
import { toSentenceCase } from '../capitalize';
import { formatPhoneNumber } from '../strings';
import { getDisplayName } from '../../../common/helpers/person-helper';
import { termText } from '../quoteTextHelpers';
import { hasOwnProp } from '../../../common/helpers/objUtils';
import { findLocalTimezone, toMoment, formatMoment } from '../../../common/helpers/moment-utils';
import { formatTimestamp } from '../../../common/helpers/date-utils';
import { YEAR_MONTH_DAY_FORMAT, SHORT_DATE_12H_FORMAT } from '../../../common/date-constants';
import { isValidPhoneNumber } from '../../../common/helpers/phone/phone-helper';
import { isObject } from '../../../common/helpers/type-of';

const isFieldHidden = field => field.includes(HIDDEN_FIELD_SUFFIX);

const printOrder = [
  ALS.MOVEOUT_NOTICE_SERVED_BY,
  ALS.AT_DATE,
  ALS.VACATE_DATE,
  ALS.ACTION,
  ALS.RENEWAL_LETTER_FOR_UNIT,
  ALS.QUOTE,
  ALS.QUOTE_ID,
  ALS.QUOTED_UNIT,
  ALS.LEASE_ID,
  ALS.LEASED_UNIT,
  ALS.LEASE_START,
  ALS.LEASE_TERMS,
  ALS.GUESTS,
  ALS.NAME,
  ALS.PREFERRED_NAME,
  ALS.UNITS,
  ALS.LEASING_AGENT,
  ALS.DATE,
  ALS.FROM,
  ALS.FROM_NUMBER,
  ALS.TO,
  ALS.TO_NUMBER,
  ALS.RING_DURATION,
  ALS.DURATION,
  ALS.STATUS,
  ALS.TYPE,
  ALS.PHONES,
  ALS.EMAIL,
  ALS.EXISTING_QUOTE,
  ALS.EXPIRATION_DATE,
  ALS.SELECTIONS,
  ALS.CONFIRMATION_NUMBER,
  ALS.RECORDING_TYPE,
  ALS.LENGTH,
  ALS.PRIMARY_AGENT,
  ALS.PREVIOUS_PRIMARY_AGENT,
  ALS.STATE,
  ALS.CLOSE_REASON,
  ALS.ARCHIVE_REASON,
  ALS.TASK_NAME,
  ALS.ASSIGNEE,
  ALS.APPROVER,
  ALS.UNIT,
  ALS.LEASE_TERM,
  ALS.DEPOSIT,
  ALS.PAYMENT_METHOD,
  ALS.PARTICIPANTS,
  ALS.NOTES,
  ALS.CLOSING_NOTES,
  ALS.ON_BEHALF_OF,
  ALS.SCORE,
  ALS.FIRST_CHANNEL,
  ALS.APPOINTMENT_RESULT,
  ALS.BY,
  ALS.BASE_RENT,
  ALS.FOR,
  ALS.LEASE_EDITS,
  ALS.HELD,
  ALS.MEMBER_NAME,
  ALS.WAIVER_REASON,
  ALS.PERSON_MERGE_TARGET,
  ALS.PERSON_MERGE_SOURCE,
  ALS.PARTIES_MERGE_FIRST_PARTY_MEMBERS,
  ALS.PARTIES_MERGE_SECOND_PARTY_MEMBERS,
  ALS.PARTIES_MERGE_PARTY_OWNER,
  ALS.CREATED_BY,
  ALS.PARTY_OWNER,
  ALS.OWNER_TEAM,
  ALS.COMPLETED_BY,
  ALS.REOPENED_BY,
  ALS.PRIMARY_PROPERTY,
  ALS.PARTY_SOURCE,
  ALS.PARTY_SOURCE_TYPE,
  ALS.PARTY_PROGRAM,
  ALS.PARTY_PROGRAM_PATH,
  ALS.CAMPAIGN,
  ALS.INVENTORY_SHORTHAND,
  ALS.CHANGED_BY,
  ALS.DAYS_RESERVED,
  ALS.APPLICATION_STATUS,
  ALS.SCREENING_STATUS,
  ALS.REASON,
  ALS.DECLINED_BY,
  ALS.CONFIRMED_BY,
  ALS.PREVIOUS_APP_STATUS,
  ALS.RESIDENTS,
  ALS.GUARANTORS,
  ALS.SSN_SET_FOR,
  ALS.SSN_ENABLED_FOR,
  ALS.PRIMARY_PROPERTY_UPDATED,
  ALS.INACTIVE_USER,
  ALS.DEACTIVATED_IN_TEAM,
  ALS.SUBJECT,
  ALS.LEASE_STATUS,
  ALS.DOWNLOAD_STATUS,
  ALS.NEW_LEASE_END_DATE,
  ALS.PROGRAM_DISPLAY_NAME,
];

const appointmentKeyMapNew = {
  partyMembers: ALS.GUESTS,
  unitNames: ALS.UNITS,
  note: ALS.NOTES,
  salesPerson: ALS.LEASING_AGENT,
  startDate: ALS.DATE,
  endDate: ALS.END_DATE,
  partyOwner: ALS.PARTY_OWNER,
  createdBy: ALS.CREATED_BY,
  closingNote: ALS.CLOSING_NOTES,
};

const appointmentKeyMapUpdate = {
  ...appointmentKeyMapNew,
  isComplete: ALS.STATUS,
  appointmentResult: ALS.APPOINTMENT_RESULT,
  completedBy: ALS.COMPLETED_BY,
  reopenedBy: ALS.REOPENED_BY,
};

const appointmentKeyMapDecline = {
  declinedBy: ALS.DECLINED_BY,
};
const appointmentKeyMapConfirm = {
  confirmedBy: ALS.CONFIRMED_BY,
};

const guestKeyMap = {
  fullName: ALS.NAME,
  preferredName: ALS.PREFERRED_NAME,
  memberType: ALS.TYPE,
  contactInfo: ALS.CONTACT_INFO,
};

const quoteKeyMapNew = {
  unitShortHand: ALS.QUOTED_UNIT,
  leaseStartDate: ALS.LEASE_START,
  selectedLeaseTermsLength: ALS.LEASE_TERMS,
  notes: ALS.NOTES,
};

const renewalLetterKeyMapNew = {
  ...quoteKeyMapNew,
  unitShortHand: ALS.RENEWAL_LETTER_FOR_UNIT,
};

const quoteKeyMapUpdate = {
  unitShortHand: ALS.QUOTED_UNIT,
  selectedLeaseTermsLength: ALS.LEASE_TERMS,
  notes: ALS.NOTES,
  leaseTerm: ALS.LEASE_TERM,
  applicationStatus: ALS.APPLICATION_STATUS,
  screeningStatus: ALS.SCREENING_STATUS,
};

const quoteKeyMapUpdatedFields = {
  leaseStartDate: ALS.LEASE_START,
  expirationDate: ALS.EXPIRATION_DATE,
  confirmationNumber: ALS.CONFIRMATION_NUMBER,
  selectedLeaseTermsLength: ALS.LEASE_TERMS,
  overwrittenBaseRent: ALS.BASE_RENT,
  termLength: ALS.FOR,
};

const quoteKeyHardcodedValues = {
  selectedAdditionalAndOneTimeCharges: ALS.RECURRING_AND_OR_ONE_TIME_CHARGES_EDITED,
};

const quoteKeyMap = {
  id: ALS.QUOTE,
  unitShortHand: ALS.QUOTED_UNIT,
  notes: ALS.NOTES,
};

const renewalLetterKeyMap = {
  unitShortHand: ALS.RENEWAL_LETTER_FOR_UNIT,
  id: ALS.QUOTE_ID,
};

const quoteKeyMapDuplicate = {
  id: ALS.QUOTE,
  existingQuoteId: ALS.EXISTING_QUOTE,
  unitShortHand: ALS.QUOTED_UNIT,
  notes: ALS.NOTES,
};

const commKeyMap = {
  recordingType: ALS.RECORDING_TYPE,
  to: ALS.TO,
  from: ALS.FROM,
  notes: ALS.NOTES,
  length: ALS.LENGTH,
  toNumber: ALS.TO_NUMBER,
  fromNumber: ALS.FROM_NUMBER,
  commDirection: ALS.COMM_DIRECTION,
  status: ALS.STATUS,
  callDuration: ALS.DURATION,
  ringDuration: ALS.RING_DURATION,
  subject: ALS.SUBJECT,
};

const quoteCommKeyMap = {
  quoteId: ALS.QUOTE_ID,
  unitShortHand: ALS.QUOTED_UNIT,
  to: ALS.TO,
};

const renewalLetterCommKeyMap = {
  unitShortHand: ALS.RENEWAL_LETTER_FOR_UNIT,
  quoteId: ALS.QUOTE_ID,
  to: ALS.TO,
};

const leasingTeamKeyMap = {
  newPrimaryAgentName: ALS.PRIMARY_AGENT,
  previousPrimaryAgentName: ALS.PREVIOUS_PRIMARY_AGENT,
};

const communicationKeyMap = {
  type: ALS.TYPE,
  from: ALS.FROM,
  time: ALS.TIME,
  direction: ALS.DIRECTION,
};
const partyKeyMap = {
  state: ALS.STATE,
  closeReason: ALS.CLOSE_REASON,
  archiveReason: ALS.ARCHIVE_REASON,
  // per the specification, it looks like the value of the status field should be Active/waitlisted/snoozed (Not stored currently)
  // and currently we end up showing the same value as State
  // for this reason the status key map is removed for now.
  // status: ALS.STATUS,
  score: ALS.SCORE,
  firstChannel: ALS.FIRST_CHANNEL,
  held: ALS.HELD,
  partyOwner: ALS.PARTY_OWNER,
  ownerTeam: ALS.OWNER_TEAM,
  source: ALS.PARTY_SOURCE,
  sourceType: ALS.PARTY_SOURCE_TYPE,
  program: ALS.PARTY_PROGRAM,
  programPath: ALS.PARTY_PROGRAM_PATH,
  primaryProperty: ALS.PRIMARY_PROPERTY,
  campaign: ALS.CAMPAIGN,
  reason: ALS.REASON,
  previousApplicationStatus: ALS.PREVIOUS_APP_STATUS,
  residents: ALS.RESIDENTS,
  guarantors: ALS.GUARANTORS,
  ssnSetFor: ALS.SSN_SET_FOR,
  ssnEnabledFor: ALS.SSN_ENABLED_FOR,
  primaryPropertyUpdated: ALS.PRIMARY_PROPERTY_UPDATED,
  workflowName: ALS.WORKFLOW_NAME,
  renewalStatus: ALS.RENEWAL_STATUS,
  syncSuccessful: ALS.SYNC_SUCCESSFUL,
  leaseStatus: ALS.LEASE_STATUS,
  downloadStatus: ALS.DOWNLOAD_STATUS,
  newLeaseEndDate: ALS.NEW_LEASE_END_DATE,
};

const mergePersonKeyMap = {
  basePerson: ALS.PERSON_MERGE_TARGET,
  otherPerson: ALS.PERSON_MERGE_SOURCE,
};

const mergePartiesKeyMap = {
  firstPartyMembers: ALS.PARTIES_MERGE_FIRST_PARTY_MEMBERS,
  secondPartyMembers: ALS.PARTIES_MERGE_SECOND_PARTY_MEMBERS,
  partyOwner: ALS.PARTIES_MERGE_PARTY_OWNER,
};

const dontMergePartiesKeyMap = {
  firstPartyMembers: ALS.PARTIES_MERGE_FIRST_PARTY_MEMBERS,
  secondPartyMembers: ALS.PARTIES_MERGE_SECOND_PARTY_MEMBERS,
};

const moveOutPartiesKeyMap = {
  requestedBy: ALS.MOVEOUT_NOTICE_SERVED_BY,
  dateOfTheNotice: ALS.AT_DATE,
  vacateDate: ALS.VACATE_DATE,
  notes: ALS.NOTES,
  movingOutStatus: ALS.ACTION,
};

const dataSyncPartyKeyMap = {
  createdBy: ALS.CREATED_BY,
  syncEventType: ALS.SYNC_EVENT_TYPE,
};

const dataPartySetFlagKeyMap = {
  createdBy: ALS.CREATED_BY,
  programDisplayName: ALS.PROGRAM_DISPLAY_NAME,
};

const taskKeyMap = {
  taskName: ALS.TASK_NAME,
  assignee: ALS.ASSIGNEE,
  createdBy: ALS.CREATED_BY,
  partyOwner: ALS.PARTY_OWNER,
};

const taskCompletedKeyMap = {
  notes: ALS.NOTES,
  completedBy: ALS.COMPLETED_BY,
};

const removeMemberKeyMap = {
  ...guestKeyMap,
  notes: ALS.NOTES,
};

const approvalRequestedKeyMap = {
  approver: ALS.APPROVER,
  unit: ALS.UNIT,
  leaseTerm: ALS.LEASE_TERM,
};

const applicationApprovedKeyMap = {
  unit: ALS.UNIT,
  unitShortHand: ALS.QUOTED_UNIT,
  leaseTerm: ALS.LEASE_TERM,
  deposit: ALS.DEPOSIT,
  paymentMethod: ALS.PAYMENT_METHOD,
  notes: ALS.NOTES,
  applicationStatus: ALS.APPLICATION_STATUS,
  screeningStatus: ALS.SCREENING_STATUS,
};

const applicationDeclinedKeyMap = {
  unit: ALS.UNIT,
  unitShortHand: ALS.QUOTED_UNIT,
  leaseTerm: ALS.LEASE_TERM,
  notes: ALS.NOTES,
  applicationStatus: ALS.APPLICATION_STATUS,
  screeningStatus: ALS.SCREENING_STATUS,
};

const applicationRevokedKeyMap = {
  unit: ALS.UNIT,
  unitShortHand: ALS.QUOTED_UNIT,
  leaseTerm: ALS.LEASE_TERM,
  notes: ALS.NOTES,
  applicationStatus: ALS.APPLICATION_STATUS,
  screeningStatus: ALS.SCREENING_STATUS,
};

const abandonApprovalRequestKeyMap = {
  quoteId: ALS.QUOTE_ID,
  unit: ALS.UNIT,
  leaseTerm: ALS.LEASE_TERM,
  applicationStatus: ALS.APPLICATION_STATUS,
  screeningStatus: ALS.SCREENING_STATUS,
};

const applicationUpdatedKeyMap = {
  memberName: ALS.ON_BEHALF_OF,
  unit: ALS.UNIT,
  leaseTerm: ALS.LEASE_TERM,
  deposit: ALS.DEPOSIT,
};

const applicationLinkSentKeyMap = {
  memberName: ALS.MEMBER_NAME,
};

const feeWaiverKeyMap = {
  memberName: ALS.MEMBER_NAME,
  waiverReason: ALS.WAIVER_REASON,
};

const contactEventKeyMap = {
  participants: ALS.PARTICIPANTS,
  type: ALS.TYPE,
  date: ALS.DATE,
  notes: ALS.NOTES,
};

const leaseKeyMap = {
  leaseId: ALS.LEASE_ID,
  leasedUnit: ALS.LEASED_UNIT,
};

const leaseCreatedKeyMap = {
  ...leaseKeyMap,
  quote: ALS.QUOTE_ID,
};

const leaseEmailedKeyMap = {
  ...leaseKeyMap,
  to: ALS.TO,
};

const leaseSignKeyMap = {
  ...leaseKeyMap,
  by: ALS.BY,
  signMethod: ALS.SIGN_METHOD,
};

const leaseInOfficeSignatureKeyMap = {
  ...leaseKeyMap,
  for: ALS.FOR,
  signMethod: ALS.SIGN_METHOD,
};

const leaseEditKeyMap = {
  ...leaseKeyMap,
  leaseEdits: ALS.LEASE_EDITS,
};

const inventoryManuallyHeldKeyMap = {
  inventoryShorthand: ALS.INVENTORY_SHORTHAND,
  changedBy: ALS.CHANGED_BY,
  daysReserved: ALS.DAYS_RESERVED,
  automatically: ALS.AUTOMATICALLY,
  reason: ALS.REASON,
};
const userDeactivationKeyMap = {
  inactiveUser: ALS.INACTIVE_USER,
  deactivatedInTeam: ALS.DEACTIVATED_IN_TEAM,
};

const guestMovedKeyMap = {
  name: ALS.NAME,
  preferredName: ALS.PREFERRED_NAME,
  to: ALS.TO,
  from: ALS.FROM,
};

const manualLogsKeyMap = { notes: ALS.NOTES };

const prettyPrintActivityLog = data => {
  const keys = Object.keys(data);
  const result = printOrder
    .filter(elem => keys.includes(elem))
    .map(elem => (isFieldHidden(elem) ? `${data[elem]}; ` : `${t(elem)}: ${data[elem]}; `))
    .join('');

  return result.replace(/,/g, ', ').replace(/_/g, ' ').trim();
};

const formatBaseRentLog = (leaseTermsBaseRent = []) => {
  if (!leaseTermsBaseRent.length) return '';

  const rentkeys = Object.keys(leaseTermsBaseRent[0]);
  const baseRentsResult = leaseTermsBaseRent.map(elem => `${rentkeys[0]}: ${elem[ALS.BASE_RENT]}, ${lowerCase(rentkeys[1])}: ${elem[ALS.FOR]}`).join('; ');

  return `${baseRentsResult}; `;
};

const getLeaseEditDisplayValue = values =>
  isObject(values) ? Object.keys(values).reduce((text, key) => text.concat(`${key} ${values[key]} `), '') : `${values}`;

const formatLeaseEdit = edit => {
  if (!edit) return '';
  let result;
  let displayValue;

  switch (edit.actionType) {
    case 'N': {
      displayValue = getLeaseEditDisplayValue(edit.newValue);
      result = ' Selected ';
      break;
    }
    case 'D':
      displayValue = getLeaseEditDisplayValue(edit.oldValue);
      result = ' De-selected ';
      break;
    case 'E': {
      displayValue = getLeaseEditDisplayValue(edit.newValue);
      result = ' Updated ';
      break;
    }
    default:
      break;
  }

  result += ` ${edit.displayName}: ${displayValue.replace('amount ', '$').replace('quantity', 'qty')}; `;

  return result;
};

const printLeaseActivityLog = (leaseData, activityType) => {
  let result = `Contract: ${leaseData[ALS.LEASE_ID]} for Unit: ${leaseData[ALS.LEASED_UNIT]}`;

  switch (activityType) {
    case ACTIVITY_TYPES.NEW:
      result = `Quote ID: ${leaseData[ALS.QUOTE_ID]} Unit: ${leaseData[ALS.LEASED_UNIT]} `;
      break;
    case ACTIVITY_TYPES.EMAIL:
      result += ` To: ${leaseData[ALS.TO]}`;
      break;
    case ACTIVITY_TYPES.UPDATE: {
      result += leaseData[ALS.LEASE_EDITS].reduce((res, edit) => res + formatLeaseEdit(edit), '');
      break;
    }
    case ACTIVITY_TYPES.IN_OFFICE_SIGNATURE:
      result += ` For: ${leaseData[ALS.FOR]}`;
      result += leaseData[ALS.SIGN_METHOD] ? ` Method: ${leaseData[ALS.SIGN_METHOD]}` : '';
      break;
    case ACTIVITY_TYPES.SIGN:
    case ACTIVITY_TYPES.COUNTERSIGN:
      result += ` By: ${leaseData[ALS.BY]}`;
      result += leaseData[ALS.SIGN_METHOD] ? ` Method: ${leaseData[ALS.SIGN_METHOD]}` : '';
      break;
    default:
      break;
  }

  return result;
};

const printQuoteActivityLog = (quoteData, activityType) => {
  const keys = Object.keys(quoteData);

  const result = printOrder
    .filter(elem => keys.includes(elem))
    .map(elem => (isFieldHidden(elem) ? `${quoteData[elem]};` : `${elem}: ${quoteData[elem]};`))
    .join('');
  let termination;
  switch (activityType) {
    case ACTIVITY_TYPES.PUBLISH:
      termination = t('ACTIVITY_LOG_QUOTE_PUBLISH_TERMINATION');
      break;
    case ACTIVITY_TYPES.UPDATE: {
      // TODO: check if we can use `Number.isNaN` instead of `isNaN`
      const harcodedValuesResult = keys
        .filter(elem => !isNaN(elem)) // eslint-disable-line no-restricted-globals
        .map(elem => `${quoteData[elem]};`)
        .join('');

      return `${result}${formatBaseRentLog(quoteData.leaseTermsBaseRent)}${harcodedValuesResult}`.replace(/_/g, ' ');
    }
    case ACTIVITY_TYPES.REMOVE:
      termination = t('ACTIVITY_LOG_QUOTE_REMOVE_TERMINATION');
      break;
    case ACTIVITY_TYPES.EMAIL:
      termination = t('ACTIVITY_LOG_QUOTE_EMAIL_TERMINATION');
      break;
    case ACTIVITY_TYPES.TEXT:
      termination = t('ACTIVITY_LOG_QUOTE_TEXT_TERMINATION');
      break;
    case ACTIVITY_TYPES.DUPLICATE:
      termination = ` ${t('ACTIVITY_LOG_QUOTE_DUPLICATE_TERMINATION')} `;
      return `${result
        .replace(/;/, termination)
        .replace(/_/g, ' ')
        .replace(/;/, ` ${t('FOR')} `)
        .replace(/;/g, '')}`;
    case ACTIVITY_TYPES.PRINT:
      termination = t('ACTIVITY_LOG_QUOTE_PRINT_TERMINATION');
      break;
    default:
      termination = activityType;
  }

  return `${result
    .replace(/;/, ` ${t('FOR')} `)
    .replace(/_/g, ' ')
    .replace(/;/g, '')} ${termination}`;
};

const printInventoryStatusActivityLog = (type, detailsData) => {
  switch (type) {
    case ACTIVITY_TYPES.ADD_MANUAL_HOLD:
    case ACTIVITY_TYPES.ADD_LEASE_HOLD:
      return `${t('ACTIVITY_LOG_ADD_MANUAL_HOLD_DETAILS', { reason: t(detailsData.Reason) })} ${detailsData.Inventory_Shorthand}`;
    case ACTIVITY_TYPES.REMOVE_MANUAL_HOLD:
    case ACTIVITY_TYPES.REMOVE_LEASE_HOLD: {
      const label = detailsData.Automatically ? 'ACTIVITY_LOG_AUTO_REMOVE_MANUAL_HOLD_DETAILS' : 'ACTIVITY_LOG_REMOVE_MANUAL_HOLD_DETAILS';
      return t(label, {
        unitName: detailsData.Inventory_Shorthand,
        reason: t(detailsData.Reason),
        days: detailsData.Days_Reserved,
      });
    }
    case ACTIVITY_TYPES.INVENTORY_RESERVED:
      return `${t('ACTIVITY_LOG_INVENTORY_RESERVED_DETAILS', { reason: t(detailsData.Reason) })} ${detailsData.Inventory_Shorthand}`;
    case ACTIVITY_TYPES.INVENTORY_RELEASED:
      return `${t('ACTIVITY_LOG_INVENTORY_RELEASED_DETAILS', { reason: t(detailsData.Reason) })} ${detailsData.Inventory_Shorthand} (${t('RESERVED_FOR')} ${
        detailsData.Days_Reserved
      } ${t('DAYS')})`;
    default:
      return '';
  }
};

const printApplicationLinkSentActivityLog = data => `${toSentenceCase(t('TO'))}: ${data.memberName}`;

const printWaiverApplicationActivityLog = (type, data) => {
  let text;
  if (type === ACTIVITY_TYPES.NEW) {
    text = 'APPLICATION_FEE_WAIVER_ISSUED';
    return t(text, { memberName: data.memberName, reason: data.waiverReason });
  }
  if (type === ACTIVITY_TYPES.REMOVE) text = 'APPLICATION_FEE_WAIVER_REVOKED';
  if (type === ACTIVITY_TYPES.SUBMIT) text = 'APPLICATION_FEE_WAIVER_APPLIED';
  return t(text, { memberName: data.memberName });
};

const printRescreeningActivityLog = data => {
  const { Residents, Guarantors, Previous_Application_Status: previousStatus } = data;

  const membersTrans = `${t('RESIDENTS_LOG', { residents: Residents })} ${Guarantors ? t('GUARANTORS_LOG', { guarantors: Guarantors }) : ''}`;

  const partyMembers = t('PARTY_MEMBERS_LOG', { members: membersTrans });

  return t('PREVIOUS_ APPLICATION_STATUS', { status: previousStatus, partyMembers });
};

const printMergePersonActivityLog = data =>
  `${prettyPrintActivityLog(data.PersonMergeTarget)} ${t('ACTIVITY_LOG_MERGED_WITH')} ${prettyPrintActivityLog(data.PersonMergeSource)}`;

const printFlagSetActivityLog = data => `${t('OPTED_PAYMENT_PLAN')}; ${data.programDisplayName ? `${t('PROGRAM')}: ${data.programDisplayName}` : ''}`;

const printEmailCommunicationLog = data =>
  `${t('PRINT_PREVIEW')} ${lowerCase(data.Type)} ${lowerCase(t('FROM_LABEL'))} ${data.From}, ${
    data.Direction === DALTypes.CommunicationDirection.IN ? `${lowerCase(t('RECEIVED_LABEL'))}` : `${lowerCase(t('SENT'))}`
  } on ${data.Time}`;

const getPartyMembersForMergeParties = members => members.map(m => m.name).join(', ');

const printMergePartiesLog = data => {
  const firstPartyMembers = getPartyMembersForMergeParties(data.PartiesMergeFirstPartyMembers);
  const secondPartyMembers = getPartyMembersForMergeParties(data.PartiesMergeSecondPartyMembers);
  return `(${firstPartyMembers}) ${t('ACTIVITY_LOG_MERGED_WITH')} (${secondPartyMembers}); ${t('PARTY_OWNER')} ${data.PartiesMergePartyOwner}`;
};

const printDontMergePartiesLog = data => {
  const firstPartyMembers = getPartyMembersForMergeParties(data.PartiesMergeFirstPartyMembers);
  const secondPartyMembers = getPartyMembersForMergeParties(data.PartiesMergeSecondPartyMembers);
  return `(${firstPartyMembers}) ${t('ACTIVITY_LOG_NOT_MERGED_WITH')} (${secondPartyMembers})`;
};

const printUserDeactivationInLeasingTeam = data =>
  t('DEACTIVATE_USER', { leasingAgentName: data[ALS.INACTIVE_USER], leasingTeamName: data[ALS.DEACTIVATED_IN_TEAM] });

const printDataSyncActivityLog = data => `${t('PARTY_UPDATED_WITH_LATEST_DATA')}; ${t('EVENT')}: ${t(data.syncEventType)}`;

const printRenewalActivityLog = data => {
  let syncStatus = '';
  if ('syncSuccessful' in data) {
    syncStatus = `${t('PARTY_SYNC')} ${data.syncSuccessful ? t('PARTY_SYNC_SUCCESSFUL') : t('PARTY_SYNC_FAILED')}`;
  }
  return `${t('RENEWAL_WF')} ${t(data.renewalStatus)}; ${syncStatus}`;
};

const printGuestMovedActivityLog = data =>
  data.PreferredName
    ? t('MEMBER_TYPE_CHANGED', { to: data.To, from: data.From, name: data.Name, preferredName: data.PreferredName })
    : t('MEMBER_TYPE_CHANGED_NO_PREFERRED_NAME', { to: data.To, from: data.From, name: data.Name });

const printAllCommsMarkedAsReadActivityLog = () => t('ACTIVITY_LOG_ALL_COMMS_MARKED_AS_READ_DETAILS');

// TODO: Move this to moment-utils
// TODO: Make it human friendlier.
// If same date show it like:
// - DATE, timeStart - timeEnd (zoneAbbr if different from environment timezone)
// - Today, timeStart - timeEnd (zoneAbbr if different from environment timezone)
// - Yesterday, timeStart - timeEnd (zoneAbbr if different from environment timezone)
// - Tomorrow, timeStart - timeEnd (zoneAbbr if different from environment timezone)
//
// If no same date (very rare cases)
// - DateStart time - DateEnd time (zoneAbbr if different from environment timezone)
const formatDateRange = (startDate, endDate, timezone) => `${formatTimestamp(startDate, { timezone })} - ${formatTimestamp(endDate, { timezone })}`;

const removeNullishDataFromObj = obj => omitBy(obj, value => !value || value.length === 0);

const mapDetails = (details, componentKeyMap) => {
  const mapped = mapKeys(details, (value, key) => componentKeyMap[key]);
  delete mapped.undefined;
  return mapped;
};

const applyAppointmentsTransformation = keyMap => (logDetails, timezone) => {
  const mappedDetails = mapDetails(logDetails, keyMap);

  if (mappedDetails.Date) {
    mappedDetails.Date = formatDateRange(mappedDetails.Date, mappedDetails.EndDate, timezone);
    delete mappedDetails.EndDate;
  }

  if ('state' in logDetails && keyMap === appointmentKeyMapUpdate) {
    if (logDetails.state === 'Completed') {
      mappedDetails.Status = t('STATUS_MARKED_COMPLETE');
    } else if (logDetails.state === 'Active') {
      mappedDetails.Status = t('STATUS_UNMARKED_COMPLETE');
    }
  }

  if (ALS.APPOINTMENT_RESULT in mappedDetails) {
    mappedDetails[ALS.APPOINTMENT_RESULT] = t(mappedDetails[ALS.APPOINTMENT_RESULT]);
  }

  return mappedDetails;
};

const applyGuestsTransformation = logDetails => {
  const mappedDetails = mapDetails(logDetails, guestKeyMap);
  const contactInfo = mappedDetails[ALS.CONTACT_INFO];
  if (!contactInfo) return mappedDetails;

  return {
    ...mappedDetails,
    [ALS.PHONES]: contactInfo.phones.map(item => (item.isPrimary ? `${formatPhoneNumber(item.value)} (primary)` : formatPhoneNumber(item.value))),
    [ALS.EMAIL]: contactInfo.emails.map(item => (item.isPrimary ? `${item.value} (primary)` : item.value)),
  };
};

const applyCommsTransformation = logDetails => mapDetails(logDetails, commKeyMap);
const applyQuoteCommsTransformation = logDetails => mapDetails(logDetails, quoteCommKeyMap);
const applyRenewalLettCommsTransformation = logDetails => mapDetails(logDetails, renewalLetterCommKeyMap);

const mappedBaseRents = (leaseTermsBaseRent = []) => leaseTermsBaseRent.map(termRent => mapDetails(termRent, quoteKeyMapUpdatedFields));

const applyQuoteUpdateTransformation = (keyMap, logDetails) => {
  const editedFields = logDetails.edited || {};
  let mappedDetails = mapDetails(logDetails, keyMap);
  let mappedUpdatedFields = mapDetails(editedFields, quoteKeyMapUpdatedFields);
  const mapped = Object.keys(editedFields).map(key => quoteKeyHardcodedValues[key]);

  mappedDetails = Object.assign(mappedDetails, mapped);
  mappedDetails = Object.assign(mappedDetails, mappedUpdatedFields);
  mappedDetails.leaseTermsBaseRent = mappedBaseRents(editedFields.leaseTermsBaseRent);
  mappedUpdatedFields = null;
  return mappedDetails;
};

const applyQuoteTransformation = keyMap => logDetails => {
  if (keyMap === quoteKeyMapUpdate) {
    return applyQuoteUpdateTransformation(keyMap, logDetails);
  }

  const mappedDetails = mapDetails(logDetails, keyMap);
  const leaseStartDate = mappedDetails[ALS.LEASE_START];

  if (!leaseStartDate) return mappedDetails;
  const timezone = logDetails.propertyTimezone || findLocalTimezone();

  return {
    ...mappedDetails,
    [ALS.LEASE_START]: toMoment(leaseStartDate, { timezone }).format(YEAR_MONTH_DAY_FORMAT),
  };
};

const applyLeasingTeamTransformation = logDetails => mapDetails(logDetails, leasingTeamKeyMap);

const applyUserDeactivationInLeasingTeamTransformation = logDetails => mapDetails(logDetails, userDeactivationKeyMap);

const applyRemoveMemberTransformation = logDetails => mapDetails(logDetails, removeMemberKeyMap);
const getSource = logDetails =>
  (logDetails.program && logDetails.program.sourceDisplayName) ||
  (logDetails.metadata && logDetails.metadata.teamMemberSource && t('BUSINESS_CARD')) ||
  (logDetails.metadata && logDetails.metadata.transferAgentSource && logDetails.metadata.transferAgentSource.displayName);

const applyPartyCreatedTransformation = logDetails => {
  const {
    sourceType,
    reportingDisplayName: program,
    propertyDisplayName: programPrimaryProperty,
    teamDisplayName: programOwnerTeam,
    campaignDisplayName: campaign,
    path: programPath,
  } = logDetails.program || {};

  const { firstContactChannel: firstChannel } = logDetails.metadata || {};
  const source = getSource(logDetails);
  const primaryProperty = programPrimaryProperty || logDetails.propertyDisplayName;
  const ownerTeam = programOwnerTeam || logDetails.ownerTeamDisplayName;

  const details = { ...logDetails, source, program, firstChannel, primaryProperty, ownerTeam, campaign, programPath, sourceType };
  return mapDetails(details, partyKeyMap);
};

const applyEmailPrintCommunication = (logDetails, timezone) => {
  const time = formatMoment(logDetails.created_at, { timezone, format: SHORT_DATE_12H_FORMAT, includeZone: true, includeZoneStrict: true });
  const logDetailsToMap = { ...logDetails, time };

  return mapDetails(logDetailsToMap, communicationKeyMap);
};

const applyManualLogTransformation = logDetails => mapDetails(logDetails, manualLogsKeyMap);

const applyPartyTransformation = logDetails => {
  let mappedDetails = mapDetails(logDetails, partyKeyMap);

  if ('Archive_Reason' in mappedDetails) {
    mappedDetails = {
      ...mappedDetails,
      // eslint-disable-next-line camelcase
      Archive_Reason: t(`${DALTypes.ArchivePartyReasons[mappedDetails.Archive_Reason]}`),
    };
  }

  if ('Close_Reason' in mappedDetails) {
    mappedDetails = {
      ...mappedDetails,
      Close_Reason: t(`${DALTypes.ClosePartyReasons[mappedDetails.Close_Reason]}`),
    };
  }

  return mappedDetails;
};

const doesGuestNameMatchNumber = (name, number) => name && formatPhoneNumber(name) === formatPhoneNumber(number);

/* Example 1 for mapped details
  { Communication_direction: "out"
  From_number: "16812173684"
  To: ["guest1"]    // guest has name and no matter how many numbers
  To_Number: "10753369648" }

Example 2 for mapped details
  { Communication_direction: "out"
    From_number: "16812173684"
    To: ["+1071 533 6964"]       // guest has no name but 2 phone numbers and call is made to secondary number
    To_Number: "10753369644"
  }

Example 3 for mapped details
  { Communication_direction: "out"
    From_number: "16812173684"
    To: ["+1071 533 6964"]  // guest has no name but has one phone number, or the call is made to the primary number
    To_Number: "10715336964"
  }

  Example 4 mappedDetails - incoming call from new guest
  { Communication_direction: "in"
From: ["+40 753 369 648"]
From_number: "40753369648"
To: "16812173684"
}

*/
const shouldDisplaySimpleToValue = mappedDetails =>
  !mappedDetails[ALS.TO_NUMBER] ||
  doesGuestNameMatchNumber(mappedDetails[ALS.TO][0], mappedDetails[ALS.TO_NUMBER]) ||
  isValidPhoneNumber(mappedDetails[ALS.TO][0]);

const getToValueForCall = mappedDetails =>
  shouldDisplaySimpleToValue(mappedDetails)
    ? formatPhoneNumber(mappedDetails[ALS.TO])
    : `${formatPhoneNumber(mappedDetails[ALS.TO])}: ${formatPhoneNumber(mappedDetails[ALS.TO_NUMBER])}`;

const getFromValueForCall = mappedDetails =>
  !mappedDetails[ALS.FROM] || formatPhoneNumber(mappedDetails[ALS.FROM_NUMBER]) === mappedDetails[ALS.FROM][0]
    ? formatPhoneNumber(mappedDetails[ALS.FROM_NUMBER])
    : `${mappedDetails[ALS.FROM]}: ${formatPhoneNumber(mappedDetails[ALS.FROM_NUMBER])}`;

const applyCallTransformation = logDetails => {
  const mappedDetails = mapDetails(logDetails, commKeyMap);

  if (mappedDetails[ALS.STATUS] === DALTypes.CallTerminationStatus.TRANSFERRED) {
    mappedDetails[ALS.STATUS] = t('TRANSFERRED_TO_TARGET', { to: mappedDetails[ALS.TO] });
    mappedDetails[ALS.TO] && delete mappedDetails[ALS.TO];
  } else {
    mappedDetails[ALS.TO] = getToValueForCall(mappedDetails);
  }
  mappedDetails[ALS.FROM] = getFromValueForCall(mappedDetails);

  mappedDetails[ALS.RING_DURATION] = mappedDetails[ALS.RING_DURATION] && `${mappedDetails[ALS.RING_DURATION]} seconds`;
  mappedDetails[ALS.DURATION] = mappedDetails[ALS.DURATION] ? mappedDetails[ALS.DURATION] : t('NOT_ANSWERED');

  mappedDetails[ALS.FROM_NUMBER] && delete mappedDetails[ALS.FROM_NUMBER];
  mappedDetails[ALS.TO_NUMBER] && delete mappedDetails[ALS.TO_NUMBER];

  return mappedDetails;
};

const applyMergePersonTransformation = logDetails => {
  const mappedGuest = person => {
    const mappedDetails = mapDetails(person, guestKeyMap);
    if ('Contact_Info' in mappedDetails && mappedDetails.Contact_Info.phones.length) {
      mappedDetails.Phones = mappedDetails.Contact_Info.phones.map(item => formatPhoneNumber(item.value));
    }
    if ('Contact_Info' in mappedDetails && mappedDetails.Contact_Info.emails.length) {
      mappedDetails.Emails = mappedDetails.Contact_Info.emails.map(item => item.value);
    }
    return mappedDetails;
  };
  return mapDetails(
    {
      basePerson: mappedGuest(logDetails.basePerson),
      otherPerson: mappedGuest(logDetails.otherPerson),
    },
    mergePersonKeyMap,
  );
};

const applyWaivedAppplicationFeeTransformation = logDetails => mapDetails(logDetails, feeWaiverKeyMap);

const getGuestNamesAsString = guests => guests.map(g => getDisplayName(g)).join(', ');

const applyTaskTransformation = logDetails => {
  const guests = logDetails.guests || [];
  let taskName;

  if (logDetails.taskName === DALTypes.TaskNames.HOLD_INVENTORY) {
    taskName = t(`${logDetails.taskName}`, { payerName: getGuestNamesAsString(guests) });
  } else {
    taskName = t(`${logDetails.taskName || 'task'}`);
    taskName = `${taskName} ${getGuestNamesAsString(guests)}`;
  }
  const details = { ...logDetails };
  if (logDetails.taskCategory !== DALTypes.TaskCategories.MANUAL_REMINDER || logDetails.taskName) {
    details.taskName = taskName;
  }
  return mapDetails(details, taskKeyMap);
};

const applyTaskCompletedTransformation = logDetails => mapDetails(logDetails, taskCompletedKeyMap);
const applyMergePartiesTransformation = logDetails => mapDetails(logDetails, mergePartiesKeyMap);
const applyDontMergePartiesTransformation = logDetails => mapDetails(logDetails, dontMergePartiesKeyMap);
const applyMoveOutTransformation = logDetails => mapDetails(logDetails, moveOutPartiesKeyMap);
const applyPartySyncTransformation = logDetails => mapDetails(logDetails, dataSyncPartyKeyMap);
const applyPartySetFlagTransformation = logDetails => mapDetails(logDetails, dataPartySetFlagKeyMap);

const applyApprovalRequestedTransformation = logDetails => mapDetails(logDetails, approvalRequestedKeyMap);
const applyApplicationApprovedTransformation = logDetails => mapDetails(logDetails, applicationApprovedKeyMap);
const applyApplicationDeclinedTransformation = logDetails => mapDetails(logDetails, applicationDeclinedKeyMap);
const applyApplicationRevokedTransformation = logDetails => {
  const { leaseTerm, ...restProperties } = logDetails;
  const mappedDetails = mapDetails(restProperties, applicationRevokedKeyMap);
  return {
    ...mappedDetails,
    [ALS.LEASE_TERM]: termText(leaseTerm),
  };
};
const applyAbandonApprovalRequesTransformation = logDetails => {
  const { leaseTerm, ...restProperties } = logDetails;
  const mappedDetails = mapDetails(restProperties, abandonApprovalRequestKeyMap);
  return {
    ...mappedDetails,
    [ALS.LEASE_TERM]: termText(leaseTerm),
  };
};
const applyApplicationLinkSentTransformation = logDetails => mapDetails(logDetails, applicationLinkSentKeyMap);
const applyContactEventTransformation = logDetails => mapDetails(logDetails, contactEventKeyMap);
const applyApplicationUpdatedTransformation = logDetails => mapDetails(logDetails, applicationUpdatedKeyMap);
const applyLeaseTransformation = logDetails => mapDetails(logDetails, leaseKeyMap);
const applyLeaseCreateTransformation = logDetails => mapDetails(logDetails, leaseCreatedKeyMap);
const applyLeaseEmailedTransformation = logDetails => mapDetails(logDetails, leaseEmailedKeyMap);
const applyLeaseSignedTransformation = logDetails => mapDetails(logDetails, leaseSignKeyMap);
const applyLeaseInOfficeSignatureTransformation = logDetails => mapDetails(logDetails, leaseInOfficeSignatureKeyMap);
const applyLeaseEditedTransformation = logDetails => mapDetails(logDetails, leaseEditKeyMap);

const applyInventoryManuallyHeldTransformation = logDetails => mapDetails(logDetails, inventoryManuallyHeldKeyMap);
const applyGuestMovedTransformation = logDetails => mapDetails(logDetails, guestMovedKeyMap);

const appointmentFormatters = {
  [`${COMPONENT_TYPES.APPOINTMENT}_${ACTIVITY_TYPES.NEW}`]: applyAppointmentsTransformation(appointmentKeyMapNew),
  [`${COMPONENT_TYPES.APPOINTMENT}_${ACTIVITY_TYPES.UPDATE}`]: applyAppointmentsTransformation(appointmentKeyMapUpdate),
  [`${COMPONENT_TYPES.APPOINTMENT}_${ACTIVITY_TYPES.REMOVE}`]: applyAppointmentsTransformation(appointmentKeyMapNew),
  [`${COMPONENT_TYPES.APPOINTMENT}_${ACTIVITY_TYPES.DECLINE}`]: applyAppointmentsTransformation(appointmentKeyMapDecline),
  [`${COMPONENT_TYPES.APPOINTMENT}_${ACTIVITY_TYPES.CONFIRM}`]: applyAppointmentsTransformation(appointmentKeyMapConfirm),
};

const guestFormatters = {
  [`${COMPONENT_TYPES.GUEST}_${ACTIVITY_TYPES.NEW}`]: applyGuestsTransformation,
  [`${COMPONENT_TYPES.GUEST}_${ACTIVITY_TYPES.UPDATE}`]: applyGuestsTransformation,
  [`${COMPONENT_TYPES.GUEST}_${ACTIVITY_TYPES.REMOVE}`]: applyRemoveMemberTransformation,
};

const quoteFormatters = {
  [`${COMPONENT_TYPES.QUOTE}_${ACTIVITY_TYPES.NEW}`]: applyQuoteTransformation(quoteKeyMapNew),
  [`${COMPONENT_TYPES.QUOTE}_${SUB_COMPONENT_TYPES.RENEWAL_LETTER}_${ACTIVITY_TYPES.NEW}`]: applyQuoteTransformation(renewalLetterKeyMapNew),
  [`${COMPONENT_TYPES.QUOTE}_${ACTIVITY_TYPES.PUBLISH}`]: applyQuoteTransformation(quoteKeyMap),
  [`${COMPONENT_TYPES.QUOTE}_${SUB_COMPONENT_TYPES.RENEWAL_LETTER}_${ACTIVITY_TYPES.PUBLISH}`]: applyQuoteTransformation(renewalLetterKeyMap),
  [`${COMPONENT_TYPES.QUOTE}_${ACTIVITY_TYPES.REMOVE}`]: applyQuoteTransformation(quoteKeyMap),
  [`${COMPONENT_TYPES.QUOTE}_${ACTIVITY_TYPES.EMAIL}`]: applyQuoteTransformation(quoteKeyMap),
  [`${COMPONENT_TYPES.QUOTE}_${ACTIVITY_TYPES.TEXT}`]: applyQuoteTransformation(quoteKeyMap),
  [`${COMPONENT_TYPES.QUOTE}_${ACTIVITY_TYPES.DUPLICATE}`]: applyQuoteTransformation(quoteKeyMapDuplicate),
  [`${COMPONENT_TYPES.QUOTE}_${ACTIVITY_TYPES.PRINT}`]: applyQuoteTransformation(quoteKeyMap),
  [`${COMPONENT_TYPES.QUOTE}_${SUB_COMPONENT_TYPES.RENEWAL_LETTER}_${ACTIVITY_TYPES.PRINT}`]: applyQuoteTransformation(renewalLetterKeyMap),
  [`${COMPONENT_TYPES.QUOTE}_${ACTIVITY_TYPES.UPDATE}`]: applyQuoteTransformation(quoteKeyMapUpdate),
};

const commFormatters = {
  [`${COMPONENT_TYPES.EMAIL}_${ACTIVITY_TYPES.NEW}`]: applyCommsTransformation,
  [`${COMPONENT_TYPES.EMAIL}_${ACTIVITY_TYPES.PRINT}`]: applyEmailPrintCommunication,
  [`${COMPONENT_TYPES.EMAIL}_${SUB_COMPONENT_TYPES.QUOTE}_${ACTIVITY_TYPES.NEW}`]: applyQuoteCommsTransformation,
  [`${COMPONENT_TYPES.EMAIL}_${SUB_COMPONENT_TYPES.RENEWAL_LETTER}_${ACTIVITY_TYPES.NEW}`]: applyRenewalLettCommsTransformation,
  [`${COMPONENT_TYPES.EMAIL}_${ACTIVITY_TYPES.READ}`]: applyCommsTransformation,
  [`${COMPONENT_TYPES.SMS}_${ACTIVITY_TYPES.NEW}`]: applyCommsTransformation,
  [`${COMPONENT_TYPES.SMS}_${SUB_COMPONENT_TYPES.QUOTE}_${ACTIVITY_TYPES.NEW}`]: applyQuoteCommsTransformation,
  [`${COMPONENT_TYPES.SMS}_${SUB_COMPONENT_TYPES.RENEWAL_LETTER}_${ACTIVITY_TYPES.NEW}`]: applyRenewalLettCommsTransformation,
  [`${COMPONENT_TYPES.SMS}_${ACTIVITY_TYPES.READ}`]: applyCommsTransformation,
  [`${COMPONENT_TYPES.CALL}_${ACTIVITY_TYPES.NEW}`]: applyCommsTransformation,
  [`${COMPONENT_TYPES.CALL}_${ACTIVITY_TYPES.UPDATE}`]: applyCommsTransformation,
  [`${COMPONENT_TYPES.CALL}_${ACTIVITY_TYPES.LISTENED}`]: applyCommsTransformation,
  [`${COMPONENT_TYPES.CALL}_${ACTIVITY_TYPES.TERMINATED}`]: applyCallTransformation,
  [`${COMPONENT_TYPES.DIRECT_MESSAGE}_${ACTIVITY_TYPES.NEW}`]: applyCommsTransformation,
};

const leasignTeamFormatters = {
  [`${COMPONENT_TYPES.LEASINGTEAM}_${ACTIVITY_TYPES.UPDATE}`]: applyLeasingTeamTransformation,
  [`${COMPONENT_TYPES.LEASINGTEAM}_${ACTIVITY_TYPES.DEACTIVATE}`]: applyUserDeactivationInLeasingTeamTransformation,
};

const partyFormatters = {
  [`${COMPONENT_TYPES.PARTY}_${ACTIVITY_TYPES.NEW}`]: applyPartyCreatedTransformation,
  [`${COMPONENT_TYPES.PARTY}_${ACTIVITY_TYPES.SPAWN}`]: applyPartyCreatedTransformation,
  [`${COMPONENT_TYPES.PARTY}_${ACTIVITY_TYPES.UPDATE}`]: applyPartyTransformation,
  [`${COMPONENT_TYPES.PARTY}_${SUB_COMPONENT_TYPES.RESCREENING}_${ACTIVITY_TYPES.UPDATE}`]: applyPartyTransformation,
  [`${COMPONENT_TYPES.PARTY}_${ACTIVITY_TYPES.EXPORT}`]: applyPartyTransformation,
  [`${COMPONENT_TYPES.PARTY}_${ACTIVITY_TYPES.CLOSE}`]: applyPartyTransformation,
  [`${COMPONENT_TYPES.PARTY}_${ACTIVITY_TYPES.ARCHIVE}`]: applyPartyTransformation,
  [`${COMPONENT_TYPES.PARTY}_${ACTIVITY_TYPES.GUEST_MERGED}`]: applyMergePersonTransformation,
  [`${COMPONENT_TYPES.PARTY}_${ACTIVITY_TYPES.MERGE_PARTIES}`]: applyMergePartiesTransformation,
  [`${COMPONENT_TYPES.PARTY}_${ACTIVITY_TYPES.DONT_MERGE_PARTIES}`]: applyDontMergePartiesTransformation,
  [`${COMPONENT_TYPES.PARTY}_${ACTIVITY_TYPES.MOVEOUT}`]: applyMoveOutTransformation,
  [`${COMPONENT_TYPES.PARTY}_${ACTIVITY_TYPES.DATA_SYNC}`]: applyPartySyncTransformation,
  [`${COMPONENT_TYPES.PARTY}_${ACTIVITY_TYPES.SET_FLAG}`]: applyPartySetFlagTransformation,
  [`${COMPONENT_TYPES.PARTY}_${SUB_COMPONENT_TYPES.RENEWAL}_${ACTIVITY_TYPES.NEW}`]: applyPartyTransformation,
  [`${COMPONENT_TYPES.PARTY}_${SUB_COMPONENT_TYPES.MOVED}_${ACTIVITY_TYPES.UPDATE}`]: applyGuestMovedTransformation,
  [`${COMPONENT_TYPES.PARTY}_${SUB_COMPONENT_TYPES.ALL_COMMS_MARKED_AS_READ}_${ACTIVITY_TYPES.UPDATE}`]: applyPartyTransformation,
};

const taskFormatters = {
  [`${COMPONENT_TYPES.TASK}_${ACTIVITY_TYPES.NEW}`]: applyTaskTransformation,
  [`${COMPONENT_TYPES.TASK}_${ACTIVITY_TYPES.UPDATE}`]: applyTaskTransformation,
  [`${COMPONENT_TYPES.TASK}_${ACTIVITY_TYPES.REMOVE}`]: applyTaskTransformation,
  [`${COMPONENT_TYPES.TASK}_${ACTIVITY_TYPES.COMPLETED}`]: applyTaskCompletedTransformation,
};

const applicationFormatters = {
  [`${COMPONENT_TYPES.APPLICATION}_${ACTIVITY_TYPES.SUBMIT}`]: applyApprovalRequestedTransformation,
  [`${COMPONENT_TYPES.APPLICATION}_${ACTIVITY_TYPES.APPROVE}`]: applyApplicationApprovedTransformation,
  [`${COMPONENT_TYPES.APPLICATION}_${ACTIVITY_TYPES.DECLINE}`]: applyApplicationDeclinedTransformation,
  [`${COMPONENT_TYPES.APPLICATION}_${ACTIVITY_TYPES.REVOKE}`]: applyApplicationRevokedTransformation,
  [`${COMPONENT_TYPES.APPLICATION}_${ACTIVITY_TYPES.REMOVE}`]: applyAbandonApprovalRequesTransformation,
  [`${COMPONENT_TYPES.APPLICATION}_${ACTIVITY_TYPES.UPDATE}`]: applyApplicationUpdatedTransformation,
  [`${COMPONENT_TYPES.APPLICATION}_${ACTIVITY_TYPES.EMAIL}`]: applyApplicationLinkSentTransformation,
  [`${COMPONENT_TYPES.APPLICATION}_${ACTIVITY_TYPES.TEXT}`]: applyApplicationLinkSentTransformation,
  [`${COMPONENT_TYPES.APPLICATION}_${SUB_COMPONENT_TYPES.WAIVER}_${ACTIVITY_TYPES.NEW}`]: applyWaivedAppplicationFeeTransformation,
  [`${COMPONENT_TYPES.APPLICATION}_${SUB_COMPONENT_TYPES.WAIVER}_${ACTIVITY_TYPES.REMOVE}`]: applyWaivedAppplicationFeeTransformation,
  [`${COMPONENT_TYPES.APPLICATION}_${SUB_COMPONENT_TYPES.WAIVER}_${ACTIVITY_TYPES.SUBMIT}`]: applyWaivedAppplicationFeeTransformation,
  [`${COMPONENT_TYPES.APPLICATION}_${SUB_COMPONENT_TYPES.MOVED}_${ACTIVITY_TYPES.SUBMIT}`]: logDetails => logDetails,
};

const contactEventFormatters = {
  [`${COMPONENT_TYPES.CONTACT_EVENT}_${ACTIVITY_TYPES.NEW}`]: applyContactEventTransformation,
  [`${COMPONENT_TYPES.CONTACT_EVENT}_${ACTIVITY_TYPES.UPDATE}`]: applyContactEventTransformation,
};

const leaseFormatters = {
  [`${COMPONENT_TYPES.LEASE}_${ACTIVITY_TYPES.NEW}`]: applyLeaseCreateTransformation,
  [`${COMPONENT_TYPES.LEASE}_${ACTIVITY_TYPES.EMAIL}`]: applyLeaseEmailedTransformation,
  [`${COMPONENT_TYPES.LEASE}_${ACTIVITY_TYPES.REMOVE}`]: applyLeaseTransformation,
  [`${COMPONENT_TYPES.LEASE}_${ACTIVITY_TYPES.UPDATE}`]: applyLeaseEditedTransformation,
  [`${COMPONENT_TYPES.LEASE}_${ACTIVITY_TYPES.SIGN}`]: applyLeaseSignedTransformation,
  [`${COMPONENT_TYPES.LEASE}_${ACTIVITY_TYPES.IN_OFFICE_SIGNATURE}`]: applyLeaseInOfficeSignatureTransformation,
  [`${COMPONENT_TYPES.LEASE}_${ACTIVITY_TYPES.COUNTERSIGN}`]: applyLeaseSignedTransformation,
  [`${COMPONENT_TYPES.LEASE}_${ACTIVITY_TYPES.EXECUTE}`]: applyLeaseSignedTransformation,
  [`${COMPONENT_TYPES.LEASE}_${ACTIVITY_TYPES.VIEW}`]: applyLeaseTransformation,
};

const inventoryStatusFormatters = {
  [`${COMPONENT_TYPES.INVENTORY_STATUS}_${ACTIVITY_TYPES.ADD_MANUAL_HOLD}`]: applyInventoryManuallyHeldTransformation,
  [`${COMPONENT_TYPES.INVENTORY_STATUS}_${ACTIVITY_TYPES.REMOVE_MANUAL_HOLD}`]: applyInventoryManuallyHeldTransformation,
  [`${COMPONENT_TYPES.INVENTORY_STATUS}_${ACTIVITY_TYPES.ADD_LEASE_HOLD}`]: applyInventoryManuallyHeldTransformation,
  [`${COMPONENT_TYPES.INVENTORY_STATUS}_${ACTIVITY_TYPES.REMOVE_LEASE_HOLD}`]: applyInventoryManuallyHeldTransformation,
  [`${COMPONENT_TYPES.INVENTORY_STATUS}_${ACTIVITY_TYPES.INVENTORY_RESERVED}`]: applyInventoryManuallyHeldTransformation,
  [`${COMPONENT_TYPES.INVENTORY_STATUS}_${ACTIVITY_TYPES.INVENTORY_RELEASED}`]: applyInventoryManuallyHeldTransformation,
};

const manualLogsFormatters = { [`${COMPONENT_TYPES.PARTY}_${ACTIVITY_TYPES.MANUAL}`]: applyManualLogTransformation };

const formatters = {
  ...appointmentFormatters,
  ...guestFormatters,
  ...quoteFormatters,
  ...commFormatters,
  ...leasignTeamFormatters,
  ...partyFormatters,
  ...taskFormatters,
  ...applicationFormatters,
  ...contactEventFormatters,
  ...leaseFormatters,
  ...inventoryStatusFormatters,
  ...manualLogsFormatters,
};

const getFormatterKey = formatter => [formatter.component, formatter.subComponent, formatter.type].filter(value => value).join('_');

const hasFormatter = formatterKey => hasOwnProp(formatters, formatterKey);

const getActivityLogForParty = (elem, removedUndefined) => {
  if (elem.type === ACTIVITY_TYPES.SET_FLAG) {
    return printFlagSetActivityLog(removedUndefined);
  }
  if (elem.type === ACTIVITY_TYPES.GUEST_MERGED) {
    return printMergePersonActivityLog(removedUndefined);
  }
  if (elem.type === ACTIVITY_TYPES.MERGE_PARTIES) {
    return printMergePartiesLog(removedUndefined);
  }
  if (elem.type === ACTIVITY_TYPES.DONT_MERGE_PARTIES) {
    return printDontMergePartiesLog(removedUndefined);
  }
  if (elem.subComponent === SUB_COMPONENT_TYPES.RESCREENING) {
    return printRescreeningActivityLog(removedUndefined);
  }
  if (elem.type === ACTIVITY_TYPES.DATA_SYNC) {
    return printDataSyncActivityLog(removedUndefined);
  }
  if (elem.subComponent === SUB_COMPONENT_TYPES.RENEWAL) {
    return printRenewalActivityLog(removedUndefined);
  }
  if (elem.subComponent === SUB_COMPONENT_TYPES.MOVED) {
    return printGuestMovedActivityLog(removedUndefined);
  }
  if (elem.subComponent === SUB_COMPONENT_TYPES.ALL_COMMS_MARKED_AS_READ) {
    return printAllCommsMarkedAsReadActivityLog();
  }
  return prettyPrintActivityLog(removedUndefined);
};

const getActivityLogForApplication = (elem, removedUndefined) => {
  let formattedDetails;
  switch (elem.type) {
    case ACTIVITY_TYPES.EMAIL:
    case ACTIVITY_TYPES.TEXT:
      formattedDetails = printApplicationLinkSentActivityLog(removedUndefined);
      break;
    case ACTIVITY_TYPES.NEW:
    case ACTIVITY_TYPES.REMOVE:
    case ACTIVITY_TYPES.SUBMIT:
      if (elem.subComponent === SUB_COMPONENT_TYPES.WAIVER) {
        formattedDetails = printWaiverApplicationActivityLog(elem.type, removedUndefined);
      }

      if (elem.subComponent === SUB_COMPONENT_TYPES.MOVED) {
        formattedDetails = t('APPLICATION_FEE_MOVED_MSG', { memberName: removedUndefined.memberName });
      }
      break;
    default:
  }
  return formattedDetails;
};

const printNewOrAnsweredCall = data => {
  const to = getToValueForCall(data);
  const from = getFromValueForCall(data);

  const message = data[ALS.COMM_DIRECTION] === DALTypes.CommunicationDirection.IN ? 'NEW_INCOMING_CALL_LOG' : 'NEW_OUTGOING_CALL_LOG';
  return t(message, { to, from });
};

const printRemindTaskActivityLog = (elem, timezone) => {
  let formattedDetails = '';

  const { details, type } = elem;
  switch (type) {
    case ACTIVITY_TYPES.NEW:
      formattedDetails = ` Task category: ${details.taskCategory}`;
      break;
    case ACTIVITY_TYPES.COMPLETED:
    case ACTIVITY_TYPES.UPDATE:
      if (details.note) formattedDetails += ` Notes: ${details.note};`;
      if (details.dueDate) formattedDetails += ` Due date: ${formatMoment(details.dueDate, { timezone, format: SHORT_DATE_12H_FORMAT })};`;
      if (details.closingNote) formattedDetails += ` Closing note: ${details.closingNote}`;
      break;
    default:
  }

  return formattedDetails;
};

const getFormattedDetails = (elem, removedUndefined, timezone) => {
  let formattedDetails;
  switch (elem.component) {
    case COMPONENT_TYPES.QUOTE:
      formattedDetails = elem.type !== ACTIVITY_TYPES.NEW && printQuoteActivityLog(removedUndefined, elem.type);
      break;
    case COMPONENT_TYPES.LEASE:
      formattedDetails = printLeaseActivityLog(removedUndefined, elem.type);
      break;
    case COMPONENT_TYPES.APPLICATION:
      formattedDetails = getActivityLogForApplication(elem, removedUndefined);
      break;
    case COMPONENT_TYPES.PARTY:
      formattedDetails = getActivityLogForParty(elem, removedUndefined);
      break;
    case COMPONENT_TYPES.INVENTORY_STATUS:
      elem.agentName = removedUndefined.Changed_By;
      formattedDetails = printInventoryStatusActivityLog(elem.type, removedUndefined);
      break;
    case COMPONENT_TYPES.LEASINGTEAM:
      if (elem.type === ACTIVITY_TYPES.DEACTIVATE) {
        formattedDetails = printUserDeactivationInLeasingTeam(removedUndefined);
      }
      break;
    case COMPONENT_TYPES.CALL:
      if (elem.type === ACTIVITY_TYPES.NEW) {
        formattedDetails = printNewOrAnsweredCall(removedUndefined);
      }
      break;
    case COMPONENT_TYPES.EMAIL:
      if (elem.type === ACTIVITY_TYPES.PRINT) {
        formattedDetails = printEmailCommunicationLog(removedUndefined);
      }
      break;
    default:
      formattedDetails = prettyPrintActivityLog(removedUndefined);
      if (elem.component === COMPONENT_TYPES.GUEST) formattedDetails = `Current contact info: ${formattedDetails || 'None'}`;
      if (elem.component === COMPONENT_TYPES.TASK && elem?.details?.taskCategory === DALTypes.TaskCategories.MANUAL_REMINDER) {
        formattedDetails += printRemindTaskActivityLog(elem, timezone);
      }
      break;
  }
  if (!formattedDetails) {
    formattedDetails = prettyPrintActivityLog(removedUndefined);
  }
  return formattedDetails;
};

export const formatActivityLogs = (logs, timezone = findLocalTimezone()) =>
  logs.reduce((acc, elem) => {
    const formatterKey = getFormatterKey(elem);
    if (!hasFormatter(formatterKey)) return acc;

    const action = formatters[formatterKey];
    const transformedDetails = action(elem.details, timezone);
    const removedUndefined = removeNullishDataFromObj(transformedDetails);
    const formattedDetails = getFormattedDetails(elem, removedUndefined, timezone);

    acc.push({ ...elem, formattedDetails });
    return acc;
  }, []);
