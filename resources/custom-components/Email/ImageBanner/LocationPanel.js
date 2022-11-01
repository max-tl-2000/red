/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import Image from '../Image/Image';
import Card from '../Card/Card';
import { Link } from '../Typography/Typography';

// Leaving the imgUrl as a placeholder this will have to be change once we start using the google maps API
const LocationPanel = ({ url, imgUrl }) => (
  <Card style={{ width: 680, height: 160, padding: 0, margin: 0, borderWidth: 0 }}>
    <Link style={{ width: '100%' }} href={url}>
      <Image style={{ width: '100%' }} alt="map" src={imgUrl} />
    </Link>
  </Card>
);

export default LocationPanel;
