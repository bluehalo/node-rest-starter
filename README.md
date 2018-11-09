[![Build Status](https://travis-ci.org/Asymmetrik/node-rest-starter.svg?branch=develop)](https://travis-ci.org/Asymmetrik/node-rest-starter)
[![Maintainability](https://api.codeclimate.com/v1/badges/38b36e9f561532e17b23/maintainability)](https://codeclimate.com/github/Asymmetrik/node-rest-starter/maintainability)
[![Test Coverage](https://api.codeclimate.com/v1/badges/38b36e9f561532e17b23/test_coverage)](https://codeclimate.com/github/Asymmetrik/node-rest-starter/test_coverage)

# Node REST Starter

## Getting Started

1. Install Node module dependencies via: `npm install`
1. Use the default configuration in `./config/env/default.js` or override with your own configuration that matches the `NODE_ENV` environment variable by copying the `./config/env/development.template.js` file and renaming it to match the value of `$NODE_ENV`
1. Start the application via `npm start`

## API Documentation

Documentation for this application is generated from the `*.routes.js` files in each module. When the application is started, Swagger provides an interface for this API that is available by default at http://localhost:3000/api-docs

The existence and path for this Swagger page is configurable via the `apiDocs` parameter, which defaults to:

```
{
  enabled: true,
  path: '/api-docs'
}
```

## Providers

Several services use configurable "providers" in order to easily swap functionality in and out of the application.

For example, the Email Service at `./src/app/core/email/email.service.js` can be controlled via the `mailer.provider` configuration to use any of the three out-of-the-box providers:
1. HTTPS
1. Log
1. SMTP

The default provider for a service will be included in `dependencies` in NPM's `package.json`. On the other hand, any non-default providers should include their dependencies as `devDependencies` in order to reduce the inclusion of unnecessary modules in production builds.

If a non-default provider is used (e.g., `kafka-publish.provider.js` for the `Event` service), the application instance should include this module in `dependencies` on its own fork, instead of updating the `node-rest-starter` reference application.

# Testing

Tests run as an NPM script. To support development, `npm run test` will watch all files via `nodemon` and will run tests as files are updated.

In order to generate code coverage output via a single run of the test suite, `npm run test:ci` will output coverage results into the top-level `./coverage` directory, both in HTML and LCOV formats.
