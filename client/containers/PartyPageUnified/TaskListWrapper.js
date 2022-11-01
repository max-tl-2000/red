/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { t } from 'i18next';
import { Section, Button } from 'components';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import {
  getPartyTasks,
  getPartyEnhancedAppointments,
  getTaskOwners,
  personsInParty,
  getPartyMembers,
  getEnhancedInactiveMembers,
  getPartyLeases,
} from 'redux/selectors/partySelectors';
import { toSentenceCase } from 'helpers/capitalize';
import { now } from '../../../common/helpers/moment-utils.ts';
import { saveTask } from '../../redux/modules/tasks';
import TaskList from '../ProspectDetailPage/TaskList/TaskList';
import { DALTypes } from '../../../common/enums/DALTypes';

const TaskListWrapper = props => {
  const {
    partyTasks,
    appointments,
    onNotifyConditionalApprovalClick,
    onReviewApplicationTaskNameClick,
    selectorDataForParty,
    taskOwners,
    persons,
    partyMembers,
    inactiveMembers,
    leases,
    currentUser,
    party,
    partyId,
    timezone,
    isSavingTask,
  } = props;

  const handleRemindMeClick = async () => {
    await props.saveTask({
      category: DALTypes.TaskCategories.MANUAL_REMINDER,
      name: toSentenceCase(DALTypes.TaskNames.REMINDER),
      partyId,
      userIds: [currentUser.id],
      dueDate: now({ timezone }).endOf('day'),
    });
  };

  return (
    <Section
      data-id="todoSection"
      title={t('TO_DO_LABEL')}
      padContent={false}
      actionItems={<Button data-id="remindMe" loading={isSavingTask} onClick={handleRemindMeClick} label={t('REMIND_ME')} />}>
      <TaskList
        tasks={partyTasks}
        enhancedAppointments={appointments}
        selectorData={selectorDataForParty}
        taskOwners={taskOwners}
        persons={persons}
        partyMembers={partyMembers}
        inactiveMembers={inactiveMembers}
        leases={leases}
        currentUser={currentUser}
        party={party}
        sendMessage={props.sendMessage}
        timezone={timezone}
        onNotifyConditionalApprovalClick={onNotifyConditionalApprovalClick}
        onReviewApplicationTaskNameClick={onReviewApplicationTaskNameClick}
      />
    </Section>
  );
};

export default connect(
  (state, props) => ({
    partyTasks: getPartyTasks(state, props),
    appointments: getPartyEnhancedAppointments(state, props),
    selectorDataForParty: state.partyStore.selectorDataForParty,
    taskOwners: getTaskOwners(state, props),
    persons: personsInParty(state, props),
    partyMembers: getPartyMembers(state, props),
    inactiveMembers: getEnhancedInactiveMembers(state, props),
    leases: getPartyLeases(state, props),
    currentUser: state.auth.user,
    isSavingTask: state.tasks.isSaving,
  }),
  dispatch =>
    bindActionCreators(
      {
        saveTask,
      },
      dispatch,
    ),
)(TaskListWrapper);
