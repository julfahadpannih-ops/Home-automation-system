<?php
// api.php - MySQL Database API backend
session_start();
header('Content-Type: application/json');

$host = 'localhost';
$db   = 'smarthome_db';
$user = 'root'; // default XAMPP user
$pass = '';     // default XAMPP password

// Connect to MySQL
$conn = new mysqli($host, $user, $pass, $db);
if ($conn->connect_error) {
    die(json_encode(["error" => "Database connection failed: " . $conn->connect_error]));
}

// 1. Handle User Login
if (isset($_GET['action']) && $_GET['action'] == 'login') {
    $data = json_decode(file_get_contents("php://input"), true);
    $u = $data['username'] ?? '';
    $p = $data['password'] ?? '';

    $stmt = $conn->prepare("SELECT password FROM users WHERE username = ?");
    $stmt->bind_param("s", $u);
    $stmt->execute();
    $res = $stmt->get_result();

    if ($res->num_rows > 0) {
        $row = $res->fetch_assoc();
        if (password_verify($p, $row['password'])) {
            $_SESSION['loggedin'] = true;
            $_SESSION['username'] = $u;
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['success' => false]);
        }
    } else {
        echo json_encode(['success' => false]);
    }
    $stmt->close();
    exit;
}

// 2. Handle Password Updates (requires active login session)
if (isset($_GET['action']) && $_GET['action'] == 'update_credentials') {
    if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true) {
        echo json_encode(['success' => false, 'error' => 'Unauthorized']);
        exit;
    }
    $data = json_decode(file_get_contents("php://input"), true);
    $old_u = $data['old_username'] ?? '';
    $new_u = $data['new_username'] ?? '';
    $new_p = password_hash($data['new_password'] ?? '', PASSWORD_BCRYPT);

    $stmt = $conn->prepare("UPDATE users SET username = ?, password = ? WHERE username = ?");
    $stmt->bind_param("sss", $new_u, $new_p, $old_u);
    $stmt->execute();
    $stmt->close();
    echo json_encode(['success' => true]);
    exit;
}

// 3. Emulate Blynk API locally
if (isset($_GET['blynk_path'])) {
    $path = $_GET['blynk_path'];
    
    // Parse the incoming emulated blynk url (e.g., "update?pin=V2&value=1")
    $parts = parse_url($path);
    $command = $parts['path']; // 'update' or 'get'
    parse_str($parts['query'], $query_params); 
    
    $pin_raw = isset($query_params['pin']) ? $query_params['pin'] : '';
    $pin = str_replace('V', '', $pin_raw); // convert V2 to 2

   if ($command === 'update') {
        $val = $query_params['value'] ?? '0';

        // Fetch the current state from the database to check if it actually changed
        $check_stmt = $conn->prepare("SELECT value FROM devices WHERE pin = ?");
        $check_stmt->bind_param("s", $pin);
        $check_stmt->execute();
        $check_res = $check_stmt->get_result();
        $current_val = $check_res->num_rows > 0 ? $check_res->fetch_assoc()['value'] : null;
        $check_stmt->close();

        // Update the live device value
        $upd_stmt = $conn->prepare("UPDATE devices SET value = ? WHERE pin = ?");
        $upd_stmt->bind_param("ss", $val, $pin);
        $upd_stmt->execute();
        $upd_stmt->close();

        // For virtual devices not in the 'devices' table (like the Master Toggle), check recent history to prevent spam
        if ($current_val === null) {
            $hist_stmt = $conn->prepare("SELECT value FROM device_history WHERE pin = ? ORDER BY timestamp DESC LIMIT 1");
            $hist_stmt->bind_param("s", $pin);
            $hist_stmt->execute();
            $hist_res = $hist_stmt->get_result();
            if ($hist_res && $hist_res->num_rows > 0) {
                $current_val = $hist_res->fetch_assoc()['value'];
            }
            $hist_stmt->close();
        }

        // MODIFIED: Insert into history log ONLY if the ON/OFF state actually changed
        if ((string)$current_val !== (string)$val) {
            $ins_stmt = $conn->prepare("INSERT INTO device_history (pin, value) VALUES (?, ?)");
            $ins_stmt->bind_param("ss", $pin, $val);
            $ins_stmt->execute();
            $ins_stmt->close();
        }

        echo "OK";
    }
    else if ($command === 'get') {
        $get_stmt = $conn->prepare("SELECT value FROM devices WHERE pin = ?");
        $get_stmt->bind_param("s", $pin);
        $get_stmt->execute();
        $res = $get_stmt->get_result();
        if ($res->num_rows > 0) {
            $row = $res->fetch_assoc();
            echo $row['value']; // return raw value exactly like blynk does
        } else {
            echo "0";
        }
        $get_stmt->close();
    }
    exit;
}

// 4. Handle History Fetching
if (isset($_GET['action']) && $_GET['action'] == 'get_history') {
    if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true) {
        echo json_encode(['error' => 'Unauthorized']); exit;
    }
    
    // MODIFIED: Changed to LEFT JOIN so virtual pins (like Master Toggle) still appear in history even if missing from `devices` table.
    $sql = "SELECT h.timestamp, 
                   IF(h.pin = '10', 'Master Toggle', IFNULL(d.name, CONCAT('Device V', h.pin))) as name, 
                   h.value 
            FROM device_history h 
            LEFT JOIN devices d ON h.pin = d.pin 
            ORDER BY h.timestamp DESC 
            LIMIT 100";
            
    $res = $conn->query($sql);
    $history = [];
    if ($res && $res->num_rows > 0) {
        while($row = $res->fetch_assoc()) {
            $history[] = $row;
        }
    }
    echo json_encode($history);
    exit;
}

// 5. ADDED: Log Power Consumption (Every Minute)
if (isset($_GET['action']) && $_GET['action'] == 'log_power') {
    if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true) {
        echo json_encode(['error' => 'Unauthorized']); exit;
    }
    $data = json_decode(file_get_contents("php://input"), true);
    if(isset($data['kwh'])) {
        $kwh = (float)$data['kwh'];
        $stmt = $conn->prepare("INSERT INTO energy_log (watts_consumed) VALUES (?)");
        $stmt->bind_param("d", $kwh);
        $stmt->execute();
        $stmt->close();
        echo json_encode(['success' => true]);
    }
    exit;
}

// 6. ADDED: Fetch Power Stats (For Dashboard and Chatbot)
if (isset($_GET['action']) && $_GET['action'] == 'get_power_stats') {
    if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true) {
        echo json_encode(['error' => 'Unauthorized']); exit;
    }
    $stats = ['today' => 0, 'week' => 0, 'month' => 0, 'overall' => 0];
    
    // Today
    $resToday = $conn->query("SELECT SUM(watts_consumed) as total FROM energy_log WHERE DATE(timestamp) = CURDATE()");
    if($resToday && $row = $resToday->fetch_assoc()) $stats['today'] = (float)$row['total'];

    // Last 7 Days
    $resWeek = $conn->query("SELECT SUM(watts_consumed) as total FROM energy_log WHERE timestamp >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)");
    if($resWeek && $row = $resWeek->fetch_assoc()) $stats['week'] = (float)$row['total'];

    // Last 30 Days
    $resMonth = $conn->query("SELECT SUM(watts_consumed) as total FROM energy_log WHERE timestamp >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)");
    if($resMonth && $row = $resMonth->fetch_assoc()) $stats['month'] = (float)$row['total'];
    
    // Overall Lifetime
    $resOverall = $conn->query("SELECT SUM(watts_consumed) as total FROM energy_log");
    if($resOverall && $row = $resOverall->fetch_assoc()) $stats['overall'] = (float)$row['total'];

    echo json_encode($stats);
    exit;
}

// 7. ADDED: Fetch Daily Power History Logs
if (isset($_GET['action']) && $_GET['action'] == 'get_power_history') {
    if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true) {
        echo json_encode(['error' => 'Unauthorized']); exit;
    }
    // Groups the consumption by Day (resets and starts a new row next day)
    $sql = "SELECT DATE(timestamp) as log_date, SUM(watts_consumed) as total_kwh FROM energy_log GROUP BY DATE(timestamp) ORDER BY log_date DESC LIMIT 30";
    $res = $conn->query($sql);
    $history = [];
    if ($res && $res->num_rows > 0) {
        while($row = $res->fetch_assoc()) {
            $history[] = $row;
        }
    }
    echo json_encode($history);
    exit;
}

?>