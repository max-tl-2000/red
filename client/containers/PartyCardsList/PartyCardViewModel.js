/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getLeadScoreIcon, getLeadScore } from 'helpers/leadScore';
import rand from 'helpers/rand';
import sortBy from 'lodash/sortBy';
import { t } from 'i18next';
import { getMoveInDateSummary } from 'helpers/unitsUtils';
import { webInquiryText } from '../../helpers/communications';
import { filterVisibleTasks } from '../../helpers/taskUtils';
import { employees } from './mocks';
import { DALTypes } from '../../../common/enums/DALTypes';
import { isRevaAdmin } from '../../../common/helpers/auth';
import { isCorporateParty as _isCorporateParty, partyFromRaw, BouncedCommunicationStatuses } from '../../../common/helpers/party-utils';
import { isSignatureStatusSigned } from '../../../common/helpers/lease';
import PersonViewModel from '../../view-models/person';
import { toMoment, findLocalTimezone, now } from '../../../common/helpers/moment-utils';
import { getDisplayName } from '../../../common/helpers/person-helper';
import { getShortFormatRentableItem } from '../../../common/helpers/quotes';

const getRandomSlice = (arr = [], count = 1) => {
  const index = rand(0, arr.length);

  return arr.slice(index, index + count);
};

const { CommunicationMessageType, PartyStateType, WorkflowName } = DALTypes;
const { EMAIL, SMS, CALL, WEB, DIRECT_MESSAGE } = CommunicationMessageType;

export default class PartyCardViewModel {
  constructor({ prospect, members, tasks, appointments, users, communication, lease, partyFilter, currentUser, persons, company, activeLeaseWorkflowData }) {
    this._prospect = prospect;
    this._persons = persons;
    this._tasks = tasks;
    this._appointments = appointments;
    this._owner = (users && users.get(prospect.userId)) || {};
    this._members = members;
    this._communication = communication;
    this._company = company;
    this._prospectMetadata = prospect.metadata || {};
    this._recentlyUpdatedAppointments = {};
    this._lease = lease;
    this._qualificationQuestions = prospect.qualificationQuestions;
    this._partyFilter = partyFilter;
    this._currentUser = currentUser;
    this._activeLeaseWorkflowData = activeLeaseWorkflowData;
  }

  get prospect() {
    return this._prospect;
  }

  get isCorporateParty() {
    return _isCorporateParty(this._prospect);
  }

  get party() {
    if (!this._party) {
      this._party = partyFromRaw(this._members || []);
    }

    return this._party;
  }

  get defaultGuest() {
    return this.party.defaultGuest;
  }

  get unitFullQualifiedName() {
    const inventory = this._activeLeaseWorkflowData?.inventory;
    const unitName = inventory && getShortFormatRentableItem(inventory);
    return unitName || '';
  }

  get defaultGuestName() {
    return this.party.defaultGuestName;
  }

  get defaultGuestFullName() {
    const primaryTenant = this.partyMembers.find(({ memberType }) => memberType === DALTypes.MemberType.RESIDENT);
    if (!this.isCorporateParty || !primaryTenant) return this.party.defaultGuestFullName; // will be the safeTextName of the default Guess

    const personViewModel = PersonViewModel.create(primaryTenant.person);
    return personViewModel.companyName || this.party.defaultGuestFullName;
  }

  get partyMembers() {
    return this.party.orderedGuests.filter(guest => !guest.endDate);
  }

  get score() {
    return getLeadScore(this._prospect.score);
  }

  get scoreIcon() {
    return getLeadScoreIcon(this._prospect.score);
  }

  get source() {
    const bussinesCardSource = this._prospectMetadata && this._prospectMetadata.teamMemberSource && t('BUSINESS_CARD');
    const transferAgentSource = this._prospectMetadata?.transferAgentSource?.displayName;
    return this._prospect.program || bussinesCardSource || transferAgentSource || '';
  }

  get timezone() {
    return this._prospect.timezone || findLocalTimezone();
  }

  get isRenewal() {
    return this._prospect.workflowName === WorkflowName.RENEWAL;
  }

  get isActiveLease() {
    return this._prospect.workflowName === WorkflowName.ACTIVE_LEASE;
  }

  get workflowName() {
    return this._prospect.workflowName || '';
  }

  get leasePublishedData() {
    const { _lease } = this;
    const { status, leaseTerm: renewalLeaseTerm, leaseStartDate: renewalLeaseStartDate } = _lease;

    if (status === DALTypes.LeaseStatus.VOIDED) return '';
    return { leaseTerm: `${renewalLeaseTerm} ${renewalLeaseTerm === 1 ? t('MONTH') : t('MONTHS')}`, leaseStartDate: renewalLeaseStartDate };
  }

  get movingOutDate() {
    const { _activeLeaseWorkflowData } = this;
    return _activeLeaseWorkflowData?.movingOutDate || '';
  }

  get moveInDate() {
    const { timezone, isFutureResident, isApplicant, isRenewal, promotedQuote, isLease, _lease, moveInDateRange: { min } = {} } = this;
    if (isRenewal) return null;
    if (isLease || isFutureResident) {
      return _lease.leaseStartDate && toMoment(_lease.leaseStartDate, { timezone });
    }
    if (isApplicant && promotedQuote) {
      return promotedQuote.quoteLeaseStartDate && toMoment(promotedQuote.quoteLeaseStartDate, { timezone });
    }
    return min ? toMoment(min, { timezone }) : undefined;
  }

  get moveInDateFormatted() {
    const { moveInDate } = this;
    return moveInDate ? moveInDate.format('MMM DD, YYYY') : '';
  }

  get moveInDateRange() {
    const unitFilters = this._prospect.storedUnitsFilters;
    const moveInDates = unitFilters && unitFilters.moveInDate;
    if (moveInDates && !this._moveInRange) {
      this._moveInRange = moveInDates;
    }

    return this._moveInRange;
  }

  get moveInDateRangeFormatted() {
    const { timezone } = this;
    return getMoveInDateSummary(this.moveInDateRange, { timezone });
  }

  get promotedQuote() {
    if (!this._promotedQuote) {
      const promotedQuotes = this.prospect.partyQuotePromotions.filter(item => item.promotionStatus !== DALTypes.PromotionStatus.CANCELED);
      if (promotedQuotes.length) {
        this._promotedQuote = promotedQuotes[0];
      }
    }
    return this._promotedQuote;
  }

  get favoritedInventory() {
    if (!this._favoritedProperties) {
      const leaseInventoryQualifiedName = this._lease && this._lease.fullQualifiedName;
      if (leaseInventoryQualifiedName) {
        this._favoritedProperties = [leaseInventoryQualifiedName];
      } else {
        this._favoritedProperties = this.isRawLead ? [] : this._prospect.favoriteUnits;
      }
    }

    return this._favoritedProperties;
  }

  get pendingApplications() {
    if (!this._pendingApplications && this._prospect.state === DALTypes.PartyStateType.APPLICANT) {
      this._pendingApplications = this._members
        .filter(
          partyMember =>
            !partyMember.endDate &&
            (!partyMember.application || (partyMember.application && partyMember.application.applicationStatus !== DALTypes.PersonApplicationStatus.COMPLETED)),
        )
        .map(partyMember => partyMember.person);
    }

    return this._pendingApplications;
  }

  get primaryInventoryName() {
    // for now just assume it is the first one of the favoritedInventory
    return this.favoritedInventory[0];
  }

  get pendingSigners() {
    if (!this._signaturesMissing && this._lease && this._lease.signatures && this._lease.signatures.length > 0) {
      this._signaturesMissing = (this._members || []).filter(member =>
        this._lease.signatures
          .filter(
            signature => signature.partyMemberId && !isSignatureStatusSigned(signature.status) && signature.status !== DALTypes.LeaseSignatureStatus.VOIDED,
          )
          .map(signature => signature.partyMemberId)
          .includes(member.id),
      );
    }

    return this._signaturesMissing;
  }

  get pendingCounterSignature() {
    if (!this._waitingOnCounterSignature) {
      if (this.pendingSigners && this.pendingSigners.length) {
        this._waitingOnCounterSignature = false;
      } else if (this._lease) {
        this._waitingOnCounterSignature =
          this._lease.signatures && !!this._lease.signatures.filter(signature => signature.userId && !isSignatureStatusSigned(signature.status)).length;
      }
    }

    return this._waitingOnCounterSignature;
  }

  get owner() {
    if (!this._owner) {
      this._owner = getRandomSlice(employees, 1)[0];
    }
    return this._owner;
  }

  get shouldShowOwner() {
    const isCurrentUserNotOwner = this._partyFilter.users && this._partyFilter.users.length === 1 && this._partyFilter.users[0] !== this._owner.id;
    const isTeamSelected = this._partyFilter.users && this._partyFilter.users.length > 1 && this._partyFilter.teams && this._partyFilter.teams.length === 1;
    if (isCurrentUserNotOwner || isTeamSelected) {
      return true;
    }
    return false;
  }

  get isClosed() {
    return !!this._prospect.endDate;
  }

  get state() {
    return this._prospect.state;
  }

  get assignedPropertyName() {
    return this._prospect.assignedPropertyName;
  }

  get shouldDisplayDuplicatePersonBanner() {
    const { features = {} } = this._currentUser;
    const isNotificationEnabled = features.duplicatePersonNotification === undefined || features.duplicatePersonNotification || isRevaAdmin(this._currentUser);
    return this._prospect.partyHasStrongMatch && isNotificationEnabled;
  }

  isRecentlyUpdatedAppointment(appointment) {
    return !!this._recentlyUpdatedAppointments[appointment.id];
  }

  // TODO: this is a temporary solution because the function above is not working
  // it is using the _recentlyUpdatedAppointments array, which is always empty...
  isRecentlyUpdated = element => {
    const { timezone } = this;
    return toMoment(element.updated_at, { timezone }).isSame(now({ timezone }), 'day');
  };

  markAppointmentAsRecentlyUpdated(appointment) {
    // TODO: this should be managed thru Redux
    appointment.isComplete = true;
    this._recentlyUpdatedAppointments[appointment.id] = true;
  }

  _getCommModel(comm) {
    if (!comm) {
      return null;
    }

    const { guests } = partyFromRaw(this._members || []);
    const persons = Object.keys(this._persons).map(person => this._persons[person]);

    return {
      get sender() {
        switch (this.type) {
          case EMAIL: {
            const sender = guests.find(guest => guest.person.contactInfo.emails.find(email => email.value === this.message.from));
            return sender && sender.safeTextName;
          }
          case WEB:
          case DIRECT_MESSAGE: {
            const sender = guests.find(guest => guest.personId === this.persons[0]);
            return sender && sender.safeTextName;
          }
          case SMS:
          case CALL: {
            const senders = persons.filter(person => person.contactInfo.defaultPhone === this.message.from);
            const sendersNames = senders.map(sender => getDisplayName(sender));
            return senders && sendersNames.join(', ');
          }
          default:
            return '';
        }
      },
      get messageText() {
        switch (this.type) {
          case EMAIL:
            return this.message.subject;
          case SMS:
            return this.message.text;
          case WEB:
            return t(webInquiryText[this.category]?.title);
          case CALL:
            if (this.isTransferredToPhoneNumber) {
              const message = this.message.isMissed ? t('MISSED_TRANSFERRED_CALL') : t('TRANSFERRED_CALL');
              return message.concat(this.message.transferredToDisplayName);
            }
            if (this.message.isCallbackRequested) return t('CALLBACK_REQUEST');
            return t(this.message.isVoiceMail ? 'VOICE_MESSAGE' : 'MISSED_CALL');
          case DIRECT_MESSAGE:
            return this.message.text;
          default:
            return '';
        }
      },
      get isBounced() {
        const commStatuses = (this.status && this.status.status) || [];
        return commStatuses.some(s => BouncedCommunicationStatuses.includes(s.status));
      },
      get isTransferredToPhoneNumber() {
        return this.message.transferredToNumber && this.message.transferredToDisplayName;
      },
      get icon() {
        switch (this.type) {
          case EMAIL:
            return 'email';
          case SMS:
            return 'message-text';
          case CALL:
            if (this.isTransferredToPhoneNumber) {
              return 'call-transferred';
            }
            if (this.message.isCallbackRequested) return 'phone-callback';
            return this.message.isVoiceMail ? 'voicemail' : 'phone-missed';
          case WEB:
            return 'web';
          case DIRECT_MESSAGE:
            return 'chat';
          default:
            return 'missing-icon';
        }
      },
      get isSMS() {
        return this.type === SMS;
      },
      get isWeb() {
        return this.type === WEB;
      },
      get isEmail() {
        return this.type === EMAIL;
      },
      get isCall() {
        return this.type === CALL;
      },
      ...comm,
    };
  }

  get mostRecentCommunication() {
    const firstComm = this._communication;
    return firstComm ? this._getCommModel(firstComm) : null;
  }

  get allTasks() {
    const tomorrowDate = now().add(1, 'day');

    const tasksForProspect = sortBy(this._tasks || [], task => toMoment(task.dueDate).utc()).filter(
      task => task.state === DALTypes.TaskStates.ACTIVE || this.isRecentlyUpdated(task),
    );
    const tasksToShow = filterVisibleTasks(tasksForProspect, this.timezone);
    const overdueTasks = tasksToShow.filter(task => toMoment(task.dueDate).isBefore(now(), 'day'));
    const todayTasks = tasksToShow.filter(task => toMoment(task.dueDate).isSame(now(), 'day'));
    const tomorrowTasks = tasksToShow.filter(task => toMoment(task.dueDate).isSame(tomorrowDate, 'day'));
    const laterTasks = tasksToShow.filter(task => toMoment(task.dueDate).isAfter(tomorrowDate, 'day'));

    const appointmentsForProspect = sortBy(this._appointments || [], appointment => toMoment(appointment.metadata.startDate).utc()).filter(
      appointment => appointment.state === DALTypes.TaskStates.ACTIVE || this.isRecentlyUpdated(appointment),
    );
    const overdueAppointments = appointmentsForProspect
      .filter(appointment => appointment.state !== DALTypes.TaskStates.COMPLETED && toMoment(appointment.metadata.startDate).isBefore(now(), 'day'))
      .map(appointment => ({
        ...appointment,
        isOverdue: true,
      }));

    const todayAppointments = appointmentsForProspect.filter(appointment => toMoment(appointment.metadata.startDate).isSame(now(), 'day'));
    const tomorrowAppointments = appointmentsForProspect.filter(appointment => toMoment(appointment.metadata.startDate).isSame(tomorrowDate, 'day'));
    const laterAppointments = appointmentsForProspect.filter(appointment => toMoment(appointment.metadata.startDate).isAfter(tomorrowDate, 'day'));

    return {
      length: appointmentsForProspect.length + tasksToShow.length,
      appointmentsLength: appointmentsForProspect.length,
      overdueTasks,
      todayTasks,
      tomorrowTasks,
      laterTasks,
      overdueAppointments,
      todayAppointments,
      tomorrowAppointments,
      laterAppointments,
    };
  }

  get isFutureResident() {
    return this.state === PartyStateType.FUTURERESIDENT;
  }

  get isPastResident() {
    return this.state === PartyStateType.PASTRESIDENT;
  }

  get isProspect() {
    return this.state === PartyStateType.PROSPECT;
  }

  get isApplicant() {
    return this.state === PartyStateType.APPLICANT;
  }

  get isQualifiedLead() {
    return this.state === PartyStateType.LEAD;
  }

  get isRawLead() {
    return this.state === PartyStateType.CONTACT;
  }

  get isLease() {
    return this.state === PartyStateType.LEASE;
  }

  get isMovingOut() {
    return this.state === PartyStateType.MOVINGOUT;
  }

  get isResident() {
    return this.state === PartyStateType.RESIDENT;
  }
}
