/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import { DALTypes } from '../../common/enums/DALTypes';
import { formatDay } from '../../common/helpers/date-utils';
import { allowedToReviewApplication } from '../../common/acd/access';
import { toMoment, now, findLocalTimezone } from '../../common/helpers/moment-utils';
import { cronofyRsvpStatusTypes } from '../../common/enums/calendarTypes';

const taskNames = DALTypes.TaskNames;
const taskCategories = DALTypes.TaskCategories;

export const isTaskComplete = task => task.state === DALTypes.TaskStates.COMPLETED || task.state === DALTypes.TaskStates.CANCELED;

const isAppointmentMarkableAsComplete = task =>
  task.name === taskNames.APPOINTMENT && !isTaskComplete(task) && now().isAfter(toMoment(task.metadata.startDate));

export const filterVisibleTasks = (tasks, timezone) =>
  tasks.filter(task =>
    task.name === DALTypes.TaskNames.COLLECT_EMERGENCY_CONTACT && task.metadata && task.metadata.startDate
      ? now({ timezone }).isSameOrAfter(toMoment(task.metadata.startDate, { timezone }), 'day')
      : true,
  );

export const isTaskReassignable = task =>
  [taskCategories.MANUAL, taskCategories.APPOINTMENT, taskCategories.MANUAL_REMINDER].includes(task.category) ||
  [
    taskNames.FOLLOWUP_PARTY,
    taskNames.PROMOTE_APPLICATION,
    taskNames.SEND_RENEWAL_QUOTE,
    taskNames.COLLECT_EMERGENCY_CONTACT,
    taskNames.COLLECT_SERVICE_ANIMAL_DOC,
  ].includes(task.name) ||
  task.metadata?.isReassignable;

export const isTaskEditable = (task, user, party) => {
  if (isTaskComplete(task)) return false;
  if ([taskCategories.MANUAL, taskCategories.APPOINTMENT, taskCategories.MANUAL_REMINDER].includes(task.category)) {
    return true;
  }

  if (task.category === taskCategories.REQUIRE_WORK) {
    return allowedToReviewApplication(user, party);
  }

  return false;
};

const isAppointmentCreatedInThePast = appointment => toMoment(appointment.metadata.startDate).isBefore(toMoment(appointment.created_at));

const getTaskOverdueDate = task => {
  const getAppointmentOverdueDate = appointment => (isAppointmentCreatedInThePast(appointment) ? appointment.created_at : appointment.metadata.startDate);
  return task.name === taskNames.APPOINTMENT ? getAppointmentOverdueDate(task) : task.dueDate;
};

export const getTaskDueDate = task => (task.name === taskNames.APPOINTMENT ? task.metadata.startDate : task.dueDate);

export const isTaskOverdue = (task, timezone) => {
  const today = now({ timezone });
  const taskOverdueDate = getTaskOverdueDate(task);
  return toMoment(taskOverdueDate, { timezone }).isBefore(today, 'day') && !isTaskComplete(task);
};

export const getFormattedTaskTitle = (task, params = {}) => (!Object.keys(params).length ? t(task.name) : t(task.metadata?.title || task.name, { ...params }));

export const isTaskAutoclosing = task =>
  [
    taskNames.APPOINTMENT === task.name && !isAppointmentMarkableAsComplete(task) ? taskNames.APPOINTMENT : '',
    taskNames.INTRODUCE_YOURSELF,
    taskNames.REMOVE_ANONYMOUS_EMAIL,
    taskNames.CALL_BACK,
    taskNames.FOLLOWUP_PARTY,
    taskNames.COMPLETE_CONTACT_INFO,
    taskNames.REVIEW_APPLICATION,
    taskNames.PROMOTE_APPLICATION,
    taskNames.COUNTERSIGN_LEASE,
    taskNames.SEND_CONTRACT,
    taskNames.HOLD_INVENTORY,
    taskNames.SEND_RENEWAL_QUOTE,
  ].includes(task.name) && !task.metadata?.isNotAutoclosing;

export const taskDuedateFormat = (task, timezone) => {
  const { state, name, completionDate } = task;

  const taskDueDate = toMoment(getTaskDueDate(task), { timezone });
  const currentDate = now({ timezone });
  const taskCompletionDate = completionDate ? toMoment(completionDate, { timezone }) : undefined;
  const isAppointment = name === taskNames.APPOINTMENT;
  const isComplete = state === DALTypes.TaskStates.COMPLETED;

  const dateFormatForNextTasks = lowerCase => {
    const tomorrow = now({ timezone }).add(1, 'days');
    const daysDifference = taskDueDate.diff(currentDate, 'days', true);
    const dayLowerCaseFormat = day => {
      if (lowerCase) return t(day).toLowerCase();
      return t(day);
    };

    if (currentDate.isSame(taskDueDate, 'day')) {
      return dayLowerCaseFormat('DATETIME_TODAY');
    }
    if (tomorrow.isSame(taskDueDate, 'day')) {
      return dayLowerCaseFormat('DATETIME_TOMORROW');
    }
    if (daysDifference < 6) return taskDueDate.format('dddd');
    return formatDay(taskDueDate, timezone);
  };

  const envTimezone = findLocalTimezone();
  const differentZone = timezone !== envTimezone;
  const zonePart = differentZone ? ` ${taskDueDate.zoneAbbr()}` : '';

  const dateFormat = currentDate.isSame(taskDueDate, 'year') ? 'EMAIL_CARD_DATE_DEFAULT' : 'EMAIL_CARD_TIMESTAMP_WITH_YEAR';
  const dateFormatForPastAppointments = `${taskDueDate.format(t(dateFormat))} at ${taskDueDate.format('h:mma')}${zonePart}`;

  const dateFormatForNextOrSetInPastAppointments = () =>
    isAppointmentCreatedInThePast(task) ? dateFormatForPastAppointments : `${dateFormatForNextTasks()} at ${taskDueDate.format('h:mma')}${zonePart}`; // TODO I18n this

  const dateFormatForOverdueTasks = () => {
    const taskDueDateEndOfDay = taskDueDate.clone().endOf('day');
    const overdueDays = Math.ceil(currentDate.diff(taskDueDateEndOfDay, 'days', true));
    if (overdueDays === 1) return `${overdueDays} ${t('DAY')} ${t('OVERDUE')}`;
    return `${overdueDays} ${t('DAYS')} ${t('OVERDUE')}`;
  };

  const dateFormatForCompletedTasks = taskCompletionDate ? formatDay(taskCompletionDate, timezone) : '';

  const nextDateFormat = isAppointment ? dateFormatForNextOrSetInPastAppointments() : t('DUE_DATE_BY', { date: dateFormatForNextTasks(true) });
  const completedDateFormat = isAppointment ? dateFormatForPastAppointments : dateFormatForCompletedTasks;
  const overdueDateFormat = isAppointment ? dateFormatForPastAppointments : dateFormatForOverdueTasks();

  if (isComplete) return completedDateFormat;
  if (isTaskOverdue(task, timezone)) return overdueDateFormat;

  return nextDateFormat;
};

export const isTaskNameClickable = (task, currentUserId) => {
  const clickableTask =
    task.name === DALTypes.TaskNames.COUNTERSIGN_LEASE ||
    task.name === DALTypes.TaskNames.REVIEW_APPLICATION ||
    task.name === DALTypes.TaskNames.NOTIFY_CONDITIONAL_APPROVAL;
  return task.userIds.includes(currentUserId) && !isTaskComplete(task) && clickableTask;
};

export const shouldTaskShowGuestName = task => [DALTypes.TaskNames.COMPLETE_CONTACT_INFO, DALTypes.TaskNames.REMOVE_ANONYMOUS_EMAIL].includes(task.name);

export const isTaskDeclinedViaExtCalendar = task => {
  const {
    metadata: { rsvpStatuses },
  } = task;

  if (!rsvpStatuses) return false;

  const hasDeclineStatuses = rsvpStatuses.some(s => s.status === cronofyRsvpStatusTypes.DECLINED);
  if (!hasDeclineStatuses) return false;

  return true;
};

export const getFeedbackForIcsRsvpDecline = (task, partyMembers) => {
  const {
    metadata: { rsvpStatuses },
  } = task;
  const partyMemberIds = rsvpStatuses?.filter(s => s.status === cronofyRsvpStatusTypes.DECLINED).map(s => s.partyMemberId) || [];
  const personNames = partyMemberIds.length
    ? partyMembers.filter(member => partyMemberIds.includes(member.id)).map(member => member.person?.fullName || member.fullName)
    : [];

  return personNames.length ? t('DECLINED_BY', { names: personNames.join(', ') }) : '';
};

export const getTaskClosingNote = task => {
  const {
    metadata: { feedback, feedbackDate, closingNote, closingNoteDate },
  } = task;
  if (feedbackDate && closingNoteDate) return feedbackDate > closingNoteDate ? feedback : closingNote;

  return feedback || closingNote;
};

export const getTaskClosingNoteLabel = task => {
  const {
    metadata: { feedbackDate, closingNoteDate },
  } = task;
  if (feedbackDate && closingNoteDate) {
    return feedbackDate > closingNoteDate ? `${t('CANCELLED_BY_GUEST')}. ` : `${t(task.metadata.appointmentResult)}. `;
  }

  return `${feedbackDate ? t('CANCELLED_BY_GUEST') : t(task.metadata.appointmentResult)}. `;
};

export const getClosingNote = (task, partyMembers) => {
  const isAppointmentDeclined = isTaskDeclinedViaExtCalendar(task);
  const closingNoteLabel = isAppointmentDeclined ? '' : getTaskClosingNoteLabel(task);
  const closingNoteMessage = isAppointmentDeclined ? getFeedbackForIcsRsvpDecline(task, partyMembers) : getTaskClosingNote(task);

  return {
    label: closingNoteLabel,
    message: closingNoteMessage,
  };
};
