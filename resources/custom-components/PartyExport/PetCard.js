/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { observer } from 'mobx-react';
import createElement from './create-element';
const Text = createElement('text');
import { t } from 'i18next';

export const PetCard = observer(({ item, className }) => {
  const details = [];
  item.name &&
    details.push(
      <Text bold style={{ fontSize: 7 }}>
        {item.name}
      </Text>,
    );
  item.type && details.push(<Text style={{ fontSize: 7 }}>{t(item.type)}</Text>);
  item.type && details.push(<Text style={{ fontSize: 7 }}>{t(item.sex)}</Text>);
  item.breed &&
    details.push(
      <Text secondary style={{ fontSize: 7 }}>
        {item.breed}
      </Text>,
    );
  return (
    <div className={`card ${className}`}>
      {details.map(line => (
        <div>{line}</div>
      ))}
    </div>
  );
});

PetCard.propTypes = {
  item: PropTypes.object,
};
