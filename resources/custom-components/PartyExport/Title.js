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
import createElement from './create-element';
const SubHeader = createElement('subheader');

export const Title = observer(({ text }) => <SubHeader style={{ fontSize: 8, fontWeight: 'bold' }}>{t(text)}</SubHeader>);

Title.propTypes = {
  text: PropTypes.string,
};
