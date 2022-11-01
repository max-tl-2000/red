/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Typography as T, Revealer, Button } from 'components';
import { t } from 'i18next';
import { cf } from './PartyErrorBlock.scss';

// TODO: move the common bits to a generic component that can be used for the 404 page
const PartyErrorBlock = ({ partyId, error, onGotoDashboardRequest }) => {
  const show = !!error;
  error = error || {};
  const errorMessage = error.message || '';
  const errorToken = error.token || '';

  return (
    <Revealer show={show}>
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <T.Title style={{ marginBottom: '20px' }}>{t('PARTY_NOT_FOUND', { partyId })}</T.Title>
        {errorMessage && (
          <T.Text>
            <T.Text inline bold>
              {`${t('ERROR_MESSAGE')}: `}
            </T.Text>
            {errorMessage}
          </T.Text>
        )}
        {errorToken && (
          <T.Text>
            <T.Text inline bold>
              {`${t('ERROR_CODE')}: `}
            </T.Text>
            {errorToken}
          </T.Text>
        )}
        <div style={{ padding: '50px' }}>
          <div className={cf('picto')} />
        </div>
        <Button type="flat" label={t('GO_BACK_TO_DASHBOARD')} onClick={onGotoDashboardRequest} />
      </div>
    </Revealer>
  );
};

export default PartyErrorBlock;
