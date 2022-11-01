/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { RedList as L, Typography as T } from 'components';
import { cf, g } from './AutocompleteCard.scss';

const AutocompleteCard = ({ mainText, secondaryText, thirdText, itemWithDescription, icon, rightAlignedSubtext }) => (
  <L.ListItem>
    <L.AvatarSection className={cf('iconSection')}>{icon}</L.AvatarSection>
    <L.MainSection>
      <div className={cf('itemBlock')}>
        <div className={cf('itemMainText')}>
          {itemWithDescription || <T.SubHeader inline>{mainText}</T.SubHeader>}
          {secondaryText ? ', ' : ''}
          <T.Caption disabled secondary inline>
            {secondaryText}
          </T.Caption>{' '}
        </div>
        <div>
          <T.Caption disabled secondary inline>
            {thirdText}
          </T.Caption>
        </div>
        {/* TODO: enable back itemLastUpdated option
          <div>
            <T.Caption secondary disabled inline>{ itemLastUpdated }</T.Caption>
          </div> */}
        {rightAlignedSubtext && <div className={cf(g('textSecondary'))}>{rightAlignedSubtext.join(', ')}</div>}
      </div>
    </L.MainSection>
  </L.ListItem>
);

export default AutocompleteCard;
