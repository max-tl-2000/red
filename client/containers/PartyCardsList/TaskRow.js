/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { t } from 'i18next';

import { Icon, RedList as L, Typography as T } from 'components';
import { DALTypes } from '../../../common/enums/DALTypes';
import { cf } from './EntryRow.scss';
import { isTaskOverdue, isTaskComplete, shouldTaskShowGuestName, getFormattedTaskTitle } from '../../helpers/taskUtils';
import TaskOwnersRow from './TaskOwnersRow';
import { getDisplayName } from '../../../common/helpers/person-helper';

export default class TaskRow extends Component {
  static propTypes = {
    task: PropTypes.object,
    users: PropTypes.object,
    members: PropTypes.array,
    currentUser: PropTypes.object,
    showOwners: PropTypes.bool,
    onClick: PropTypes.func,
    dataId: PropTypes.string,
  };

  handleClick = () => {
    const { onClick } = this.props;
    onClick && onClick();
  };

  getTaskFormattedValue = () => {
    const { task, members } = this.props;

    if (shouldTaskShowGuestName(task)) {
      const guest = members.find(pm => pm.personId === task.metadata.personId);

      const guestName = guest ? getDisplayName(guest.person) : '';
      return t(task.name, { guestName });
    }

    return task.category === DALTypes.TaskCategories.MANUAL && !task.metadata?.formatTitle ? task.name : getFormattedTaskTitle(task);
  };

  render = () => {
    const { task, showOwners, users, currentUser, timezone, dataId } = this.props;

    const isComplete = isTaskComplete(task);
    const isOverdue = isTaskOverdue(task, timezone);

    return (
      <L.ListItem fixedSections={1}>
        <L.AvatarSection>
          <Icon id={`${dataId}_checkbox`} name={isComplete ? 'check' : 'checkbox-blank-outline'} disabled />
        </L.AvatarSection>
        <L.MainSection className={cf('main-section')} onClick={this.handleClick} data-task-name={task.name}>
          <T.Text error={isOverdue} data-id={`${dataId}_name`} ellipsis>
            {this.getTaskFormattedValue()}
          </T.Text>
          {showOwners && <TaskOwnersRow task={task} users={users} currentUser={currentUser} />}
        </L.MainSection>
      </L.ListItem>
    );
  };
}
