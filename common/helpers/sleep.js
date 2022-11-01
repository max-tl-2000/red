/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/**
 * generic sleep helper to simulate the sync method sleep
 */
export default function sleep(timeout = 1000, event = undefined) {
  return new Promise(resolve => {
    setTimeout(resolve, timeout, event);
  });
}
