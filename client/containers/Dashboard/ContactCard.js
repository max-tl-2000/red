/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { RedList as L, Typography as T } from 'components';

export default props => {
  const { fullName, title, selected, nameWithMatches, avatar, withSmallAvatar, ...rest } = props;

  return (
    <div>
      <L.ListItem rowStyle="mixed" selected={selected} {...rest}>
        <L.AvatarSection withSmallAvatar={withSmallAvatar}>{avatar}</L.AvatarSection>
        <L.MainSection>
          {nameWithMatches || <T.SubHeader>{fullName}</T.SubHeader>}
          <T.Caption secondary ellipsis title={title}>
            {title}
          </T.Caption>
        </L.MainSection>
      </L.ListItem>
    </div>
  );
};
