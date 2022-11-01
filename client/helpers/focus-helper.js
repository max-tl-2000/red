/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import $ from 'jquery';
import { document } from '../../common/helpers/globals';

let prevActiveElement;
$(document).on('focusout', ':input, [tabindex]', () => {
  prevActiveElement = this;
});

const focusHelper = {
  get prevActiveElement() {
    return prevActiveElement;
  },
};

export default focusHelper;
