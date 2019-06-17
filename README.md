[![Build Status](https://travis-ci.org/materiahq/materia-server.svg?branch=master)](https://travis-ci.org/materiahq/materia-server) [![npm version](https://badge.fury.io/js/%40materia%2Fserver.svg)](https://badge.fury.io/js/%40materia%2Fserver) [![dependencies Status](https://david-dm.org/materiahq/materia-server/status.svg)](https://david-dm.org/materiahq/materia-server)

# Materia Server

Materia Server is the core of [Materia](https://getmateria.com). It handles your Materia Application and host them anywhere.

![Materia logo](https://getmateria.com/assets/img/logo.png)

## Installation

You can install Materia Server globally using NPM:

`$ (sudo) npm install -g @materia/server`

or yarn:

`$ (sudo) yarn global add @materia/server`

then you can use Materia Server in 3 ways:

* CLI Interface,

* Javascript interface,

* HTTP Admin API.


## CLI Interface

### Manipulating the server

Start the server

```
$ materia start
```

### Basic information

Get the current version of Materia Server

```
$ materia version
```

You can see more information in the [Materia documentation](https://getmateria.com/docs).

The guide to use [materia deploy](https://getmateria.com/docs/guide/deploy)

## Javascript Interface

The API Reference is available on [getmateria.com/docs/api-reference](https://getmateria.com/docs/api-reference/app).

You can include these object (using `require()`) to create a Materia Application and save it on the Filesystem.

## HTTP Admin Interface

The API reference is available [here](https://materiahq.github.io/materia-server/).

To interact with your running server through the HTTP Admin API, you first need to authenticate with your root password to retrieve your admin access token.

Your admin token has to be used as [Bearer token](https://swagger.io/docs/specification/authentication/bearer-authentication/).
You can then use all the protected http endpoints to model your application.

## Licensing

Materia Server is licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE.md) for the full license text.
