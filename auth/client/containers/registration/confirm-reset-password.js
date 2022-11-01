/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Card, TextBox, Button, Field, ErrorMessage, Typography } from 'components';
import { t } from 'i18next';
import { cf } from './confirm-reset-password.scss';
import { LoginMessageTypes } from '../../../../common/enums/messageTypes';

const { SubHeader, Title } = Typography;

export const ConfirmResetPassword = ({ model, handleCreateUserAndRegister, disabledAction, callToParent, email }) => {
  const {
    loginError,
    fields: { password },
  } = model;

  return (
    <Card className={cf('card')} container={false}>
      <ErrorMessage message={t(loginError)} />
      <Title inline bold>
        {t('RESET_PASSWORD')}
      </Title>

      <Field noMargin flex>
        <SubHeader inline>{email}</SubHeader>
      </Field>
      <TextBox
        label={t('NEW_PASSWORD')}
        className={cf('text-password')}
        wide
        required
        requiredMark={''}
        onEnterPress={handleCreateUserAndRegister}
        errorMessage={password.errorMessage}
        value={password.value}
        onChange={({ value }) => password.setValue(value)}
        type="password"
      />
      <div className={cf('actions')}>
        <Button
          label={t('CANCEL')}
          className={cf('btn-cancel')}
          style={{ color: '#000000' }}
          type="flat"
          btnRole="secondary"
          onClick={() => callToParent(LoginMessageTypes.GO_TO_SIGN_IN)}
        />
        <Button
          style={{ marginLeft: 8 }}
          className={cf('btn-done')}
          type="raised"
          btnRole="primary"
          label={t('CONFIRM')}
          disabled={disabledAction}
          onClick={handleCreateUserAndRegister}
        />
      </div>
    </Card>
  );
};
