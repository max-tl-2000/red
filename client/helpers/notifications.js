/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const askPermissionForBrowserNotifications = () => {
  // Let's check if the browser supports notifications
  if (!('Notification' in window)) {
    console.warn('This browser does not support desktop notifications');
  } else if (Notification.permission !== 'denied' || Notification.permission === 'default') {
    // We need to ask the user for permission
    Notification.requestPermission(permission => {
      permission === 'granted' ? console.info('Permission granted to send notifications') : console.warn('Permission denied to send notifications');
    });
  }
};

export const notifyUserAndFocusParentTab = (title, options) => {
  let notification = null;

  // Let's check if the browser supports notifications
  if (!('Notification' in window)) {
    console.warn('Could not notify user with desktop notification because this browser does not support them');
  } else if (Notification.permission === 'granted') {
    notification = new Notification(title, options);

    notification.onclick = () => {
      window.focus();
      parent.focus();
      notification.close();
    };
  }

  return notification;
};

export const closeNotification = notification => notification && notification.close();
