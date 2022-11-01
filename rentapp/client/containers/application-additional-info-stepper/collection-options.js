/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import { Radio } from 'components';
import { t } from 'i18next';
import FormattedMarkdown from 'components/Markdown/FormattedMarkdown';
import { showMsgBox } from 'components/MsgBox/showMsgBox';
import { cf } from './collection-options.scss';
import { SharedSections, ApplicationSettingsValues } from '../../../../common/enums/applicationTypes';

@inject('applicationSettings')
@observer
export class CollectionOptions extends Component {
  handleUpdate = value => {
    const { applicationSettings, section } = this.props;
    applicationSettings.storeSkipSection(section, value);
  };

  constructor(props) {
    super(props);
    const { section, applicationSettings, model } = this.props;
    const sectionValue = applicationSettings[section];
    const isRequired = sectionValue === ApplicationSettingsValues.REQUIRED;
    if (isRequired && model.hasItems) {
      this.handleUpdate(false);
    }
  }

  handleConfirmationMsgBox = value => {
    const { model, entityLabel, section } = this.props;

    const msgBoxOptions = {
      title: t('REMOVE_ITEM', { entityName: t(`${entityLabel}_plural`) }),
      lblOK: t('KEEP_ITEMS', { items: t(`${entityLabel}_plural`) }),
      lblCancel: t('REMOVE_ITEMS', { items: t(`${entityLabel}_plural`) }),
      btnCancelRole: 'secondary',
      onCancelClick: () => {
        model.items.map(item => model.remove(item));
        this.handleUpdate(value);
      },
    };

    const messageKey = SharedSections.indexOf(section) > -1 ? 'REMOVE_COLLECTION_PARTY_WARNING' : 'REMOVE_COLLECTION_WARNING';
    showMsgBox(
      <div>
        <FormattedMarkdown>
          {t(messageKey, {
            item: t(entityLabel).toLowerCase(),
            items: t(`${entityLabel}_plural`).toLowerCase(),
          })}
        </FormattedMarkdown>
      </div>,
      msgBoxOptions,
    );
  };

  clickHandler = value => {
    const { model } = this.props;

    if (value && model.hasItems) {
      this.handleConfirmationMsgBox(value);
      return;
    }
    this.handleUpdate(value);
  };

  render = () => {
    const { section, entityLabel, applicationSettings } = this.props;
    const sectionValue = applicationSettings[section];
    const keyName = `skip${section[0].toUpperCase()}${section.substring(1)}`;
    const skipValue = applicationSettings[keyName];

    const displayOptions = sectionValue === ApplicationSettingsValues.REQUIRED;
    return displayOptions ? (
      <div className={cf('wrapper')}>
        <Radio checked={!skipValue} label={t(`HAVE_${entityLabel}`)} onClick={() => this.clickHandler(false)} id={`have${t(`${entityLabel}`)}Checkbox`} />
        <Radio
          checked={skipValue}
          label={t(`DONT_HAVE_${entityLabel}`)}
          onClick={() => this.clickHandler(true)}
          id={`doNotHave${t(`${entityLabel}`)}Checkbox`}
        />
      </div>
    ) : (
      <noscript />
    );
  };
}
