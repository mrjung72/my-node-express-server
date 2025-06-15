async function inputServersData(db) {
    try {
        await db.execute(`SET FOREIGN_KEY_CHECKS = 0`);
        await db.execute(`TRUNCATE TABLE database_instances`);
        await db.execute(`TRUNCATE TABLE servers_port`);
        await db.execute(`TRUNCATE TABLE servers`);

        const sql = 
                `INSERT INTO SERVERS (SERVER_IP, HOSTNAME, CORP_ID, ENV_TYPE, ROLE_TYPE, STATUS_CD)
                SELECT SERVER_IP
                    ,MAX(HOSTNAME) HOSTNAME
                    ,MAX(CORP_ID) CORP_ID
                    ,MAX(ENV_TYPE) ENV_TYPE
                    ,MAX(ROLE_TYPE) ROLE_TYPE
                    ,'Y'
                FROM SERVERS_TEMP
                GROUP  BY SERVER_IP`;
        await db.execute(sql);
        
        await db.execute(`insert into servers_port (server_ip, port, proc_id, proc_detail, usage_type, stat_check_target_yn)
                            select server_ip
                                , port
                                , max(proc_id)
                                , max(proc_detail)
                                , max(usage_type)
                                , max(check_yn)
                            from servers_temp
                            group by server_ip, port`);
        
        await db.execute(`insert into database_instances (db_instance_name, db_instance_type, server_port_id)
                            select db_name
                                ,'BASIC' 
                                ,(select p.server_port_id  from servers_port p where p.server_ip = st.server_ip and p.port = st.port) server_port_id
                            from servers_temp st 
                            where st.usage_type = 'DB'`);

        await db.execute(`SET FOREIGN_KEY_CHECKS = 1`);
        

        return true; // 혹은 다른 결과값
    } catch (err) {
        console.error('DB 초기화 중 오류 발생:', err);
        throw err; // 호출자에게 오류 전파
    }
}

module.exports = { inputServersData };
