/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { t } from 'i18next';
import { createSelector } from 'reselect';
import * as telephonyActions from 'redux/modules/telephony';
import { updateUserStatus } from 'redux/modules/usersStore';
import { inject, observer } from 'mobx-react';
import callStates from 'helpers/enums/callStates';
import { Typography, Icon, Button } from 'components';
import { DALTypes } from '../../../common/enums/DALTypes';
import { cf } from './WrapUpTimeCounter.scss';
import mediator from '../../helpers/mediator';
import EventTypes from '../../../common/enums/eventTypes';
import { getTeamMembersWhereUserIsAgent } from '../../../common/acd/roles';

const { Caption, Title } = Typography;

const getUser = createSelector(
  state => state.globalStore.get('users'),
  state => state.auth.user,
  (users, logedUser) => {
    if (!logedUser) return null;
    return users.find(u => u.id === logedUser.id);
  },
);

@inject('teamsCallQueueStore')
@observer
@connect(
  (state, props) => ({
    wrapUpRemainingTime: state.telephony.wrapUpTime,
    showWrapUpCounter: state.telephony.showWrapUpCounter,
    callState: state.telephony.callState,
    user: getUser(state, props),
  }),
  dispatch =>
    bindActionCreators(
      {
        ...telephonyActions,
        updateUserStatus,
      },
      dispatch,
    ),
)
export default class WrapUpTimeCounter extends Component {
  static propTypes = {
    wrapUpRemainingTime: PropTypes.number,
    showWrapUpCounter: PropTypes.bool,
    user: PropTypes.object,
  };

  componentWillUnmount() {
    mediator.off(EventTypes.TEAMS_CALL_QUEUE_CHANGED, this.handleTeamsCallQueueChangedNotification);
  }

  handleTeamsCallQueueChangedNotification = (e, data) => {
    const { teamsCallQueueStore } = this.props;
    const { teamsCallQueue } = data;
    teamsCallQueue && teamsCallQueueStore.combineResultsTeamsCallQueue(teamsCallQueue);
  };

  componentWillReceiveProps(nextProps) {
    const isCallStatusChange = nextProps.callState && nextProps.callState !== this.props.callState;
    const isOutgoingCall = nextProps.callState === callStates.OUTGOING;
    const isSetAvailableWhileWrapUp = nextProps.showWrapUpCounter && nextProps.user && nextProps.user.metadata.status === DALTypes.UserStatus.AVAILABLE;

    if ((this.props.showWrapUpCounter && isCallStatusChange && isOutgoingCall) || isSetAvailableWhileWrapUp) {
      this.props.closeWrapUpCounter();
    }

    if (nextProps.showWrapUpCounter && !this.props.showWrapUpCounter) {
      this.props.teamsCallQueueStore.loadTeamCallQueue();
      mediator.on(EventTypes.TEAMS_CALL_QUEUE_CHANGED, this.handleTeamsCallQueueChangedNotification);
    }
  }

  setUserAvailable = () => {
    const { user } = this.props;
    if (!user) return;
    this.props.updateUserStatus(user.id, { status: DALTypes.UserStatus.AVAILABLE });
    this.props.closeWrapUpCounter();
  };

  getUserCallQueueDepth = () => {
    const { user, teamsCallQueueStore } = this.props;

    const teamsWhereUserIsLWA = getTeamMembersWhereUserIsAgent(user.teams);
    return teamsWhereUserIsLWA.reduce((acc, team) => {
      const count = +(teamsCallQueueStore.teamsCallQueue.get(team.id)?.count || 0);
      acc += count;
      return acc;
    }, 0);
  };

  render = () => {
    const { wrapUpRemainingTime, showWrapUpCounter } = this.props;

    if (!showWrapUpCounter) return <noScript />;
    const callQueueDepth = this.getUserCallQueueDepth();

    return (
      showWrapUpCounter && (
        <div className={cf('mainContent')}>
          <div className={cf('wrapUpContent')}>
            <Icon name="timer" iconStyle="light" />
            <Title bold lighter className={cf('counter')}>
              {wrapUpRemainingTime}
            </Title>
            <Caption lighter secondary>
              {t('SECONDS_REMAINING')}
            </Caption>
          </div>
          {!!callQueueDepth && (
            <Caption className={cf('queueCalls')} lighter secondary>
              {t('NUMBER_CALLS_IN_QUEUE', { count: callQueueDepth })}
            </Caption>
          )}
          <Button
            id="availableBtn"
            className={cf('availableButton')}
            type="flat"
            btnRole="primary"
            label={t('I_AM_AVAILABLE')}
            onClick={this.setUserAvailable}
          />
        </div>
      )
    );
  };
}
