/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import DocumentMeta from 'react-document-meta';
import { t } from 'i18next';
import {
  AppBar,
  Button,
  DateSelector,
  Switch,
  TextBox,
  Section,
  AppBarActions,
  IconButton,
  CardMenu,
  CardMenuItem,
  Typography as T,
  PreloaderBlock,
} from 'components';
import { inject, observer } from 'mobx-react';
import { fetchAppSettings, updateAppSettings } from 'redux/modules/appSettingsStore';
import { logout } from 'helpers/auth-helper';
import groupBy from 'lodash/groupBy';
import { encodeTextSetting, encodeBoolSetting, encodeDateSetting, encodeNumberSetting, TRUE_STRING } from '../../helpers/appSettingsHelper';
import { DALTypes } from '../../../common/enums/DALTypes';
import { toMoment } from '../../../common/helpers/moment-utils';
import { DATE_US_FORMAT } from '../../../common/date-constants';
import { isNumberValid } from '../../../common/helpers/validations/number';

import { cf } from './AppSettingsPage.scss';

@connect(
  state => ({
    authUser: state.auth.user,
    appSettings: state.appSettingsStore.appSettings,
    isLoading: state.appSettingsStore.isLoading,
  }),
  dispatch =>
    bindActionCreators(
      {
        fetchAppSettings,
        updateAppSettings,
      },
      dispatch,
    ),
)
@inject('leasingNavigator')
@observer
export default class AppSettingsPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = { appSettings: [] };
  }

  navigateToHome = () => {
    this.props.leasingNavigator.navigateToHome();
  };

  componentWillMount() {
    this.props.fetchAppSettings();
  }

  componentWillReceiveProps(nextProps) {
    const enhancedAppSettings = nextProps.appSettings ? nextProps.appSettings.map(s => ({ ...s, newValue: null })) : [];
    this.setState({
      appSettings: enhancedAppSettings,
    });
  }

  handleLogout = event => {
    event.preventDefault();
    this.props.leasingNavigator.navigateToHome();
    logout();
  };

  getCurrentValue = setting => (setting.newValue !== null ? setting.newValue : setting.value);

  getBoolValue = setting => this.getCurrentValue(setting) === TRUE_STRING;

  getDateValue = setting => toMoment(this.getCurrentValue(setting), { parseFormat: DATE_US_FORMAT });

  updateValue = (key, newValue) => {
    const updatedAppSettings = this.state.appSettings.map(s => (s.key === key ? { ...s, newValue } : s));
    this.setState({ appSettings: updatedAppSettings });
  };

  saveSettings = () => {
    const { appSettings } = this.state;
    const settingsToSave = appSettings.filter(appSetting => appSetting.newValue !== null);
    this.props.updateAppSettings(settingsToSave);
    this.props.leasingNavigator.navigateToHome();
  };

  getTextComponent = appSetting => (
    <TextBox wide label={appSetting.key} value={appSetting.value} onChange={args => this.updateValue(appSetting.key, encodeTextSetting(args.value))} />
  );

  getBoolComponent = appSetting => (
    <Switch label={appSetting.key} checked={this.getBoolValue(appSetting)} onChange={args => this.updateValue(appSetting.key, encodeBoolSetting(args))} />
  );

  isFormInvalid = () => {
    const { appSettings } = this.state;

    return appSettings
      .filter(setting => setting.datatype === DALTypes.AppSettingsDataType.NUMBER)
      .some(setting => !isNumberValid(this.getCurrentValue(setting)));
  };

  getNumberComponent = appSetting => (
    <TextBox
      label={appSetting.key}
      value={appSetting.value}
      errorMessage={isNumberValid(this.getCurrentValue(appSetting)) ? null : t('VALUE_MUST_BE_NUMBER')}
      onChange={args => this.updateValue(appSetting.key, encodeNumberSetting(args.value))}
    />
  );

  getDateComponent = appSetting => (
    <DateSelector
      label={appSetting.key}
      selectedDate={this.getDateValue(appSetting)}
      onChange={value => this.updateValue(appSetting.key, encodeDateSetting(value))}
    />
  );

  renderSettingRow = (appSetting, settingComponent) => (
    <div key={`${appSetting.key}${appSetting.value}`} className={cf('settingColumn')}>
      <T.Text bold>{appSetting.description}</T.Text>
      <div key={appSetting.id} className={cf('settingRow')}>
        {settingComponent}
      </div>
    </div>
  );

  renderSetting = appSetting => {
    if (!appSetting) return <noscript />;

    let settingComponent;
    switch (appSetting.datatype) {
      case DALTypes.AppSettingsDataType.TEXT:
        settingComponent = this.getTextComponent(appSetting);
        break;
      case DALTypes.AppSettingsDataType.BOOL:
        settingComponent = this.getBoolComponent(appSetting);
        break;
      case DALTypes.AppSettingsDataType.NUMBER:
        settingComponent = this.getNumberComponent(appSetting);
        break;
      case DALTypes.AppSettingsDataType.DATE:
        settingComponent = this.getDateComponent(appSetting);
        break;
      default:
        return <noscript />;
    }

    return this.renderSettingRow(appSetting, settingComponent);
  };

  renderCategory = (category, settings) => (
    <Section key={category} title={`${category} settings`}>
      {settings && settings.map(this.renderSetting)}
    </Section>
  );

  renderSettings = appSettings => {
    if (!appSettings) return <noscript />;

    const groupedSettings = groupBy(appSettings, s => s.category);
    return Object.entries(groupedSettings).map(([category, settings]) => this.renderCategory(category, settings));
  };

  render({ authUser, isLoading } = this.props) {
    const { appSettings } = this.state;
    return (
      <div className={cf('AppSettingsPage')}>
        <DocumentMeta title={t('APP_SETTINGS_PAGE')} />
        <AppBar title={authUser.tenantName} icon={<IconButton iconStyle="light" iconName="home" onClick={this.navigateToHome} />}>
          <AppBarActions>
            <CardMenu iconName="dots-vertical" iconStyle="light" menuListStyle={{ width: 200 }}>
              <CardMenuItem text={t('LOGOUT')} onClick={this.handleLogout} />
            </CardMenu>
          </AppBarActions>
        </AppBar>
        {isLoading && <PreloaderBlock />}
        {!isLoading && <div className={cf('settingsContainer')}>{this.renderSettings(appSettings)}</div>}
        <Section title={t('PERSIST_SETTINGS')}>
          <div className={cf('buttonBar')}>
            <Button label={t('SAVE_SETTINGS')} disabled={isLoading || this.isFormInvalid()} onClick={this.saveSettings} />
            <Button label={t('BACK')} onClick={this.navigateToHome} />
          </div>
        </Section>
      </div>
    );
  }
}
