const express = require('express');
const cors = require('cors');

const healthRoutes = require('./routes/health');

const app = express();

app.use(cors());
app.use(express.json({limit: '1mb'}));

app.use('/api', healthRoutes);

app.get('/', (req, res) => {
  res.status(200).json({
    message: 'SafeRide Guardian API is running',
  });
});

module.exports = app;
