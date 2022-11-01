/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { observer } from 'mobx-react';
import { Typography as T } from 'components';
import { Page } from '../../custom-components/page/page';

export const NotFound = observer(props => (
  <Page title={'Reva'} iconName="reva">
    <div style={{ padding: 20 }}>
      <T.Title>
        The requested route:{' '}
        <T.Title inline bold>
          {props.location.pathname}
        </T.Title>{' '}
        is not found
      </T.Title>
    </div>
  </Page>
));
