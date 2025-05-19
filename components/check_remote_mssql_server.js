const fs = require('fs');
const tcpp = require('tcp-ping');
const sql = require('mssql');

// 공통 DB 접속 정보
const commonDBConfig = {
  user: 'sahara',
  password: '1111',
  database: 'master',
  port: 1433, // 기본 MSSQL 포트
  options: {
    encrypt: false,
    trustServerCertificate: true,
  }
};

// IP 목록 읽기
const ipList = fs.readFileSync('./remotedb_server_ips.txt', 'utf-8')
  .split('\n')
  .map(ip => ip.trim())
  .filter(ip => ip.length > 0);

// 포트 오픈 확인
function checkPort(host) {
  return new Promise((resolve) => {
    tcpp.probe(host, commonDBConfig.port, (err, available) => {
      resolve({ host, portOpen: available });
    });
  });
}

// DB 접속 확인
async function checkDB({ host, portOpen }) {
  if (!portOpen) {
    return { host, portOpen, dbConnected: false, dbError: 'Port closed' };
  }

  const config = {
    ...commonDBConfig,
    server: host
  };

  try {
    await sql.connect(config);
    await sql.close();
    return { host, portOpen, dbConnected: true };
  } catch (error) {
    return { host, portOpen, dbConnected: false, dbError: error.message };
  }
}

// 전체 검사 실행
async function runChecks() {
  console.log('서버 상태를 확인합니다...\n');

  for (const host of ipList) {
    const portChecked = await checkPort(host);
    const dbChecked = await checkDB(portChecked);

    console.log(`📡 [${dbChecked.host}]`);
    console.log(`   - 포트 열림 여부: ${dbChecked.portOpen ? '✅ 열림' : '❌ 닫힘'}`);
    console.log(`   - DB 접속 여부:  ${dbChecked.dbConnected ? '✅ 성공' : `❌ 실패 (${dbChecked.dbError})`}`);
    console.log('');
  }

  console.log('✅ 검사 완료.');
}

runChecks();
