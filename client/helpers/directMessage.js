/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import notifier from 'helpers/notifier/notifier';
import { OperationResultType } from '../../common/enums/enumHelper';
import { getDisplayName } from '../../common/helpers/person-helper';

export const getFailureNotice = message => {
  if (message.sendingResult !== OperationResultType.FAILED) return '';
  return t('DIRECT_MESSAGE_NOT_SENT');
};

export const notifyDirectMessageSendingResult = (personIds, storePersons, notificationMessageToken, type) => {
  const names = personIds
    .map(id => storePersons.get(id))
    .map(getDisplayName)
    .join(', ');

  const message = notificationMessageToken || 'DIRECT_MESSAGE_SUCCESSFULLY_SENT';

  if (type === OperationResultType.SUCCESS) notifier.success(t(message, { names }));
  else notifier.error(t('DIRECT_MESSAGE_SENDING_FAILED', { names }));
};
