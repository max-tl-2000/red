/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
// import TaskCard from '../TaskCard';
import { mount } from 'enzyme';
import { DALTypes } from '../../../../../common/enums/DALTypes';

import * as taskUtils from '../../../../helpers/taskUtils';
import { toMoment } from '../../../../../common/helpers/moment-utils';

const { mockModules } = require('test-helpers/mocker').default(jest);

const baseDate = toMoment('2017-05-18T20:00:11').utc();

jest.resetModules();

mockModules({
  '../../../../helpers/taskUtils.js': {
    ...taskUtils,
    taskDuedateFormat: () => '1 DAY OVERDUE', // always mock this instance as 1 day overdue only
  },
});

const TaskCard = require('../TaskCard').default;

const activeIntroduceYourselfTask = {
  id: 'd5a906a9-5a9b-4e41-a40b-3a57f81d9791',
  created_at: '2016-11-23T22:30:39.232Z',
  dueDate: baseDate.format(),
  updated_at: baseDate.format(),
  name: DALTypes.TaskNames.INTRODUCE_YOURSELF,
  partyId: 'd5a906a9-5a9b-4e41-a40b-3a57f81d979a',
  state: DALTypes.TaskStates.ACTIVE,
  userIds: ['25e5702d-ef29-4996-8948-c1fc593e5b36'],
  category: 'Party',
  metadata: {},
};

const completeIntroduceYourselfTask = {
  ...activeIntroduceYourselfTask,
  state: DALTypes.TaskStates.COMPLETED,
};

const overdueIntroduceYourselfTask = {
  ...activeIntroduceYourselfTask,
  dueDate: toMoment(activeIntroduceYourselfTask.dueDate).subtract(2, 'days').format(),
};

const selectorData = {
  users: [
    {
      created_at: '2016-11-19T22:30:39.232Z',
      fullName: 'Alice Altimes',
      id: '25e5702d-ef29-4996-8948-c1fc593e5b36',
      preferredName: 'Alice',
      teams: [
        {
          id: 'd491d706-6129-4edc-a69a-ee5cd026ca68',
          displayName: 'Parkmerced Pod',
          mainRoles: ['PM'],
        },
      ],
    },
  ],
};

const party = {
  partyMembers: [{ fullName: 'Client Name 1' }, { fullName: 'Client Name 2' }],
};

const currentUser = {
  id: '0e3c5587-b27f-4e2a-bb45-9368cd2727b3',
};

describe('TaskCard', () => {
  describe('Active introduce yourself TaskCard', () => {
    const wrapper = mount(
      <TaskCard party={party} task={activeIntroduceYourselfTask} formattedValue="Introduce yourself" selectorData={selectorData} currentUser={currentUser} />,
    );
    it('should have a blank checkbox, have the text "Introduce yourself"', () => {
      expect(wrapper).toMatchSnapshot();
    });
  });

  describe('Completed introduce yourself TaskCard', () => {
    const wrapper = mount(
      <TaskCard party={party} task={completeIntroduceYourselfTask} formattedValue="Introduce yourself" selectorData={selectorData} currentUser={currentUser} />,
    );

    it('should have a check icon, and task name and task date disabled', () => {
      expect(wrapper).toMatchSnapshot();
    });
  });

  describe('Overdue introduce yourself TaskCard', () => {
    const wrapper = mount(
      <TaskCard party={party} task={overdueIntroduceYourselfTask} formattedValue="Introduce yourself" selectorData={selectorData} currentUser={currentUser} />,
    );

    it('should have a blank icon, use regular text to show task name and have the taskDate highlighted', () => {
      expect(wrapper).toMatchSnapshot();
    });
  });
});
