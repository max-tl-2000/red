/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { AppBar, IconButton } from 'components';
import { push } from '../../../../client/helpers/navigator';
import { cf } from './default-app-bar.scss';

const getIconComponent = iconName => (iconName ? <IconButton iconStyle="light" iconName={iconName} onClick={() => push('/')} /> : null);

export const DefaultAppBar = ({ title, iconName }) => <AppBar title={title} className={cf('full-width')} icon={getIconComponent(iconName)} />;
