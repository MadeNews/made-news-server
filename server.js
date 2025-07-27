const app = require('./app');

if (require.main === module) {
  const PORT = 3000;
  app.listen(PORT, () =>
    console.log(`🚀 Server running at http://localhost:${PORT}`)
  );
}

module.exports = app;
