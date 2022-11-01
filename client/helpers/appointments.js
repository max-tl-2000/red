/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import { getObjectsFromMapByIds } from './collections';
import { orderedGuestNames } from './infoToDisplayOnPerson';
import { toMoment, now, findLocalTimezone } from '../../common/helpers/moment-utils';
import { formatTimestamp } from '../../common/helpers/date-utils';
import { getDisplayName } from '../../common/helpers/person-helper';
import { DALTypes } from '../../common/enums/DALTypes';
import { TIME_MERIDIEM_FORMAT } from '../../common/date-constants';

export const formatAppointmentTitleForInventoryFlyout = (appointment, user, timezone) => {
  let displayFormat = 'INVENTORY_CARD_FLAYOUT_APPOINTMENT_TITLE_DEFAULT';
  const appointmentMoment = appointment.isComplete ? toMoment(appointment.updated_at, { timezone }) : toMoment(appointment.metadata.startDate, { timezone });

  const today = now({ timezone });
  if (today.isSame(appointmentMoment, 'days')) {
    displayFormat = 'INVENTORY_CARD_FLAYOUT_APPOINTMENT_TITLE_FOR_TODAY';
  }

  const tomorrow = today.clone().add(1, 'days');
  if (tomorrow.isSame(appointmentMoment, 'days')) {
    displayFormat = 'INVENTORY_CARD_FLAYOUT_APPOINTMENT_TITLE_FOR_TOMORROW';
  }

  const salesAgentPreferredName = user ? user.preferredName : '';
  const completed = appointment.isComplete ? t('completed') : '';

  const localTz = findLocalTimezone();
  const zone = localTz !== appointmentMoment.tz() ? appointmentMoment.zoneAbbr() : '';

  return appointmentMoment.format(t(displayFormat, { completed, zone, salesAgentPreferredName }));
};

export const formatAppointmentDetailsForInventoryFlyout = (appointment, partyMembers) => {
  const metadata = appointment.metadata || {};
  const touredUnits = (metadata.inventories || []).map(unit => unit.name).join(', '); // shouldn't this be fullQualifiedName ? fqn is used everywhere else.
  const memberNames = (metadata.partyMembers || [])
    .reduce((acc, m) => {
      const member = partyMembers.get(m);
      if (member) acc.push(getDisplayName(member.person, { usePreferred: true }));
      return acc;
    }, [])
    .join(', ');

  return touredUnits.length > 0
    ? t('INVENTORY_CARD_FLAYOUT_TOURED_UNITS_WITH_MEMBERS', {
        touredUnits,
        memberNames,
      })
    : memberNames;
};

export const getEnhancedAppointments = (appointmentsList, { users: usersMap, partyMembers: membersMap, inactiveMembers = [], timezone, parties }) => {
  if (!appointmentsList || !usersMap) return [];
  return appointmentsList.map(app => {
    const agent = usersMap.get(app.userIds[0]);
    const partyMembers = [
      ...getObjectsFromMapByIds(membersMap, app.metadata.partyMembers),
      ...getObjectsFromMapByIds(inactiveMembers, app.metadata.partyMembers),
    ];

    let propertyTimezone;

    if (parties) {
      propertyTimezone = (parties.get(app.partyId) || {}).timezone;
    }

    const tz = propertyTimezone || timezone;

    return {
      ...app,
      guestNames: orderedGuestNames(partyMembers),
      partyMembers,
      agentName: agent && agent.fullName,
      timezone: tz,
      // TODO: check if pretty date is used
      prettyDate: toMoment(app.metadata.startDate, { timezone: tz }).calendar(),
    };
  });
};

export const formatTaskTimeForTitle = (task, timezone) => {
  const startDate = (task.metadata && task.metadata.startDate) || task.dueDate;

  const appointmentMoment = toMoment(startDate, { timezone });

  const nowDate = now({ timezone });
  if (nowDate.isSame(appointmentMoment, 'days')) {
    return `${t('DATE_TODAY')}  at ${formatTimestamp(appointmentMoment, { timezone })}`;
  }

  const tomorrow = nowDate.clone().add(1, 'days');
  if (tomorrow.isSame(appointmentMoment, 'days')) {
    return `${t('DATE_TOMORROW')}  at ${toMoment(appointmentMoment, { timezone }).format(TIME_MERIDIEM_FORMAT)} ${appointmentMoment.zoneAbbr()}`;
  }
  return `${formatTimestamp(appointmentMoment, { timezone })}`;
};

export const formatAppointmentTitleForAppointmentCard = (appointment, timezone) => {
  const appointmentMoment = toMoment(appointment.metadata.startDate, { timezone });
  const nowDate = now({ timezone });
  const upcoming = appointmentMoment.isAfter(nowDate);

  const completed = appointment.state === DALTypes.TaskStates.COMPLETED;

  const upcomingLabel = upcoming && !completed ? `${t('UPCOMING')}:` : '';

  const rescheduleStatus = appointment.metadata && appointment.metadata.rescheduled ? ` (${t('RESCHEDULED')})` : '';
  return `${upcomingLabel}${rescheduleStatus} ${formatTaskTimeForTitle(appointment, timezone)}`;
};

export const getTourTypesForDropdown = ({ storedTourType, tourTypesAvailableInSettings = [] }) => {
  const availableTourTypes = new Set([...tourTypesAvailableInSettings, storedTourType]);

  return Object.keys(DALTypes.TourTypes).reduce((acc, key) => {
    const tourTypeId = DALTypes.TourTypes[key];
    availableTourTypes.has(tourTypeId) && acc.push({ id: tourTypeId, text: t(key) });
    return acc;
  }, []);
};

export const getTourTypesForAppointmentCard = () => [
  { id: DALTypes.TourTypes.VIRTUAL_TOUR, text: t('IN_A_VIRTUAL_TOUR') },
  { id: DALTypes.TourTypes.IN_PERSON_TOUR, text: t('IN_A_PERSON_TOUR') },
  { id: DALTypes.TourTypes.IN_PERSON_SELF_GUIDED_TOUR, text: t('IN_A_PERSON_SELF_GUIDED_TOUR') },
  { id: DALTypes.TourTypes.LEASING_APPOINTMENT, text: t('IN_A_LEASING_APPOINTMENT') },
  { id: DALTypes.TourTypes.IMPORTED_TOUR, text: t('IN_A_IMPORTED_TOUR') },
];
