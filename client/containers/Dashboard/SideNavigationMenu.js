/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Button, FullScreenDialog, DialogTitle, SavingAffordance } from 'components';

import UserSettings from 'custom-components/UserSettings/UserSettings';
import AgentSchedules from 'custom-components/AgentSchedules/AgentSchedules';
import SickLeaves from 'custom-components/SickLeaves/SickLeaves';
import SideNav from 'custom-components/SideNav/SideNav';
import RevaUniversity from 'custom-components/RevaUniversity/RevaUniversity';

import { t } from 'i18next';
import BlacklistAdmin from '../Tenants/BlacklistAdmin';
import { cf } from './TopNavigationBar.scss';
import CallQueueDetails from '../CallQueueDetails/CallQueueDetails';

export default class SideNavigationMenu extends Component {
  static propTypes = {
    users: PropTypes.object,
    loggedInUser: PropTypes.object,
    tenantName: PropTypes.string,
    enableRingPhoneConfiguration: PropTypes.bool,
  };

  constructor(props) {
    super(props);
    this.state = {
      isAddSickLeaveEnabled: false,
      addSickLeaveDialogOpen: false,
    };
  }

  handleEnableAddSickLeave = () => {
    this.setState({
      isAddSickLeaveEnabled: true,
    });
  };

  handleSetAddSickLeaveDialogOpenState = addSickLeaveDialogOpen => {
    this.setState({
      addSickLeaveDialogOpen,
    });
  };

  handleUserDataChanged = updatedData => {
    const loggedInUser = this.props.loggedInUser;
    if (!loggedInUser) return;
    this.props.updateUser(loggedInUser.id, updatedData);
  };

  render() {
    const { users, loggedInUser, tenantName, enableRingPhoneConfiguration } = this.props;
    const { isAddSickLeaveEnabled, addSickLeaveDialogOpen } = this.state;
    return (
      <div>
        <SideNav
          users={users}
          onUserSettingsClick={() => this.setState({ showUserSettings: true })}
          onManageBlacklistClick={() => this.setState({ showManageBlacklistScreen: true })}
          onAgentSchedulesClick={() => this.setState({ showAgentSchedulesScreen: true })}
          onAddSickLeavesClick={() => this.setState({ showAddSickLeavesScreen: true })}
          onRevaUniversityClick={() => this.setState({ showRevaUniversityScreen: true })}
          onCallQueueDetailsQueueClick={() => this.setState({ showCallQueueDetailsScreen: true })}
        />
        <FullScreenDialog
          open={this.state.showUserSettings}
          onCloseRequest={() => this.setState({ showUserSettings: false })}
          title={[
            <DialogTitle key="title">
              <span>{t('USER_SETTINGS')}</span>
            </DialogTitle>,
            <SavingAffordance key="saving-affordance" matcher={/patch_\/users\//} lighter />,
          ]}>
          <UserSettings
            loggedInUser={loggedInUser}
            onUserDataChanged={this.handleUserDataChanged}
            tenantName={tenantName}
            enableRingPhoneConfiguration={enableRingPhoneConfiguration}
          />
        </FullScreenDialog>
        <FullScreenDialog
          open={this.state.showRevaUniversityScreen}
          onCloseRequest={() => this.setState({ showRevaUniversityScreen: false })}
          title={[
            <DialogTitle key="title">
              <span>{t('REVA_UNIVERSITY')}</span>
            </DialogTitle>,
            <SavingAffordance key="saving-affordance" matcher={/patch_\/users\//} lighter />,
          ]}>
          <RevaUniversity loggedInUser={loggedInUser} onUserDataChanged={this.handleUserDataChanged} tenantName={tenantName} />
        </FullScreenDialog>
        <FullScreenDialog
          open={this.state.showAgentSchedulesScreen}
          onCloseRequest={() => this.setState({ showAgentSchedulesScreen: false })}
          title={[
            <DialogTitle key="title">
              <span>{t('ROTATING_AGENT_SCHEDULES')}</span>
            </DialogTitle>,
            <SavingAffordance key="saving-affordance" matcher={/post_\/floatingAgents\//} lighter />,
          ]}>
          <AgentSchedules />
        </FullScreenDialog>
        <FullScreenDialog
          open={this.state.showCallQueueDetailsScreen}
          onCloseRequest={() => this.setState({ showCallQueueDetailsScreen: false })}
          title={[
            <DialogTitle key="title">
              <span>{t('CALL_QUEUE_DETAILS_TITLE')}</span>
            </DialogTitle>,
            <SavingAffordance key="saving-affordance" matcher={/patch_\/callQueueDetails\//} lighter />,
          ]}>
          <CallQueueDetails />
        </FullScreenDialog>
        <FullScreenDialog
          open={this.state.showAddSickLeavesScreen}
          onCloseRequest={() => this.setState({ showAddSickLeavesScreen: false, isAddSickLeaveEnabled: false })}
          title={[
            <DialogTitle key="title">
              <span>{t('SICK_LEAVE')}</span>
            </DialogTitle>,
            <SavingAffordance key="saving-affordance" matcher={/post_\/sickLeaves\//} lighter />,
          ]}
          actions={
            <div className={cf('add-sick-leave-button-wrapper')}>
              <Button disabled={!isAddSickLeaveEnabled} onClick={() => this.handleSetAddSickLeaveDialogOpenState(true)}>
                {t('ADD_SICK_LEAVE')}
              </Button>
            </div>
          }>
          <SickLeaves
            onAgentSelected={this.handleEnableAddSickLeave}
            closeAddSickLeaveDialog={() => this.handleSetAddSickLeaveDialogOpenState(false)}
            addSickLeaveDialogOpen={addSickLeaveDialogOpen}
          />
        </FullScreenDialog>
        <FullScreenDialog
          open={this.state.showManageBlacklistScreen}
          onCloseRequest={() => this.setState({ showManageBlacklistScreen: false })}
          title={
            <DialogTitle>
              <span>{t('BLACKLIST')}</span>
            </DialogTitle>
          }>
          <BlacklistAdmin loggedInUser={loggedInUser} users={users} onUserDataChanged={this.handleUserDataChanged} />
        </FullScreenDialog>
      </div>
    );
  }
}
