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

        case 'subscribe':
            $user = validateToken($input['token'] ?? '');
            if (!$user) {
                echo json_encode(['error' => 'Invalid or expired token']);
                exit;
            }

            $subscription = $input['subscription'] ?? null;
            if (!$subscription || !isset($subscription['endpoint']) || !isset($subscription['keys'])) {
                echo json_encode(['error' => 'Invalid subscription data']);
                exit;
            }

            $endpoint = $subscription['endpoint'];
            $p256dh = $subscription['keys']['p256dh'] ?? '';
            $authKey = $subscription['keys']['auth'] ?? '';

            if (!$endpoint || !$p256dh || !$authKey) {
                echo json_encode(['error' => 'Missing subscription keys']);
                exit;
            }

            // Upsert subscription
            $stmt = $pdo->prepare("INSERT INTO pwa_push_subscriptions (user_id, endpoint, p256dh, auth_key, created_at)
                VALUES (?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE user_id = ?, p256dh = ?, auth_key = ?, last_used_at = NOW()");
            $stmt->execute([$user['id'], $endpoint, $p256dh, $authKey, $user['id'], $p256dh, $authKey]);

            echo json_encode(['success' => true]);
            break;

        case 'unsubscribe':
            $user = validateToken($input['token'] ?? '');
            if (!$user) {
                echo json_encode(['error' => 'Invalid or expired token']);
                exit;
            }

            $endpoint = $input['endpoint'] ?? '';
            if (!$endpoint) {
                echo json_encode(['error' => 'Missing endpoint']);
                exit;
            }

            $stmt = $pdo->prepare("DELETE FROM pwa_push_subscriptions WHERE endpoint = ? AND user_id = ?");
            $stmt->execute([$endpoint, $user['id']]);

            echo json_encode(['success' => true]);
            break;

        default:
            echo json_encode(['error' => 'Unknown action']);
    }
} catch (Exception $e) {
    echo json_encode(['error' => 'Server error: ' . $e->getMessage()]);
}
