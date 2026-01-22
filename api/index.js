const app = require('../server/server.js');

if (require.main === module) {
    const port = process.env.PORT || 8080;
    app.listen(port, () => {
        console.log(`Server started from api/index.js on port ${port}`);
    });
}

module.exports = app;
