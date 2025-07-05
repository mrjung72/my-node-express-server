/**
 * 회원 정보 유효성 검사
 * @param {string} validationItems - ex) {userid:${userid}, email:${email}, name:${name}, password:${password}}
 * @returns {{ valid: boolean, code?: number, message?: string }}
 */
function validateUserInfo(items) {

    if(items['userid']) {
        const result = validateUserId(items['userid'])
        if (!result.valid) {
            return result
        }
    }

    if(items['email']) {
        const result = validateEmail(items['email'])
        if (!result.valid) {
            return result
        }
    }

    if(items['name']) {
        const result = validateName(items['name'])
        if (!result.valid) {
            return result
        }
    }

    if(items['password']) {
        const result = validatePassword(items['password'])
        if (!result.valid) {
            return result
        }
    }

    return { valid: true };
}

/**
 * 회원ID 유효성 검사
 * @param {string} userid - 사용자 ID
 * @returns {{ valid: boolean, code?: number, message?: string }}
 */
function validateUserId(userid) {

    if (!userid || !/^[a-zA-Z0-9]+$/.test(userid)) {
        return { valid: false, code: 401, message: '[ERROR] User ID can only contain alphanumeric characters' };
    } else if (userid.toLowerCase().startsWith('admin')) {
        return { valid: false, code: 402, message: '[ERROR] User ID that start with "admin" is not allowed' };
    }
    return { valid: true };
}

/**
 * 이메일 유효성 검사
 * @param {string} email - 사용자 이메일
 * @returns {{ valid: boolean, code?: number, message?: string }}
 */
function validateEmail(email) {

    if (!email || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
        return { valid: false, code: 403, message: '[ERROR] Invalid email format' };
    }
    return { valid: true };
}

/**
 * 이름 유효성 검사
 * @param {string} name - 이름
 * @returns {{ valid: boolean, code?: number, message?: string }}
 */
function validateName(name) {

    if (!name) {
        return { valid: false, code: 404, message: '[ERROR] Name field is required' };
    }     
    return { valid: true };
}

/**
 * 비밀번호 유효성 검사
 * @param {string} password - 비밀번호
 * @returns {{ valid: boolean, code?: number, message?: string }}
 */
function validatePassword(password) {

    if (!password || password.length < 4 || password.length > 8) {
        return { valid: false, code: 405, message: '[ERROR] 최소 4자리, 최대 8자리 비밀번호를 입력하세요.' };
    }

    if (isSameChar(password)) {
        return { valid: false, code: 406, message: '[ERROR] 동일한 문자 또는 숫자는 2자리까지 허용합니다.' };
    }

    if (isSequential(password)) {
        return { valid: false, code: 407, message: '[ERROR] 연속된 문자 또는 숫자가 포함되어 있습니다.' };
    }

    return { valid: true };
}

function isSequential(str) {
    if (!str) return false
    let asc = true, desc = true
    for (let i = 0; i < str.length - 1; i++) {
        if (str.charCodeAt(i) + 1 !== str.charCodeAt(i + 1)) asc = false
        if (str.charCodeAt(i) - 1 !== str.charCodeAt(i + 1)) desc = false
    }
    return asc || desc
}

function isSameChar(str) {
    return /([a-zA-Z0-9])\1{2,}/.test(str)
}

module.exports = {
  validateUserInfo,
  validateUserId,
  validateEmail,
  validateName,
  validatePassword
};
