async function inputServersData(db) {
    try {
        await db.execute(`SET FOREIGN_KEY_CHECKS = 0`);
        await db.execute(`TRUNCATE TABLE database_instances`);
        await db.execute(`TRUNCATE TABLE servers_port`);
        await db.execute(`TRUNCATE TABLE servers`);
        await db.execute(`TRUNCATE TABLE corp_proc_define`);

        await db.execute(`insert into corp_proc_define (env_type, corp_id, proc_name, proc_type, db_instance_name, db_instance_name_etc, db_instance_cnt)
                            select env_type, corp_id, proc_detail, proc_id
                                    , max(db_name) db_name
                                    , case when min(db_name) = max(db_name) then '' else min(db_name) end db_name_etc
                                    , count(*) db_cnt
                            from servers_temp st 
                            where length(trim(db_name)) > 3
                            and usage_type = 'AP'
                            and db_type != 'IF'
                            group by env_type, corp_id, proc_detail, proc_id
                        `);

        await db.execute(`INSERT INTO SERVERS (SERVER_IP, HOSTNAME, CORP_ID, ENV_TYPE, ROLE_TYPE, STATUS_CD)
                            SELECT SERVER_IP
                                ,MAX(HOSTNAME) HOSTNAME
                                ,MAX(CORP_ID) CORP_ID
                                ,MAX(ENV_TYPE) ENV_TYPE
                                ,MAX(ROLE_TYPE) ROLE_TYPE
                                ,'Y'
                            FROM SERVERS_TEMP
                            GROUP  BY SERVER_IP
                        `);
        
        await db.execute(`insert into servers_port (server_ip, port, proc_id, proc_detail, usage_type, stat_check_target_yn)
                            select server_ip
                                , port
                                , max(proc_id)
                                , max(proc_detail)
                                , max(usage_type)
                                , max(check_yn)
                            from servers_temp
                            group by server_ip, port`);
        
        await db.execute(`insert into database_instances (db_instance_name, db_instance_type, server_port_id, proc_id, proc_detail)
                            select ap.db_name,
                                case when ap.db_type is null or ap.db_type = '' then 'MAIN' else  ap.db_type end db_type,
                                (select sp.server_port_id from servers_port sp where sp.server_ip = db.server_ip and sp.port = db.port ) server_port_id,
                                proc_id, proc_detail
                            from (
                                select corp_id , group_id , db_name , db_type , env_type, proc_id, proc_detail
                                from servers_temp st
                                where usage_type = 'AP'
                                and group_id > 0
                                and LENGTH(trim(db_name)) > 3
                            ) ap, (
                                select env_type , corp_id , group_id , server_ip , port
                                from servers_temp st
                                where usage_type = 'DB'
                                and env_type  != 'DEV'
                            ) db
                            where ap.env_type = db.env_type
                            and ap.corp_id = db.corp_id
                            and ap.group_id = db.group_id
                            union all
                            select db_name, 'MAIN' db_type, (select sp.server_port_id from servers_port sp where sp.server_ip = t.server_ip and sp.port = t.port ) server_port_id, proc_id, proc_detail
                            from servers_temp t
                            where usage_type = 'DB'
                            and env_type  = 'DEV'
                        `);

        await db.execute(`SET FOREIGN_KEY_CHECKS = 1`);
        

        return true; // 혹은 다른 결과값
    } catch (err) {
        console.error('DB 초기화 중 오류 발생:', err);
        throw err; // 호출자에게 오류 전파
    }
}

module.exports = { inputServersData };
