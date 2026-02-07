<?php
/**
 * Monitor Check - Cron Script
 * Run every 5 minutes: */5 * * * * php /path/to/monitor-check.php
 *
 * Checks all monitors due for checking and sends push notifications for alerts.
 */

define('DTERM_API', true);
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/push-send.php';

try {
    $pdo = getDb();
} catch (Exception $e) {
    error_log('Monitor check: DB connection failed - ' . $e->getMessage());
    exit(1);
}

// Get all monitors due for checking
$stmt = $pdo->prepare("SELECT * FROM pwa_monitors WHERE enabled = 1 AND (next_check IS NULL OR next_check <= NOW())");
$stmt->execute();
$monitors = $stmt->fetchAll(PDO::FETCH_ASSOC);

if (empty($monitors)) {
    exit(0);
}

foreach ($monitors as $monitor) {
    $result = checkMonitor($monitor);
    updateMonitor($pdo, $monitor, $result);

    // Determine if alert should be sent
    if (shouldAlert($monitor, $result)) {
        $title = getAlertTitle($monitor, $result);
        $body = getAlertBody($monitor, $result);
        $type = $monitor['type'] . '_' . $result['status'];
        $url = '/dterm/pwa/#monitors';

        sendPushNotification($pdo, $monitor['user_id'], $title, $body, $type, $url);

        // Update last_alert_sent
        $pdo->prepare("UPDATE pwa_monitors SET last_alert_sent = NOW() WHERE id = ?")->execute([$monitor['id']]);
    }
}

/**
 * Run the appropriate check for a monitor
 */
function checkMonitor($monitor) {
    switch ($monitor['type']) {
        case 'domain':
            return checkDomainExpiry($monitor['target']);
        case 'ssl':
            return checkSslExpiry($monitor['target']);
        case 'uptime':
            return checkUptime($monitor['target']);
        default:
            return ['status' => 'unknown', 'details' => ['error' => 'Unknown monitor type']];
    }
}

/**
 * Check domain WHOIS expiry
 */
function checkDomainExpiry($domain) {
    $domain = escapeshellarg($domain);
    $output = shell_exec("whois $domain 2>&1");

    if (!$output) {
        return ['status' => 'unknown', 'details' => ['error' => 'WHOIS lookup failed']];
    }

    // Parse expiry date from various WHOIS formats
    $patterns = [
        '/Registry Expiry Date:\s*(.+)/i',
        '/Expiration Date:\s*(.+)/i',
        '/Expiry Date:\s*(.+)/i',
        '/paid-till:\s*(.+)/i',
        '/Expiry date:\s*(.+)/i',
        '/expire:\s*(.+)/i',
        '/Renewal Date:\s*(.+)/i',
    ];

    $expiryDate = null;
    foreach ($patterns as $pattern) {
        if (preg_match($pattern, $output, $matches)) {
            $parsed = strtotime(trim($matches[1]));
            if ($parsed) {
                $expiryDate = $parsed;
                break;
            }
        }
    }

    if (!$expiryDate) {
        return ['status' => 'unknown', 'details' => ['error' => 'Could not parse expiry date']];
    }

    $daysRemaining = floor(($expiryDate - time()) / 86400);
    $expiryFormatted = date('Y-m-d', $expiryDate);

    $status = 'ok';
    if ($daysRemaining <= 7) $status = 'critical';
    elseif ($daysRemaining <= 30) $status = 'warning';

    return [
        'status' => $status,
        'details' => [
            'expiry_date' => $expiryFormatted,
            'days_remaining' => $daysRemaining
        ]
    ];
}

/**
 * Check SSL certificate expiry
 */
function checkSslExpiry($domain) {
    $domain = preg_replace('/^https?:\/\//', '', $domain);
    $domain = rtrim($domain, '/');

    $context = stream_context_create([
        'ssl' => [
            'capture_peer_cert' => true,
            'verify_peer' => false,
            'verify_peer_name' => false,
        ]
    ]);

    $client = @stream_socket_client(
        "ssl://{$domain}:443",
        $errno, $errstr, 10,
        STREAM_CLIENT_CONNECT, $context
    );

    if (!$client) {
        return ['status' => 'critical', 'details' => ['error' => "Connection failed: $errstr"]];
    }

    $params = stream_context_get_params($client);
    fclose($client);

    if (!isset($params['options']['ssl']['peer_certificate'])) {
        return ['status' => 'unknown', 'details' => ['error' => 'Could not get certificate']];
    }

    $cert = openssl_x509_parse($params['options']['ssl']['peer_certificate']);
    if (!$cert || !isset($cert['validTo_time_t'])) {
        return ['status' => 'unknown', 'details' => ['error' => 'Could not parse certificate']];
    }

    $expiryDate = $cert['validTo_time_t'];
    $daysRemaining = floor(($expiryDate - time()) / 86400);
    $expiryFormatted = date('Y-m-d', $expiryDate);
    $issuer = $cert['issuer']['O'] ?? $cert['issuer']['CN'] ?? 'Unknown';
    $subject = $cert['subject']['CN'] ?? $domain;

    $status = 'ok';
    if ($daysRemaining <= 7) $status = 'critical';
    elseif ($daysRemaining <= 30) $status = 'warning';

    return [
        'status' => $status,
        'details' => [
            'expiry_date' => $expiryFormatted,
            'days_remaining' => $daysRemaining,
            'issuer' => $issuer,
            'subject' => $subject
        ]
    ];
}

/**
 * Check uptime via HTTP request
 */
function checkUptime($url) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 3,
        CURLOPT_NOBODY => false,
        CURLOPT_USERAGENT => 'dTerm Monitor/1.0',
        CURLOPT_SSL_VERIFYPEER => false,
    ]);

    $startTime = microtime(true);
    $response = curl_exec($ch);
    $endTime = microtime(true);

    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    $responseTimeMs = round(($endTime - $startTime) * 1000);

    if ($error) {
        return [
            'status' => 'critical',
            'details' => [
                'error' => $error,
                'http_status' => 0,
                'response_time_ms' => $responseTimeMs
            ]
        ];
    }

    $status = 'ok';
    if ($httpCode < 200 || $httpCode >= 400) {
        $status = 'critical';
    } elseif ($responseTimeMs > 5000) {
        $status = 'warning';
    }

    return [
        'status' => $status,
        'details' => [
            'http_status' => $httpCode,
            'response_time_ms' => $responseTimeMs,
            'error' => null
        ]
    ];
}

/**
 * Update monitor record with check results
 */
function updateMonitor($pdo, $monitor, $result) {
    $nextCheck = date('Y-m-d H:i:s', time() + intval($monitor['check_interval']));
    $details = json_encode($result['details']);

    $stmt = $pdo->prepare("UPDATE pwa_monitors SET status = ?, last_checked = NOW(), next_check = ?, details = ? WHERE id = ?");
    $stmt->execute([$result['status'], $nextCheck, $details, $monitor['id']]);
}

/**
 * Determine if an alert notification should be sent
 */
function shouldAlert($monitor, $result) {
    // Only alert on warning or critical
    if ($result['status'] !== 'warning' && $result['status'] !== 'critical') {
        return false;
    }

    // Check alert threshold for domain/ssl
    if ($monitor['type'] === 'domain' || $monitor['type'] === 'ssl') {
        $daysRemaining = $result['details']['days_remaining'] ?? null;
        if ($daysRemaining === null) return false;
        if ($daysRemaining > intval($monitor['alert_days'])) return false;
    }

    // Check cooldown
    if ($monitor['last_alert_sent']) {
        $lastAlert = strtotime($monitor['last_alert_sent']);
        $cooldown = intval($monitor['alert_cooldown']);
        if ((time() - $lastAlert) < $cooldown) {
            return false;
        }
    }

    return true;
}

/**
 * Get alert notification title
 */
function getAlertTitle($monitor, $result) {
    $prefix = ($result['status'] === 'critical') ? 'CRITICAL' : 'Warning';
    switch ($monitor['type']) {
        case 'domain':
            return "$prefix: Domain Expiring";
        case 'ssl':
            return "$prefix: SSL Certificate Expiring";
        case 'uptime':
            return "$prefix: Site Down";
        default:
            return "$prefix: Monitor Alert";
    }
}

/**
 * Get alert notification body
 */
function getAlertBody($monitor, $result) {
    $target = $monitor['label'] ?: $monitor['target'];
    switch ($monitor['type']) {
        case 'domain':
            $days = $result['details']['days_remaining'] ?? '?';
            return "{$target} expires in {$days} days";
        case 'ssl':
            $days = $result['details']['days_remaining'] ?? '?';
            return "SSL for {$target} expires in {$days} days";
        case 'uptime':
            $error = $result['details']['error'] ?? "HTTP {$result['details']['http_status']}";
            return "{$target} is down: {$error}";
        default:
            return "{$target}: {$result['status']}";
    }
}
