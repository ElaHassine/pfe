require('dotenv').config();

const app = require('./app');
const { connectDatabase } = require('./config/db');
const Doctor = require('./models/Doctor');
const BookingRequest = require('./models/BookingRequest');

const PORT = process.env.PORT || 4000;

async function start() {
  await connectDatabase();
  await Promise.all([
    Doctor.createCollection(),
    BookingRequest.createCollection(),
  ]);

  app.listen(PORT, () => {
    console.log(`Lesio backend running on port ${PORT}`);
  });
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
