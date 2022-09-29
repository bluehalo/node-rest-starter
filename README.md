# Node REST Starter

[![Build Status](https://travis-ci.org/Asymmetrik/node-rest-starter.svg?branch=develop)](https://travis-ci.org/Asymmetrik/node-rest-starter)
[![Maintainability](https://api.codeclimate.com/v1/badges/38b36e9f561532e17b23/maintainability)](https://codeclimate.com/github/Asymmetrik/node-rest-starter/maintainability)
[![Test Coverage](https://api.codeclimate.com/v1/badges/38b36e9f561532e17b23/test_coverage)](https://codeclimate.com/github/Asymmetrik/node-rest-starter/test_coverage)

## Getting Started

### Prereqs

#### Required

- nodejs 14.x, 16.x - this project supports `.tool-versions` via [asdf](https://asdf-vm.com/)
- mongodb 4.0, 4.2

#### Recommended

- docker - [Start Up](#start-up) contains instructions for installing mongo via docker

### Start Up

1. To get started run `npm run init`(if you do not have mongo running use `npm run init:mongo`)
   - This will install the dependencies and setup the `development.js` environment from the template
1. Start the application via `npm start`

### Related Commands

- `init` - initalizes project
- `init:mongo` - initalizes project and runs mongodb via docker
- `init:env:dev` - copies development environment config template to usable location
- `init:mongo:up` - uses docker compose to run containerized mongodb
- `init:mongo:express` - uses docker compose to run mongo express at http://localhost:8081 for mongo debugging
- `init:mongo:down` - removes node-rest-starter docker container group
- `start` - runs project and watches for changes and reloads
- `start:dev` - runs with node_env set to development
- `start:prod` - runs compiled version of project

## API Documentation

Endpoint Documentation for this application is generated from the `*.routes.js` files in each module.  
Model/Schema documentation should be included in with each model and will be compiled from any file matching `*.model.js`.

When the application is started, Swagger provides an interface for this API that is available by default at <http://localhost:3000/api-docs>

The existence and path for this Swagger page is configurable via the `apiDocs` parameter, which defaults to:

```json
{
	"enabled": true,
	"path": "/api-docs"
}
```

## Providers

Several services use configurable "providers" in order to easily swap functionality in and out of the application.

For example, the Email Service at `./src/app/core/email/email.service.ts` can be controlled via the `mailer.provider` configuration to use any of the out-of-the-box providers:

1. HTTPS
1. SMTP
1. Log
1. File
1. Noop

The default provider for a service will be included in `dependencies` in NPM's `package.json`. On the other hand, any non-default providers should include their dependencies as `devDependencies` in order to reduce the inclusion of unnecessary modules in production builds.

If a non-default provider is used (e.g., `node-kafka` for the `Event` service), the application instance should include this module in `dependencies` on its own fork, instead of updating the `node-rest-starter` reference application.

## Testing

Tests run as an NPM script. To support development, `npm run test` will watch all files via `nodemon` and will run tests as files are updated.

In order to generate code coverage output via a single run of the test suite, `npm run test:ci` will output coverage results into the top-level `./coverage` directory, both in HTML and LCOV formats.

## Installing on Production

Since Mongoose suggests not automatically creating Mongo indices on-the-fly, the following series of commands is available to run on the production Mongo instance / cluster to create all required indices.

```js
db.audit.createIndex({ created: -1 }, { background: true });
db.audit.createIndex(
	{
		message: 'text',
		'audit.auditType': 'text',
		'audit.action': 'text',
		'audit.object': 'text'
	},
	{ background: true }
);

db.cache.entry.createIndex({ ts: 1 }, { background: true });
db.cache.entry.createIndex({ key: 1 }, { background: true });

db.exportconfigs.createIndex({ created: 1 }, { background: true });

db.feedback.createIndex(
	{ created: -1 },
	{ background: true, expireAfterSeconds: 15552000 }
);
db.feedback.createIndex({ type: 1 }, { background: true });
db.feedback.createIndex({ creator: 1 }), { background: true };
db.feedback.createIndex({ url: 1 }, { background: true });
db.feedback.createIndex({ os: 1 }, { background: true });
db.feedback.createIndex({ browser: 1 }, { background: true });
db.feedback.createIndex({ body: 'text' }, { background: true });

db.messages.createIndex(
	{ title: 'text', body: 'text', type: 'text' },
	{ background: true }
);
db.messages.dismissed.createIndex(
	{ created: -1 },
	{ expireAfterSeconds: 2592000, background: true }
);
db.messages.dismissed.createIndex({ userId: 1 }, { background: true });

db.notifications.createIndex({ user: 1, created: -1 }, { background: true });
db.notifications.createIndex({ created: 1 }, { background: true });

db.owners.createIndex({ name: 1 }, { background: true });

db.preferences.createIndex({ user: 1, updated: -1 }, { background: true });
db.preferences.createIndex(
	{ user: 1, preferenceType: 1, updated: -1 },
	{ background: true }
);

db.resources.createIndex({ created: 1, updated: -1 }, { background: true });
db.resources.createIndex({ 'owner.name': 1 }, { background: true });
db.resources.createIndex(
	{ title_lowercase: 'text', description: 'text' },
	{ background: true }
);

db.teams.createIndex(
	{ name: 'text', description: 'text' },
	{ background: true }
);

db.useragreements.createIndex(
	{ title: 'text', text: 'text' },
	{ background: true }
);

db.users.createIndex({ username: 1 }, { background: true });
db.users.createIndex(
	{ name: 'text', email: 'text', username: 'text' },
	{ background: true }
);
```
