/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';

import { getPartyEnhancedAppointments, getPartyMembers } from 'redux/selectors/partySelectors';
import { openFlyout } from 'redux/modules/flyoutStore';
import { sendMessage } from 'redux/modules/communication';
import { startEditingAppointment } from 'redux/modules/appointments.dialog';
import { observer } from 'mobx-react';
import AppointmentList from '../AppointmentList/AppointmentList';

@connect(
  (state, props) => ({
    appointments: getPartyEnhancedAppointments(state, props),
    partyMembers: getPartyMembers(state, props),
  }),
  dispatch =>
    bindActionCreators(
      {
        openFlyout,
        sendMessage,
        startEditingAppointment,
      },
      dispatch,
    ),
)
@observer
export default class ApoinmentListWrapper extends Component {
  get appointments() {
    const { props } = this;
    const { appointments } = props;

    return appointments ? appointments.toArray() : [];
  }

  handleEditAppointment = appointment => this.props.startEditingAppointment(appointment);

  render() {
    const { props } = this;
    const { defaultFocusedAppointmentId, partyMembers, partyLoadingModel, timezone, isActiveLeaseParty } = props;
    const { loading } = partyLoadingModel;

    if (isActiveLeaseParty && !this.appointments.length) return null;

    return (
      <AppointmentList
        appointments={this.appointments}
        loading={loading}
        timezone={timezone}
        editAppointment={this.handleEditAppointment}
        defaultFocusedAppointmentId={defaultFocusedAppointmentId}
        sendMessage={props.sendMessage}
        partyMembers={partyMembers}
      />
    );
  }
}
