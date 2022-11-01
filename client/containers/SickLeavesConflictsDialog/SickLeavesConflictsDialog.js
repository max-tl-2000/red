/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import clsc from 'helpers/coalescy';
import { t } from 'i18next';
import { Dialog, DialogOverlay, Button, Typography as T, DialogActions, DialogHeader } from 'components';
import { addPropertyToUnitFilters } from 'redux/modules/unitsFilter';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { cf } from './SickLeavesConflictsDialog.scss';
import { toMoment, findLocalTimezone } from '../../../common/helpers/moment-utils';

@connect(
  state => ({
    propertiesByTeamsLoading: state.globalStore.get('globalDataIsLoading'),
    teamPropertyMap: state.globalStore.get('propertiesByTeams'),
    enableRenewals: state.auth.user.features.enableRenewals,
    enableTransfers: state.auth.user.features.enableTransfers,
  }),
  dispatch =>
    bindActionCreators(
      {
        addPropertyToUnitFilters,
      },
      dispatch,
    ),
)
export class SickLeavesConflictsDialog extends Component {
  static propTypes = {
    id: PropTypes.string,
    open: PropTypes.bool,
    onClose: PropTypes.func,
    closeOnEscape: PropTypes.bool,
    showCancelButton: PropTypes.bool,
    selectedAgent: PropTypes.object,
    conflictEvents: PropTypes.arrayOf(PropTypes.object),
  };

  static defaultProps = {
    closeOnEscape: true,
    showCancelButton: false,
    open: false,
    conflictEvents: [],
  };

  handleOnClose = () => {
    const { onClose } = this.props;
    onClose && onClose();
  };

  storeDialogOverlayRef = ref => {
    this.dialogOverlayRef = ref;
  };

  renderConflicts = conflictEvents => {
    const timezone = findLocalTimezone();
    return conflictEvents.map(conflictEvent => {
      const { startDate } = conflictEvent?.metadata || {};
      const { guestNames = '', inventoryName = '', buildingName = '', propertyName = '' } = conflictEvent || {};
      const names = [];
      const momentDate = startDate && toMoment(startDate, { timezone });
      const date = momentDate.calendar(null, {
        sameDay: '[Today at] hh:mm a z',
        nextDay: '[Tomorrow at] hh:mm a z',
        lastDay: '[Yesterday at]  hh:mm a z',
        lastWeek: '[Last] dddd [at] hh:mm a z',
        nextWeek: 'dddd [at] hh:mm a z',
        sameElse: 'DD/MM/YYYY [at] hh:mm a z',
      });

      propertyName && names.push(propertyName);
      buildingName && names.push(buildingName);
      inventoryName && names.push(inventoryName);
      const units = names.length ? names.join('-') : '';
      const guests = guestNames.length ? guestNames.join(', ') : '';

      return (
        <div key={`conflict-${conflictEvent.id}`} className={cf('conflicts-wrapper')}>
          <T.SubHeader inline>{t('PROSPECT_CARD_APPOINTMENT_WITH_PARTICIPANTS', { guests })}</T.SubHeader>
          {inventoryName && (
            <T.Caption inline className={cf('conflict-unit')}>
              {t('VISITING', { units })}
            </T.Caption>
          )}
          <T.Text className={cf('conflict-date')}>{date}</T.Text>
        </div>
      );
    });
  };

  render() {
    const { id, open, selectedAgent, onClose, conflictEvents = [] } = this.props;
    const theId = clsc(id, this.id);
    const { fullName: agentName } = selectedAgent || {};

    return (
      <Dialog open={open} id={theId} forceFocusOnDialog closeOnEscape onClose={this.handleOnClose}>
        <DialogOverlay ref={this.storeDialogOverlayRef} className={cf('property-selection-dialog')} container={false}>
          <DialogHeader title={t('SICK_LEAVES_FOR', { agentName })} />
          <T.Text className={cf('info-text')}>{t('APPOINTMENTS_NEED_TO_BE_REASSIGNED')}</T.Text>
          {this.renderConflicts(conflictEvents)}
          <DialogActions className={cf('actions')}>
            <Button type="flat" id="submitAssignedProperty" onClick={onClose} label={t('CLOSE')} disabled={this.isSubmitDisabled} />
          </DialogActions>
        </DialogOverlay>
      </Dialog>
    );
  }
}
