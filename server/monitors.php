<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !isset($input['action'])) {
    echo json_encode(['error' => 'Invalid request']);
    exit;
}

define('DTERM_API', true);
require_once __DIR__ . '/config.php';

try {
    $pdo = getDb();
} catch (Exception $e) {
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

$action = $input['action'];

try {
    switch ($action) {

        case 'list':
            $user = validateToken($input['token'] ?? '');
            if (!$user) {
                echo json_encode(['error' => 'Invalid or expired token']);
                exit;
            }

            $stmt = $pdo->prepare("SELECT id, type, target, label, enabled, alert_days, status, last_checked, details, created_at FROM pwa_monitors WHERE user_id = ? ORDER BY created_at DESC");
            $stmt->execute([$user['id']]);
            $monitors = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode(['success' => true, 'monitors' => $monitors]);
            break;

        case 'add':
            $user = validateToken($input['token'] ?? '');
            if (!$user) {
                echo json_encode(['error' => 'Invalid or expired token']);
                exit;
            }

            $type = $input['type'] ?? '';
            $target = trim($input['target'] ?? '');
            $label = trim($input['label'] ?? '');
            $alertDays = intval($input['alert_days'] ?? 30);

            if (!in_array($type, ['domain', 'ssl', 'uptime'])) {
                echo json_encode(['error' => 'Invalid type. Must be domain, ssl, or uptime.']);
                exit;
            }
            if ($target === '') {
                echo json_encode(['error' => 'Target cannot be empty']);
                exit;
            }
            if ($alertDays < 1 || $alertDays > 365) {
                echo json_encode(['error' => 'Alert days must be between 1 and 365']);
                exit;
            }

            // Clean target
            if ($type === 'uptime' && !preg_match('/^https?:\/\//', $target)) {
                $target = 'https://' . $target;
            } elseif ($type !== 'uptime') {
                $target = preg_replace('/^https?:\/\//', '', $target);
                $target = rtrim($target, '/');
            }

            // Check for duplicate
            $stmt = $pdo->prepare("SELECT id FROM pwa_monitors WHERE user_id = ? AND type = ? AND target = ?");
            $stmt->execute([$user['id'], $type, $target]);
            if ($stmt->fetch()) {
                echo json_encode(['error' => 'Monitor already exists for this target']);
                exit;
            }

            $checkInterval = ($type === 'uptime') ? 300 : 86400;
            $alertCooldown = ($type === 'uptime') ? 300 : 86400;

            $stmt = $pdo->prepare("INSERT INTO pwa_monitors (user_id, type, target, label, alert_days, check_interval, alert_cooldown, next_check, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())");
            $stmt->execute([$user['id'], $type, $target, $label, $alertDays, $checkInterval, $alertCooldown]);

            echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
            break;

        case 'delete':
            $user = validateToken($input['token'] ?? '');
            if (!$user) {
                echo json_encode(['error' => 'Invalid or expired token']);
                exit;
            }

            $monitorId = intval($input['monitor_id'] ?? 0);
            if (!$monitorId) {
                echo json_encode(['error' => 'Invalid monitor ID']);
                exit;
            }

            $stmt = $pdo->prepare("DELETE FROM pwa_monitors WHERE id = ? AND user_id = ?");
            $stmt->execute([$monitorId, $user['id']]);

            if ($stmt->rowCount() === 0) {
                echo json_encode(['error' => 'Monitor not found']);
                exit;
            }

            echo json_encode(['success' => true]);
            break;

        case 'update':
            $user = validateToken($input['token'] ?? '');
            if (!$user) {
                echo json_encode(['error' => 'Invalid or expired token']);
                exit;
            }

            $monitorId = intval($input['monitor_id'] ?? 0);
            if (!$monitorId) {
                echo json_encode(['error' => 'Invalid monitor ID']);
                exit;
            }

            $updates = [];
            $params = [];

            if (isset($input['label'])) {
                $updates[] = 'label = ?';
                $params[] = trim($input['label']);
            }
            if (isset($input['alert_days'])) {
                $updates[] = 'alert_days = ?';
                $params[] = intval($input['alert_days']);
            }
            if (isset($input['enabled'])) {
                $updates[] = 'enabled = ?';
                $params[] = $input['enabled'] ? 1 : 0;
            }

            if (empty($updates)) {
                echo json_encode(['error' => 'Nothing to update']);
                exit;
            }

            $params[] = $monitorId;
            $params[] = $user['id'];
            $stmt = $pdo->prepare("UPDATE pwa_monitors SET " . implode(', ', $updates) . " WHERE id = ? AND user_id = ?");
            $stmt->execute($params);

            echo json_encode(['success' => true]);
            break;

        default:
            echo json_encode(['error' => 'Unknown action']);
    }
} catch (Exception $e) {
    echo json_encode(['error' => 'Server error: ' . $e->getMessage()]);
}
