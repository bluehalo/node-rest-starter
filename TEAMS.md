# Teams

node-rest-starter implements a team system to aid in the organization of and access to application resources.

## Overview

Teams are used to manage the organization of and access to resources in the application. Each resource is 'owned' by
a team, and only members of that team can view that resource.

## Team Roles

Teams support a hierarchy of access control where each role builds on the previous adding additional privileges.

### Member
This is the most basic team role.  It provides 'read only' access to team resources.

### Editor
This role grants the user the ability to create/edit/delete resources on behalf of the team.

### Admin
This role grants the user the ability to add/remove members of the team and to delete the
team itself.

## Nested Teams

The nested teams feature allows for creating a hierarchy of teams.  Internally, the relationships between teams are
tracked using the [Array of Ancestors pattern](https://docs.mongodb.com/manual/tutorial/model-tree-structures-with-ancestors-array/).

By default, nested teams provide access to resources in a top-down manner (i.e. members of a parent team have the same access
rights to resources owned by any child teams).

## Implicit Teams

Implicit teams allow for granting membership to a team implicitly based on `externalRoles` or `externalGroups` defined on
the user.  Currently, implicit team members are granted the `Member` role.  `
