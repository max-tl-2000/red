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
import { Icon, Typography, Card, Avatar, Truncate, RedList as L } from 'components';
import { isString } from 'helpers/type-of';
import { formatAsPhoneIfDigitsOnly } from 'helpers/phone-utils';
import { createSelector } from 'reselect';
import { observer, inject } from 'mobx-react';
import { toMoment } from '../../../common/helpers/moment-utils';
import { SHORT_DATE_FORMAT, MONTH_DATE_YEAR_FORMAT } from '../../../common/date-constants';
import AppointmentRow from './AppointmentRow';
import TaskRow from './TaskRow';
import { cf } from './PartyCard.scss';
import PartyCardViewModel from './PartyCardViewModel';
import { DATETIME_TOMORROW } from './constants';
import { DALTypes } from '../../../common/enums/DALTypes';
import PartyGuests from '../../custom-components/PartyGuests/PartyGuests';
import PartyTypeLabel from '../../custom-components/PartyType/PartyTypeLabel';
import { getDisplayName } from '../../../common/helpers/person-helper';
import { isDateInTheCurrentYear } from '../../../common/helpers/date-utils';

const { Text, Caption } = Typography;

const createViewModel = () =>
  createSelector(
    (state, props) => props.prospect,
    (state, props) => props.members,
    (state, props) => props.tasks,
    (state, props) => props.appointments,
    (state, props) => props.users,
    (state, props) => props.persons,
    (state, props) => props.company,
    (state, props) => props.communication,
    (state, props) => props.lease,
    (state, props) => props.partyFilter,
    (state, props) => props.activeLeaseWorkflowData,
    state => state.auth.user,
    (prospect, members, tasks, appointments, users, persons, company, communication, lease, partyFilter, activeLeaseWorkflowData, currentUser) =>
      new PartyCardViewModel({
        prospect,
        members,
        tasks,
        appointments,
        users,
        persons,
        company,
        communication,
        lease,
        partyFilter,
        activeLeaseWorkflowData,
        currentUser,
      }),
  );

// create a memoized function for each PartyCardList instance
// see: https://github.com/reduxjs/reselect#sharing-selectors-with-props-across-multiple-component-instances
const makeMapStateToProps = () => {
  const getMemoizedViewModel = createViewModel();

  const mapStateToProps = (state, props) => ({
    viewModel: getMemoizedViewModel(state, props),
    dashboardSelection: state.dashboardStore.dashboardSelection,
  });
  return mapStateToProps;
};

@connect(makeMapStateToProps, dispatch => bindActionCreators({}, dispatch))
@inject('leasingNavigator')
@observer
export default class PartyCard extends Component {
  static propTypes = {
    prospect: PropTypes.shape({
      id: PropTypes.string,
    }).isRequired,
    params: PropTypes.object,
    groupView: PropTypes.bool,
    appointments: PropTypes.array.isRequired,
    tasks: PropTypes.array.isRequired,
    users: PropTypes.object,
    members: PropTypes.array,
    communication: PropTypes.object,
    showTaskOwners: PropTypes.bool,
    currentUser: PropTypes.object,
    lease: PropTypes.object,
    dateType: PropTypes.string,
    partyFilter: PropTypes.object,
    viewModel: PropTypes.object.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      displayAllTasks: false,
    };
  }

  componentWillReceiveProps() {
    this.state = {
      displayAllTasks: false,
    };
  }

  toggleTasks = () => this.setState({ displayAllTasks: !this.state.displayAllTasks });

  navigateToProspect = () => {
    const { props } = this;
    // TODO: change prospect to party
    const { leasingNavigator, prospect } = props;

    leasingNavigator.navigateToParty(prospect.id);
  };

  navigateToProspectFromTask = task => {
    const { props } = this;
    const { leasingNavigator, prospect } = props;

    leasingNavigator.navigateToParty(prospect.id);
    switch (task.name) {
      case DALTypes.TaskNames.REVIEW_APPLICATION:
        leasingNavigator.navigateToParty(prospect.id, { reviewApplication: true });
        break;
      default:
        this.navigateToProspect();
    }
  };

  navigateToProspectWithThreadOpen = comm => {
    const { threadId } = comm;
    const { viewModel, leasingNavigator } = this.props;
    leasingNavigator.navigateToParty(viewModel.prospect.id, { threadId });
  };

  navigateToAppoinment = appointment => {
    const { viewModel, leasingNavigator } = this.props;
    leasingNavigator.navigateToParty(viewModel.prospect.id, { appointmentId: appointment.id });
  };

  renderTasks = tasks => {
    const { users, showTaskOwners, currentUser, members, viewModel } = this.props;
    return tasks.map((task, index) => (
      <TaskRow
        dataId={`cardTask${index}`}
        key={task.id}
        members={members}
        task={task}
        timezone={viewModel.timezone}
        currentUser={currentUser}
        users={users}
        showOwners={showTaskOwners}
        onClick={() => this.navigateToProspectFromTask(task)}
      />
    ));
  };

  renderAppointments = (tasks, startDateFormat) => {
    const { users, showTaskOwners, currentUser, members, viewModel } = this.props;
    if (viewModel.isCorporateParty) return null;

    return tasks.map(task => (
      <AppointmentRow
        key={task.id}
        timezone={viewModel.timezone}
        appointment={task}
        members={members}
        currentUser={currentUser}
        users={users}
        showOwners={showTaskOwners}
        startDateFormat={startDateFormat}
        onClick={this.navigateToAppoinment}
        dataId="appointmentRow"
      />
    ));
  };

  formatInventory(inventories) {
    return (inventories || [])
      .filter(inventory => inventory)
      .map(inventory => (inventory.fullQualifiedName ? inventory.fullQualifiedName : inventory))
      .join(', ');
  }

  getNrOfRemainingUnits(inventories, nrOfDisplayedInventories) {
    const nrOfInventories = inventories.length;
    const remainingInventories = nrOfInventories - nrOfDisplayedInventories;

    return remainingInventories > 0 ? ` + ${t('REMAINING_ITEMS', { count: remainingInventories })}` : '';
  }

  renderIncompleteApplicants(pendingApplications) {
    return pendingApplications.length > 0 ? (
      <Caption inline secondary>
        ({pendingApplications.map(getDisplayName).join(', ')})
      </Caption>
    ) : null;
  }

  renderPendingSigners(pendingSigners) {
    return pendingSigners.length > 0 ? (
      <Caption inline secondary>
        ({pendingSigners.map(getDisplayName).join(', ')})
      </Caption>
    ) : null;
  }

  renderAvatar = isResidentOrFutureResident => {
    const { viewModel } = this.props;
    const { isClosed, isActiveLease, isRenewal, scoreIcon, score, defaultGuestFullName, workflowName } = viewModel;
    const badgeIcon = workflowName === DALTypes.WorkflowName.NEW_LEASE && !isResidentOrFutureResident ? scoreIcon : '';

    if (isClosed) {
      // temp implementation; there will be a future story to replace the icon with a watermark
      return <Avatar src="/closed-party.svg" />;
    }

    return (
      <Avatar
        isRenewalOrActiveLease={isActiveLease || isRenewal}
        lighter
        userName={defaultGuestFullName}
        badgeIcon={badgeIcon}
        badgeClassName={cf({
          blueBadge: score,
          lightBlueBadge: !score,
        })}
      />
    );
  };

  renderPublishedLeaseMessage = () => {
    const { viewModel } = this.props;
    const { leasePublishedData, timezone } = viewModel;

    if (!leasePublishedData) return null;
    const { leaseTerm, leaseStartDate } = leasePublishedData;
    const dateFormat = isDateInTheCurrentYear(leaseStartDate, timezone) ? SHORT_DATE_FORMAT : MONTH_DATE_YEAR_FORMAT;
    const formattedStartDate = toMoment(leaseStartDate, { timezone }).format(dateFormat);
    return (
      <Caption data-id="renewalDetailsTxt" secondary>
        {t('RENEWAL_STARTING_ON', { leaseTerm, leaseStartDate: formattedStartDate })}
      </Caption>
    );
  };

  renderMovingOutMessage = () => {
    const { viewModel } = this.props;
    const { movingOutDate, timezone } = viewModel;
    if (!movingOutDate) return null;
    const formattedMovingOutDate = toMoment(movingOutDate, { timezone }).format(SHORT_DATE_FORMAT);
    return (
      <Caption data-id="renewalDetailsTxt" secondary>
        {t('MOVING_OUT_ON', { movingOutDate: formattedMovingOutDate })}
      </Caption>
    );
  };

  shouldShowAssignedProperty = (state, workflowName) => {
    const validStates = [DALTypes.PartyStateType.CONTACT, DALTypes.PartyStateType.LEAD, DALTypes.PartyStateType.PROSPECT, DALTypes.PartyStateType.APPLICANT];
    const validWorkflowNames = [DALTypes.WorkflowName.ACTIVE_LEASE, DALTypes.WorkflowName.RENEWAL];

    if (validWorkflowNames.includes(workflowName)) {
      const { associatedProperties = [] } = this.props.dashboardSelection || {};
      return !!associatedProperties?.length;
    }

    if (validStates.some(partyState => partyState === state)) {
      const { associatedProperties = [] } = this.props.dashboardSelection || {};
      return associatedProperties.length > 1;
    }
    return false;
  };

  renderAssignedProperty = ({ state, assignedPropertyName, workflowName }) => {
    if (!assignedPropertyName || !this.shouldShowAssignedProperty(state, workflowName)) {
      return <noscript />;
    }
    return <Caption secondary>{assignedPropertyName}</Caption>;
  };

  renderMoveInDate = (isLeaseOrFutureResident, viewModel) => {
    if (isLeaseOrFutureResident) {
      return !viewModel.isCorporateParty && viewModel.moveInDateFormatted && <Caption secondary>{viewModel.moveInDateFormatted}</Caption>;
    }
    return viewModel.moveInDateRangeFormatted && <Caption secondary>{viewModel.moveInDateRangeFormatted}</Caption>;
  };

  render() {
    const { displayAllTasks } = this.state;
    const { viewModel } = this.props;

    const {
      mostRecentCommunication: comm,
      shouldShowOwner: showOwner,
      allTasks,
      source,
      isLease,
      isFutureResident,
      isRawLead,
      isApplicant,
      isQualifiedLead,
      isProspect,
      shouldDisplayDuplicatePersonBanner,
      isCorporateParty,
      isRenewal,
      isMovingOut,
      unitFullQualifiedName,
      workflowName,
      isActiveLease,
      isResident,
    } = viewModel;

    const isLeaseOrFutureResident = isLease || isFutureResident;
    const notContract = isRawLead || isApplicant || isQualifiedLead || isProspect;
    const isResidentOrFutureResident = isResident || isFutureResident;
    const {
      overdueAppointments,
      todayAppointments,
      tomorrowAppointments,
      laterAppointments,
      overdueTasks,
      todayTasks,
      tomorrowTasks,
      laterTasks,
      appointmentsLength,
      length,
    } = allTasks;
    const shouldDisplayTasksBlock = (isCorporateParty ? appointmentsLength !== length : length > 0) || displayAllTasks;
    const showTomorrowAppointmentsInCollapsedState = this.props.dateType === DATETIME_TOMORROW;

    const overdueAndTodayCount = overdueAppointments.length + overdueTasks.length + todayAppointments.length + todayTasks.length;
    const tomorrowCount = tomorrowAppointments.length + tomorrowTasks.length;
    const laterCount = laterAppointments.length + laterTasks.length;
    const tomorrowAndLaterCount = tomorrowCount + laterCount;

    const hasLaterTasks = showTomorrowAppointmentsInCollapsedState ? laterCount > 0 : tomorrowAndLaterCount > 0;
    const MAX_FAV_UNITS_TO_DISPLAY = 2;
    const isNotRenewalOrActiveLease = !isRenewal && !isActiveLease;

    return (
      <Card className={cf('card', { showOwner })} data-id="card" container={false}>
        {showOwner && (
          <div className={cf('top-bar')}>
            <div className={cf('top-bar-wrapper')}>
              <Truncate direction="horizontal">
                <Caption secondary>{viewModel.owner.fullName}</Caption>
              </Truncate>
            </div>
          </div>
        )}
        <div className={cf('details')} onClick={this.navigateToProspect}>
          {!!shouldDisplayDuplicatePersonBanner && <div className={cf('mergeHighlight')} />}
          <PartyTypeLabel party={viewModel.prospect} />
          <div className={cf('info')}>
            {this.renderAvatar(isResidentOrFutureResident)}
            <div className={cf('meta')}>
              <PartyGuests className={cf('subheader')} guests={viewModel.partyMembers} isCorporateParty={viewModel.isCorporateParty} />
              {this.renderAssignedProperty(viewModel)}
              {viewModel.favoritedInventory && (
                <Caption secondary>
                  {workflowName === DALTypes.WorkflowName.NEW_LEASE
                    ? this.formatInventory(viewModel.favoritedInventory.slice(-MAX_FAV_UNITS_TO_DISPLAY)) +
                      this.getNrOfRemainingUnits(viewModel.favoritedInventory, MAX_FAV_UNITS_TO_DISPLAY)
                    : unitFullQualifiedName}
                </Caption>
              )}
              {source && notContract && <Caption secondary>{source}</Caption>}
              {isLeaseOrFutureResident && isRenewal && this.renderPublishedLeaseMessage()}
              {isMovingOut && isRenewal && this.renderMovingOutMessage()}
              {!isMovingOut && isNotRenewalOrActiveLease && this.renderMoveInDate(isLeaseOrFutureResident, viewModel)}
              {isApplicant && !viewModel.isCorporateParty && viewModel.pendingApplications && viewModel.pendingApplications.length > 0 && (
                <Caption highlight>
                  {t('INCOMPLETE_APPLICATION', {
                    count: viewModel.pendingApplications.length,
                  })}{' '}
                  {this.renderIncompleteApplicants(viewModel.pendingApplications)}
                </Caption>
              )}
              {isLease && !viewModel.pendingCounterSignature && viewModel.pendingSigners && viewModel.pendingSigners.length > 0 && (
                <Caption highlight>
                  {t('MISSING_SIGNATURE', {
                    count: viewModel.pendingSigners.length,
                  })}{' '}
                  {this.renderPendingSigners(viewModel.pendingSigners)}
                </Caption>
              )}
              {isLease && viewModel.pendingCounterSignature && <Caption highlight>{t('WAITING_ON_COUNTER_SIGNATURE')}</Caption>}
            </div>
            {isRenewal && <Icon id="renewIcon" name="watermark-grey" className={cf('renewalPartyIcon')} />}
          </div>
        </div>
        {comm && (
          <L.ListItem className={cf('message-preview-wrapper')} rowStyle="mixed" onClick={() => this.navigateToProspectWithThreadOpen(comm)}>
            <L.AvatarSection>
              <Icon name={comm.icon} lighter />
            </L.AvatarSection>
            <L.MainSection data-id={`message ${viewModel.defaultGuest}`} className={cf('message-preview')}>
              <Text>{formatAsPhoneIfDigitsOnly(comm.sender)}</Text>
              <Text secondary ellipsis style={{ paddingLeft: 6, flex: 1 }}>
                {isString(comm.messageText) && comm.messageText}
              </Text>
            </L.MainSection>
            {comm.isBounced && (
              <L.ActionSection>
                <Icon name="alert" className={cf('bounce-icon')} />
              </L.ActionSection>
            )}
          </L.ListItem>
        )}
        {shouldDisplayTasksBlock && (
          <div className={cf('tasks-section', { hasLaterTasks })}>
            {displayAllTasks && overdueAndTodayCount > 0 && (
              <L.GroupSection noIndentGroupItems>
                <Caption secondary>
                  {t('PROSPECT_CARD_TODAY_TASKS', {
                    count: overdueAndTodayCount,
                  })}
                </Caption>
              </L.GroupSection>
            )}

            {this.renderTasks(overdueTasks)}
            {this.renderAppointments(overdueAppointments, t('PROSPECT_CARD_LATER_APPOINTMENT_TIME_FORMAT'))}
            {this.renderTasks(todayTasks)}
            {this.renderAppointments(todayAppointments, t('PROSPECT_CARD_TODAY_APPOINTMENT_TIME_FORMAT'))}

            {displayAllTasks && tomorrowCount > 0 && (
              <L.GroupSection noIndentGroupItems>
                <Caption secondary>
                  {t('PROSPECT_CARD_TOMORROW_TASKS', {
                    count: tomorrowCount,
                  })}
                </Caption>
              </L.GroupSection>
            )}
            {(displayAllTasks || showTomorrowAppointmentsInCollapsedState) && this.renderTasks(tomorrowTasks)}
            {(displayAllTasks || showTomorrowAppointmentsInCollapsedState) &&
              this.renderAppointments(tomorrowAppointments, t('PROSPECT_CARD_LATER_APPOINTMENT_TIME_FORMAT'))}

            {displayAllTasks && laterCount > 0 && (
              <L.GroupSection noIndentGroupItems>
                <Caption secondary>{t('PROSPECT_CARD_LATER_TASKS', { count: laterCount })}</Caption>
              </L.GroupSection>
            )}
            {displayAllTasks && this.renderTasks(laterTasks)}
            {displayAllTasks && this.renderAppointments(laterAppointments, t('PROSPECT_CARD_LATER_APPOINTMENT_TIME_FORMAT'))}
            {hasLaterTasks && (
              <div className={cf('collapse-trigger')} onClick={this.toggleTasks}>
                <div>
                  <Icon name={displayAllTasks ? 'chevron-up' : 'chevron-down'} />
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    );
  }
}
