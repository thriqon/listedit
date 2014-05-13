ListEdit
========

Simple web app to edit mailing lists hosted on [Mailgun](mailgun.org) without disclosing your API credentials.

Prerequisites
-------------

NodeJS, Redis, an app and accounts on Facebook and an account with a mailing list on Mailgun.

Installation
------------

ListEdit is optimized for usage on [Openshift](www.openshift.com), all environmental parameters
are automatically set if used in this environment. See `index.js` for details.

Dependencies should be installed by executing `npm install`.

To start the instance, set the configuration parameters described below, then start up the
server by issuing `node index.js`.

Configuration
-------------

Configuration is done via _Redis_. The relevant keys are following:

### mvh:authorizedpersonell

A set of authorized users, with a provider prefix. Currently only Facebook is supported ("fb:"), the numerical user id follows.

### mvh:config

A hash with the following entries:

`fbId, fbSecret, fbCallbackUrl`: These are the credentials to authenticate your instance with Facebook. `fbCallbackUrl` should end with "/auth/cb".

`mailgunKey`, `mailgunDomain`: Credentials for API access to Mailgun.

`mailingList`: The mailing list on Mailgun to administrate.

`secret`: The secret to use for express sessions.


