/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import { DALTypes } from '../enums/DALTypes';

// excludeSelfBook is a Temporaty fix for CPM-14917
// TODO: when we migrate all the records we can remove the ContactEventTypes.SELFBOOK from the daltypes
export const getContactEventTypes = ({ excludeSelfBook = false } = {}) => [
  { id: DALTypes.ContactEventTypes.WALKIN, text: t('CE_TYPE_WALKIN') },
  { id: DALTypes.ContactEventTypes.CALL, text: t('CE_TYPE_PHONE') },
  { id: DALTypes.ContactEventTypes.SMS, text: t('CE_TYPE_SMS') },
  { id: DALTypes.ContactEventTypes.EMAIL, text: t('CE_TYPE_EMAIL') },
  { id: DALTypes.ContactEventTypes.CHAT, text: t('CE_TYPE_CHAT') },
  ...(!excludeSelfBook ? [{ id: DALTypes.ContactEventTypes.SELFBOOK, text: t('CE_TYPE_SELFBOOK') }] : []),
  { id: DALTypes.ContactEventTypes.OTHER, text: t('CE_TYPE_OTHER') },
];

export const getReadOnlyContactEventTypes = () => [{ id: DALTypes.ContactEventTypes.WEB, text: t('CE_TYPE_WEB') }];
