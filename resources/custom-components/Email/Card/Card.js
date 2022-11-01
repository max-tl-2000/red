/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { getStyleFor } from './Styles';
import Container from '../Container/Container';

const Card = ({ style, children }) => <Container style={getStyleFor('card', style)}>{children}</Container>;

export default Card;
