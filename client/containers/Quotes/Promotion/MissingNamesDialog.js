/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import PropTypes from 'prop-types';
import { t } from 'i18next';
import { MsgBox } from 'components';
import { toHumanReadableString } from '../../../../common/helpers/strings';

const MissingNamesDialog = ({ onOkAction, onDialogClosed, isDialogOpen, companyMissingFields = [], missingNames = [] }) => {
  const getMessage = (type = 'TITLE') => {
    const isAnyCompanyFieldMissing = companyMissingFields.length;

    if (!isAnyCompanyFieldMissing) {
      const missingNamesLength = missingNames.length;
      const membersInfo = toHumanReadableString(missingNames);
      return t(`MISSING_NAME_${type}`, { membersInfo, count: missingNamesLength });
    }

    const companyNameMissing = companyMissingFields.includes('companyName');
    const transToken = companyNameMissing ? 'MISSING_COMPANY_NAME' : 'MISSING_POINT_OF_CONTACT_NAME';
    return t(`${transToken}_${type}`);
  };

  return (
    <MsgBox
      open={isDialogOpen}
      closeOnTapAway={false}
      title={getMessage('TITLE')}
      lblOK={t('MANAGE_PARTY')}
      onOKClick={onOkAction}
      lblCancel={t('CLOSE')}
      onCloseRequest={onDialogClosed}
      content={getMessage('MESSAGE')}
    />
  );
};

MissingNamesDialog.propTypes = {
  isDialogOpen: PropTypes.bool.isRequired,
  companyMissingFields: PropTypes.arrayOf(PropTypes.string),
  missingNames: PropTypes.arrayOf(PropTypes.string),
  onOkAction: PropTypes.func,
  onDialogClosed: PropTypes.func,
};

export default MissingNamesDialog;
