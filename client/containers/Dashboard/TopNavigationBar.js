/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import handleFlyoutAnimation from 'helpers/employeesFlyoutAnimation';
import { windowOpen } from 'helpers/win-open';
import { getUnitPricingUrl } from 'helpers/sisense';

import {
  FlyOut,
  FlyOutOverlay,
  IconButton,
  Icon,
  Button,
  Avatar,
  AppBar,
  AppBarMainSection,
  AppBarActions,
  AppBarIconSection,
  Typography,
  Switch,
} from 'components';

import { loadOverview, clearOverview } from 'redux/modules/schedule';
import { updateUser } from 'redux/modules/usersStore';

import * as dashboardActions from 'redux/modules/dashboardStore';
import { t } from 'i18next';
import DemoElement from 'custom-components/DemoElement/DemoElement';
import { loadNavigationHistory, resetNavigationHistory } from 'redux/modules/locationTracking';
import { observer, inject } from 'mobx-react';
import { getPartyFilterSelector } from 'redux/selectors/userSelectors';
import { loadDashboardData } from 'redux/modules/appDataLoadingActions';
import ScheduleCalendar from './ScheduleCalendar';
import EmployeeSelector from './EmployeeSelector';
import NavigationHistory from './NavigationHistory';
import SideNavigationMenu from './SideNavigationMenu';

import { cf } from './TopNavigationBar.scss';
import { employeesSelectorData } from '../../../common/employee-selectors/selector-data-dashboard';

import { getBadgeName } from '../../helpers/users';
import { findLocalTimezone } from '../../../common/helpers/moment-utils';
import { isUnitPricingEnabled } from '../../../common/helpers/utils';

const { Text } = Typography;

@connect(
  state => ({
    loggedInUser: state.auth.user,
    users: state.globalStore.get('users'),
    currentUserId: (state.auth.user || {}).id,
    showOnlyToday: state.dashboardStore.showOnlyToday,
    dashboardSelection: state.dashboardStore.dashboardSelection,
    navigationHistory: state.locationTracking.navigationHistory,
    isLoadingNavigationHistory: state.locationTracking.isLoading,
    refreshNeeded: state.dashboardStore.refreshNeeded,
    partyFilter: getPartyFilterSelector(state),
  }),
  dispatch =>
    bindActionCreators(
      {
        ...dashboardActions,
        updateUser,
        clearOverview,
        loadScheduleOverview: loadOverview,
        loadNavigationHistory,
        resetNavigationHistory,
        loadDashboardData,
      },
      dispatch,
    ),
)
@inject('leasingNavigator')
@observer
export default class TopNavigationBar extends Component {
  static propTypes = {
    loadScheduleOverview: PropTypes.func.isRequired,
    users: PropTypes.object,
    currentUserId: PropTypes.string,
    onUserSelected: PropTypes.func,
  };

  constructor(props) {
    super(props);
    const { filteredTeams, filteredUsers } = this.determineFilteredElements(props);

    this.state = {
      filteredTeams,
      filteredUsers,
    };
  }

  componentWillMount() {
    const { users, currentUserId, dashboardSelection, setDashboardSelection } = this.props;

    if (!dashboardSelection) {
      setDashboardSelection(users.get(currentUserId));
    }
  }

  componentWillReceiveProps(nextProps) {
    const { filteredTeams, filteredUsers } = this.determineFilteredElements(nextProps);
    const { users, currentUserId, dashboardSelection, setDashboardSelection } = nextProps;

    this.setState({
      filteredTeams,
      filteredUsers,
    });

    if (!dashboardSelection) {
      setDashboardSelection(users.get(currentUserId));
    }
  }

  determineFilteredElements = ({ users, currentUserId }) => {
    if (!currentUserId || users.size === 0) {
      return { filteredUsers: [], filteredTeams: [] };
    }
    const currentUser = users.get(currentUserId);
    const { users: selectedUsers, teams } = employeesSelectorData(users, currentUser);

    return {
      filteredTeams: teams,
      filteredUsers: selectedUsers,
    };
  };

  handleAnimation({ animProps }) {
    animProps.animation.transformOriginX = ['75%', '75%'];
    animProps.animation.transformOriginY = ['0', '0'];
  }

  handleSearch = () => {
    const { leasingNavigator } = this.props;
    leasingNavigator.navigateToSearch();
  };

  handleOnEmployeeSelected = selectedItem => {
    this.employeeSelectorFlyout.close();
    const { onUserSelected, setDashboardSelection } = this.props;
    onUserSelected && onUserSelected(selectedItem);
    setDashboardSelection(selectedItem);
  };

  handleScheduleCalendarOpen = () => {
    const dashboardSelection = this.props.dashboardSelection;
    const selectedTeam = dashboardSelection.isTeam && dashboardSelection.id;
    const { filteredUsers } = this.state;

    const users = selectedTeam ? filteredUsers.filter(user => user.teams.some(team => team.id === selectedTeam)).map(m => m.id) : [dashboardSelection.id];
    const timezone = findLocalTimezone();
    this.props.loadScheduleOverview({ users, timezone });
  };

  refreshDashboard = () => {
    const { partyFilter, showOnlyToday } = this.props;
    this.props.loadDashboardData(partyFilter, { showOnlyToday });
  };

  openUnitPricing = () => {
    windowOpen(getUnitPricingUrl());
  };

  render() {
    const { filteredTeams, filteredUsers } = this.state;
    const { users, dashboardSelection = {}, loggedInUser, showOnlyToday, toggleDisplayOfLaterAndTomorrow } = this.props;
    const user = loggedInUser && users.get(loggedInUser.id);
    const tenantName = (loggedInUser || {}).tenantName;
    const { enableRingPhoneConfiguration } = (loggedInUser || {}).features || {};
    const userId = (user || {}).id;
    let selectedItem = {};
    if (dashboardSelection.isTeam) {
      selectedItem = { name: dashboardSelection.fullName };
    } else if (dashboardSelection.id) {
      const selectedUser = users.get(dashboardSelection.id);
      selectedItem = {
        name: selectedUser.fullName,
        avatar: selectedUser.avatarUrl,
        badgeIcon: true,
        status: selectedUser.metadata.status,
      };
    }

    const badgeName = selectedItem.badgeIcon && getBadgeName(selectedItem.status);

    return (
      <AppBar flat>
        <AppBarIconSection>
          <SideNavigationMenu
            updateUser={this.props.updateUser}
            users={users}
            loggedInUser={user}
            tenantName={tenantName}
            enableRingPhoneConfiguration={enableRingPhoneConfiguration}
            handleOnManageBlacklistClick={this.handleOnManageBlacklistClick}
          />
        </AppBarIconSection>
        <AppBarMainSection>
          <FlyOut ref={ref => (this.employeeSelectorFlyout = ref)} overTrigger expandTo="bottom-right">
            <Button type="wrapper" className={cf('employee-button')}>
              {selectedItem.name && (
                <Avatar
                  dataId="employee-avatar"
                  userName={selectedItem.name}
                  src={selectedItem.avatar}
                  badgeIcon={badgeName}
                  badgeIconStyle={{ background: '#fff' }}
                  badgeIconViewBox="2 2 20 20"
                  className={cf('employee-avatar', badgeName)}
                />
              )}
              <Text inline>{selectedItem.name}</Text>
              <span className={cf('icon-wrapper')}>
                <Icon name="menu-down" />
              </span>
            </Button>
            <FlyOutOverlay animationFn={handleFlyoutAnimation} container={false} elevation={2}>
              <EmployeeSelector
                users={filteredUsers}
                teams={filteredTeams}
                currentUserId={userId}
                currentUser={loggedInUser}
                onEmployeeSelected={this.handleOnEmployeeSelected}
              />
            </FlyOutOverlay>
          </FlyOut>
        </AppBarMainSection>
        <AppBarActions>
          {this.props.refreshNeeded && <IconButton iconName="refresh" iconStyle="light" onClick={this.refreshDashboard} />}
          <Switch
            label={t('TODAY_ONLY')}
            checked={showOnlyToday}
            reverse
            foregroundMode="light"
            id="switchTodayOnly"
            onChange={() => toggleDisplayOfLaterAndTomorrow()}
            style={{ marginRight: '1rem' }}
          />
          {isUnitPricingEnabled(tenantName) && <IconButton iconName="table-large" iconStyle="light" onClick={() => this.openUnitPricing()} />}
          <DemoElement>
            <div className={cf('analytics-wrapper')}>
              <div className={cf('analytics')}>
                <div className={cf('goal-section')}>
                  <div className={cf('goal-text')}>
                    <Text inline lighter>
                      2nd
                    </Text>
                    <Text inline secondary lighter>
                      {' '}
                      / 6 (goal achieved)
                    </Text>
                  </div>
                  <div className={cf('triangle', 'triangle-1')} />
                  <div className={cf('triangle', 'triangle-2')} />
                </div>
                <div className={cf('divider')} />
                <FlyOut expandTo="bottom-left">
                  <IconButton iconName="chart-column" iconStyle="light" />
                  <FlyOutOverlay container={false}>
                    <img src="/dashboard.png" alt="Analytics" />
                  </FlyOutOverlay>
                </FlyOut>
              </div>
            </div>
          </DemoElement>
          <FlyOut
            appendToBody
            onOpen={this.handleScheduleCalendarOpen}
            onClose={this.props.clearOverview}
            positionArgs={{
              my: 'right-24 top+65',
              at: 'right top',
              of: window,
            }}>
            <IconButton iconName="calendar" iconStyle="light" />
            <FlyOutOverlay animationFn={this.handleAnimation} container={false}>
              <ScheduleCalendar users={this.state.filteredUsers} isTeam={dashboardSelection.isTeam} />
            </FlyOutOverlay>
          </FlyOut>
          <FlyOut appendToBody expandTo="bottom-left" onOpen={this.props.loadNavigationHistory} onClose={this.props.resetNavigationHistory}>
            <IconButton iconName="history" iconStyle="light" />
            <FlyOutOverlay animationFn={this.handleAnimation} container={false}>
              <NavigationHistory navigationHistory={this.props.navigationHistory} isLoading={this.props.isLoadingNavigationHistory} />
            </FlyOutOverlay>
          </FlyOut>
          <IconButton iconName="magnify" iconStyle="light" onClick={this.handleSearch} />
        </AppBarActions>
      </AppBar>
    );
  }
}
