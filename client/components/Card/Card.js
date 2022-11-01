/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Children } from 'react';
import elevationShadow from 'helpers/elevationShadow';
import nullish from 'helpers/nullish';
import { cf, g } from './Card.scss';
import CardActions from './CardActions';

const cardActionsType = (<CardActions />).type;

const Card = ({ className, children, elevation = 2, container = true, style = {}, ...rest }) => {
  const overlayStyle = {
    ...style,
    boxShadow: elevation === 0 ? 'none' : elevationShadow(elevation),
  };

  const [actions] = Children.toArray(children).filter(child => child.type === cardActionsType);

  return (
    <div
      data-actions-visible={!nullish(actions)}
      data-component="card"
      className={cf('card', g(className), {
        'with-actions': !nullish(actions),
        container,
      })}
      style={overlayStyle}
      {...rest}>
      {children}
    </div>
  );
};

export default Card;
