/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { t } from 'i18next';
import { Form, Field, Button, Dialog, DialogOverlay, TextBox, CheckBox, ErrorMessage } from 'components';
import { observer } from 'mobx-react';
import { createModel } from 'helpers/Form/FormModel';
import { maxUnixTenantName, minUnixTenantName } from '../../../common/helpers/utils';
import * as T from '../../components/Typography/Typography';
import DialogActions from '../../components/Dialog/DialogActions';
import { isString } from '../../../common/helpers/type-of';

@observer
export default class CreateTenantDialog extends React.Component {
  constructor(props) {
    super(props);

    const newTenantModel = createModel(
      {
        name: '',
        password: '',
        enablePhoneSupport: false,
      },
      {
        name: {
          required: t('TENANT_NAME_REQUIRED'),
          fn: ({ value: name }) => {
            if (name.length < minUnixTenantName) return { error: t('TENANT_NAME_TOO_SHORT') };
            if (name.toLowerCase() === 'admin') {
              return {
                error: t('TENANT_NAME_NOT_ALLOWED', { tenantName: name }),
              };
            }
            if (this.props.tenants.some(tenant => tenant.name === name)) {
              return { error: t('TENANTS_LIST_TENANT_NAME_MUST_BE_UNIQUE') };
            }
            if (name.length > maxUnixTenantName) return { error: t('TENANT_NAME_TOO_LONG') };

            return true;
          },
        },
        password: {
          required: t('PASSWORD_REQUIRED'),
        },
        enablePhoneSupport: {
          interactive: false,
        },
      },
    );

    this.state = { newTenantModel };
  }

  handleSetName = ({ value }) => {
    const { newTenantModel } = this.state;
    newTenantModel.updateField('name', value);
  };

  handleSetTenantPassword = ({ value }) => {
    const { newTenantModel } = this.state;
    newTenantModel.updateField('password', value);
  };

  handleEnablePhoneSupportChange = event => {
    const { newTenantModel } = this.state;
    newTenantModel.updateField('enablePhoneSupport', event);
  };

  handleSubmit = async () => {
    const { newTenantModel } = this.state;

    await newTenantModel.validate();

    if (!newTenantModel.valid) return;
    const { name, password, enablePhoneSupport } = newTenantModel.serializedData;

    const { onCreateTenant } = this.props;
    onCreateTenant &&
      onCreateTenant({
        name,
        adminPassword: password,
        metadata: {
          enablePhoneSupport,
          phoneNumbers: [],
        },
      });

    newTenantModel.restoreInitialValues();
  };

  render() {
    const { open, error, workInProgress, onClose } = this.props;
    const { newTenantModel } = this.state;
    const name = newTenantModel.valueOf('name');
    const password = newTenantModel.valueOf('password');
    const enablePhoneSupport = newTenantModel.valueOf('enablePhoneSupport');

    return (
      <Dialog type="modal" open={open} onCloseRequest={onClose}>
        <DialogOverlay title={t('TENANT_CREATE')}>
          <div style={{ maxWidth: 450 }}>
            <Form>
              <Field columns={12}>
                <TextBox
                  type="text"
                  wide
                  label={t('NAME')}
                  value={name}
                  required
                  errorMessage={newTenantModel.fields.name.errorMessage}
                  onChange={this.handleSetName}
                  onEnterPress={this.handleSubmit}
                />
              </Field>
              <Field columns={12}>
                <TextBox
                  type="password"
                  wide
                  required
                  label={t('ADMIN_USER_PASSWORD')}
                  errorMessage={newTenantModel.fields.password.errorMessage}
                  value={password}
                  onChange={this.handleSetTenantPassword}
                  onEnterPress={this.handleSubmit}
                />
              </Field>
              <Field columns={12}>
                <CheckBox checked={enablePhoneSupport} leftAligned label={t('ENABLE_PHONE_SUPPORT')} onChange={this.handleEnablePhoneSupportChange} />
              </Field>
              {error && isString(error) && (
                <Field columns={12}>
                  <ErrorMessage errorMessage={t(error)} />
                </Field>
              )}
              <T.Caption>{t('ASSIGN_PHONE_NUMBERS_TO_TENANT_NOTE')}</T.Caption>
            </Form>
          </div>
          <DialogActions>
            <Button type="flat" btnRole="secondary" label={t('CANCEL')} data-action="close" onClick={() => onClose} />
            <Button
              onClick={this.handleSubmit}
              label={t('CREATE')}
              loading={workInProgress}
              disabled={workInProgress || !newTenantModel.valid || !newTenantModel.interacted || !newTenantModel.requiredAreFilled}
            />
          </DialogActions>
        </DialogOverlay>
      </Dialog>
    );
  }
}
