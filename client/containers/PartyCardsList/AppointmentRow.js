/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { t } from 'i18next';

import { RedList as L, Typography as T, Icon } from 'components';
import { infoToDisplayOnPerson } from 'helpers/infoToDisplayOnPerson';
import { cf } from './EntryRow.scss';

import { DALTypes } from '../../../common/enums/DALTypes';
import TaskOwnersRow from './TaskOwnersRow';
import { now, toMoment, formatMoment } from '../../../common/helpers/moment-utils';
import { isSelfServiceAppointment } from '../../../common/helpers/tasks';

export default class AppointmentRow extends Component {
  static propTypes = {
    appointment: PropTypes.shape({
      id: PropTypes.string.isRequired,
      metadata: PropTypes.object.isRequired,
      isOverdue: PropTypes.bool,
    }),
    users: PropTypes.object,
    currentUser: PropTypes.object,
    members: PropTypes.array,
    showOwners: PropTypes.bool,
    startDateFormat: PropTypes.string.isRequired,
    onClick: PropTypes.func.isRequired,
  };

  handleClick = () => this.props.onClick(this.props.appointment);

  get canCompleteAppointment() {
    return toMoment(this.props.appointment.metadata.startDate).isBefore(now());
  }

  getGuests = () => {
    const { appointment, members } = this.props;

    return appointment.metadata.partyMembers
      .map(id => members.find(m => m.id === id))
      .map(guest => infoToDisplayOnPerson(guest))
      .filter(guest => guest)
      .join(', ');
  };

  render({ appointment, showOwners, startDateFormat, users, currentUser, timezone, dataId } = this.props) {
    const guests = this.getGuests();
    const isCompleteOrCanceled = appointment.state === DALTypes.TaskStates.COMPLETED || appointment.state === DALTypes.TaskStates.CANCELED;
    const titlePrefix = isSelfServiceAppointment(appointment.metadata) ? `${t('SELF_SERVICE')} ` : ' ';

    return (
      <L.ListItem fixedSections={1} onClick={this.handleClick}>
        <L.AvatarSection>
          <Icon name={isCompleteOrCanceled ? 'check' : 'checkbox-blank-outline'} disabled={!this.canCompleteAppointment} />
        </L.AvatarSection>
        <L.MainSection className={cf('main-section')}>
          <T.Text error={appointment.isOverdue} ellipsis>
            <span data-id={dataId} className={cf('date')}>
              {formatMoment(appointment.metadata.startDate, { format: startDateFormat, timezone })}
            </span>
            {titlePrefix}
            {t('PROSPECT_CARD_APPOINTMENT_WITH_PARTICIPANTS', { guests })}
          </T.Text>
          {showOwners && <TaskOwnersRow task={appointment} users={users} currentUser={currentUser} />}
        </L.MainSection>
      </L.ListItem>
    );
  }
}
