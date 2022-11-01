/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { t } from 'i18next';
import { Button, TextBox, Dialog, DialogOverlay, DialogActions, Typography, PreloaderBlock } from 'components';
import { cf } from './IPPhoneDialog.scss';

const { Text, Caption, SubHeader } = Typography;

const IP_PHONE_PLIVO_DOMAIN = 'phone.plivo.com';

export default class IPPhoneDialog extends Component {
  static propTypes = {
    isEnabled: PropTypes.bool,
    isEditing: PropTypes.bool,
    onUpdateIpPhone: PropTypes.func,
    onDeleteIpPhone: PropTypes.func,
    onCancel: PropTypes.func,
  };

  constructor(props) {
    super(props);
    this.state = { alias: props.sipEndpoint ? props.sipEndpoint.alias : '' };
  }

  updateIPPhone = () => {
    const { onUpdateIpPhone, sipEndpoint } = this.props;

    onUpdateIpPhone &&
      onUpdateIpPhone({
        ...sipEndpoint,
        alias: this.state.alias,
      });
  };

  deleteIPPhone = () => {
    const { onDeleteIpPhone, sipEndpoint } = this.props;
    onDeleteIpPhone && onDeleteIpPhone(sipEndpoint.username);
  };

  cancel = () => {
    const { onCancel, sipEndpoint } = this.props;
    onCancel && onCancel(sipEndpoint.username);
  };

  render = () => {
    const { isEnabled, isEditing, sipEndpoint } = this.props;

    return (
      <Dialog open={isEnabled} type="modal" closeOnEscape onClose={this.cancel}>
        <DialogOverlay title={t(isEditing ? 'IP_PHONE_DIALOG_EDIT_TITLE' : 'IP_PHONE_DIALOG_ADD_TITLE')}>
          {do {
            if (!sipEndpoint) {
              <PreloaderBlock />;
            } else {
              <div className={cf('form-container')}>
                <TextBox
                  ref={ref => ref && ref.focus()}
                  label={t('IP_PHONE_DIALOG_PHONE_ALIAS')}
                  onChange={({ value }) => this.setState({ alias: value })}
                  value={sipEndpoint.alias}
                  autoResize={false}
                  className={cf('form-element')}
                />
                <Text>{t('IP_PHONE_DIALOG_CONNECTION_SETTINGS_MESSAGE')}</Text>
                <div className={cf('form-element')}>
                  <Caption secondary>{t('IP_PHONE_DIALOG_SIP_USERNAME')}</Caption>
                  <SubHeader>{sipEndpoint.username}</SubHeader>
                </div>
                <div className={cf('form-element')}>
                  <Caption secondary>{t('IP_PHONE_DIALOG_SIP_PASSWORD')}</Caption>
                  <SubHeader>{sipEndpoint.password}</SubHeader>
                </div>
                <div className={cf('form-element')}>
                  <Caption secondary>{t('IP_PHONE_DIALOG_DOMAIN')}</Caption>
                  <SubHeader>{IP_PHONE_PLIVO_DOMAIN}</SubHeader>
                </div>
              </div>;
            }
          }}
          <DialogActions>
            {sipEndpoint && isEditing && (
              <Button type="flat" btnRole="secondary" useWaves label={t('DELETE')} style={{ marginRight: 'auto' }} onClick={this.deleteIPPhone} />
            )}
            <Button type="flat" btnRole="secondary" useWaves label={t('CANCEL')} onClick={this.cancel} />
            {sipEndpoint && (
              <Button type="flat" useWaves onClick={this.updateIPPhone} disabled={!this.state.alias} label={t(isEditing ? 'DONE' : 'ADD_IP_PHONE')} />
            )}
          </DialogActions>
        </DialogOverlay>
      </Dialog>
    );
  };
}
