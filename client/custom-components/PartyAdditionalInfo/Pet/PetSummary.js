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
import { PetCard } from './PetCard';
import { cf } from './PetSummary.scss';

export const PetSummary = observer(({ pets }) => {
  if (!pets || pets.length === 0) {
    return <EmptyMessage message={t('NO_PETS_OR_SERVICE_ANIMALS_ADDED')} />;
  }

  return (
    <div className={cf('pet-summary')}>
      {pets.map(pet => (
        <div key={pet.id}>
          <PetCard item={pet} className={cf('pet-card')} />
        </div>
      ))}
    </div>
  );
});

PetSummary.propTypes = {
  pets: PropTypes.array,
};
