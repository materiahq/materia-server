[![Build Status](https://travis-ci.org/webshell/materia-server.svg?branch=master)](https://travis-ci.org/webshell/materia-server) [![npm version](https://badge.fury.io/js/materia-server.svg)](https://badge.fury.io/js/materia-server) [![dependencies Status](https://david-dm.org/webshell/materia-server/status.svg)](https://david-dm.org/webshell/materia-server)

# Materia Server

Materia Server is the core of [Materia](https://getmateria.com). It handles your Materia Application and host them anywhere.

![Materia logo](https://getmateria.com/img/logo.png)

Installation
------------

You can install Materia Server using NPM.

`$ (sudo) npm install -g @materia/server`

then you can use Materia Server in 2 ways:

* CLI Interface

* Javascript interface


CLI Interface
-------------

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

Javascript Interface
--------------------

The API Reference is available on [getmateria.com/docs/api-reference](https://getmateria.com/docs/api-reference/app).

You can include these object (using `require()`) to create a Materia Application and save it on the Filesystem.

Licensing
---------

Materia Server is licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE.md) for the full license text.
