/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { t } from 'i18next';
import { Button, PickBox, FlyOut, FlyOutOverlay, FlyOutActions, SelectionGroup, RedList, InlineConfirm, Typography } from 'components';

import sortBy from 'lodash/sortBy';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { addNewAppointmentFromInventoryCardFlyout } from 'redux/modules/appointments.dialog';
import { getParty } from 'redux/selectors/partySelectors';
import { addUnitToAppointmentFromInventoryCardFlyout } from 'redux/modules/appointments';
import { createSelector } from 'reselect';
import { getEnhancedAppointments, formatAppointmentTitleForInventoryFlyout, formatAppointmentDetailsForInventoryFlyout } from '../../helpers/appointments';
import { cf } from './InventoryActions.scss';
import { DALTypes } from '../../../common/enums/DALTypes';
import { shouldEnableQuoteAction, getQuoteActionLabel } from '../../../common/inventory-helper.js';
import { toMoment } from '../../../common/helpers/moment-utils';

const { ListItem, AvatarSection, MainSection } = RedList;
const { Text } = Typography;

const itemTemplate = ({ item, selected, multiple }) => {
  const originalItem = item.originalItem;

  return (
    <ListItem disabled={originalItem.isComplete}>
      <AvatarSection>
        <PickBox disabled={originalItem.disabled} type={multiple ? 'checkbox' : 'radio'} checked={selected} />
      </AvatarSection>
      <MainSection>
        <Text>{originalItem.title}</Text>
        <Text secondary>{originalItem.details}</Text>
      </MainSection>
    </ListItem>
  );
};

const getAppointments = createSelector(
  s => s.dataStore.get('tasks'),
  (s, props) => props.partyId,
  (tasks, partyId) =>
    tasks.filter(p => p.category === DALTypes.TaskCategories.APPOINTMENT && p.state !== DALTypes.TaskStates.CANCELED && p.partyId === partyId),
);

const getEnhancedPartyMembers = createSelector(
  s => s.dataStore.get('members'),
  s => s.dataStore.get('persons'),
  (s, props) => props.partyId,
  (members, personsMap, partyId) =>
    members
      .filter(p => p.partyId === partyId)
      .map(p => ({
        ...p,
        person: personsMap.get(p.personId),
      })),
);

@connect(
  (state, props) => {
    const party = getParty(state, { partyId: props.partyId });

    return {
      usersMap: state.globalStore.get('users'),
      appointmentsByProspectId: getAppointments(state, props),
      membersMap: getEnhancedPartyMembers(state, props),
      inactiveMembers: state.dataStore.get('inactiveMembers'),
      party,
    };
  },
  dispatch =>
    bindActionCreators(
      {
        addNewAppointmentFromInventoryCardFlyout,
        addUnitToAppointmentFromInventoryCardFlyout,
      },
      dispatch,
    ),
)
export default class InventoryActions extends Component {
  static propTypes = {
    partyId: PropTypes.string,
    appointmentsByProspectId: PropTypes.object.isRequired,
    membersMap: PropTypes.object,
    usersMap: PropTypes.object,
    onQuoteClick: PropTypes.func,
    unit: PropTypes.object,
    addNewAppointmentFromInventoryCardFlyout: PropTypes.func,
    addUnitToAppointmentFromInventoryCardFlyout: PropTypes.func,
  };

  constructor(props) {
    super(props);

    const { timezone, appointmentsByProspectId, usersMap, membersMap, inactiveMembers } = props;

    const appointments = getEnhancedAppointments(appointmentsByProspectId, { users: usersMap, partyMembers: membersMap, inactiveMembers, timezone }).toArray();

    this.state = {
      selected: this.getPreselectedAppointments(),
      sortedAppointments: sortBy(appointments, appointment => -toMoment(appointment.metadata.startDate, { timezone })),
    };
  }

  componentWillReceiveProps(nextProps) {
    const { timezone, appointmentsByProspectId, usersMap, membersMap, inactiveMembers } = nextProps;
    const appointments = getEnhancedAppointments(appointmentsByProspectId, { users: usersMap, partyMembers: membersMap, inactiveMembers, timezone }).toArray();

    this.setState({
      sortedAppointments: sortBy(appointments, appointment => -toMoment(appointment.metadata.startDate, { timezone })),
    });
  }

  getPreselectedAppointments = () =>
    this.props.appointmentsByProspectId
      .filter(appt => appt.metadata.inventories && appt.metadata.inventories.find(property => property === this.props.unit.id))
      .map(appt => appt.id);

  handleCreateNewClick = () => {
    this.props.addNewAppointmentFromInventoryCardFlyout(this.props.unit);
  };

  handleDoneClick = () => {
    const preselectedAppointments = this.getPreselectedAppointments();
    const selectedByUser = this.state.selected.filter(apptId => preselectedAppointments.includes(apptId) === false);

    const appointmentsData = selectedByUser.map(apptId => {
      const appt = this.props.appointmentsByProspectId.find(a => a.id === apptId);
      const apptProperties = (appt.metadata.inventories || []).map(unit => unit.id);
      apptProperties.push(this.props.unit.id);

      return {
        id: apptId,
        metadata: {
          inventories: apptProperties,
        },
      };
    });

    if (appointmentsData.length > 0) {
      this.props.addUnitToAppointmentFromInventoryCardFlyout(appointmentsData);
    }
  };

  handleQuoteClick = () => {
    const { onQuoteClick, unit } = this.props;

    // Setting the isRenewalQuote from here cause in the future the user may have both choices (renewal quote/ quote) from the card so we will need to check which one he clicked in order to set the flag
    onQuoteClick && onQuoteClick({ isRenewalQuote: unit.isRenewal });
  };

  render = () => {
    const { onQuoteClick, unit, usersMap, small, membersMap, timezone, party } = this.props;
    const { selected, sortedAppointments } = this.state;
    const isRenewalParty = party.workflowName === DALTypes.WorkflowName.RENEWAL;
    const quoteActionEnabled = shouldEnableQuoteAction(unit, { isRenewalParty });
    const quoteActionLabel = getQuoteActionLabel(unit, { isRenewalParty });
    const isModel = unit.state === DALTypes.InventoryState.MODEL;
    const isStateDown = unit.state === DALTypes.InventoryState.DOWN;
    const items = (sortedAppointments || []).map(appt => ({
      id: appt.id,
      title: formatAppointmentTitleForInventoryFlyout(appt, usersMap.get(appt.userIds[0]), timezone),
      details: formatAppointmentDetailsForInventoryFlyout(appt, membersMap),
      isComplete: appt.state === DALTypes.TaskStates.COMPLETED,
      disabled: appt.state === DALTypes.TaskStates.COMPLETED || (appt.metadata.inventories.length > 0 && appt.metadata.inventories.includes(unit.id)),
    }));

    const flyOutTitle = t('INVENTORY_CARD_FLAYOUT_TITLE', {
      unitName: unit.name,
    });
    let actionButtons;
    const tourButtonDataTestId = `tour-${unit.name}`;
    const quoteButtonDataTestId = `quote-${unit.name}`; // adding a constant for Quote
    if (!isRenewalParty && !unit.renewalDate) {
      if (sortedAppointments && sortedAppointments.length > 0) {
        actionButtons = (
          <FlyOut appendToBody overTrigger expandTo="bottom-left" onOpen={() => this.setState({ selected: this.getPreselectedAppointments() })}>
            <Button type="flat" label={t('TOUR')} data-id={tourButtonDataTestId} />
            <FlyOutOverlay container={false} title={flyOutTitle} className={cf('overlay')}>
              <div className={cf('overlay-wrapper')}>
                <SelectionGroup
                  itemTemplate={itemTemplate}
                  items={items}
                  selectedValue={selected}
                  multiple
                  onChange={({ ids }) => this.setState({ selected: ids })}
                />
              </div>
              <FlyOutActions>
                <Button type="flat" label={t('INVENTORY_CARD_FLYOUT_CREATE_NEW')} btnRole="secondary" data-action="close" onClick={this.handleCreateNewClick} />
                <Button type="flat" label={t('INVENTORY_CARD_FLYOUT_DONE')} data-action="close" onClick={this.handleDoneClick} />
              </FlyOutActions>
            </FlyOutOverlay>
          </FlyOut>
        );
      } else {
        actionButtons = <Button type="flat" label={t('TOUR')} data-id={tourButtonDataTestId} onClick={this.handleCreateNewClick} />;
      }
    }

    const confirmContent = (
      <div>
        <Text>{t('ARE_YOU_SURE_YOU_WANT_TO_QUOTE_DOWN_UNIT')}</Text>
      </div>
    );

    return (
      // adding data-id for Quote button
      <div className={cf('actions', { small, model: isModel })}>
        {!isModel && (
          <InlineConfirm
            lblOK={t('CONTINUE')}
            width={220}
            appendToBody
            overTrigger
            passThru={!isStateDown}
            expandTo="bottom-right"
            content={confirmContent}
            onOKClick={onQuoteClick}>
            <Button
              disabled={!quoteActionEnabled}
              type="flat"
              data-id={quoteButtonDataTestId}
              onClick={!isStateDown && this.handleQuoteClick}
              label={quoteActionLabel}
            />
          </InlineConfirm>
        )}
        {actionButtons}
      </div>
    );
  };
}
