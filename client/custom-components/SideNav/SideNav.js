/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { t } from 'i18next';

import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { updateUserStatus, logoutUser } from 'redux/modules/usersStore';
import * as authActions from 'redux/modules/auth';
import clsc from 'helpers/coalescy';
import { Avatar, IconButton, Switch, FlyOut, FlyOutOverlay, RedList as L, Typography as T } from 'components';
import generateId from 'helpers/generateId';
import DemoElement from 'custom-components/DemoElement/DemoElement';
import { windowOpen } from 'helpers/win-open';
import cfg from 'helpers/cfg';
import { isLoggedAsAdmin, isCustomerAdmin } from 'helpers/users';
import { observer, inject } from 'mobx-react';
import TelephonyErrorBanner from '../../containers/Telephony/TelephonyErrorBanner';
import { logger } from '../../../common/client/logger';
import { getBigAvatar } from '../../../common/helpers/cloudinary';
import { DALTypes } from '../../../common/enums/DALTypes';
import { isScheduleManager, isCohortCommunicationApprover } from '../../../common/acd/roles';
import { cf } from './sideNav.scss';
import { isCommunicationManagementPage } from '../../helpers/leasing-navigator';
import { getBadgeName } from '../../helpers/users';

@connect(
  state => ({
    loggedInUser: state.auth.user,
    dashboardSelection: state.dashboardStore.dashboardSelection,
    enableRevaUniversity: state.auth.user.features.enableUniversity && !state.auth.user.isTrainingTenant,
    enableCohortComms: state.auth.user.features.enableCohortComms && !state.auth.user.isTrainingTenant,
    isPlivoConnectionError: state.telephony.isPlivoConnectionError,
    plivoConnectionErrorReason: state.telephony.plivoConnectionErrorReason,
  }),
  dispatch =>
    bindActionCreators(
      {
        updateUserStatus,
        logoutUser,
        ...authActions,
      },
      dispatch,
    ),
)
@inject('leasingNavigator')
@observer
export default class SideNav extends Component {
  constructor(props) {
    super(props);
    this.id = generateId(this);
    this.state = {
      sideNavOpen: false,
    };
  }

  static propTypes = {
    extraClass: PropTypes.string,
    loggedInUser: PropTypes.object,
    enableRevaUniversity: PropTypes.bool,
    users: PropTypes.object,
    user: PropTypes.object,
    updateUser: PropTypes.func,
    onUserSettingsClick: PropTypes.func,
    onAgentSchedulesClick: PropTypes.func,
    onAddSickLeavesClick: PropTypes.func,
    onManageBlacklistClick: PropTypes.func,
    onRevaUniversityClick: PropTypes.func,
    onCallQueueDetailsQueueClick: PropTypes.func,
    enableCohortComms: PropTypes.bool,
  };

  handleSubmit = async event => {
    event.preventDefault();
    const { loggedInUser } = this.props;
    if (!loggedInUser || !loggedInUser.id) {
      const error = new Error('USER_NOT_DEFINED');
      logger.error({ error, loggedInUser }, 'Attempt to logout without an user object');
      return;
    }
    await this.props.logoutUser(loggedInUser.id);
  };

  closeSideNav = () => this.setState({ sideNavOpen: false });

  isUserAvailable = user => {
    // currently we have only 2 statuses in the UI (available and not-available)
    // and 3 statuses in the backend (available, not-available and busy);
    // in the UI we'll consider the user as being available when his status is either 'available' or 'busy'
    if (!user) return false;
    const { status } = user.metadata;
    return status === DALTypes.UserStatus.AVAILABLE || status === DALTypes.UserStatus.BUSY;
  };

  handleAvailabilityChange = user => {
    if (!user || !user.id) {
      const error = new Error('USER_NOT_DEFINED');
      logger.error({ error, user }, 'Attempt to change the availability without an user object');
      return;
    }

    const isAvailable = this.isUserAvailable(user);
    const status = !isAvailable ? DALTypes.UserStatus.AVAILABLE : DALTypes.UserStatus.NOT_AVAILABLE;

    this.props.updateUserStatus(user.id, { status });
  };

  getEmailOrUser = user => {
    if (!user) return '';
    return clsc(user.email, user.fullName, user.preferredName, '--');
  };

  handleAnimation = ({ open, animProps }) => {
    animProps.animation = {
      // eslint-disable-line no-param-reassign
      opacity: open ? 1 : 0,
      translateX: open ? 0 : '-100%',
      transformOriginX: ['0', '0'],
      transformOriginY: ['50%', '50%'],
    };
  };

  handleShowUserSettingsDialog = () => {
    const { onUserSettingsClick } = this.props;
    onUserSettingsClick && onUserSettingsClick();
  };

  handleShowAgentSchedules = () => {
    const { onAgentSchedulesClick } = this.props;
    onAgentSchedulesClick && onAgentSchedulesClick();
  };

  handleAddSickLeaves = () => {
    const { onAddSickLeavesClick } = this.props;
    onAddSickLeavesClick && onAddSickLeavesClick();
  };

  handleShowBlackListAdminScreen = () => {
    const { onManageBlacklistClick } = this.props;
    onManageBlacklistClick && onManageBlacklistClick();
  };

  handleOpenReporting = () => {
    windowOpen(cfg('sisenseConfig.sisenseURL'));
    this.closeSideNav();
  };

  handleOpenCommunicationManagement = () => {
    const { leasingNavigator } = this.props;
    leasingNavigator.navigateToCommunicationManagement();
  };

  handleOpenLeasing = () => {
    const { leasingNavigator } = this.props;
    leasingNavigator.navigateToDashboard();
  };

  handleOpenRevaUniversity = () => {
    const { onRevaUniversityClick } = this.props;
    onRevaUniversityClick && onRevaUniversityClick();
  };

  handleShowCallQueueDetails = () => {
    const { onCallQueueDetailsQueueClick } = this.props;
    onCallQueueDetailsQueueClick && onCallQueueDetailsQueueClick();
  };

  render(
    {
      id,
      loggedInUser,
      users,
      enableRevaUniversity,
      enableCohortComms,
      leasingNavigator,
      dashboardSelection,
      plivoConnectionErrorReason,
      isPlivoConnectionError,
    } = this.props,
  ) {
    const user = loggedInUser && users.get(loggedInUser.id);
    const userName = user ? user.fullName : '';
    const badgeName = getBadgeName(user?.metadata?.status);

    const userAvatarUrl = user ? getBigAvatar(user.avatarUrl) : '';
    id = clsc(id, this.id);

    const shouldShowCommunicationManagementOption = enableCohortComms && user && isCohortCommunicationApprover(user);
    const shouldShowNavIconBadge = loggedInUser?.id !== dashboardSelection?.id;

    const isCommunicationManagementOptionSelected = isCommunicationManagementPage();
    return (
      <FlyOut
        appendToBody
        noAutoBind
        modal
        onCloseRequest={this.closeSideNav}
        open={this.state.sideNavOpen}
        positionArgs={{ my: 'left top', at: 'left top', of: window }}>
        <IconButton
          id="side-nav"
          className={cf('navButton')}
          iconStyle="light"
          ref="buttonCollapse"
          iconName="menu"
          badgeIcon={shouldShowNavIconBadge && badgeName}
          badgeClassName={cf('navBadgeIcon', badgeName)}
          badgeIconViewBox="2 2 20 20"
          onClick={() => {
            this.setState({ sideNavOpen: true });
          }}
        />
        <FlyOutOverlay animationFn={this.handleAnimation} className={cf('side-nav-overlay')} container={false} lazy>
          <div id={id}>
            <div id="slide-out" className={cf('sideNav')}>
              <div className={cf('hero')}>
                <div className={cf('hero-profile')}>
                  <Avatar
                    className={cf('avatarSize', badgeName)}
                    userName={userName}
                    src={userAvatarUrl}
                    imageWidth={64}
                    badgeIconStyle={{ background: '#fff' }}
                    badgeIconViewBox="2 2 20 20"
                    badgeIcon={badgeName}
                  />
                </div>
                <div className={cf('user-info')}>
                  <T.SubHeader lighter>{userName}</T.SubHeader>
                  <T.Text lighter>{this.getEmailOrUser(user)}</T.Text>
                </div>
              </div>

              <L.List className={cf('sideNavOptions')}>
                {isPlivoConnectionError && <TelephonyErrorBanner reason={plivoConnectionErrorReason} />}
                <L.ListItem rowStyle="mixed">
                  <L.MainSection>
                    <T.Text>{t('AVAILABLE')}</T.Text>
                  </L.MainSection>
                  <L.ActionSection className={cf('switch')}>
                    <Switch
                      id="availability-switch"
                      checked={this.isUserAvailable(user)}
                      disabled={isPlivoConnectionError}
                      onChange={event => this.handleAvailabilityChange(user, event)}
                    />
                  </L.ActionSection>
                </L.ListItem>
                <L.Divider />
                {leasingNavigator.wasCommunicationManagementVisited && (
                  <div>
                    <L.ListItem
                      rowStyle="mixed"
                      onClick={() => this.handleOpenLeasing()}
                      className={cf({ selected: !isCommunicationManagementOptionSelected })}>
                      <L.MainSection>
                        <T.Text>{t('LEASING')}</T.Text>
                      </L.MainSection>
                    </L.ListItem>
                    <L.Divider />
                  </div>
                )}
                <L.ListItem rowStyle="mixed" onClick={() => this.handleShowCallQueueDetails()}>
                  <L.MainSection>
                    <T.Text>{t('CALL_QUEUE_DETAILS')}</T.Text>
                  </L.MainSection>
                </L.ListItem>
                <L.ListItem rowStyle="mixed" onClick={() => this.handleOpenReporting()}>
                  <L.MainSection>
                    <T.Text>{t('REPORTING')}</T.Text>
                  </L.MainSection>
                </L.ListItem>
                {shouldShowCommunicationManagementOption && (
                  <L.ListItem
                    rowStyle="mixed"
                    onClick={() => this.handleOpenCommunicationManagement()}
                    className={cf({ selected: isCommunicationManagementOptionSelected })}>
                    <L.MainSection>
                      <T.Text>{t('COMMUNICATION_MANAGEMENT')}</T.Text>
                    </L.MainSection>
                  </L.ListItem>
                )}
                <DemoElement>
                  <div>
                    <L.Divider />
                    <L.ListItem rowStyle="mixed">
                      <L.MainSection>
                        <T.Text>Marketing</T.Text>
                      </L.MainSection>
                    </L.ListItem>
                    <L.ListItem rowStyle="mixed">
                      <L.MainSection>
                        <T.Text>Leasing</T.Text>
                      </L.MainSection>
                    </L.ListItem>
                    <L.ListItem rowStyle="mixed">
                      <L.MainSection>
                        <T.Text>Resident Services</T.Text>
                      </L.MainSection>
                    </L.ListItem>
                    <L.ListItem rowStyle="mixed">
                      <L.MainSection>
                        <T.Text>Maintenance</T.Text>
                      </L.MainSection>
                    </L.ListItem>
                    <L.ListItem rowStyle="mixed">
                      <L.MainSection>
                        <T.Text>Analytics</T.Text>
                      </L.MainSection>
                    </L.ListItem>
                  </div>
                </DemoElement>
                <L.Divider />
                {isCustomerAdmin(user) && (
                  <div>
                    <L.ListItem
                      rowStyle="mixed"
                      onClick={() => {
                        this.setState({ sideNavOpen: false }, () => {
                          this.props.leasingNavigator.openTenantAdminTab();
                        });
                      }}>
                      <L.MainSection>
                        <T.Text>{t('GO_TO_ADMIN_UI')}</T.Text>
                      </L.MainSection>
                    </L.ListItem>
                    <L.Divider />
                  </div>
                )}
                {isLoggedAsAdmin(user) && (
                  <L.ListItem rowStyle="mixed" onClick={() => this.props.leasingNavigator.navigateToTenantAdmin()} data-id={'admin-settings'}>
                    <L.MainSection>
                      <T.Text className={cf('highlightedMenuItem')}>{t('ADMIN_SETTINGS')}</T.Text>
                    </L.MainSection>
                  </L.ListItem>
                )}
                {isLoggedAsAdmin(user) && (
                  <L.ListItem rowStyle="mixed" onClick={this.handleShowBlackListAdminScreen} data-id={'manage-blacklist'}>
                    <L.MainSection>
                      <T.Text className={cf('highlightedMenuItem')}>{t('MANAGE_BLACKLIST')}</T.Text>
                    </L.MainSection>
                  </L.ListItem>
                )}
                {user && isScheduleManager(user) && (
                  <L.ListItem rowStyle="mixed" onClick={this.handleShowAgentSchedules} data-id={'floating-agent-scheduling'}>
                    <L.MainSection>
                      <T.Text>{t('FLOATING_AGENT_SCHEDULING')}</T.Text>
                    </L.MainSection>
                  </L.ListItem>
                )}
                {user && isScheduleManager(user) && (
                  <L.ListItem rowStyle="mixed" onClick={this.handleAddSickLeaves} data-id={'sick-leave-scheduling'}>
                    <L.MainSection>
                      <T.Text>{t('SICK_LEAVE_SCHEDULING')}</T.Text>
                    </L.MainSection>
                  </L.ListItem>
                )}
                <L.ListItem rowStyle="mixed" onClick={this.handleShowUserSettingsDialog} data-id={'settings'}>
                  <L.MainSection>
                    <T.Text>{t('SETTINGS')}</T.Text>
                  </L.MainSection>
                </L.ListItem>
                <L.Divider />
                {enableRevaUniversity && (
                  <L.ListItem rowStyle="mixed" onClick={() => this.handleOpenRevaUniversity()} data-id={'reva-university'}>
                    <L.MainSection>
                      <T.Text>{t('REVA_UNIVERSITY')}</T.Text>
                    </L.MainSection>
                  </L.ListItem>
                )}
                <L.ListItem rowStyle="mixed" onClick={() => windowOpen(cfg('zendeskConfig.urlCreateTicket'))} data-id={'send-feedback'}>
                  <L.MainSection>
                    <T.Text>{t('SEND_FEEDBACK')}</T.Text>
                  </L.MainSection>
                </L.ListItem>
                <L.ListItem rowStyle="mixed" onClick={() => windowOpen(cfg('zendeskConfig.urlHelpCenter'))} data-id={'need-help-link'}>
                  <L.MainSection>
                    <T.Text>{t('NEED_HELP_LINK')}</T.Text>
                  </L.MainSection>
                </L.ListItem>
                <L.Divider />
                <L.ListItem rowStyle="mixed" className="waves-effect" id="logout" onClick={this.handleSubmit}>
                  <L.MainSection>
                    <T.Text>{t('LOGOUT_LINK')}</T.Text>
                  </L.MainSection>
                </L.ListItem>
              </L.List>
            </div>
          </div>
        </FlyOutOverlay>
      </FlyOut>
    );
  }
}
