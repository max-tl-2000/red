/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { observer } from 'mobx-react';
import { t } from 'i18next';
import Text from 'components/Typography/Text';
import Icon from 'components/Icon/Icon';
import { cf, g } from './PetCard.scss';

export const PetCardComponent = ({ item: pet, onItemSelected = () => {}, className }) => {
  const handleOnTouchTapItem = e => onItemSelected(e, pet);
  const { name, type, breed, size } = pet || {};
  const details = [];
  name &&
    details.push(
      <Text data-id="petNameLabelText" bold>
        {name}
      </Text>,
    );
  type && details.push(<Text>{t(type)}</Text>);
  breed && details.push(<Text secondary>{breed}</Text>);
  size && details.push(<Text secondary>{t(size)}</Text>);

  return (
    <div onClick={handleOnTouchTapItem} className={cf('pet-card', g(className))}>
      {details.map((line, key) => (
        // TODO: We need to find a proper id here
        // eslint-disable-next-line react/no-array-index-key
        <div key={key}>{line}</div>
      ))}
      {!(name && type && breed && size) && (
        <div className={cf('alert')}>
          <Icon name="alert" className={cf('alert-icon')} />
          <Text secondary>{t('INCOMPLETE_PET_INFO')}</Text>
        </div>
      )}
    </div>
  );
};

PetCardComponent.propTypes = {
  item: PropTypes.object,
  onItemSelected: PropTypes.func,
};

export const PetCard = observer(PetCardComponent);
