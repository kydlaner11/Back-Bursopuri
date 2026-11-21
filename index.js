const { PORT } = require('./config');

const debug = require('debug')('backend:server');
const server = require('./server');

const StartServer = () => {
  const listener = server.listen(PORT, () => {
    debug(`Server is running on port ${PORT}`);
  });

  listener.on('error', (err) => {
    debug(err);
    process.exit(1);
  });
};

StartServer();
