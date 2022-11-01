/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { adjustWalkinDates } from '../../../common/helpers/walkInUtils';
import { DALTypes } from '../../../common/enums/DALTypes';
import { toMoment } from '../../../common/helpers/moment-utils';
import tryParse from '../../../common/helpers/try-parse';

export const getFirstComm = comms =>
  adjustWalkinDates(comms)
    .filter(comm => comm.direction === DALTypes.CommunicationDirection.OUT && comm.category === DALTypes.CommunicationCategory.USER_COMMUNICATION)
    .sort((a, b) => toMoment(a.created_at).diff(toMoment(b.created_at)))[0];

export const narrowDownPartiesByProperty = ({ parties, propertyId }) => {
  const filteredPartiesByProperty = parties.filter(p => p.assignedPropertyId === propertyId);
  return filteredPartiesByProperty.length ? filteredPartiesByProperty : parties;
};

export const extractPostMessage = post => {
  if (post.category === DALTypes.PostCategory.EMERGENCY) return post.message;

  /*
Sample raw post message from rich text editor
{
  "blocks": [
      { "key": "o385", "text": "normal text", "type": "unstyled", "depth": 0, "inlineStyleRanges": [], "entityRanges": [], "data": {} },
      { "key": "c8n6s", "text": "", "type": "unstyled", "depth": 0, "inlineStyleRanges": [], "entityRanges": [], "data": {} },
      { "key": "3nug8", "text": "bold text", "type": "unstyled", "depth": 0, "inlineStyleRanges": [{ "offset": 0, "length": 9, "style": "BOLD" }], "entityRanges": [], "data": {} },
      { "key": "27l3j", "text": "", "type": "unstyled", "depth": 0, "inlineStyleRanges": [], "entityRanges": [], "data": {} },
      { "key": "9al05", "text": "italic text", "type": "unstyled", "depth": 0, "inlineStyleRanges": [{ "offset": 0, "length": 6, "style": "ITALIC" }], "entityRanges": [], "data": {} },
      { "key": "brj3m", "text": "", "type": "unstyled", "depth": 0, "inlineStyleRanges": [], "entityRanges": [], "data": {} },
      { "key": "cvomr", "text": "link", "type": "unstyled", "depth": 0, "inlineStyleRanges": [], "entityRanges": [{ "offset": 0, "length": 4, "key": 0 }], "data": {} }
  ],
  "entityMap": { "0": { "type": "LINK", "mutability": "MUTABLE", "data": { "url": "https://rxp1.local.env.reva.tech/cohortComms" } } }
}
 */

  const { blocks } = tryParse(post.rawMessage, { blocks: [] });
  return blocks.map(b => b.text).join('\n');
};
