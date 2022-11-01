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
import { CheckBox, TextBox, Typography as T } from 'components';
import { cf } from './disclosure-item.scss';

export const DisclosureItem = observer(({ item, index }) => (
  <div className={cf('disclosure-item')}>
    <CheckBox checked={item.selected} label={item.displayName} onChange={checked => item.select(checked)} id={`disclosureCheckbox${index}`} />
    <div className={cf('help-section')}>
      {item.displayHelp && (
        <T.Caption secondary id={`disclosureCaption${index}`}>
          {item.displayHelp}
        </T.Caption>
      )}
      {item.selected && (
        <TextBox
          id={`disclosureTxt${index}`}
          placeholder={item.descriptionHelper}
          value={item.description}
          autoFocus
          multiline
          wide
          numRows={1}
          textRoleSecondary
          onChange={({ value }) => item.updateDescription(value)}
          errorMessage={item.interacted ? null : t('DESCRIPTION_FIELD_REQUIRED')}
        />
      )}
    </div>
  </div>
));

DisclosureItem.propTypes = {
  item: PropTypes.object,
  index: PropTypes.number,
};
