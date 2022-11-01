/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { t } from 'i18next';
import { Text, Caption } from 'components/Typography/Typography';
import { validatePhone } from 'helpers/phone-utils';
import injectProps from 'helpers/injectProps';
import { formatPhoneNumber } from 'helpers/strings';
import cfg from 'helpers/cfg';
import { Button, Section, Field, TextBox, PhoneTextBox } from 'components';

import MultiTextBox from 'components/MultiTextBox/MultiTextBox';
import snackbar from 'helpers/snackbar/snackbar';
import { sendResetPasswordMail } from 'redux/modules/needHelp';
import { createIpPhoneCredentials, removeIpPhoneCredentials, updateUser } from 'redux/modules/usersStore';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import IPPhoneDialog from './IPPhoneDialog';
import { isEmailValid } from '../../../common/helpers/validations/email';
import { formatTenantEmailDomain } from '../../../common/helpers/utils';
import { cf } from './UserSettings.scss';

const itemAlreadyExists = (allItems, newItem) => allItems.filter(item => item.value === newItem).length > 1;

const Block = ({ label, text, columns, last, inline }) => (
  <Field style={{ paddingTop: 20, marginBottom: '.5rem' }} inline={inline} columns={columns} last={last}>
    <Caption>{label}</Caption>
    <div style={{ padding: '10px 0' }}>
      <Text style={{ fontSize: 15 }}>{text}</Text>
    </div>
  </Field>
);

const getExternalCalendars = loggedInUser => {
  const { externalCalendars, teams } = loggedInUser;

  const userPrimaryCalendar = externalCalendars.calendars && externalCalendars.calendars.find(calendar => calendar.calendar_primary);
  const teamsCalendars = teams.map(
    team =>
      team.externalCalendars.calendars && team.externalCalendars.calendars.find(calendar => calendar.calendar_id === team.externalCalendars.teamCalendarId),
  );

  return [userPrimaryCalendar, ...teamsCalendars].filter(item => item);
};

@connect(
  state => ({
    resetPasswordSuccess: state.needHelp.resetPasswordSuccess,
    resetPasswordError: state.needHelp.resetPasswordError,
  }),
  dispatch =>
    bindActionCreators(
      {
        sendResetPasswordMail,
        createIpPhoneCredentials,
        removeIpPhoneCredentials,
        updateUser,
      },
      dispatch,
    ),
)
export default class UserSettings extends Component {
  static propTypes = {
    loggedInUser: PropTypes.object,
    onUserDataChanged: PropTypes.func,
    tenantName: PropTypes.string,
    resetPasswordSuccess: PropTypes.bool,
    enableRingPhoneConfiguration: PropTypes.bool,
    resetPasswordError: PropTypes.string,
  };

  constructor(props) {
    super(props);
    this.state = {
      isIpPhoneDialogEnabled: false,
    };
  }

  componentDidMount = () => this.fillFormData(this.props.loggedInUser);

  componentDidUpdate = () => {
    const { resetPasswordSuccess, resetPasswordError } = this.props;
    if (resetPasswordSuccess) {
      snackbar.show({
        text: `${t('RESET_PASSWORD_EMAIL')} ${this.props.loggedInUser.email}`,
      });
    } else if (resetPasswordError) {
      snackbar.show({ text: resetPasswordError });
    }
  };

  fillFormData = user => {
    if (!user) return;

    const getValuesToDisplay = items => (items || []).map(item => ({ value: item, id: item }));

    if (!this.props.enableRingPhoneConfiguration) return;
    this.phonesRef.values = getValuesToDisplay(user.ringPhones);
  };

  renderExternalCalendars = calendars => {
    const usersCalendars = calendars.map(
      calendar =>
        calendar &&
        (calendar.calendar_primary ? (
          <Text style={{ fontSize: 15 }} key={calendar.calendar_id}>
            {calendar.calendar_name.concat(t('PRIMARY_CALENDAR'))}
          </Text>
        ) : (
          <Text style={{ fontSize: 15 }} key={calendar.calendar_id}>
            {calendar.calendar_name}
          </Text>
        )),
    );
    return usersCalendars[0] ? usersCalendars : <Text style={{ fontSize: 15 }}>{t('NOT_DEFINED')}</Text>;
  };

  savePhones = async () => {
    this.phonesRef.values = this.phonesRef.nonEmptyValues;

    await this.phonesRef.validate();
    const valid = this.phonesRef.valid;

    if (!valid) return;

    this.props.onUserDataChanged({
      ringPhones: this.phonesRef.values.map(item => item.value),
    });
  };

  resetPassword = email => {
    this.props.sendResetPasswordMail(email);
  };

  renderPhoneTextBox = props => <PhoneTextBox wide {...props} />;

  validateEmails = (email, emailItems) => {
    if (email.length && !isEmailValid(email)) {
      return { error: t('EMAIL_VALIDATION_MESSAGE') };
    }

    if (itemAlreadyExists(emailItems, email)) {
      return { error: t('EMAIL_ADDRESS_ALREADY_EXISTS') };
    }

    return true;
  };

  validatePhones = (phone, phoneItems) => {
    if (phone.length) {
      const validateResult = validatePhone(phone);
      if (!validateResult.valid) return { error: t(validateResult.reason) };
    }

    if (itemAlreadyExists(phoneItems, phone)) {
      return { error: t('PHONE_NUMBER_ALREADY_EXISTS') };
    }

    return true;
  };

  addIpPhoneSettings = () => {
    this.props.createIpPhoneCredentials(this.props.loggedInUser.id);
    this.setState({
      isIpPhoneDialogEnabled: true,
      isEditingIpPhone: false,
    });
  };

  editIpPhoneSettings = () => {
    this.setState({
      isIpPhoneDialogEnabled: true,
      isEditingIpPhone: true,
    });
  };

  cancelIpPhoneSettings = sipUsername => {
    if (!this.state.isEditingIpPhone) {
      // the agent changed his mind on adding VOIP phone, so we remove
      // the generated credentials, as they are no longer needed
      this.props.removeIpPhoneCredentials(this.props.loggedInUser.id, sipUsername);
    }
    this.setState({
      isIpPhoneDialogEnabled: false,
    });
  };

  saveIpPhoneSettings = updatedEndpoint => {
    const { id: userId, sipEndpoints: existingEndpoints } = this.props.loggedInUser;

    const sipEndpoints = existingEndpoints.map(endpoint => (endpoint.username === updatedEndpoint.username ? updatedEndpoint : endpoint));

    this.props.updateUser(userId, { sipEndpoints });
    this.setState({
      isIpPhoneDialogEnabled: false,
    });
  };

  deleteIpPhoneSettings = sipUsername => {
    this.props.removeIpPhoneCredentials(this.props.loggedInUser.id, sipUsername);
    this.setState({
      isIpPhoneDialogEnabled: false,
    });
  };

  @injectProps
  render({ loggedInUser, tenantName, enableRingPhoneConfiguration }) {
    // in which cases we get here without a user?
    loggedInUser = loggedInUser || {};
    const { directPhoneIdentifier, directEmailIdentifier, sipEndpoints, email } = loggedInUser;

    const directPhoneNumber = directPhoneIdentifier ? formatPhoneNumber(directPhoneIdentifier) : t('NOT_DEFINED');
    const directEmailAddress = directEmailIdentifier ? `${directEmailIdentifier}@${formatTenantEmailDomain(tenantName, cfg('emailDomain'))}` : t('NOT_DEFINED');
    const userExternalCalendars = getExternalCalendars(loggedInUser);

    const ipPhoneEndpoint = (sipEndpoints || []).find(e => !e.isUsedInApp) || {};
    const { alias } = ipPhoneEndpoint;

    return (
      <div>
        <Section title={t('ACCOUNT')}>
          <Block label={t('SIGNED_IN_EMAIL_ADDRESS')} text={[email]} />
          <Field>
            <Button id="btnHelp" onClick={() => this.resetPassword(email)} label={t('BUTTON_RESET_PASSWORD')} />
          </Field>
          <Block label={t('EXTERNAL_CALENDARS')} text={this.renderExternalCalendars(userExternalCalendars)} />
        </Section>
        <Section title={t('DIRECT_COMMUNICATION_CHANNELS_TITLE')}>
          <Block label={t('DIRECT_EMAIL_ADDRESS_LABEL')} text={[directEmailAddress]} />
          <Block label={t('DIRECT_PHONE_NUMBER_LABEL')} text={[directPhoneNumber]} />
        </Section>
        {enableRingPhoneConfiguration && (
          <Section title={t('RING_PHONES')}>
            <Field>
              <Text>{t('RING_PHONES_SECTION_DESCRIPTION')}</Text>
            </Field>
            <Field maxWidth={400}>
              <MultiTextBox
                ref={ref => (this.phonesRef = ref)}
                label={t('RING_PHONE')}
                itemValidation={this.validatePhones}
                renderComponent={this.renderPhoneTextBox}
              />
            </Field>
            <Field maxWidth={400}>
              <Button type="raised" label={t('SAVE_BUTTON')} onClick={this.savePhones} />
            </Field>
          </Section>
        )}
        <Section title="IP Phone Settings">
          <Field maxWidth={400}>
            {do {
              if (alias) {
                <TextBox
                  label={t('VOIP_RING_PHONE_LABEL')}
                  value={alias}
                  autoResize={false}
                  onClick={this.editIpPhoneSettings}
                  className={cf('voip-textbox')}
                  inputClassName={cf('voip-input')}
                />;
              } else {
                <Button type="flat" useWaves label={t('ADD_VOIP_PHONE')} onClick={this.addIpPhoneSettings} />;
              }
            }}
            {this.state.isIpPhoneDialogEnabled && (
              <IPPhoneDialog
                isEnabled={this.state.isIpPhoneDialogEnabled}
                isEditing={this.state.isEditingIpPhone}
                sipEndpoint={ipPhoneEndpoint}
                onUpdateIpPhone={this.saveIpPhoneSettings}
                onDeleteIpPhone={this.deleteIpPhoneSettings}
                onCancel={this.cancelIpPhoneSettings}
              />
            )}
          </Field>
        </Section>
      </div>
    );
  }
}
