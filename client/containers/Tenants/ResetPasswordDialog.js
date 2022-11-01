/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { observer } from 'mobx-react';
import { t } from 'i18next';
import trim from 'helpers/trim';
import { createModel } from 'helpers/Form/FormModel';
import { Typography as T, Button, Dialog, TextBox, DialogOverlay, DialogActions, DialogHeader, Form, Field } from 'components';
import { cf } from './ResetPasswordDialog.scss';

@observer
export default class ResetPasswordDialog extends Component {
  constructor(props) {
    super(props);

    const newPasswordModel = createModel(
      {
        password: '',
      },
      {
        password: {
          fn: ({ value: password }) => {
            if (!trim(password)) {
              return { error: t('PASSWORD_REQUIRED') };
            }
            return true;
          },
        },
      },
    );

    this.state = {
      newPasswordModel,
    };
  }

  handleSetPassword = ({ value }) => {
    const { newPasswordModel } = this.state;
    newPasswordModel.updateField('password', value);
  };

  handleSavePassword = async () => {
    const { newPasswordModel } = this.state;

    await newPasswordModel.validate();

    if (!newPasswordModel.valid) return;
    const { password } = newPasswordModel.serializedData;
    const { onClickSave } = this.props;

    onClickSave && onClickSave(password);
  };

  render() {
    const { open, onClickCancel, title } = this.props;
    const { newPasswordModel } = this.state;

    return (
      <Dialog type="modal" open={open} onCloseRequest={() => onClickCancel()}>
        <DialogOverlay className={cf('mainContent')}>
          <DialogHeader>
            <T.Title ellipsis>{title}</T.Title>
            <T.SubHeader secondary>{t('SET_NEW_PASSWORD_WARNING')}</T.SubHeader>
          </DialogHeader>
          <Form>
            <Field>
              <TextBox
                autoFocus
                type="password"
                wide
                label={t('PASSWORD')}
                errorMessage={newPasswordModel.fields.password.errorMessage}
                onChange={this.handleSetPassword}
              />
            </Field>
          </Form>
          <DialogActions>
            <Button type="flat" btnRole="secondary" label={t('CANCEL')} data-action="close" />
            <Button
              type="flat"
              btnRole="primary"
              label={t('SAVE_BUTTON')}
              onClick={this.handleSavePassword}
              disabled={!newPasswordModel.valid || !newPasswordModel.interacted}
            />
          </DialogActions>
        </DialogOverlay>
      </Dialog>
    );
  }
}
