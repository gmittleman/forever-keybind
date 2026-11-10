/* Shared setup for the browser tests: a local server for site/ and where screenshots go. */
const path = require('path');
const fs = require('fs');
const { serve } = require('./server');

const OUT = process.env.TEST_OUTPUT || path.join(__dirname, 'output');
fs.mkdirSync(OUT, { recursive: true });

module.exports = { serve, OUT };
