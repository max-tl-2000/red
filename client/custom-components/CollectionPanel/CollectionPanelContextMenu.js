/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Menu, MenuItem, RedList as L } from 'components';

import { toSentenceCase } from 'helpers/capitalize';

const CollectionPanelContextMenu = ({
  defaultActions,
  customActions,
  id,
  className,
  editLabel,
  removeLabel,
  hideEditAction = false,
  hideRemoveAction = false,
  ...rest
}) => {
  const renderDefaultActions = () => (
    <div>
      {!hideEditAction && <MenuItem data-id={`edit_${id}_MenuItem`} text={editLabel} action="edit" />}
      {!hideRemoveAction && <MenuItem data-id={`remove_${id}_MenuItem`} text={removeLabel} action="remove" />}
      {customActions && customActions.length && <L.Divider />}
    </div>
  );

  const renderDivider = render => render && <L.Divider />;

  // note- preserveCase can be used to preserve case in the event that the label might contain proper noun
  // such as a building name
  const renderCustomActions = actions =>
    actions.map((menuAction, index) => (
      // TODO: We need to find a proper id here
      // eslint-disable-next-line react/no-array-index-key
      <div key={index}>
        <MenuItem text={menuAction.preserveCase ? menuAction.label : toSentenceCase(menuAction.label)} action={menuAction.action} />
        {renderDivider(menuAction.divider)}
      </div>
    ));

  return (
    <Menu id={id} className={className} {...rest}>
      {defaultActions && renderDefaultActions()}
      {customActions && customActions.length && renderCustomActions(customActions)}
    </Menu>
  );
};

export default CollectionPanelContextMenu;
