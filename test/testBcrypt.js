// testBcrypt.js
const bcrypt = require('bcrypt');

// 해싱할 비밀번호
const myPassword = process.argv[2] || 'mySuperSecretPassword123!';
const saltRounds = 10; // 솔트 생성에 사용될 라운드 수. 10이 일반적입니다.

console.log(`\n--- bcrypt 테스트 시작 ---`);
console.log(`해싱할 비밀번호: "${myPassword}"`);
console.log(`솔트 라운드 수: ${saltRounds}`);

async function runBcryptTest() {
    try {
        console.log('\n1. 비밀번호 해싱...');
        const hashedPassword = await bcrypt.hash(myPassword, saltRounds);
        console.log(`해싱된 비밀번호: ${hashedPassword}`);

        console.log('\n2. 비밀번호 검증 (올바른 비밀번호로 테스트)...');
        const isMatchCorrect = await bcrypt.compare(myPassword, hashedPassword);
        console.log(`원래 비밀번호와 해싱된 비밀번호 일치 여부: ${isMatchCorrect ? '일치함 (성공)' : '불일치함 (실패)'}`);

        console.log('\n3. 비밀번호 검증 (틀린 비밀번호로 테스트)...');
        const wrongPassword = 'wrongPassword';
        console.log(`틀린 비밀번호: "${wrongPassword}"`);
        const isMatchWrong = await bcrypt.compare(wrongPassword, hashedPassword);
        console.log(`틀린 비밀번호와 해싱된 비밀번호 일치 여부: ${isMatchWrong ? '일치함 (실패)' : '불일치함 (성공)'}`);

    } catch (error) {
        console.error('\nbcrypt 테스트 중 오류 발생:', error);
    } finally {
        console.log('\n--- bcrypt 테스트 종료 ---');
    }
}

runBcryptTest();

