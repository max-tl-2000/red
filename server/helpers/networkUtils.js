/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import _ from 'lodash'; // eslint-disable-line red/no-lodash

const os = require('os');

export const getLocalIpAddress = () => _.chain(os.networkInterfaces()).values().flatten().find({ family: 'IPv4', internal: false }).value().address;
