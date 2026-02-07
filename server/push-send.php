<?php
/**
 * Push Notification Sender - Internal use only
 * Called by monitor-check.php or admin tools
 * Standalone implementation - no Composer dependencies required
 *
 * Usage: sendPushNotification($pdo, $userId, $title, $body, $type, $url)
 */

if (!defined('DTERM_API')) {
    define('DTERM_API', true);
}
require_once __DIR__ . '/config.php';

// VAPID keys
define('VAPID_SUBJECT', 'mailto:admin@mynetworktools.com');
define('VAPID_PUBLIC_KEY', 'BM_nWMcyb4kCht1zzBbSYvWtwT4Cm5kixm45Svb6795HfXyJphdzr-tSp74zg9FMl3sVWor_wJT4r6gOhgU_bBU');
define('VAPID_PRIVATE_KEY', '6ee4CK3cRZjmKU9cTm_uFzgcCoyRd2MPhzwJMqzQXFY');

// Internal secret key for cron/admin calls
define('PUSH_SECRET_KEY', 'e071ceb6fab81314a959513441dea73814bb832f039e53c8cfbe2c3ebd01fdb6');

// ── Base64url helpers ──

function b64url_encode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function b64url_decode($data) {
    return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', (4 - strlen($data) % 4) % 4));
}

// ── ASN.1 / DER helpers ──

function asn1_length($len) {
    if ($len < 128) return chr($len);
    $bytes = '';
    $t = $len;
    while ($t > 0) { $bytes = chr($t & 0xFF) . $bytes; $t >>= 8; }
    return chr(0x80 | strlen($bytes)) . $bytes;
}

function der_sig_to_raw($der) {
    $o = 2; // skip 0x30 + length
    if (ord($der[1]) & 0x80) $o += (ord($der[1]) & 0x7F);

    // R
    $o++; // skip 0x02
    $rLen = ord($der[$o]); $o++;
    $r = substr($der, $o, $rLen); $o += $rLen;

    // S
    $o++; // skip 0x02
    $sLen = ord($der[$o]); $o++;
    $s = substr($der, $o, $sLen);

    $r = str_pad(ltrim($r, "\x00"), 32, "\x00", STR_PAD_LEFT);
    $s = str_pad(ltrim($s, "\x00"), 32, "\x00", STR_PAD_LEFT);
    return $r . $s;
}

function ec_private_key_pem($privKeyRaw, $pubKeyRaw) {
    $oid = hex2bin('06082a8648ce3d030107');
    $ver = hex2bin('020101');
    $priv = chr(0x04) . chr(strlen($privKeyRaw)) . $privKeyRaw;
    $oidT = chr(0xa0) . chr(strlen($oid)) . $oid;
    $pubBits = chr(0x00) . $pubKeyRaw;
    $pubT = chr(0xa1) . asn1_length(2 + strlen($pubBits)) . chr(0x03) . asn1_length(strlen($pubBits)) . $pubBits;
    $inner = $ver . $priv . $oidT . $pubT;
    $der = chr(0x30) . asn1_length(strlen($inner)) . $inner;
    return "-----BEGIN EC PRIVATE KEY-----\n" . chunk_split(base64_encode($der), 64) . "-----END EC PRIVATE KEY-----";
}

function ec_public_key_pem($pubKeyRaw) {
    $ecOid = hex2bin('06072a8648ce3d0201');
    $curveOid = hex2bin('06082a8648ce3d030107');
    $algId = chr(0x30) . chr(strlen($ecOid) + strlen($curveOid)) . $ecOid . $curveOid;
    $bits = chr(0x03) . asn1_length(1 + strlen($pubKeyRaw)) . chr(0x00) . $pubKeyRaw;
    $der = chr(0x30) . asn1_length(strlen($algId) + strlen($bits)) . $algId . $bits;
    return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($der), 64) . "-----END PUBLIC KEY-----";
}

// ── VAPID JWT ──

function create_vapid_jwt($audience) {
    $header = b64url_encode(json_encode(['typ' => 'JWT', 'alg' => 'ES256']));
    $payload = b64url_encode(json_encode([
        'aud' => $audience,
        'exp' => time() + 43200,
        'sub' => VAPID_SUBJECT
    ]));

    $input = "$header.$payload";

    $privRaw = b64url_decode(VAPID_PRIVATE_KEY);
    $pubRaw = b64url_decode(VAPID_PUBLIC_KEY);
    $pem = ec_private_key_pem($privRaw, $pubRaw);

    $key = openssl_pkey_get_private($pem);
    if (!$key) throw new Exception('VAPID key load failed: ' . openssl_error_string());

    openssl_sign($input, $sig, $key, OPENSSL_ALGO_SHA256);
    $rawSig = der_sig_to_raw($sig);

    return "$input." . b64url_encode($rawSig);
}

// ── Payload Encryption (RFC 8291 / aes128gcm) ──

function encrypt_payload($payload, $userPubB64, $userAuthB64) {
    $uaPub = b64url_decode($userPubB64);
    $uaAuth = b64url_decode($userAuthB64);

    // Generate local ECDH key pair
    $localKey = openssl_pkey_new([
        'curve_name' => 'prime256v1',
        'private_key_type' => OPENSSL_KEYTYPE_EC,
    ]);
    if (!$localKey) throw new Exception('Failed to generate local key: ' . openssl_error_string());

    $localDetails = openssl_pkey_get_details($localKey);
    $localPub = chr(0x04)
        . str_pad($localDetails['ec']['x'], 32, "\x00", STR_PAD_LEFT)
        . str_pad($localDetails['ec']['y'], 32, "\x00", STR_PAD_LEFT);

    // ECDH shared secret
    $uaPem = ec_public_key_pem($uaPub);
    $shared = openssl_pkey_derive($uaPem, $localKey, 32);
    if ($shared === false) throw new Exception('ECDH failed: ' . openssl_error_string());

    $salt = random_bytes(16);

    // IKM (RFC 8291 Section 3.4)
    $ikm_info = "WebPush: info\x00" . $uaPub . $localPub;
    $prk_key = hash_hmac('sha256', $shared, $uaAuth, true);
    $ikm = hash_hmac('sha256', $ikm_info . chr(1), $prk_key, true);
    $ikm = substr($ikm, 0, 32);

    // PRK
    $prk = hash_hmac('sha256', $ikm, $salt, true);

    // CEK (Content Encryption Key) - 16 bytes
    $cek_info = "Content-Encoding: aes128gcm\x00";
    $cek = substr(hash_hmac('sha256', $cek_info . chr(1), $prk, true), 0, 16);

    // Nonce - 12 bytes
    $nonce_info = "Content-Encoding: nonce\x00";
    $nonce = substr(hash_hmac('sha256', $nonce_info . chr(1), $prk, true), 0, 12);

    // Encrypt: payload + 0x02 padding delimiter
    $padded = $payload . "\x02";
    $tag = '';
    $encrypted = openssl_encrypt($padded, 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag, '', 16);
    if ($encrypted === false) throw new Exception('AES-GCM encrypt failed: ' . openssl_error_string());

    // aes128gcm header: salt(16) + rs(4) + idlen(1) + keyid(65)
    $rs = pack('N', 4096);
    $header = $salt . $rs . chr(strlen($localPub)) . $localPub;

    return $header . $encrypted . $tag;
}

// ── Send Single Push ──

function sendWebPush($endpoint, $p256dh, $authKey, $payload) {
    try {
        $parsed = parse_url($endpoint);
        $audience = $parsed['scheme'] . '://' . $parsed['host'];

        $jwt = create_vapid_jwt($audience);
        $encrypted = encrypt_payload($payload, $p256dh, $authKey);

        $headers = [
            'Content-Type: application/octet-stream',
            'Content-Encoding: aes128gcm',
            'Content-Length: ' . strlen($encrypted),
            'TTL: 86400',
            'Authorization: vapid t=' . $jwt . ', k=' . VAPID_PUBLIC_KEY,
        ];

        $ch = curl_init($endpoint);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $encrypted,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($httpCode >= 200 && $httpCode < 300) return true;
        if ($httpCode === 410 || $httpCode === 404) return 'expired';

        error_log("WebPush failed ($httpCode) to $endpoint: $response | $error");
        return false;
    } catch (Exception $e) {
        error_log('WebPush exception: ' . $e->getMessage());
        return false;
    }
}

// ── Send to All User Subscriptions ──

function sendPushNotification($pdo, $userId, $title, $body, $type = 'general', $url = '/dterm/pwa/') {
    $stmt = $pdo->prepare("SELECT id, endpoint, p256dh, auth_key FROM pwa_push_subscriptions WHERE user_id = ?");
    $stmt->execute([$userId]);
    $subscriptions = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($subscriptions)) return 0;

    $payload = json_encode([
        'title' => $title,
        'body' => $body,
        'type' => $type,
        'url' => $url
    ]);

    $sent = 0;
    $expired = [];

    foreach ($subscriptions as $sub) {
        $result = sendWebPush($sub['endpoint'], $sub['p256dh'], $sub['auth_key'], $payload);

        if ($result === true) {
            $sent++;
            $pdo->prepare("UPDATE pwa_push_subscriptions SET last_used_at = NOW() WHERE id = ?")->execute([$sub['id']]);
        } elseif ($result === 'expired') {
            $expired[] = $sub['id'];
        }
    }

    if (!empty($expired)) {
        $ph = implode(',', array_fill(0, count($expired), '?'));
        $pdo->prepare("DELETE FROM pwa_push_subscriptions WHERE id IN ($ph)")->execute($expired);
    }

    return $sent;
}

// ── HTTP endpoint for direct calls ──

if (php_sapi_name() !== 'cli' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: POST');
    header('Access-Control-Allow-Headers: Content-Type');

    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        echo json_encode(['error' => 'Invalid request']);
        exit;
    }

    if (($input['secret_key'] ?? '') !== PUSH_SECRET_KEY) {
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }

    try {
        $pdo = getDb();
    } catch (Exception $e) {
        echo json_encode(['error' => 'Database connection failed']);
        exit;
    }

    $userId = intval($input['user_id'] ?? 0);
    $title = $input['title'] ?? 'dTerm';
    $body = $input['body'] ?? '';
    $type = $input['type'] ?? 'general';
    $url = $input['url'] ?? '/dterm/pwa/';

    if (!$userId) {
        echo json_encode(['error' => 'Missing user_id']);
        exit;
    }

    $sent = sendPushNotification($pdo, $userId, $title, $body, $type, $url);
    echo json_encode(['success' => true, 'sent' => $sent]);
}
