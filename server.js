const config = require('./src/config/env');
const { bootstrap } = require('./src/app');

bootstrap()
  .then((app) => {
    app.listen(config.port, () => {
      console.log(`Server running on http://localhost:${config.port}`);
      console.log(`Swagger docs: http://localhost:${config.port}/api-docs`);
      console.log(`Admin panel:  http://localhost:${config.port}/admin`);
    });
  })
  .catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});
