/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import $ from 'jquery';

/**
 * return true if the contained node is the same as the container node
 * or if the container node is an ancestor of the contained node
 *
 * @method contains
 * @param {Node} container the container node
 * @paran {Node} contained the contained node
 */
export default function contains(container, contained) {
  return container === contained || $.contains(container, contained);
}
