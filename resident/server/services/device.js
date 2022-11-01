/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import * as dal from '../dal/device';

export const createDevice = async (ctx, device) => await dal.insertDevice(ctx, device);

export const updateDevice = async (ctx, id, delta) => await dal.updateDevice(ctx, id, delta);
