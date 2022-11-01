/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const testData = `Return-Path: <darius@craftingsoftware.com>
Received: from mail-ua0-f173.google.com (mail-ua0-f173.google.com [209.85.217.173])
 by inbound-smtp.us-east-1.amazonaws.com with SMTP id 0djjbjnln9enbpi8tn5l6i5sidp14n2m8iagee81
 for the_cove@red.local.envmail.reva.tech;
 Mon, 19 Jun 2017 19:07:50 +0000 (UTC)
X-SES-Spam-Verdict: PASS
X-SES-Virus-Verdict: PASS
Received-SPF: none (spfCheck: 209.85.217.173 is neither permitted nor denied by domain of reva.tech) client-ip=209.85.217.173; envelope-from=coprea@reva.tech; helo=mail-ua0-f173.google.com;
Authentication-Results: amazonses.com;
 spf=none (spfCheck: 209.85.217.173 is neither permitted nor denied by domain of reva.tech) client-ip=209.85.217.173; envelope-from=coprea@reva.tech; helo=mail-ua0-f173.google.com;
 dkim=pass header.i=@reva-tech.20150623.gappssmtp.com;
X-SES-RECEIPT: AEFBQUFBQUFBQUFIMkljcFBYM1lwdS9yR0xCY3hJTkRzWE1GbFRtcTA3YUdFMTZBZ0IxdTloMndjRHVtZGh4RjhOb0plN3FnQm4rOVFpRjlkY1ErV3pwNGtDYVE1QkZYZnJZbG5leFFDdmxWL2FqUzVqUGJiMEswcHJNZVd5WVg2STRXdXNnanFaaklhbmR3RE9JNitJZGJCcmJPRlAwMHl2eEF3ZHdQZERZL2VqWHFVYUZNbCtnbXQ0VStHVVFSQTFuMlJGRnJUR25YUnZOaDl1b3QweVozSWZkd3NFd1Y3TkIvcm1GeWlmMjFTOG0zQ2JtWXowSkRSbk5qUzVZeVFqNURjT1R6R2FQVjY2bGV4dmZ0YTFvdWRuWVY3bXB4eg==
X-SES-DKIM-SIGNATURE: v=1; a=rsa-sha256; q=dns/txt; c=relaxed/simple;
	s=224i4yxa5dv7c2xz3womw6peuasteono; d=amazonses.com; t=1497899271;
	h=X-SES-RECEIPT:MIME-Version:From:Date:Message-ID:Subject:To:Content-Type;
	bh=TLAaYUPfrTe1fu2xZhsI6kqFmE9iTIFy286xJXY+P44=;
	b=BDehpzqxoZI4+GvblggwrkdVodou6+PvixpZwjvE4E9p4dK0WteRwX2OlmncwQVl
	is549Jb3yCsctGkUmxOPwrslUUW1vAF3baY2kMg2bnQhihAPrZUB+/NuAwDqmebSA3q
	04Mth5qoUVtVMq/r260zhSsltftS3AmpFbXHQ5Yc=
Received: by mail-ua0-f173.google.com with SMTP id j53so51598490uaa.2
        for <the_cove@red.local.envmail.reva.tech>; Mon, 19 Jun 2017 12:07:50 -0700 (PDT)
DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed;
        d=reva-tech.20150623.gappssmtp.com; s=20150623;
        h=mime-version:in-reply-to:references:from:date:message-id:subject:to;
        bh=TLAaYUPfrTe1fu2xZhsI6kqFmE9iTIFy286xJXY+P44=;
        b=UYrs360CGvL46WJ0CDFWpdVY+pK9Tx90N8f16aHJw1GRyyA7UudUDeV+ETqtPCSwe0
         9+9WYwoqU9a9YFraCOpQv2VqqrHQnV6LT8jREgazz9e2rs5GJhCQUI7q7fhOjbuBWOiu
         9ow/hX2Eb+7xFtCgE/p0CvGBON2HhIpBT3XKh8rYdUD3UBeZOpTINE6p70AwaiWMsgjU
         +yNxca96WreW+LFHbsE4Aacw8YCPMGtwQGJ8q5j7VH4qqXG35KaEDuC7AuzEoTgvEUaP
         2u4ML1JHXurSUeWiXzg6qpuP7+f7L55A98WjZZR6GB0FX2Fg+78QvjYsksOci3FqGgpO
         RCgw==
X-Google-DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed;
        d=1e100.net; s=20161025;
        h=x-gm-message-state:mime-version:in-reply-to:references:from:date
         :message-id:subject:to;
        bh=TLAaYUPfrTe1fu2xZhsI6kqFmE9iTIFy286xJXY+P44=;
        b=WKuwzL7WIz2Bin5HpYMxnZD7gngqCXD06BeGU8fcTL336nm8YOyhw2Tcsm4qbUcTcC
         hBT53Im1j8+43k91DhT0JKGB+p9smdU54JuPHT46yDwyPyorr008Nr03NW/TeY4bXi+e
         4bmIBZ9F53taa1LFWnlFVDj/OojSnxF+8knuoUCSuPm7q2WfBBGOrjpFNpVEBH6mpOes
         pw7dMVLyDipDkijYQfWU0Zw3loXD0Q+L/TwMXTmkiMFTH5Uod95E8NHduZKcX+6ZtLvB
         1OPpjDVsdeGg2xH1J7fgnwpNrGqOgxSvHe9RTv4uX//uKTBc4DxN20V8jCfGudE3QwJA
         BBfQ==
X-Gm-Message-State: AKS2vOzCm4EsoZMpqq0rLH+4vkMQhAoSN5hGXQyZfFmfv+zrUli7gqvH
	TOfZXNs/0yUrsNtkAAaJiFexmkYiCPwvWtw=
X-Received: by 10.176.94.3 with SMTP id z3mr15929534uag.68.1497899270197; Mon,
 19 Jun 2017 12:07:50 -0700 (PDT)
MIME-Version: 1.0
Received: by 10.176.23.129 with HTTP; Mon, 19 Jun 2017 12:07:49 -0700 (PDT)
In-Reply-To: <CABcBfQM5aoQxj9v1Zh+HaNVCyFcW_8Yaak3isw+D-s0jJqvKGQ@mail.gmail.com>
References: <0100015cc197e589-f1ef4672-fa8f-477f-a874-f385860360b9-000000@email.amazonses.com>
 <CABcBfQM5aoQxj9v1Zh+HaNVCyFcW_8Yaak3isw+D-s0jJqvKGQ@mail.gmail.com>
From: Darius Baba <darius@craftingsoftware.com>
Date: Mon, 19 Jun 2017 22:07:49 +0300
Message-ID: <CABcBfQP4H6uKJ3dCebd3R3eTzrZePGojubdnDdCjovSL=LdzHw@mail.gmail.com>
Subject: Re: test
To: Patrick Gonzales <the_cove@red.local.envmail.reva.tech>
Content-Type: multipart/alternative; boundary="f403043c4a50e95066055254d9e8"

--f403043c4a50e95066055254d9e8
Content-Type: text/plain; charset="UTF-8"
test

--f403043c4a50e95066055254d9e8
Content-Type: text/html; charset="UTF-8"
Content-Transfer-Encoding: quoted-printable

<div dir=3D"ltr">test</div>

--f403043c4a50e95066055254d9e8--
`;
