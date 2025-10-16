const dotenv = require('dotenv');
const path = require('path');


dotenv.config({ path: path.resolve(__dirname, '..', '.env') });


module.exports = {
port: process.env.PORT,
nodeEnv: process.env.NODE_ENV || 'development',
};