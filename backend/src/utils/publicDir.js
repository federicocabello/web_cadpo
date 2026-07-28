const path = require('path');
const fs = require('fs');

const hostingerPublicDir = path.resolve(__dirname, '../../../public_html');
const localPublicDir = path.resolve(__dirname, '../../../frontend/public');

const getPublicDir = () => {
  if (process.env.PUBLIC_DIR) {
    return path.resolve(process.env.PUBLIC_DIR);
  }
  if (fs.existsSync(hostingerPublicDir)) {
    return hostingerPublicDir;
  }
  return localPublicDir;
};

const publicDir = getPublicDir();

module.exports = publicDir;
