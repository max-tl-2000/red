/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import notifier from 'helpers/notifier/notifier';
import { Dialog, DialogOverlay } from 'components';
import ScheduleAppointmentForm from './ScheduleAppointmentForm';
import { cf } from './AppointmentDialog.scss';

export default class AppointmentDialog extends Component {
  static propTypes = {
    isAddingAppointment: PropTypes.bool,
    partyId: PropTypes.string,
    propertyIds: PropTypes.arrayOf(PropTypes.string),
    agents: PropTypes.array,
    selectorData: PropTypes.object,
    onSuccess: PropTypes.func,
    partyAppointments: PropTypes.object,
  };

  handleClose = () => {
    this.props.endAddingAppointment();
  };

  handleUpdateAppointment = (appointment, propertiesForSelector) => {
    const { onUpdateAppointment } = this.props;
    onUpdateAppointment && onUpdateAppointment(appointment, propertiesForSelector);
  };

  handleSaveAppointment = (appointment, propertiesForSelector) => {
    const { onSaveAppointment } = this.props;
    onSaveAppointment && onSaveAppointment(appointment, propertiesForSelector);
  };

  render() {
    const {
      isAddingAppointment,
      onOpenWarning,
      property,
      partyId,
      propertyIds,
      agents,
      selectorData,
      partyAppointments,
      properties,
      isPropertySelectorDialogOpen,
    } = this.props;

    return (
      <Dialog appendToBody open={isAddingAppointment} onCloseRequest={() => this.handleClose()}>
        <DialogOverlay container={false} className={cf('apptDialog', isPropertySelectorDialogOpen ? 'shouldHide' : '')}>
          {isAddingAppointment && (
            <ScheduleAppointmentForm
              partyId={partyId}
              propertyIds={propertyIds}
              property={property}
              onOpenWarning={onOpenWarning}
              agents={agents}
              selectorData={selectorData}
              onCancel={this.handleClose}
              partyAppointments={partyAppointments}
              properties={properties}
              onSaveAppointment={this.handleSaveAppointment}
              onUpdateAppointment={this.handleUpdateAppointment}
              onSuccess={text => {
                notifier.success(text);
              }}
            />
          )}
        </DialogOverlay>
      </Dialog>
    );
  }
}
