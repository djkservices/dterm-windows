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

        case 'send_message':
            $user = validateToken($input['token'] ?? '');
            if (!$user) {
                echo json_encode(['error' => 'Invalid or expired token']);
                exit;
            }

            $subject = $input['subject'] ?? '';
            $message = trim($input['message'] ?? '');

            if (!in_array($subject, ['Bug', 'Idea'])) {
                echo json_encode(['error' => 'Invalid subject. Must be Bug or Idea.']);
                exit;
            }
            if ($message === '') {
                echo json_encode(['error' => 'Message cannot be empty']);
                exit;
            }

            // Insert into site messages table - send to admin id 1
            $subjectLine = '[dTerm ' . $subject . '] from ' . $user['username'];
            $stmt = $pdo->prepare("INSERT INTO messages (sender_type, sender_id, recipient_type, recipient_id, subject, body, created_at) VALUES ('dterm', ?, 'admin', 1, ?, ?, NOW())");
            $stmt->execute([$user['id'], $subjectLine, $message]);

            echo json_encode(['success' => true, 'message' => 'Message sent successfully']);
            break;

        case 'check_replies':
            $user = validateToken($input['token'] ?? '');
            if (!$user) {
                echo json_encode(['error' => 'Invalid or expired token']);
                exit;
            }

            // Find replies: messages sent by admin TO this dterm user that are unread
            $stmt = $pdo->prepare("SELECT m.id, m.subject, m.body, m.created_at,
                (SELECT m2.body FROM messages m2 WHERE m2.id = m.parent_id) as original_message
                FROM messages m
                WHERE m.recipient_type = 'dterm' AND m.recipient_id = ? AND m.read_at IS NULL
                ORDER BY m.created_at DESC");
            $stmt->execute([$user['id']]);
            $replies = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Mark as read
            if (!empty($replies)) {
                $ids = array_column($replies, 'id');
                $placeholders = implode(',', array_fill(0, count($ids), '?'));
                $pdo->prepare("UPDATE messages SET read_at = NOW() WHERE id IN ($placeholders)")->execute($ids);
            }

            echo json_encode(['success' => true, 'replies' => $replies]);
            break;

        case 'get_my_messages':
            $user = validateToken($input['token'] ?? '');
            if (!$user) {
                echo json_encode(['error' => 'Invalid or expired token']);
                exit;
            }

            // Get messages sent by this user
            $stmt = $pdo->prepare("SELECT m.id, m.subject, m.body, m.created_at,
                (SELECT GROUP_CONCAT(r.body SEPARATOR '|||') FROM messages r WHERE r.parent_id = m.id ORDER BY r.created_at ASC) as admin_replies
                FROM messages m
                WHERE m.sender_type = 'dterm' AND m.sender_id = ?
                ORDER BY m.created_at DESC");
            $stmt->execute([$user['id']]);
            $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode(['success' => true, 'messages' => $messages]);
            break;

        default:
            echo json_encode(['error' => 'Unknown action']);
    }
} catch (Exception $e) {
    echo json_encode(['error' => 'Server error: ' . $e->getMessage()]);
}
