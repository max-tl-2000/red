/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';

import { Typography, RedTable, RedList } from 'components';

const { Text, Caption } = Typography;
const { Row, Cell } = RedTable;
const { List } = RedList;

import { t } from 'i18next';
import { inject, observer } from 'mobx-react';
import PropTypes from 'prop-types';
import { DALTypes } from '../../../common/enums/DALTypes';
import AgentStatusCard from './AgentStatusCard';
import PreloaderBlock from '../../components/PreloaderBlock/PreloaderBlock';
import { cf } from './CallQueueTeamListItem.scss';
import { orderUsersByAvailability } from '../../helpers/users';

const DEFAULT_CALL_QUEUE_DEPTH = 0;

@inject('teamsCallQueueStore')
@observer
export default class CallQueueTeamListItem extends Component {
  static propTypes = {
    teamMembers: PropTypes.array,
    teamId: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
  };

  get agentsAvailable() {
    const { teamMembers } = this.props;
    return teamMembers.filter(teamMember => teamMember?.metadata?.status === DALTypes.UserStatus.AVAILABLE).length;
  }

  renderAgentStatus = teamMember => {
    const { teamId } = this.props;
    const { metadata, fullName, avatarUrl } = teamMember || {};
    return <AgentStatusCard key={`agentStatusCard-${teamId}-${teamMember.id}`} employeeFullName={fullName} metadata={metadata} avatarUrl={avatarUrl} />;
  };

  get teamMembers() {
    const { teamMembers } = this.props;
    return orderUsersByAvailability(teamMembers);
  }

  renderQueueDepth = () => {
    const { teamsCallQueueStore, teamId } = this.props;

    if (teamsCallQueueStore.isLoadingTeamsCallQueue) {
      return <PreloaderBlock style={{ alignItems: 'inherit' }} size="tiny" />;
    }

    if (teamsCallQueueStore.teamsCallQueueError) {
      return t('CALL_QUEUE_DEPTH_ERROR');
    }

    const count = +(teamsCallQueueStore.teamsCallQueue.get(teamId)?.count || DEFAULT_CALL_QUEUE_DEPTH);
    return t('COUNT_CALLS', { count });
  };

  render() {
    const { displayName, teamMembers } = this.props;

    return (
      <Row fullWidthDivider>
        <Cell width={'20%'} verticalAlign="top" className={cf('cellTextTopAligned')}>
          <Text>{displayName}</Text>
          <Caption secondary>{t('AGENTS_AVAILABLE', { agentsAvailable: this.agentsAvailable, totalAgents: teamMembers.length })}</Caption>
        </Cell>
        <Cell width={'20%'} verticalAlign="top" className={cf('cellTextTopAligned')}>
          {this.renderQueueDepth()}
        </Cell>
        <Cell>
          <List>{this.teamMembers.map(this.renderAgentStatus)}</List>
        </Cell>
      </Row>
    );
  }
}
