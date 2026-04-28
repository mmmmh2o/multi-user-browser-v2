const path = require('path');
const { app } = require('electron');

function pathValidator(targetPath) {
  const homeDir = app.getPath('home');
  const resolved = path.resolve(targetPath);
  if (!resolved.startsWith(homeDir)) {
    throw new Error(`路径安全校验失败: ${resolved} 不在 ${homeDir} 内`);
  }
  return resolved;
}

module.exports = { pathValidator };
