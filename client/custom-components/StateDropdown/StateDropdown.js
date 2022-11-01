/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import Dropdown from 'components/Dropdown/Dropdown';
import * as T from 'components/Typography/Typography';
import { t } from 'i18next';
import { matchQuery } from './simple-matcher';
import { states } from '../../../resources/data/states';

const noItemsTemplate = ({ query } = {}) => (
  <div style={{ padding: '.5rem 1rem' }}>
    <T.Caption secondary>{t('NO_STATE_MATCH_FOUND', { query })}</T.Caption>
  </div>
);
const StateDropdown = props => <Dropdown {...props} items={states} filterable={true} matchQuery={matchQuery} wide noItemsTemplate={noItemsTemplate} />;

export default StateDropdown;
