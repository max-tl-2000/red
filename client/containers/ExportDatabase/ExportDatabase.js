/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { Section, Typography, Field, Dropdown, Button } from 'components';
import { t } from 'i18next';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { exportDatabase } from 'redux/modules/exportDatabase';
import JobStatus from '../Jobs/JobStatus';
import { cf } from './exportDatabase.scss';
import { DALTypes } from '../../../common/enums/DALTypes';
import { isCustomerAdmin } from '../../../common/helpers/auth';
import { spreadsheet } from '../../../common/helpers/spreadsheet';
import { now } from '../../../common/helpers/moment-utils';

const { Text } = Typography;

@connect(
  state => ({
    authUser: state.auth.user,
    exportData: state.exportDatabase,
    tenantProperties: state.globalStore.get('properties'),
  }),
  dispatch =>
    bindActionCreators(
      {
        exportDatabase,
      },
      dispatch,
    ),
)
export default class ExportDatabase extends Component {
  constructor(props) {
    super(props);
    this.state = {
      propertiesSelected: [],
      worksheetsSelected: [],
    };
  }

  handleExport = () => {
    const { tenantId } = this.props.authUser;
    const { propertiesSelected, worksheetsSelected } = this.state;
    let properties;

    if (this.props.tenantProperties.length === propertiesSelected.length) {
      properties = []; // when we send an empty list, by default backend get all properties.
    } else {
      properties = propertiesSelected.map(property => ({ id: property.id, name: property.name }));
    }

    const sheetNames = worksheetsSelected.map(sheet => sheet.workbookSheetName);
    this.props.exportDatabase(tenantId, properties, sheetNames, now().format('YYYY-MM-DD_HH-mm-ss'));
  };

  handleChangeProperties = ({ items }) => {
    this.setState({
      propertiesSelected: items,
    });
  };

  renderPropertiesSelect = propertiesSelected => {
    if (propertiesSelected.length === 0) {
      return (
        <div>
          <Text secondary>{t('DEFAULT_PROPERTIES_SELECTED')}</Text>
        </div>
      );
    }
    return (
      <div>
        <Text secondary>{propertiesSelected.reduce((acc, item) => acc.concat(item.displayName), []).join(', ')}</Text>
      </div>
    );
  };

  renderSheetsSelected = worksheetsSelected => {
    if (worksheetsSelected.length === 0) {
      return (
        <div>
          <Text secondary>{t('DEFAULT_WORKSHEETS_SELECTED')}</Text>
        </div>
      );
    }
    return (
      <div>
        <Text secondary>{worksheetsSelected.reduce((acc, item) => acc.concat(item.workbookSheetName), []).join(', ')}</Text>
      </div>
    );
  };

  render({ authUser = {} } = this.props) {
    const { propertiesSelected, worksheetsSelected } = this.state;
    const { tenantProperties, exportData } = this.props;
    const isCustomerAdminUser = isCustomerAdmin(authUser);

    return (
      <div>
        {!isCustomerAdminUser && (
          <div>
            <Section title={t('EXPORT_DATABASE')}>
              <Field columns={4}>
                <Dropdown
                  items={tenantProperties}
                  onChange={({ items }) => this.setState({ propertiesSelected: items })}
                  placeholder={t('SELECT_PROPERTIES')}
                  textField="displayName"
                  valueField="id"
                  wide
                  multiple
                />
                {this.renderPropertiesSelect(propertiesSelected)}
              </Field>
              <Field columns={4}>
                <Dropdown
                  items={Object.values(spreadsheet)}
                  onChange={({ items }) => this.setState({ worksheetsSelected: items })}
                  placeholder={t('SELECT_WORKSHEETS')}
                  textField="workbookSheetName"
                  valueField="workbookSheetName"
                  wide
                  multiple
                />
                {this.renderSheetsSelected(worksheetsSelected)}
              </Field>
              <Field columns={6}>
                <Button label={t('EXPORT')} onClick={this.handleExport} disabled={exportData.exportStarted} />
                {exportData.exportFinishedWithErrors && <Text error>{t('EXPORT_DATABASE_ERROR')}</Text>}
              </Field>
            </Section>
          </div>
        )}

        <Section title={t('JOBS_STATUS')}>
          <JobStatus jobCategory={DALTypes.JobCategory.ExportDatabase} privateResult={true} />
        </Section>
        <div className={cf('item-count-notification')}>
          <Text inline>{t('IMPORT_ADMIN_JOBS_COUNT_NOTICE')}</Text>
        </div>
      </div>
    );
  }
}
