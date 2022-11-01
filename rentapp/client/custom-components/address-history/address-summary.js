/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { observer } from 'mobx-react';
import EmptyMessage from 'custom-components/EmptyMessage/EmptyMessage';
import { t } from 'i18next';
import AddressCard from './address-card';
import { cf } from './address-summary.scss';

export const AddressSummary = observer(({ addresses }) => {
  if (!addresses || addresses.length === 0) {
    return <EmptyMessage message={t('NO_ADDRESSES_ADDED')} />;
  }
  return (
    <div className={cf('address-summary')}>
      {addresses.map(address => (
        <AddressCard key={address.id} item={address} className={cf('address-card')} />
      ))}
    </div>
  );
});

AddressSummary.propTypes = {
  addresses: PropTypes.array,
};
