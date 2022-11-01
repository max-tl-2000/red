/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

exports.testEvent = {
    'Records': [
        {
            'EventSource': 'aws:sns',
            'EventVersion': '1.0',
            'EventSubscriptionArn': 'arn:aws:sns:us-east-1:865217022307:SNS-Email-Delivered:209109ba-9971-4aff-a860-857bed9e01ac',
            'Sns': {
                'Type': 'Notification',
                'MessageId': '65dc0bac-d6ea-59da-a006-44cd3577c755',
                'TopicArn': 'arn:aws:sns:us-east-1:865217022307:SNS-Email-Delivered',
                'Subject': null,
                'Message': '{\'notificationType\':\'Delivery\',\'mail\':{\'timestamp\':\'2016-03-15T10:18:04.464Z\',\'source\':\'darius@darius.dev.mail.reva.tech\',\'sourceArn\':\'arn:aws:ses:us-east-1:865217022307:identity/darius.dev.mail.reva.tech\',\'sendingAccountId\':\'865217022307\',\'messageId\':\'0100015379c85130-1e1cfc6b-315d-4559-85bf-716ca066fc78-000000\',\'destination\':[\'success@simulator.amazonses.com\']},\'delivery\':{\'timestamp\':\'2016-03-15T10:18:04.967Z\',\'processingTimeMillis\':503,\'recipients\':[\'success@simulator.amazonses.com\'],\'smtpResponse\':\'250 2.6.0 Message received\',\'reportingMTA\':\'a9-128.smtp-out.amazonses.com\'}}',
                'Timestamp': '2016-03-15T10:18:05.106Z',
                'SignatureVersion': '1',
                'Signature': 'Sqk+cD7VmSd7KLu0NWoRJV3+KPeb2WOzh/jaKtXObALC4TX+ZLhqIwBI0bywfSwKKw+6tkrhiEHmo21ql8kiTNCqwxW6dlyCDEefcr/ytZAqSxrvj4tlKUqMkKPVAzbCkgwOzLlbgm3w8ZmlNqZCHYvQrtZtNaqaFSM9Qclm3ABhQKwH85Q0L9hXFGCz9ZmBovEv3ZM0K8tAUb3NJ0fLy1l3XZGPNo/N1D1Fn0Uzr8yRg6zYo61gvqdTy/44UzJfk9/BJEi/oM0wm66VsjykihlOm5VuGK6t9yl8a+xlJ5bAuzOyk+zXAWxUFEbQySEUfGICRIx/eT+H7aee0gZl/g==',
                'SigningCertUrl': 'https://sns.us-east-1.amazonaws.com/SimpleNotificationService-bb750dd426d95ee9390147a5624348ee.pem',
                'UnsubscribeUrl': 'https://sns.us-east-1.amazonaws.com/?Action=Unsubscribe&SubscriptionArn=arn:aws:sns:us-east-1:865217022307:SNS-Email-Delivered:209109ba-9971-4aff-a860-857bed9e01ac',
                'MessageAttributes': {},
            },
        },
    ],
};
