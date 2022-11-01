/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { endAddingAppointment, updateAppointment, saveAppointment } from 'redux/modules/appointments.dialog';
import { loadSelectorDataForParty } from 'redux/modules/partyStore';
import { t } from 'i18next';
import { MsgBox } from 'components';
import AppointmentDialog from '../AppointmentDialog/AppointmentDialog';
import { getDisplayName } from '../../../common/helpers/person-helper';
import { PropertySelectionDialog } from '../PropertySelection/PropertySelectionDialog';

@connect(
  state => {
    const { appointmentsDialog, globalStore, partyStore, auth } = state;
    return {
      isAddingAppointment: appointmentsDialog.isEnabled,
      users: globalStore.get('users'),
      selectorDataForParty: partyStore.selectorDataForParty,
      currentUser: auth.user,
    };
  },
  dispatch =>
    bindActionCreators(
      {
        endAddingAppointment,
        loadSelectorDataForParty,
        updateAppointment,
        saveAppointment,
      },
      dispatch,
    ),
)
export default class AppointmentDialogWrapper extends Component {
  constructor(props) {
    super(props);

    this.state = {
      shouldOpenAppointmentWarning: false,
      selectedMembers: [],
    };
  }

  componentWillReceiveProps(nextProps) {
    const { currentUser, users, party, selectorDataForParty = {} } = nextProps;
    if (!currentUser || !party) return;

    if (users.size && !selectorDataForParty.users) {
      this.props.loadSelectorDataForParty(nextProps.users, currentUser, party);
    }
  }

  componentWillUnmount() {
    const { endAddingAppointment: doEndAddAppointment } = this.props;
    doEndAddAppointment();
  }

  handleOpenAppointmentWarning = (members, shouldOpen) => this.setState({ shouldOpenAppointmentWarning: shouldOpen, selectedMembers: members });

  handleCloseAppointmentWarning = () => this.setState({ shouldOpenAppointmentWarning: false, selectedMembers: [] });

  renderAppointmentNotification = members => (
    <MsgBox
      title={t('APPOINTMENT_NOTIFICATION')}
      open={this.state.shouldOpenAppointmentWarning}
      closeOnTapAway={false}
      content={
        <div>
          <p>{t('GUESTS_WITH_NO_CONTACT_INFO')}</p>
          {members.map(m => (
            <li key={m.id}>{getDisplayName(m)}</li>
          ))}
        </div>
      }
      lblOK={t('OK_GOT_IT')}
      onOKClick={() => this.handleCloseAppointmentWarning()}
      onCloseRequest={() => this.handleCloseAppointmentWarning()}
      hideCancelButton
    />
  );

  handlePropertyDialogClose = () => {
    this.setState({ isPropertySelectorDialogOpen: false });
  };

  addSelectedPropertyIdToAppointment = (appointmentData, selectedPropertyId) => ({
    ...appointmentData,
    metadata: { ...appointmentData.metadata, selectedPropertyId },
  });

  handleSubmitAppointment = (appointmentData, propertiesForSelector, submitFn, isEditing = false) => {
    const isPropertySelectorDialogOpen = propertiesForSelector.length > 1;
    this.setState({ isPropertySelectorDialogOpen, propertiesForSelector, appointmentData, isEditing });
    const property = propertiesForSelector[0] || {};
    const appointment = this.addSelectedPropertyIdToAppointment(appointmentData, property.id);
    !isPropertySelectorDialogOpen && submitFn(appointment);
  };

  handleUpdateAppointment = (appointmentData, propertiesForSelector) => {
    this.handleSubmitAppointment(appointmentData, propertiesForSelector, this.props.updateAppointment, true);
  };

  handleSaveAppointment = (appointmentData, propertiesForSelector) => {
    this.handleSubmitAppointment(appointmentData, propertiesForSelector, this.props.saveAppointment);
  };

  handleSubmitPropertySelection = ({ assignedPropertyId }) => {
    const { appointmentData, isEditing } = this.state;
    const appointment = this.addSelectedPropertyIdToAppointment(appointmentData, assignedPropertyId);

    isEditing ? this.props.updateAppointment(appointment) : this.props.saveAppointment(appointment);
    this.setState({ isPropertySelectorDialogOpen: false, isEditing: false });
  };

  render() {
    const {
      isAddingAppointment,
      property,
      partyId,
      users,
      selectorDataForParty,
      endAddingAppointment: doEndAddAppointment,
      propertyIds,
      properties,
      currentUser,
    } = this.props;

    const { isPropertySelectorDialogOpen, propertiesForSelector } = this.state;

    return (
      <div>
        <AppointmentDialog
          isAddingAppointment={isAddingAppointment}
          partyId={partyId}
          agents={Array.from(users).map(p => p[1])}
          selectorData={selectorDataForParty}
          propertyIds={propertyIds}
          endAddingAppointment={doEndAddAppointment}
          onOpenWarning={this.handleOpenAppointmentWarning}
          property={property}
          properties={properties}
          onSaveAppointment={this.handleSaveAppointment}
          onUpdateAppointment={this.handleUpdateAppointment}
          isPropertySelectorDialogOpen={isPropertySelectorDialogOpen}
        />
        {this.state.shouldOpenAppointmentWarning && this.renderAppointmentNotification(this.state.selectedMembers)}
        {isPropertySelectorDialogOpen && (
          <PropertySelectionDialog
            open={isPropertySelectorDialogOpen}
            showCancelButton
            closeOnEscape={false}
            onClose={this.handlePropertyDialogClose}
            forceFocusOnDialog={true}
            onSubmit={this.handleSubmitPropertySelection}
            party={this.props.party}
            properties={propertiesForSelector}
            propertyId={this.props.party.assignedPropertyId}
            shouldDisplayTeamAndContactChannel={false}
            titleText={t('APPOINTMENT_PROPERTY_SELECTOR_TITLE')}
            contentText={t('APPOINTMENT_PROPERTY_SELECTOR_CONTENT')}
            fieldToDisplayForProperty="displayNameForSelector"
            teams={currentUser.teams}
          />
        )}
      </div>
    );
  }
}
