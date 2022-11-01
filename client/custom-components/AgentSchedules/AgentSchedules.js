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
import range from 'lodash/range';
import { FlyOut, FlyOutOverlay, Button, Typography, Icon, Avatar, RedTable, Radio } from 'components';
import handleFlyoutAnimation from 'helpers/employeesFlyoutAnimation';
import { getBusinessTitle } from 'helpers/users';
import * as agentSchedulesActions from 'redux/modules/agentSchedulesStore';
import { createSelector } from 'reselect';
import { cf } from './AgentSchedules.scss';
import EmployeeSelector from '../../containers/Dashboard/EmployeeSelector';
import { isAgentInMultipleTeams, getTeamsWhereUserIsAgentExceptResidentServiceTeams } from '../../../common/acd/roles';
import { toMoment, DATE_ISO_FORMAT } from '../../../common/helpers/moment-utils';

const { SubHeader, Caption, Text } = Typography;
const { Table, Row, RowHeader, Cell } = RedTable;

const columnWidth = 180;

const getFloatingAgents = createSelector(
  state => state.globalStore.get('users').filter(isAgentInMultipleTeams).toArray(),
  res => res,
);

@connect(
  state => ({
    users: state.globalStore.get('users'),
    floatingAgents: getFloatingAgents(state),
    startDate: state.agentSchedules.startDate,
    endDate: state.agentSchedules.endDate,
    availability: state.agentSchedules.availability,
    loading: state.agentSchedules.loading,
  }),
  dispatch => bindActionCreators({ ...agentSchedulesActions }, dispatch),
)
export default class AgentSchedules extends Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  static propTypes = {
    users: PropTypes.object,
    startDate: PropTypes.string,
    endDate: PropTypes.string,
    availability: PropTypes.object,
    loading: PropTypes.bool,
  };

  handleAgentSelected = item => {
    this.agentSelector.close();
    const selectedAgent = this.props.users.get(item.id);
    this.setState({ selectedAgent });
    this.props.loadAvailability(selectedAgent.id);
  };

  renderSelectedAgent = () => {
    const { selectedAgent } = this.state;

    if (selectedAgent) {
      return (
        <div className={cf('agent-card')}>
          <Avatar userName={selectedAgent.fullName} src={selectedAgent.avatarUrl} />
          <div className={cf('agent-text')}>
            <SubHeader>{selectedAgent.fullName}</SubHeader>
            <Caption secondary>{getBusinessTitle(selectedAgent)}</Caption>
          </div>
        </div>
      );
    }

    return <SubHeader>{t('SELECT_A_LEASING_AGENT')}</SubHeader>;
  };

  renderAvailabilityRowHeader = selectedAgent => (
    <RowHeader>
      <Cell width={columnWidth} textAlign="center" />
      {getTeamsWhereUserIsAgentExceptResidentServiceTeams(selectedAgent).map(team => (
        <Cell width={columnWidth} textAlign="center" key={`h-${team.displayName}`}>
          <Caption>{team.displayName}</Caption>
        </Cell>
      ))}
      <Cell width={columnWidth} textAlign="center">
        <Caption>{t('UNAVAILABLE_FOR_TOURS')}</Caption>
      </Cell>
    </RowHeader>
  );

  get availabilityRange() {
    const { startDate, endDate, availability } = this.props;

    if (!startDate || !endDate) return [];

    const start = toMoment(startDate);
    const end = toMoment(endDate);
    const noOfDays = end.diff(start, 'days') + 1;

    return range(noOfDays).map(dayNo => {
      const day = start.clone().add(dayNo, 'days');
      const date = day.format(DATE_ISO_FORMAT);
      return {
        date,
        displayDate: day.format('dddd MM.DD'),
        availableTeam: availability[date],
      };
    });
  }

  renderAvailabilityRows = selectedAgent =>
    this.availabilityRange.map(dayAvailability => (
      <Row key={`r-${selectedAgent.id}-${dayAvailability.date}`} data-id={`r-${dayAvailability.date}`}>
        <Cell width={columnWidth} textAlign="right" key={`c-${selectedAgent.id}-${dayAvailability.date}`}>
          <Text>{dayAvailability.displayDate}</Text>
        </Cell>
        {getTeamsWhereUserIsAgentExceptResidentServiceTeams(selectedAgent).map(team => (
          <Cell
            width={columnWidth}
            textAlign="center"
            key={`c-${selectedAgent.id}-${dayAvailability.date}-${team.displayName}`}
            data-id={`c-${team.displayName}`}>
            <Radio
              checked={dayAvailability.availableTeam === team.id}
              onChange={checked => checked && this.props.saveAvailability(dayAvailability.date, selectedAgent.id, team.id)}
            />
          </Cell>
        ))}
        <Cell width={columnWidth} textAlign="center" key={`c-${selectedAgent.id}-${dayAvailability.date}-unavailable`} data-id={'c-unavailable'}>
          <Radio
            checked={!dayAvailability.availableTeam}
            onChange={checked => checked && this.props.saveAvailability(dayAvailability.date, selectedAgent.id)}
          />
        </Cell>
      </Row>
    ));

  render = () => {
    const { selectedAgent } = this.state;
    return (
      <div className={cf('container')}>
        <FlyOut ref={ref => (this.agentSelector = ref)} overTrigger expandTo="bottom-right">
          <Button type="wrapper" className={cf('agents-button')} data-id={'floatig-agent-button'}>
            {this.renderSelectedAgent()}
            <span className={cf('icon-wrapper')}>
              <Icon name="menu-down" />
            </span>
          </Button>
          <FlyOutOverlay animationFn={handleFlyoutAnimation} container={false} elevation={2}>
            <EmployeeSelector users={this.props.floatingAgents} onEmployeeSelected={this.handleAgentSelected} placeholderText={t('FIND')} noStatusBadge />
          </FlyOutOverlay>
        </FlyOut>
        {selectedAgent && (
          <div className={cf('container')}>
            <Table type="readOnly" data-id={'floating-table'}>
              {this.renderAvailabilityRowHeader(selectedAgent)}
              {this.renderAvailabilityRows(selectedAgent)}
            </Table>
            <div className={cf('show-more-button')}>
              <Button type="flat" label={t('SHOW_MORE')} loading={this.props.loading} onClick={() => this.props.loadMoreAvailability(selectedAgent.id)} />
            </div>
          </div>
        )}
      </div>
    );
  };
}
