/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Card, TextBox, Button, Field, Form, ErrorMessage } from 'components';
import { t } from 'i18next';
import { observer } from 'mobx-react';
import { cf } from './login-form.scss';
import { Page } from '../../custom-components/page/page';
import { DefaultAppFooter } from '../../custom-components/default-app-footer/default-app-footer';

const NON_VISIBLE_FIELD = { position: 'absolute', top: -99999, left: -99999 };

const LoginFormComponent = ({ model, handleLogin, mainActionLabel, disabledAction, redirectTo, handleForgotPassword }) => {
  const {
    loginError,
    fields: { email, password, _name_ },
  } = model;

  return (
    <Page className={cf('page')} noHeader>
      <Card className={cf('card')}>
        <Form className={cf('form')}>
          <div>
            <Field fullWidth>
              <TextBox
                dataId="usernameTxt"
                label={t('EMAIL')}
                placeholder={t('ENTER_EMAIL')}
                wide
                required
                forceLowerCase
                requiredMark={''}
                errorMessage={email.errorMessage}
                autoComplete="username"
                value={email.value}
                onBlur={() => email.markBlurredAndValidate()}
                onChange={({ value }) => email.setValue(value)}
              />
            </Field>
            <Field style={NON_VISIBLE_FIELD}>
              <TextBox label="_name_" value={_name_.value} />
            </Field>
            <Field fullWidth>
              <TextBox
                dataId="passwordTxt"
                label={t('PASSWORD')}
                placeholder={t('ENTER_PASSWORD')}
                wide
                required
                requiredMark={''}
                errorMessage={password.errorMessage}
                autoComplete="current-password"
                value={password.value}
                onBlur={() => password.markBlurredAndValidate()}
                onChange={({ value }) => password.setValue(value)}
                type="password"
                onEnterPress={handleLogin}
              />
            </Field>
            <Field fullWidth noMargin>
              <ErrorMessage message={t(loginError)} />
              <div className={cf('form-actions')}>
                <Button label={t('FORGOT_PASSWORD')} type="flat" btnRole="primary" onClick={handleForgotPassword} />
                <Button data-id="loginBtn" style={{ marginLeft: 14 }} label={mainActionLabel} onClick={handleLogin} disabled={disabledAction} />
              </div>
            </Field>
          </div>
        </Form>
      </Card>
      <DefaultAppFooter redirectTo={redirectTo} />
    </Page>
  );
};

export const LoginForm = observer(LoginFormComponent);
