/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import fuzzysearch from 'fuzzysearch';
import clsc from 'helpers/coalescy';
import { bindActionCreators } from 'redux';
import generateId from 'helpers/generateId';
import { t } from 'i18next';
import { Dialog, DialogOverlay, Button, Form, Field, Dropdown, Typography as T, DialogActions, DialogHeader, PreloaderBlock, Radio } from 'components';
import { connect } from 'react-redux';
import { closeImportedParties, archivePartiesFromSoldProperties, finishArchivePartiesFromSoldProperties } from 'redux/modules/tenantsStore';
import { cf } from './CloseOrArchivePartiesDialog.scss';
import { now, toMoment } from '../../../common/helpers/moment-utils';
import { LA_TIMEZONE, DATE_ONLY_FORMAT } from '../../../common/date-constants';
import DateSelector from '../../components/DateSelector/DateSelector';

const selectionValues = {
  CLOSE: 'close',
  ARCHIVE: 'archive',
};

@connect(
  state => ({
    closingImportedParties: state.tenants.closingImportedParties,
    authUser: state.auth.user,
    openDataMigration: state.tenants.openDataMigration,
    archiveInProgress: state.tenants.archiveInProgress,
    archiveFinished: state.tenants.archiveFinished,
    archiveStatus: state.tenants.archiveStatus,
    numberOfPartiesToArchive: state.tenants.numberOfPartiesToArchive,
  }),
  dispatch =>
    bindActionCreators(
      {
        closeImportedParties,
        archivePartiesFromSoldProperties,
        finishArchivePartiesFromSoldProperties,
      },
      dispatch,
    ),
)
export default class CloseOrArchivePartiesDialog extends Component {
  constructor(props) {
    super(props);
    this.state = {
      id: generateId(this),
      selectedValue: selectionValues.CLOSE,
    };
  }

  static propTypes = {
    open: PropTypes.bool,
    properties: PropTypes.arrayOf(PropTypes.object),
    onClose: PropTypes.func,
  };

  componentWillReceiveProps(nextProps) {
    if (this.props.closingImportedParties !== nextProps.closingImportedParties && !nextProps.closingImportedParties) {
      this.handleOnClose();
      nextProps.openDataMigration && this.props.handleShowImportDataDialog();
    }
  }

  get isSubmitDisabled() {
    const { propertyIds, activityDate, selectedValue } = this.state;
    if (selectedValue === selectionValues.CLOSE && propertyIds && propertyIds.length && activityDate) return this.props.closingImportedParties;
    if (selectedValue === selectionValues.ARCHIVE && propertyIds && propertyIds.length) return this.props.archiveInProgress;
    return true;
  }

  get dropdownProperties() {
    const { properties } = this.props;
    const { selectedValue } = this.state;

    if (selectedValue === selectionValues.ARCHIVE) {
      return properties
        .filter(p => !!p.endDate && toMoment(p.endDate, { timezone: p.timezone }).isSameOrBefore(now({ timezone: p.timezone })))
        .sort((a, b) => a.displayName.toUpperCase().localeCompare(b.displayName.toUpperCase()));
    }

    return properties.sort((a, b) => a.displayName.toUpperCase().localeCompare(b.displayName.toUpperCase()));
  }

  handleDateChange = value => this.setState({ activityDate: value });

  handlePropertyChange = ({ ids }) => this.setState({ propertyIds: ids });

  handleOnSubmit = () => {
    const { selectedValue } = this.state;
    const { archiveInProgress, archiveFinished, authUser } = this.props;
    const propertyIds = this.state.propertyIds;
    const { tenantId } = authUser;

    if (selectedValue === selectionValues.CLOSE) {
      const activityDate = toMoment(this.state.activityDate).format(DATE_ONLY_FORMAT);
      this.props.closeImportedParties(tenantId, propertyIds, activityDate);
      return;
    }

    if (selectedValue === selectionValues.ARCHIVE) {
      if (!archiveInProgress && archiveFinished) {
        this.props.finishArchivePartiesFromSoldProperties();
        this.handleOnClose();
        this.props.handleShowImportDataDialog();
        return;
      }
      this.props.archivePartiesFromSoldProperties(tenantId, propertyIds);
    }

    return;
  };

  handleOnClose = () => {
    const { onClose } = this.props;
    onClose && onClose();
  };

  matchQuery = (query, { originalItem: item }) => {
    if (item.items) return false;

    return fuzzysearch(query, item.displayName.toLowerCase()) || fuzzysearch(query, item.name.toLowerCase());
  };

  render() {
    const { id, open, closingImportedParties, archiveInProgress, archiveFinished, archiveStatus, numberOfPartiesToArchive } = this.props;
    const { selectedValue } = this.state;

    const theId = clsc(id, this.state.id);
    const datePickerMax = now({ timezone: LA_TIMEZONE });
    return (
      <Dialog open={open} id={theId} closeOnEscape={false} onClose={this.handleOnClose}>
        <DialogOverlay className={cf('close-or-archive-parties-dialog')}>
          <DialogHeader title={t('CLOSE_OR_ARCHIVE_PARTIES')} />
          <Form>
            {!archiveFinished && (
              <div>
                <Radio
                  label={t('CLOSE_IMPORTED_PARTIES')}
                  checked={selectedValue === selectionValues.CLOSE}
                  onChange={() => this.setState({ selectedValue: selectionValues.CLOSE })}
                />
                <div className={cf('close-or-archive-parties-body')}>
                  <T.Text>{t('CLOSE_IMPORTED_PARTIES_MESSAGE')}</T.Text>
                  <Field className={cf('close-or-archive-parties-field')} columns={12}>
                    <DateSelector
                      placeholder={t('SELECT_CLOSE_DATE_PLACEHOLDER')}
                      appendToBody={false}
                      disabled={selectedValue === selectionValues.ARCHIVE}
                      max={datePickerMax}
                      tz={LA_TIMEZONE}
                      selectedDate={this.state.activityDate}
                      onChange={this.handleDateChange}
                    />
                  </Field>
                </div>
                <Radio
                  label={t('ARCHIVE_PARTIES_FROM_SOLD_PROPERTIES_TITLE')}
                  checked={selectedValue === selectionValues.ARCHIVE}
                  onChange={() => this.setState({ selectedValue: selectionValues.ARCHIVE })}
                />
                <div className={cf('close-or-archive-parties-body')}>
                  <T.Text>{t('ARCHIVE_PARTIES_FROM_SOLD_PROPERTIES_DESCRIPTION')}</T.Text>
                </div>
                <Field className={cf('property-dropdown', 'close-or-archive-parties-field')} columns={12}>
                  <Dropdown
                    placeholder={t('SELECT_CLOSE_PROPERTY_PLACEHOLDER')}
                    wide
                    multiple
                    filterable
                    selectAllEnabled
                    textField="displayName"
                    valueField="id"
                    id="assignedProperty"
                    onChange={this.handlePropertyChange}
                    matchQuery={this.matchQuery}
                    selectedValue={this.state.propertyIds}
                    items={this.dropdownProperties}
                  />
                </Field>
              </div>
            )}
            {archiveFinished && (
              <div>
                <T.Text> {t(archiveStatus, { number: numberOfPartiesToArchive })} </T.Text>
              </div>
            )}
          </Form>
          <DialogActions>
            {!archiveInProgress && !archiveFinished && <Button type="flat" btnRole="secondary" onClick={this.handleOnClose} label={t('CANCEL')} />}
            <Button type="flat" onClick={this.handleOnSubmit} label={!archiveFinished ? t('START') : t('OK')} disabled={this.isSubmitDisabled} />
          </DialogActions>
          {(closingImportedParties || archiveInProgress) && <PreloaderBlock modal />}
        </DialogOverlay>
      </Dialog>
    );
  }
}
