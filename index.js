const debug = require('debug')('backend:server');
const server = require('./server');
const{PORT} = require('./config');

const StartServer = async () => {
  server.listen(PORT, () => {
    debug(`Server is running on port ${PORT}`);
  }).on('error', (err) => {
    debug(err);
    process.exit(1);
  });
}

StartServer();