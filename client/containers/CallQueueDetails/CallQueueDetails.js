/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';

import { Typography, RedTable } from 'components';

const { TextHeavy } = Typography;
const { Table, Row, Cell } = RedTable;
import { t } from 'i18next';
import { connect } from 'react-redux';
import { inject, observer } from 'mobx-react';
import { getUserCallQueueTeams } from '../../redux/selectors/callQueueSelectors';
import CallQueueTeamListItem from './CallQueueTeamListItem';
import mediator from '../../helpers/mediator';
import EventTypes from '../../../common/enums/eventTypes';

@inject('teamsCallQueueStore')
@observer
@connect(state => ({
  userCallQueueTeams: getUserCallQueueTeams(state),
}))
export default class CallQueueDetails extends Component {
  componentDidMount() {
    this.props.teamsCallQueueStore.loadTeamCallQueue();
    mediator.on(EventTypes.TEAMS_CALL_QUEUE_CHANGED, this.handleTeamsCallQueueChangedNotification);
  }

  componentWillUnmount() {
    mediator.off(EventTypes.TEAMS_CALL_QUEUE_CHANGED, this.handleTeamsCallQueueChangedNotification);
  }

  handleTeamsCallQueueChangedNotification = (e, data) => {
    const { teamsCallQueueStore } = this.props;
    const { teamsCallQueue } = data;
    teamsCallQueueStore.combineResultsTeamsCallQueue(teamsCallQueue);
  };

  render() {
    const { userCallQueueTeams } = this.props;
    return (
      <Table>
        <Row fullWidthDivider>
          <Cell width={'20%'}>
            <TextHeavy>{t('TEAM_NAME')}</TextHeavy>
          </Cell>
          <Cell width={'20%'}>
            <TextHeavy>{t('QUEUE_DEPTH')} </TextHeavy>
          </Cell>
          <Cell>
            <TextHeavy>{t('AGENT_STATUS')}</TextHeavy>
          </Cell>
        </Row>
        {userCallQueueTeams.map(({ teamId, displayName, teamMembers }) => (
          <CallQueueTeamListItem key={`callQueueTeamListItem-${teamId}`} teamId={teamId} displayName={displayName} teamMembers={teamMembers} />
        ))}
      </Table>
    );
  }
}
