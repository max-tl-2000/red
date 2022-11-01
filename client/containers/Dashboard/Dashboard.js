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
import { createSelector } from 'reselect';
import * as dashboardActions from 'redux/modules/dashboardStore';
import { setSelectedPropertyId, setOwnerTeamId } from 'redux/modules/propertyStore';
import { setPartyFilter } from 'redux/modules/dataStore';
import { loadDashboardData } from 'redux/modules/appDataLoadingActions';
import { t } from 'i18next';
import { Icon, ActionButton } from 'components';
import { getPartyFilterSelector } from 'redux/selectors/userSelectors';
import { setFirstContactChannel, setPartyWorkflow, setIsTransferLease } from 'redux/modules/partyStore';
import { sizes, screenIsAtLeast } from 'helpers/layout';
import { askPermissionForBrowserNotifications } from 'helpers/notifications';
import { observer, inject } from 'mobx-react';
import { reinitializeProvider } from 'redux/modules/telephony';
import { locals as styles, cf } from './Dashboard.scss';
import TopNavigationBar from './TopNavigationBar';
import { KanbanColumn } from './KanbanColumns';
import KanbanDashboard from './KanbanDashboard';
import PartyCardsList from '../PartyCardsList/PartyCardsList';
import { PropertySelectionDialog } from '../PropertySelection/PropertySelectionDialog';
import { dashboardFilterByUser, dashboardFilterByTeam } from '../../../common/acd/filters';
import { DALTypes } from '../../../common/enums/DALTypes';
import { getAssignedProperty } from '../../helpers/party';
import { isRevaAdmin } from '../../../common/helpers/auth';
import { partyCreationAllowedTeams } from '../../../common/enums/partyTypes';

const isDuplicatePersonNotificationEnabled = createSelector(
  state => state.auth.user || {},
  state => (state.auth.user || {}).features || {},
  (currentUser, features) => features.duplicatePersonNotification === undefined || features.duplicatePersonNotification || isRevaAdmin(currentUser),
);

@connect(
  (state, props) => ({
    screenSize: state.screen.size,
    showOnlyToday: state.dashboardStore.showOnlyToday,
    columnPosition: state.dashboardStore.columnPosition,
    nextMatchParty: state.dashboardStore.nextMatchParty,
    selectedDropdownItem: state.dashboardStore.dashboardSelection,
    nextMatchPersonId: state.dashboardStore.nextMatchPersonId,
    users: state.globalStore.get('users'),
    globalDataLoaded: state.globalStore.get('globalDataLoaded'),
    partyFilter: getPartyFilterSelector(state),
    currentUser: state.auth.user || {},
    nextMatchTargetURL: state.dashboardStore.nextMatchTargetURL,
    isPlivoConnectionError: state.telephony.isPlivoConnectionError,
    plivoConnectionErrorReason: state.telephony.plivoConnectionErrorReason,
    displayDuplicatePersonNotification: isDuplicatePersonNotificationEnabled(state, props),
  }),
  dispatch =>
    bindActionCreators(
      {
        ...dashboardActions,
        loadDashboardData,
        setPartyFilter,
        setSelectedPropertyId,
        setOwnerTeamId,
        setFirstContactChannel,
        setPartyWorkflow,
        setIsTransferLease,
        reinitializeProvider,
      },
      dispatch,
    ),
)
@inject('leasingNavigator')
@observer
export default class Dashboard extends Component {
  state = {};

  static propTypes = {
    loadDashboardData: PropTypes.func,
    globalDataLoaded: PropTypes.bool,
    loadingData: PropTypes.bool,
    showOnlyToday: PropTypes.bool,
    currentUser: PropTypes.object,
    users: PropTypes.object,
    setPartyFilter: PropTypes.func,
    partyFilter: PropTypes.object,
    setSelectedPropertyId: PropTypes.func,
    setFirstContactChannel: PropTypes.func,
    setPartyWorkflow: PropTypes.func,
  };

  constructor(props) {
    super(props);
    const residentsColumnTitle = this.getResidentsColumnTitle();
    this.state = { propertySelectionDialogOpen: false, residentsColumnTitle };
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.showOnlyToday !== nextProps.showOnlyToday) {
      const { partyFilter, showOnlyToday } = nextProps;
      this.props.loadDashboardData(partyFilter, { showOnlyToday });
    }

    if (this.props.globalDataLoaded !== nextProps.globalDataLoaded && nextProps.globalDataLoaded) {
      const { currentUser, showOnlyToday, users, selectedDropdownItem } = nextProps;
      const filterData = this.getFilterData(selectedDropdownItem || currentUser, users);
      this.props.setPartyFilter(filterData);
      this.props.loadDashboardData(filterData, { showOnlyToday });
    }

    if (nextProps.nextMatchTargetURL) {
      // TODO: should be better to use navigateToParty method, but since the url is calculated
      // in the action creator already we just navigate here to the provided url
      this.props.leasingNavigator.navigate(nextProps.nextMatchTargetURL);
      this.props.resetNextMatch();
    }
  }

  componentWillMount() {
    const { currentUser, loadUserSettings } = this.props;

    loadUserSettings(currentUser.id);
  }

  componentDidMount = () => {
    const { selectedDropdownItem, currentUser, showOnlyToday, globalDataLoaded, users } = this.props;
    if (globalDataLoaded) {
      const filterData = this.getFilterData(selectedDropdownItem || currentUser, users);
      this.props.setPartyFilter(filterData);
      this.props.loadDashboardData(filterData, { showOnlyToday });
    }

    askPermissionForBrowserNotifications();

    window.addEventListener('online', this.handleConnectionChange);
    window.addEventListener('offline', this.handleConnectionChange);
  };

  componentWillUnmount() {
    window.removeEventListener('online', this.handleConnectionChange);
    window.removeEventListener('offline', this.handleConnectionChange);
  }

  handleConnectionChange = () => {
    const { currentUser } = this.props;
    this.props.reinitializeProvider(currentUser);
  };

  goToPartyPage = () => {
    const { props } = this;
    props.leasingNavigator.navigateToParty();
  };

  createParty = () => this.setState({ propertySelectionDialogOpen: true });

  handleSubmitPropertySelection = ({ assignedPropertyId, ownerTeamId, contactChannel, partyWorkflow, isTransferLease }) => {
    this.props.setSelectedPropertyId(assignedPropertyId);
    this.props.setOwnerTeamId(ownerTeamId);
    this.props.setFirstContactChannel(contactChannel);
    this.props.setPartyWorkflow(partyWorkflow);
    this.props.setIsTransferLease(isTransferLease);
    this.setState({ propertySelectionDialogOpen: false });
    this.goToPartyPage();
  };

  handleOnClosePropertySelection = () => this.setState({ propertySelectionDialogOpen: false });

  getFilterData = (selectedItem, users) => {
    const { currentUser } = this.props;
    const loggedInUser = users.get(currentUser.id);
    const filter = selectedItem.isTeam ? dashboardFilterByTeam : dashboardFilterByUser;
    return filter(loggedInUser, users, selectedItem.id);
  };

  handleOnUserSelected = user => {
    const filterData = this.getFilterData(user, this.props.users);
    this.props.setPartyFilter(filterData);
    this.props.loadDashboardData(filterData, {
      showOnlyToday: this.props.showOnlyToday,
    });
  };

  getResidentsColumnTitle = () => {
    const {
      features: { enableRenewals },
      backendName,
    } = this.props.currentUser;

    if (backendName && enableRenewals) return t('SALES_DASHBOARD_TRANSITION_TO', { backendName });

    if (!backendName) return t('SALES_DASHBOARD_TRANSITIONING_PARTY');

    return t('SALES_DASHBOARD_FUTURE_RESIDENTS');
  };

  isUserAllowedToCreateParty = user => user?.teams?.some(({ module, endDate }) => partyCreationAllowedTeams.includes(module) && !endDate);

  render = () => {
    const { currentUser, displayDuplicatePersonNotification, screenSize, isPlivoConnectionError, plivoConnectionErrorReason } = this.props;
    const { residentsColumnTitle } = this.state;
    const dashboardNavbar = cf('dashboardNavbar');
    const propertyId = getAssignedProperty(currentUser.associatedProperties.length === 1, currentUser.associatedProperties);
    const strongMatchExists = !!this.props.nextMatchParty && !!this.props.nextMatchParty.id;
    const shouldLeaveRoomForBanner = (displayDuplicatePersonNotification && strongMatchExists) || isPlivoConnectionError;

    // 112px is the height of the headers
    // 160px is the height of the headers + the bottom nav buttons
    let diff = screenIsAtLeast(screenSize, sizes.medium) ? 112 : 160;
    diff = shouldLeaveRoomForBanner ? diff + 56 : diff;
    const height = `calc(100vh - ${diff}px)`;

    return (
      <div className={`${styles.pageStyle} dashboard-view`}>
        <TopNavigationBar className={dashboardNavbar} onUserSelected={this.handleOnUserSelected} />
        <KanbanDashboard
          shouldLeaveRoomForBanner={shouldLeaveRoomForBanner}
          ref="KanbanDashboard"
          setColumnPosition={this.props.setColumnPosition}
          columnPosition={this.props.columnPosition}
          navigateToNextMatch={this.props.navigateToNextMatch}
          nextMatchParty={this.props.nextMatchParty}
          nextMatchPersonId={this.props.nextMatchPersonId}
          isPlivoConnectionError={isPlivoConnectionError}
          plivoConnectionErrorReason={plivoConnectionErrorReason}
          displayDuplicatePersonNotification={displayDuplicatePersonNotification}>
          <KanbanColumn id="contacts" title={t('SALES_DASHBOARD_CONTACTS')}>
            <PartyCardsList laneHeight={height} state={DALTypes.PartyStateType.CONTACT} key={DALTypes.PartyStateType.CONTACT} />
          </KanbanColumn>
          <KanbanColumn id="leads" title={t('SALES_DASHBOARD_LEADS')}>
            <PartyCardsList laneHeight={height} state={DALTypes.PartyStateType.LEAD} key={DALTypes.PartyStateType.LEAD} />
          </KanbanColumn>
          <KanbanColumn id="prospects" title={t('SALES_DASHBOARD_PROSPECTS')}>
            <PartyCardsList laneHeight={height} state={DALTypes.PartyStateType.PROSPECT} key={DALTypes.PartyStateType.PROSPECT} />
          </KanbanColumn>
          <KanbanColumn id="applicants" title={t('SALES_DASHBOARD_APPLICANTS')}>
            <PartyCardsList laneHeight={height} state={DALTypes.PartyStateType.APPLICANT} key={DALTypes.PartyStateType.APPLICANT} />
          </KanbanColumn>
          <KanbanColumn id="leases" title={t('SALES_DASHBOARD_LEASES')}>
            <PartyCardsList laneHeight={height} state={DALTypes.PartyStateType.LEASE} key={DALTypes.PartyStateType.LEASE} />
          </KanbanColumn>
          <KanbanColumn id="residents" title={residentsColumnTitle}>
            <PartyCardsList laneHeight={height} state={DALTypes.PartyStateType.FUTURERESIDENT} key={DALTypes.PartyStateType.FUTURERESIDENT} />
          </KanbanColumn>
        </KanbanDashboard>
        {this.state.propertySelectionDialogOpen && (
          <PropertySelectionDialog
            open={this.state.propertySelectionDialogOpen}
            showCancelButton
            onSubmit={this.handleSubmitPropertySelection}
            onClose={this.handleOnClosePropertySelection}
            properties={currentUser.associatedProperties}
            propertyId={propertyId}
            teams={currentUser.teams}
          />
        )}
        {this.isUserAllowedToCreateParty(currentUser) && (
          <ActionButton size="large" id="btnCreateParty" className={cf('action-menu-trigger')} onClick={this.createParty}>
            <Icon name="plus" />
          </ActionButton>
        )}
      </div>
    );
  };
}
