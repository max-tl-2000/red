/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { t } from 'i18next';
import { formatInventoryItems } from 'helpers/quotes';
import { Typography as T, TextBox, Button, Dialog, DialogOverlay, DialogActions, DialogHeader, CheckBox } from 'components';
import { taskDuedateFormat, isTaskAutoclosing } from '../../helpers/taskUtils';
import { cf } from './MarkAsCompleteTaskDialog.scss';
import { DALTypes } from '../../../common/enums/DALTypes';
import { normalizeFilters } from '../../../common/helpers/filters';
import InventorySelector from '../InventorySelector/InventorySelector';
import { enhanceAdditionalTag } from '../../helpers/inventory';
import GuestList from '../../custom-components/GuestList/GuestList';
import { formatTaskTimeForTitle } from '../../helpers/appointments';

export default class MarkAsCompleteTaskDialog extends Component {
  static propTypes = {
    task: PropTypes.object,
    title: PropTypes.string,
    onClickDone: PropTypes.func,
    onClickCancel: PropTypes.func,
    onCancelTask: PropTypes.func,
  };

  constructor(props) {
    super(props);
    const { task } = props;
    const preselectedUnits = task ? this.getPreselectedUnits(task) : [];
    const units = task ? this.getUnits(task) : [];
    this.state = {
      unitsInputValue: [],
      preselectedUnits,
      units,
    };
  }

  getPreselectedUnits = task => task.metadata && task.metadata.inventories && task.metadata.inventories.map(unit => unit.id);

  getUnits = task => (task.metadata && task.metadata.inventories && task.metadata.inventories) || [];

  componentWillReceiveProps(nextProps) {
    if ('task' in nextProps && nextProps.task) {
      if (nextProps.task.name === 'APPOINTMENT') {
        this.setState({
          preselectedUnits: this.getPreselectedUnits(nextProps.task),
          units: this.getUnits(nextProps.task),
        });
      }
    }
  }

  getResultsBasedOnQuery = async ({ query }) => {
    let filters = normalizeFilters();
    if (query) {
      filters = { ...filters, query };
    } else {
      // this will be helpful for the callSourceOnFocus prop in the InventorySelector, it will get units with state = 'model'
      // moreover, it will work only when the query is empty.
      filters = {
        ...filters,
        withoutLimit: true,
        inventoryStates: [DALTypes.InventoryState.MODEL],
      };
    }

    const res = (await this.props.searchUnits(filters)) || {};
    const { partyAppointments, quotes, prospect } = this.props;
    const favoritedUnits = prospect && prospect.metadata && prospect.metadata.favoriteUnits;
    res.data = enhanceAdditionalTag(res.data, partyAppointments, quotes, favoritedUnits);
    return formatInventoryItems(res.data, DALTypes.InventorySelectorCases.SCHEDULE_APPOINTMENT);
  };

  onUnitsInputChanged = unitsInputValue => {
    this.setState({
      unitsInputValue,
    });
  };

  clickDoneHandler = () => {
    const { unitsInputValue, preselectedUnits } = this.state;
    const { task, actionType } = this.props;
    const inventories = unitsInputValue.ids && unitsInputValue.ids.length ? unitsInputValue.ids : preselectedUnits;
    const sendConfirmationEmail = !!(this.sendEmailCheckBox && this.sendEmailCheckBox.value);
    this.props.onClickDone(task, this.noteText && this.noteText.value, actionType, inventories, sendConfirmationEmail);
  };

  clickCancelTaskHandler = () => {
    const { task } = this.props;
    this.props.onCancelTask(task);
  };

  getDialogTitle = (task, actionType) => {
    const { timezone } = this.props;
    const appointmentTitles = {
      [DALTypes.AppointmentResults.COMPLETE]: t('COMPLETE_APPOINTMENT_DIALOG_TITLE'),
      [DALTypes.AppointmentResults.NO_SHOW]: t('MARK_NO_SHOW_APPOINTMENT_DIALOG_TITLE'),
      [DALTypes.AppointmentResults.CANCELLED]: t('CANCEL_APPOINTMENT_DIALOG_TITLE'),
    };
    return `${task.name === 'APPOINTMENT' ? appointmentTitles[actionType] : t(task.name)} ${formatTaskTimeForTitle(task, timezone)}`;
  };

  getActionLabel = () => {
    const actionLabels = {
      [DALTypes.AppointmentResults.COMPLETE]: t('MARK_DONE'),
      [DALTypes.AppointmentResults.NO_SHOW]: t('MARK_NOSHOW'),
      [DALTypes.AppointmentResults.CANCELLED]: t('CANCEL_APPOINTMENT'),
    };
    return actionLabels[this.props.actionType];
  };

  renderCancelAsAdminDialog = () => {
    const { open, onClickCancel } = this.props;
    return (
      <Dialog type="modal" open={open} onCloseRequest={() => onClickCancel()}>
        <DialogOverlay className={cf('mainContent')}>
          <DialogHeader>
            <T.Title ellipsis>{t('CANCEL_TASK')}</T.Title>
          </DialogHeader>
          <T.Text>{t('CONFIRM_CANCEL_TASK')}</T.Text>
          <DialogActions>
            <Button type="flat" btnRole="secondary" label={t('NO')} data-action="close" />
            <Button type="flat" btnRole="primary" label={t('YES')} data-action="OK" onClick={this.clickCancelTaskHandler} />
          </DialogActions>
        </DialogOverlay>
      </Dialog>
    );
  };

  render = () => {
    const { open, onClickCancel, task, actionType, timezone } = this.props;
    if (!task) return <noscript />;
    if (isTaskAutoclosing(task) && DALTypes.TaskNames.APPOINTMENT !== task.name) {
      return this.renderCancelAsAdminDialog();
    }

    const isAppointmentTask = task.name === DALTypes.TaskNames.APPOINTMENT;

    return (
      <Dialog type="modal" open={open} onCloseRequest={() => onClickCancel()}>
        <DialogOverlay className={cf('mainContent')}>
          <DialogHeader>
            <T.SubHeader ellipsis>{this.getDialogTitle(task, actionType)}</T.SubHeader>
            {(task.name === 'APPOINTMENT' && <GuestList TagElement={T.Text} data-id="guests" inline guests={task.partyMembers || []} />) || (
              <T.Text secondary>{taskDuedateFormat(task, timezone)}</T.Text>
            )}
          </DialogHeader>
          {isAppointmentTask && actionType === DALTypes.AppointmentResults.COMPLETE && (
            <InventorySelector
              placeholder={t('SCHEDULE_APPOINTMENT_FORM_UNITS')}
              ref={this.storeInventorySelectorRef}
              selectedValue={this.state.preselectedUnits}
              handleChange={this.onUnitsInputChanged}
              items={this.state.units}
              selectedChipText="fullQualifiedName"
              callSourceOnFocus={true}
              source={this.getResultsBasedOnQuery}
              showFooter
              templateType={DALTypes.InventorySelectorCases.SCHEDULE_APPOINTMENT}
            />
          )}
          <TextBox
            placeholder={isAppointmentTask ? t('TYPE_CLOSING__APPOINTMENT_NOTE') : t('TYPE_CLOSING_NOTE')}
            value={task.metadata && task.metadata.closingNote}
            multiline
            wide
            autoResize={false}
            numRows={4}
            ref={tx => (this.noteText = tx)}
          />
          {isAppointmentTask && actionType === DALTypes.AppointmentResults.CANCELLED && (
            <CheckBox ref={checkbox => (this.sendEmailCheckBox = checkbox)} label={t('SCHEDULE_APPOINTMENT_FORM_SEND_NOTIFICATION')} />
          )}
          <DialogActions>
            <Button type="flat" btnRole="secondary" label={t('CANCEL')} data-action="close" />
            <Button
              type="flat"
              disabled={this.state.isMarkAsDoneDisabled}
              data-action="mark-as-done"
              btnRole="primary"
              label={this.getActionLabel()}
              onClick={this.clickDoneHandler}
            />
          </DialogActions>
        </DialogOverlay>
      </Dialog>
    );
  };
}
