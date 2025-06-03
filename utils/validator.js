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
        const result = validateName(items['password'])
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
        return { valid: false, code: 405, message: '[ERROR] Password must be greater than 4 characters or less than 8 characters' };
    }     
    return { valid: true };
}

module.exports = {
  validateUserInfo,
  validateUserId,
  validateEmail,
  validateName,
  validatePassword
};
