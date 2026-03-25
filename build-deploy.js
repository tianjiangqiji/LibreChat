#!/usr/bin/env node

/**
 * LibreChat 一键构建部署脚本
 * 用于生成可部署的文件夹
 * 
 * 使用方法：
 *   node build-deploy.js
 *   或 npm run build:deploy
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 配置
const BUILD_DIR = 'build';
const ROOT_DIR = path.resolve(__dirname);

// 需要复制的文件和目录（不包含 node_modules，部署时安装）
const FILES_TO_COPY = [
  // 后端代码
  { src: 'api', dest: 'api', type: 'dir' },
  
  // 内部包（完整目录，包含 package.json 和 dist）
  { src: 'packages/api', dest: 'packages/api', type: 'dir' },
  { src: 'packages/data-provider', dest: 'packages/data-provider', type: 'dir' },
  { src: 'packages/data-schemas', dest: 'packages/data-schemas', type: 'dir' },
  { src: 'packages/client', dest: 'packages/client', type: 'dir' },
  
  // 客户端完整目录（包含 package.json）
  { src: 'client/package.json', dest: 'client/package.json', type: 'file' },
  { src: 'client/dist', dest: 'client/dist', type: 'dir' },
  { src: 'client/public', dest: 'client/public', type: 'dir' },
  
  // 配置文件
  { src: 'package.json', dest: 'package.json', type: 'file' },
  { src: 'package-lock.json', dest: 'package-lock.json', type: 'file' },
  { src: '.env', dest: '.env', type: 'file', optional: true },
  { src: 'librechat.yaml', dest: 'librechat.yaml', type: 'file', optional: true },
  
  // 数据目录（如果存在）
  { src: 'data', dest: 'data', type: 'dir', optional: true },
];

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n[${step}] ${message}`, 'cyan');
}

function logSuccess(message) {
  log(`  ✓ ${message}`, 'green');
}

function logError(message) {
  log(`  ✗ ${message}`, 'red');
}

function logWarning(message) {
  log(`  ⚠ ${message}`, 'yellow');
}

/**
 * 递归删除目录
 */
function deleteDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

/**
 * 确保目录存在
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 复制文件或目录
 */
function copyPath(src, dest) {
  const srcPath = path.join(ROOT_DIR, src);
  const destPath = path.join(ROOT_DIR, BUILD_DIR, dest);
  
  if (!fs.existsSync(srcPath)) {
    return false;
  }
  
  // 确保目标父目录存在
  ensureDir(path.dirname(destPath));
  
  if (fs.statSync(srcPath).isDirectory()) {
    // 复制目录
    fs.cpSync(srcPath, destPath, { recursive: true });
  } else {
    // 复制文件
    fs.copyFileSync(srcPath, destPath);
  }
  
  return true;
}

/**
 * 执行构建命令
 */
function runBuild() {
  logStep('1', '开始构建项目...');
  
  try {
    // 构建所有包和前端
    log('  正在构建所有包和前端...', 'yellow');
    execSync('npm run build', { stdio: 'inherit', cwd: ROOT_DIR });
    logSuccess('构建完成');
    return true;
  } catch (error) {
    logError('构建失败');
    logError(error.message);
    return false;
  }
}

/**
 * 清理构建目录
 */
function cleanBuildDir() {
  logStep('2', '清理构建目录...');
  
  const buildPath = path.join(ROOT_DIR, BUILD_DIR);
  deleteDir(buildPath);
  ensureDir(buildPath);
  
  logSuccess(`已清理并创建 ${BUILD_DIR}/ 目录`);
}

/**
 * 复制文件
 */
function copyFiles() {
  logStep('3', '复制文件到构建目录...');
  
  let copied = 0;
  let skipped = 0;
  
  for (const item of FILES_TO_COPY) {
    const success = copyPath(item.src, item.dest);
    
    if (success) {
      logSuccess(`${item.src} -> ${item.dest}`);
      copied++;
    } else if (item.optional) {
      logWarning(`跳过可选文件: ${item.src}`);
      skipped++;
    } else {
      logError(`复制失败: ${item.src}`);
    }
  }
  
  log(`\n  复制完成: ${copied} 个成功, ${skipped} 个跳过`, 'green');
}

/**
 * 生成启动脚本
 */
function generateStartScript() {
  logStep('4', '生成启动脚本...');
  
  // Windows 启动脚本
  const winScript = `@echo off
echo Starting LibreChat...
set NODE_ENV=production
node api/server/index.js
pause
`;
  
  // Linux/Mac 启动脚本
  const unixScript = `#!/bin/bash
echo "Starting LibreChat..."
export NODE_ENV=production
node api/server/index.js
`;
  
  // 写入脚本
  fs.writeFileSync(path.join(ROOT_DIR, BUILD_DIR, 'start.bat'), winScript);
  fs.writeFileSync(path.join(ROOT_DIR, BUILD_DIR, 'start.sh'), unixScript);
  
  // 给 Unix 脚本添加执行权限
  try {
    fs.chmodSync(path.join(ROOT_DIR, BUILD_DIR, 'start.sh'), '755');
  } catch (e) {
    // Windows 上可能会失败，忽略
  }
  
  logSuccess('已生成 start.bat (Windows)');
  logSuccess('已生成 start.sh (Linux/Mac)');
}

/**
 * 生成 README
 */
function generateReadme() {
  logStep('5', '生成部署说明...');
  
  const readme = `# LibreChat 部署包

## 部署步骤

### 1. 环境要求
- Node.js >= 20.19.0 或 >= 22.12.0
- MongoDB 数据库

### 2. 配置
- 确保 \`.env\` 文件配置正确
- 确保 \`librechat.yaml\` 文件配置正确

### 3. 安装依赖
\`\`\`bash
# 重要：必须使用 smart-reinstall 或完整安装，因为项目包含内部包
npm install
\`\`\`

> 注意：不要使用 --production 参数，因为内部包需要构建依赖

### 4. 启动服务

**Windows:**
\`\`\`bash
start.bat
\`\`\`

**Linux/Mac:**
\`\`\`bash
./start.sh
\`\`\`

或手动启动:
\`\`\`bash
NODE_ENV=production node api/server/index.js
\`\`\`

### 5. 访问应用
打开浏览器访问: http://localhost:3080

## 目录结构
\`\`\`
build/
├── api/                    # 后端代码
├── client/                 # 客户端
│   ├── dist/               # 前端静态文件
│   ├── package.json        # 客户端包配置
│   └── public/             # 静态资源
├── packages/               # 内部包（包含 package.json 和 dist）
│   ├── api/                # @librechat/api
│   ├── data-provider/      # librechat-data-provider
│   ├── data-schemas/       # @librechat/data-schemas
│   └── client/             # @librechat/client
├── node_modules/           # 依赖包
├── .env                    # 环境变量
├── librechat.yaml          # 配置文件
├── start.bat               # Windows 启动脚本
└── start.sh                # Linux/Mac 启动脚本
\`\`\`

## 注意事项
- 确保 MongoDB 服务已启动
- 确保端口 3080 未被占用
- 生产环境建议使用 PM2 或 Docker 管理进程
`;
  
  fs.writeFileSync(path.join(ROOT_DIR, BUILD_DIR, 'README.md'), readme);
  logSuccess('已生成 README.md');
}

/**
 * 显示统计信息
 */
function showStats() {
  logStep('6', '构建统计...');
  
  const buildPath = path.join(ROOT_DIR, BUILD_DIR);
  
  function getDirSize(dirPath) {
    let size = 0;
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
          size += getDirSize(filePath);
        } else {
          size += stats.size;
        }
      }
    }
    return size;
  }
  
  const sizeInBytes = getDirSize(buildPath);
  const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);
  
  log(`  构建目录大小: ${sizeInMB} MB`, 'green');
  log(`  构建目录位置: ${buildPath}`, 'green');
}

/**
 * 主函数
 */
function main() {
  console.log('\n========================================');
  console.log('    LibreChat 一键构建部署脚本');
  console.log('========================================\n');
  
  const startTime = Date.now();
  
  // 1. 执行构建
  if (!runBuild()) {
    process.exit(1);
  }
  
  // 2. 清理构建目录
  cleanBuildDir();
  
  // 3. 复制文件
  copyFiles();
  
  // 4. 生成启动脚本
  generateStartScript();
  
  // 5. 生成 README
  generateReadme();
  
  // 6. 显示统计
  showStats();
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  
  console.log('\n========================================');
  log(`构建完成！耗时 ${elapsed} 秒`, 'green');
  console.log('========================================\n');
  
  log('部署方法:', 'cyan');
  log('  1. 将 build/ 目录复制到目标服务器');
  log('  2. 确保已安装 Node.js 和 MongoDB');
  log('  3. 运行 start.bat (Windows) 或 start.sh (Linux/Mac)');
  log('');
}

// 执行
main();
