<?php
declare(strict_types=1);
// Append numbered migrations in future releases; never rewrite an applied migration.
function migrate(PDO $db): void {
 $db->exec('CREATE TABLE IF NOT EXISTS pdm_schema (id INT PRIMARY KEY, version INT NOT NULL) ENGINE=InnoDB');
 $version=(int)$db->query('SELECT version FROM pdm_schema WHERE id=1')->fetchColumn();
 if($version>SCHEMA_VERSION)throw new RuntimeException('پایگاه داده جدیدتر از فایل‌های برنامه است؛ نصب نسخه قدیمی مجاز نیست.');
 if($version<1){
 $db->exec("CREATE TABLE IF NOT EXISTS pdm_users (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,email VARCHAR(190) NOT NULL UNIQUE,password_hash VARCHAR(255) NOT NULL,role VARCHAR(20) NOT NULL DEFAULT 'teacher',auth_version INT NOT NULL DEFAULT 1,created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
 $db->exec('CREATE TABLE IF NOT EXISTS pdm_workspaces (user_id BIGINT UNSIGNED PRIMARY KEY,payload MEDIUMTEXT NOT NULL,revision BIGINT NOT NULL DEFAULT 0,updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,CONSTRAINT pdm_workspace_user FOREIGN KEY(user_id) REFERENCES pdm_users(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
 $db->exec('CREATE TABLE IF NOT EXISTS pdm_history (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,user_id BIGINT UNSIGNED NOT NULL,revision BIGINT NOT NULL,payload MEDIUMTEXT NOT NULL,created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,INDEX history_user(user_id,id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
 $db->exec('CREATE TABLE IF NOT EXISTS pdm_rate_limits (rate_key CHAR(64) PRIMARY KEY,started BIGINT NOT NULL,attempts INT NOT NULL) ENGINE=InnoDB');
 $db->exec('INSERT INTO pdm_schema (id,version) VALUES (1,1) ON DUPLICATE KEY UPDATE version=1');
 }
 if($version<2){
 $exists=$db->query("SHOW COLUMNS FROM pdm_users LIKE 'active'")->fetch();
 if(!$exists)$db->exec('ALTER TABLE pdm_users ADD active TINYINT NOT NULL DEFAULT 1');
 $db->exec('CREATE TABLE IF NOT EXISTS pdm_audit (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,actor_id BIGINT UNSIGNED NOT NULL,target_id BIGINT UNSIGNED NOT NULL,action VARCHAR(40) NOT NULL,created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,INDEX audit_target(target_id,id)) ENGINE=InnoDB');
 $db->exec('UPDATE pdm_schema SET version=2 WHERE id=1');
 }
 if($version<3){
 $db->exec("CREATE TABLE IF NOT EXISTS pdm_attendance_notes (owner_id BIGINT UNSIGNED NOT NULL,session_id VARCHAR(64) NOT NULL,student_id VARCHAR(64) NOT NULL,note TEXT NOT NULL,updated_by BIGINT UNSIGNED NOT NULL,updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,PRIMARY KEY(owner_id,session_id,student_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
 $db->exec("CREATE TABLE IF NOT EXISTS pdm_incidents (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,owner_id BIGINT UNSIGNED NOT NULL,student_id VARCHAR(64) NOT NULL,student_name VARCHAR(150) NOT NULL,student_code VARCHAR(40) NOT NULL,class_id VARCHAR(64) NOT NULL,class_name VARCHAR(100) NOT NULL,event_date DATE NOT NULL,title VARCHAR(150) NOT NULL,detail TEXT NOT NULL,followup TEXT NOT NULL,status VARCHAR(20) NOT NULL DEFAULT 'open',revision INT NOT NULL DEFAULT 0,created_by BIGINT UNSIGNED NOT NULL,updated_by BIGINT UNSIGNED NOT NULL,created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,INDEX incident_date(event_date,owner_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
 $db->exec("CREATE TABLE IF NOT EXISTS pdm_case_history (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,kind VARCHAR(30) NOT NULL,reference_key VARCHAR(220) NOT NULL,actor_id BIGINT UNSIGNED NOT NULL,before_payload MEDIUMTEXT NOT NULL,after_payload MEDIUMTEXT NOT NULL,created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,INDEX case_reference(reference_key)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
 $db->exec('UPDATE pdm_schema SET version=3 WHERE id=1');
 }
 if($version<4){
 $exists=$db->query("SHOW COLUMNS FROM pdm_users LIKE 'actor_id'")->fetch();
 if(!$exists)$db->exec('ALTER TABLE pdm_users ADD actor_id VARCHAR(100) NULL UNIQUE, ADD phone VARCHAR(11) NULL');
 $db->exec('CREATE TABLE IF NOT EXISTS pdm_school (id INT PRIMARY KEY,revision BIGINT NOT NULL DEFAULT 0,payload LONGTEXT NOT NULL,updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
 $db->exec('CREATE TABLE IF NOT EXISTS pdm_school_history (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,revision BIGINT NOT NULL,actor_id BIGINT UNSIGNED NOT NULL,payload LONGTEXT NOT NULL,created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
 $db->exec('CREATE TABLE IF NOT EXISTS pdm_files (id CHAR(32) PRIMARY KEY,user_id BIGINT UNSIGNED NOT NULL,task_id VARCHAR(100) NOT NULL,name VARCHAR(200) NOT NULL,size INT NOT NULL,created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
 $db->exec('UPDATE pdm_schema SET version=4 WHERE id=1');
 }
}
