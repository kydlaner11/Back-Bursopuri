const environment = process.env.NODE_ENV || 'dev';
const knex = require('knex');
const config = require('./knexfile');
// const model = require('../src/model');

module.exports = knex(config[environment.trim()]);
