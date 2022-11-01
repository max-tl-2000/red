/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import orderBy from 'lodash/orderBy';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { getEmailNotificationMessage } from '../../../helpers/notifications';
import DSInput from './DSInput';
import { isAnonymousEmail } from '../../../../common/helpers/anonymous-email';

const { CommunicationDirection, CommunicationMessageType, CommunicationCategory, PersonApplicationStatus } = DALTypes;

class CorticonDSInput extends DSInput {
  id;

  created_at;

  assignedProperty;

  mostRecentInboundCommTime;

  noResponseCounter;

  partyOwnerUUID;

  eventCommRecord;

  comms;

  partyMembers;

  tasks;

  partyApplication;

  lease;

  createdFromCommId;

  workflowState;

  leaseType;

  workflowName;

  activeLeaseData;

  quotes;

  propertyTimeZone;

  moveoutNoticePeriodDays;

  get setters() {
    return [
      'setId',
      'setCreatedAt',
      'setAssignedProperty',
      'setEventCommRecord',
      'setComms',
      'setMostRecentInboundCommTime',
      'setNoResponseCounter',
      'setPartyOwner',
      'setPartyMembers',
      'setTasks',
      'setPartyApplication',
      'setLease',
      'setCreatedFromCommId',
      'setWorkflowState',
      'setLeaseType',
      'setWorkflowName',
      'setActiveLeaseData',
      'setQuotes',
      'setPropertyTimeZone',
      'setMoveOutNoticePeriodDays',
    ];
  }

  getLatestComm = (acc, { created_at }) => {
    const { isDateAfter } = this;
    if (!acc) {
      acc = created_at;
      return acc;
    }

    acc = isDateAfter(acc, created_at) ? created_at : acc;

    return acc;
  };

  getPartyMemberLastCommunicationDate = (party, { personId }) => {
    const { getLatestComm } = this;
    const { comms = [] } = party;
    const partyMemberComms = (comms || []).filter(({ persons, direction }) => persons.includes(personId) && direction === CommunicationDirection.IN);

    return partyMemberComms.reduce(getLatestComm, undefined);
  };

  getPartyMemberInvoice = (party, personApplication = {}) => {
    const { invoices = [] } = party;
    return (invoices || []).find(invoice => invoice.personApplicationId === personApplication.id);
  };

  hasPartyMemberCompletedPayment = (party, personApplication = {}) => {
    const { getPartyMemberInvoice } = this;
    return (getPartyMemberInvoice(party, personApplication) || {}).paymentCompleted || false;
  };

  getPartyMemberApplicationPaidDate = (party, personApplication = {}) => {
    const { getPartyMemberInvoice, hasPartyMemberCompletedPayment } = this;
    const { created_at } = getPartyMemberInvoice(party, personApplication) || {};
    const paymentCompleted = hasPartyMemberCompletedPayment(party, personApplication);

    return paymentCompleted ? created_at : '';
  };

  getPartyMemberApplicationLinkSentDate = (party, { personId }) => {
    const { comms = [] } = party;
    const partyMemberOutgoingEmailComms = (comms || []).filter(
      ({ persons, direction, type }) => persons.includes(personId) && type === CommunicationMessageType.EMAIL && direction === CommunicationDirection.OUT,
    );

    const applicationEmailSent = getEmailNotificationMessage('', CommunicationCategory.APPLICATION_INVITE);
    const { created_at } = partyMemberOutgoingEmailComms.find(comm => comm.message?.notificationMessage === applicationEmailSent) || {};
    return created_at;
  };

  getPartyMemberPersonApplication = (party, { personId }) => {
    const { getPartyMemberApplicationPaidDate, getPartyMemberApplicationLinkSentDate, formatDate } = this;
    const { personApplications = [] } = party;
    const personApplication = (personApplications || []).find(personApp => personApp.personId === personId) || {};
    const dateApplicationPaid = formatDate(getPartyMemberApplicationPaidDate(party, personApplication));
    const created_at = formatDate(personApplication.created_at);
    const dateLinkSent = formatDate(getPartyMemberApplicationLinkSentDate(party, personApplication));
    const completionDate = formatDate(personApplication.applicationCompleted);

    return {
      id: personApplication.id,
      created_at,
      applicationStatus: personApplication.applicationStatus,
      completionDate,
      dateApplicationOpened: created_at,
      dateApplicationPaid,
      dateLinkSent,
    };
  };

  getActivePartyMembers = ({ members = [] }) => (members || []).filter(({ partyMember }) => !partyMember.endDate);

  haveAllPartyMembersPaid = party => {
    const { getActivePartyMembers } = this;
    const members = getActivePartyMembers(party);

    if (!members.length) return false;

    const { getPartyMemberPersonApplication, hasPartyMemberCompletedPayment } = this;

    return members.every(({ partyMember }) => {
      const personApplication = getPartyMemberPersonApplication(party, partyMember);
      return hasPartyMemberCompletedPayment(party, personApplication);
    });
  };

  haveAllPartyMembersCompletedApplication = party => {
    const { getActivePartyMembers } = this;
    const members = getActivePartyMembers(party);

    if (!members.length) return false;

    const { getPartyMemberPersonApplication } = this;

    return members.every(({ partyMember }) => {
      const personApplication = getPartyMemberPersonApplication(party, partyMember);
      return personApplication.applicationStatus === PersonApplicationStatus.COMPLETED;
    });
  };

  getPartyApplicationCompletelyPaidDate = party => {
    const { haveAllPartyMembersPaid } = this;
    let completelyPaidDate;

    if (!haveAllPartyMembersPaid(party)) return completelyPaidDate;

    const { isDateAfter, getActivePartyMembers, getPartyMemberApplicationPaidDate, getPartyMemberPersonApplication } = this;
    const members = getActivePartyMembers(party);

    return members.reduce((acc, { partyMember }) => {
      const personApplication = getPartyMemberPersonApplication(party, partyMember);
      const paidDate = getPartyMemberApplicationPaidDate(party, personApplication);
      if (!acc) {
        acc = paidDate;
        return acc;
      }

      acc = isDateAfter(acc, paidDate) ? paidDate : acc;

      return acc;
    }, completelyPaidDate);
  };

  getPartyApplicationCompletionDate = party => {
    const { haveAllPartyMembersCompletedApplication } = this;
    let completionDate;

    if (!haveAllPartyMembersCompletedApplication(party)) return completionDate;

    const { isDateAfter, getActivePartyMembers } = this;
    const activePartyMembers = getActivePartyMembers(party);

    const { personApplications = [] } = party;

    return (personApplications || []).reduce((acc, { personId, applicationCompleted }) => {
      const activeMember = activePartyMembers.find(({ partyMember }) => partyMember.personId === personId);
      if (!activeMember) return acc;

      if (!acc) {
        acc = applicationCompleted;
        return acc;
      }

      acc = isDateAfter(acc, applicationCompleted) ? applicationCompleted : acc;

      return acc;
    }, completionDate);
  };

  setId(party) {
    this.id = party.id;
  }

  setCreatedAt(party) {
    this.created_at = this.formatDate(party.created_at);
  }

  setAssignedProperty(party) {
    this.assignedProperty = party.assignedPropertyId;
  }

  setMostRecentInboundCommTime(party) {
    const { getLatestComm, formatDate } = this;
    const { comms = [] } = party;
    this.mostRecentInboundCommTime = formatDate((comms || []).filter(comm => comm.direction === CommunicationDirection.IN).reduce(getLatestComm, undefined));
  }

  setNoResponseCounter(party) {
    const { getLatestComm } = this;
    const { comms = [] } = party;

    const mostRecentInboundCommTime = (comms || []).filter(comm => comm.direction === CommunicationDirection.IN).reduce(getLatestComm, undefined);
    if (!mostRecentInboundCommTime) {
      this.noResponseCounter = (comms || []).filter(comm => comm.direction === CommunicationDirection.OUT).length;
      return;
    }

    const { isDateAfter } = this;
    this.noResponseCounter = (comms || [])
      .filter(comm => comm.direction === CommunicationDirection.OUT)
      .reduce((acc, { created_at }) => (isDateAfter(mostRecentInboundCommTime, created_at) ? acc + 1 : acc), 0);
  }

  setPartyOwner(party) {
    this.partyOwnerUUID = party.userId;
  }

  getCommList(party, communicationId) {
    const { getDurationInSeconds, formatDate, isCommunicationForAllPartyMembers } = this;
    const { comms = [], events = [], createdFromCommId } = party;
    const [commEvent] = events.filter(e => e.metadata?.communicationId);
    const { metadata } = commEvent || {};
    const { isLeadCreated } = metadata || {};

    const c = comms || [];
    const commList = communicationId ? c.filter(comm => comm.id === communicationId) : c;
    return commList.map(({ id, created_at, userId, direction, type, message, category, persons: personsInComm }) => {
      const callConnectedWithAgent = message?.answered === true;
      const isCallbackRequested = message?.isCallbackRequested === true;
      const isVideoLinkRequested = message?.rawMessageData?.requestVideoLink === true;

      return {
        id,
        created_at: formatDate(created_at),
        callDurationSeconds: getDurationInSeconds(message?.duration),
        commAgentUUID: userId,
        direction,
        eventType: type,
        isLeadCreated: isLeadCreated || id === createdFromCommId,
        isCallbackRequested,
        isVideoLinkRequested,
        callConnectedWithAgent,
        category,
        isCommForAllPartyMembers: isCommunicationForAllPartyMembers(personsInComm, party),
      };
    });
  }

  setEventCommRecord(party) {
    const [commEvent] = (party.events || []).filter(e => e.metadata?.communicationId);
    const communicationId = commEvent?.metadata?.communicationId;
    this.eventCommRecord = communicationId ? this.getCommList(party, communicationId) : [];
  }

  setComms(party) {
    this.comms = this.getCommList(party);
  }

  mapTasks(party, personId) {
    const { formatDate } = this;
    let tasks = party.tasks || [];

    if (personId) tasks = tasks.filter(({ metadata }) => personId === metadata?.personId);

    return tasks.map(({ id, created_at, category, dueDate, name, state, userIds, metadata, completionDate }) => ({
      id,
      created_at: formatDate(created_at),
      category,
      dueDate: formatDate(dueDate),
      name,
      state,
      taskOwner: userIds[0],
      personId: metadata?.personId,
      createdBy: metadata?.createdBy,
      completionDate: formatDate(completionDate),
    }));
  }

  setPartyMembers(party) {
    const { getPartyMemberLastCommunicationDate, getPartyMemberPersonApplication, formatDate } = this;
    const { members = [] } = party;
    this.partyMembers = (members || []).map(({ partyMember, person, contactInfo = [] }) => {
      const { id } = partyMember;
      const { id: personId, modified_by: modifiedBy } = person;

      const created_at = formatDate(partyMember.created_at);
      const personApplication = getPartyMemberPersonApplication(party, partyMember);
      const lastCommunicationDate = formatDate(getPartyMemberLastCommunicationDate(party, partyMember));
      const hasContactInfo = !!(contactInfo && contactInfo.length);
      const isActive = !partyMember.endDate;

      return {
        id,
        created_at,
        lastCommunicationDate,
        personApplication,
        personId,
        modifiedBy,
        hasContactInfo,
        isActive,
        partyMemberTasks: this.mapTasks(party, personId),
        hasAnonymousEmail: (contactInfo || []).some(info => info.type === DALTypes.ContactInfoType.EMAIL && isAnonymousEmail(info.value)),
      };
    });
  }

  setTasks(party) {
    this.tasks = this.mapTasks(party);
  }

  setPartyApplication(party) {
    const { getPartyApplicationCompletelyPaidDate, getPartyApplicationCompletionDate, formatDate } = this;
    const { partyApplications } = party;
    const [partyApplication] = partyApplications || [];

    if (partyApplication) {
      this.partyApplication = {
        id: partyApplication.id,
        created_at: formatDate(partyApplication.created_at),
        completelyPaidDate: formatDate(getPartyApplicationCompletelyPaidDate(party, partyApplication)),
        completionDate: formatDate(getPartyApplicationCompletionDate(party)),
      };
    }
  }

  setLease(party) {
    const { leases } = party;
    const [lease] = orderBy(leases || [], 'created_at', 'desc');

    if (lease) {
      this.lease = {
        id: lease.id,
        created_at: this.formatDate(lease.created_at),
        status: lease.status,
      };
    }
  }

  setCreatedFromCommId(party) {
    this.createdFromCommId = party.createdFromCommId;
  }

  setWorkflowState(party) {
    this.workflowState = party.workflowState;
  }

  setLeaseType(party) {
    this.leaseType = party.leaseType;
  }

  setWorkflowName(party) {
    this.workflowName = party.workflowName;
  }

  setActiveLeaseData(party) {
    const activeLeasesData = party.activeLeaseData || [];
    const [activeLeaseData] = orderBy(activeLeasesData, 'created_at', 'desc');

    if (activeLeaseData) {
      const { id, created_at, state, leaseData } = activeLeaseData;

      this.activeLeaseData = {
        id,
        created_at: this.formatDate(created_at),
        state,
        leaseEndDate: this.formatDate(leaseData.leaseEndDate),
      };
    }
  }

  setQuotes(party) {
    const { formatDate } = this;
    const quotes = party.quotes || [];

    const { events = [] } = party;
    const [quoteEvent] = events.filter(e => e.metadata?.quoteId);
    const { metadata } = quoteEvent || {};
    const { quoteId, isQuotePrinted = false } = metadata || {};

    this.quotes = [];

    if (quoteId) {
      this.quotes = quotes
        .filter(q => q.id === quoteId)
        .map(({ id, created_at }) => ({
          id,
          created_at: formatDate(created_at),
          isQuotePrinted,
        }));
    }
  }

  setPropertyTimeZone(party) {
    const [property] = party.property || [];
    let { timeZone } = property || {};

    if (!timeZone) {
      const [latestLease] = orderBy(party.leases || [], 'created_at', 'desc');

      const { baselineData } = latestLease || {};
      timeZone = (baselineData || {}).timezone;

      if (!timeZone) {
        const [latestQuote] = orderBy(party.quotes || [], 'created_at', 'desc');
        const { propertyTimezone } = latestQuote || {};
        timeZone = propertyTimezone;
      }
    }

    this.propertyTimeZone = timeZone || 'GMT';
  }

  setMoveOutNoticePeriodDays(party) {
    const [property] = party.property || [];
    const { settings } = property || {};

    this.moveoutNoticePeriodDays = settings?.moveoutNoticePeriod || this.defaultMoveoutNoticePeriodDays;
  }

  toDSInput() {
    const {
      id,
      created_at,
      assignedProperty,
      mostRecentInboundCommTime,
      noResponseCounter,
      partyOwnerUUID,
      eventCommRecord,
      comms,
      partyMembers,
      tasks,
      partyApplication,
      lease,
      createdFromCommId,
      workflowState,
      leaseType,
      workflowName,
      activeLeaseData,
      quotes,
      propertyTimeZone,
      moveoutNoticePeriodDays,
    } = this;

    return {
      id,
      created_at,
      assignedProperty,
      mostRecentInboundCommTime,
      noResponseCounter,
      partyOwnerUUID,
      eventCommRecord,
      comms,
      partyMembers,
      tasks,
      partyApplication,
      lease,
      createdFromCommId,
      workflowState,
      leaseType,
      workflowName,
      activeLeaseData,
      quotes,
      propertyTimeZone,
      moveoutNoticePeriodDays,
    };
  }
}

export class DSInputBuilder {
  log = (...args) => {
    const [logger, method, ...loggerArgs] = args;
    if (!logger) return;
    logger[method](...loggerArgs);
  };

  mapInputData(party) {
    const dsInput = new CorticonDSInput();
    return dsInput.setters.reduce((acc, key) => {
      acc[key](party);
      return acc;
    }, dsInput);
  }

  build(ctx, party, logger) {
    if (!party) return new CorticonDSInput().toDSInput();

    const { log } = this;
    log(logger, 'trace', { ctx, partyId: party.id }, 'building ds input');

    const dsInput = this.mapInputData(party);

    log(logger, 'trace', { ctx, partyId: party.id }, 'done building ds input');

    return dsInput.toDSInput();
  }
}
