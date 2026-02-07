<?php
/**
 * dTerm Tools Proxy API
 *
 * Executes system commands on behalf of the PWA tools.
 * Deployed to: public_html/dterm/api/tools-proxy.php
 *
 * Accepts POST requests with JSON body:
 *   { "token": "auth_token", "tool": "tool_name", ...params }
 *
 * Returns JSON:
 *   { "success": true, "output": "..." }
 *   { "error": "..." }
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle CORS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Require POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'POST required']);
    exit;
}

// Parse JSON body
$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !isset($input['tool']) || !isset($input['token'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required parameters: tool, token']);
    exit;
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

function validateToken(string $token): bool {
    $config = require __DIR__ . '/config.php';
    try {
        $db = new PDO(
            'mysql:host=localhost;dbname=' . $config['db_name'],
            $config['db_user'],
            $config['db_pass'],
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
        );
        $stmt = $db->prepare('SELECT id FROM users WHERE token = ? LIMIT 1');
        $stmt->execute([$token]);
        return $stmt->fetch() !== false;
    } catch (PDOException $e) {
        error_log('dTerm tools-proxy DB error: ' . $e->getMessage());
        return false;
    }
}

if (!validateToken($input['token'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Invalid or expired token']);
    exit;
}

// ---------------------------------------------------------------------------
// Input Validation Helpers
// ---------------------------------------------------------------------------

/**
 * Validate a hostname or IP address.
 * Allows alphanumeric, dots, hyphens, underscores, and colons (IPv6).
 */
function validateHost(string $host): bool {
    return (bool) preg_match('/^[a-zA-Z0-9.:_-]+$/', $host) && strlen($host) <= 253;
}

/**
 * Validate an IPv4 address.
 */
function validateIPv4(string $ip): bool {
    return filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) !== false;
}

/**
 * Validate an IP address (v4 or v6).
 */
function validateIP(string $ip): bool {
    return filter_var($ip, FILTER_VALIDATE_IP) !== false;
}

/**
 * Validate a URL.
 */
function validateUrl(string $url): bool {
    return filter_var($url, FILTER_VALIDATE_URL) !== false
        && preg_match('#^https?://#i', $url);
}

/**
 * Validate a port number.
 */
function validatePort(int $port): bool {
    return $port >= 1 && $port <= 65535;
}

/**
 * Validate a MAC address (common formats).
 */
function validateMac(string $mac): bool {
    return (bool) preg_match('/^([0-9A-Fa-f]{2}[:\-.]){5}[0-9A-Fa-f]{2}$/', $mac);
}

/**
 * Return a required string parameter or send an error and exit.
 */
function requireParam(array $input, string $key, string $label = null): string {
    $label = $label ?? $key;
    if (!isset($input[$key]) || trim((string) $input[$key]) === '') {
        http_response_code(400);
        echo json_encode(['error' => "Missing required parameter: {$label}"]);
        exit;
    }
    return trim((string) $input[$key]);
}

/**
 * Send a success response and exit.
 */
function respond(string $output, array $extra = []): void {
    echo json_encode(array_merge(['success' => true, 'output' => $output], $extra));
    exit;
}

/**
 * Send an error response and exit.
 */
function respondError(string $message, int $code = 400): void {
    http_response_code($code);
    echo json_encode(['error' => $message]);
    exit;
}

/**
 * Execute a shell command and return the combined output.
 */
function execCommand(string $cmd): string {
    $output = [];
    $exitCode = 0;
    exec($cmd . ' 2>&1', $output, $exitCode);
    return implode("\n", $output);
}

// ---------------------------------------------------------------------------
// Allowed DNS record types
// ---------------------------------------------------------------------------
$ALLOWED_DNS_TYPES = ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME', 'SOA', 'ANY', 'PTR', 'SRV', 'CAA'];

// ---------------------------------------------------------------------------
// Allowed HTTP methods for API tester
// ---------------------------------------------------------------------------
$ALLOWED_HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

// ---------------------------------------------------------------------------
// Common DNSBL servers for blacklist checks
// ---------------------------------------------------------------------------
$DNSBL_SERVERS = [
    'zen.spamhaus.org',
    'bl.spamcop.net',
    'b.barracudacentral.org',
    'dnsbl.sorbs.net',
    'spam.dnsbl.sorbs.net',
    'dul.dnsbl.sorbs.net',
    'combined.abuse.ch',
    'dnsbl-1.uceprotect.net',
    'dnsbl-2.uceprotect.net',
    'dnsbl-3.uceprotect.net',
    'psbl.surriel.com',
    'dyna.spamrats.com',
    'noptr.spamrats.com',
    'bl.blocklist.de',
    'all.s5h.net',
];

// ---------------------------------------------------------------------------
// Tool Router
// ---------------------------------------------------------------------------

$tool = strtolower(trim($input['tool']));

switch ($tool) {

    // -----------------------------------------------------------------------
    // 1. Ping
    // -----------------------------------------------------------------------
    case 'ping':
        $host = requireParam($input, 'host');
        if (!validateHost($host)) {
            respondError('Invalid hostname or IP address');
        }
        $count = isset($input['count']) ? (int) $input['count'] : 4;
        $count = max(1, min(20, $count));

        $cmd = sprintf(
            'timeout 10 ping -c %d %s',
            $count,
            escapeshellarg($host)
        );
        respond(execCommand($cmd));
        break;

    // -----------------------------------------------------------------------
    // 2. Traceroute
    // -----------------------------------------------------------------------
    case 'traceroute':
        $host = requireParam($input, 'host');
        if (!validateHost($host)) {
            respondError('Invalid hostname or IP address');
        }
        $maxHops = isset($input['maxHops']) ? (int) $input['maxHops'] : 20;
        $maxHops = max(1, min(30, $maxHops));

        $cmd = sprintf(
            'timeout 30 traceroute -m %d %s',
            $maxHops,
            escapeshellarg($host)
        );
        respond(execCommand($cmd));
        break;

    // -----------------------------------------------------------------------
    // 3. DNS Lookup
    // -----------------------------------------------------------------------
    case 'dns':
        $host = requireParam($input, 'host');
        if (!validateHost($host)) {
            respondError('Invalid hostname');
        }
        $type = isset($input['type']) ? strtoupper(trim($input['type'])) : 'A';
        if (!in_array($type, $ALLOWED_DNS_TYPES, true)) {
            respondError('Invalid DNS record type. Allowed: ' . implode(', ', $ALLOWED_DNS_TYPES));
        }

        $cmd = sprintf(
            'dig %s %s +noall +answer',
            escapeshellarg($host),
            escapeshellarg($type)
        );
        respond(execCommand($cmd));
        break;

    // -----------------------------------------------------------------------
    // 4. Reverse DNS
    // -----------------------------------------------------------------------
    case 'reverse-dns':
        $ip = requireParam($input, 'ip');
        if (!validateIP($ip)) {
            respondError('Invalid IP address');
        }

        $cmd = sprintf('dig -x %s +noall +answer', escapeshellarg($ip));
        respond(execCommand($cmd));
        break;

    // -----------------------------------------------------------------------
    // 5. Port Scan
    // -----------------------------------------------------------------------
    case 'port-scan':
        $host = requireParam($input, 'host');
        if (!validateHost($host)) {
            respondError('Invalid hostname or IP address');
        }

        $ports = isset($input['ports']) ? $input['ports'] : [];
        if (!is_array($ports) || empty($ports)) {
            respondError('Missing or invalid ports array');
        }
        // Limit to 100 ports max
        $ports = array_slice($ports, 0, 100);

        $results = [];
        foreach ($ports as $port) {
            $port = (int) $port;
            if (!validatePort($port)) {
                $results[] = ['port' => $port, 'status' => 'invalid', 'error' => 'Invalid port number'];
                continue;
            }
            $cmd = sprintf(
                'timeout 3 nc -z -w 2 %s %d',
                escapeshellarg($host),
                $port
            );
            $output = [];
            $exitCode = 0;
            exec($cmd . ' 2>&1', $output, $exitCode);
            $results[] = [
                'port'   => $port,
                'status' => $exitCode === 0 ? 'open' : 'closed',
            ];
        }
        echo json_encode(['success' => true, 'output' => 'Port scan complete', 'data' => $results]);
        exit;

    // -----------------------------------------------------------------------
    // 6. IP Info
    // -----------------------------------------------------------------------
    case 'ip-info':
        $host = isset($input['host']) ? trim($input['host']) : '';
        if ($host !== '' && !validateHost($host)) {
            respondError('Invalid hostname or IP address');
        }

        $apiUrl = $host !== ''
            ? 'http://ip-api.com/json/' . urlencode($host)
            : 'http://ip-api.com/json/';

        $cmd = sprintf('timeout 10 curl -s %s', escapeshellarg($apiUrl));
        $raw = execCommand($cmd);
        $data = json_decode($raw, true);

        echo json_encode([
            'success' => true,
            'output'  => $raw,
            'data'    => $data ?: null,
        ]);
        exit;

    // -----------------------------------------------------------------------
    // 7. WHOIS
    // -----------------------------------------------------------------------
    case 'whois':
        $host = requireParam($input, 'host');
        if (!validateHost($host)) {
            respondError('Invalid hostname');
        }

        $cmd = sprintf('timeout 10 whois %s', escapeshellarg($host));
        respond(execCommand($cmd));
        break;

    // -----------------------------------------------------------------------
    // 8. MAC Lookup
    // -----------------------------------------------------------------------
    case 'mac-lookup':
        $mac = requireParam($input, 'mac');
        if (!validateMac($mac)) {
            respondError('Invalid MAC address format (expected XX:XX:XX:XX:XX:XX)');
        }

        $cmd = sprintf(
            'timeout 10 curl -s %s',
            escapeshellarg('https://api.macvendors.com/' . urlencode($mac))
        );
        respond(execCommand($cmd));
        break;

    // -----------------------------------------------------------------------
    // 9. Blacklist Check (DNSBL)
    // -----------------------------------------------------------------------
    case 'blacklist':
        $ip = requireParam($input, 'ip');
        if (!validateIPv4($ip)) {
            respondError('Invalid IPv4 address');
        }

        // Reverse the IP octets
        $reversed = implode('.', array_reverse(explode('.', $ip)));

        $results = [];
        foreach ($DNSBL_SERVERS as $dnsbl) {
            $query = $reversed . '.' . $dnsbl;
            $cmd = sprintf('dig +short %s', escapeshellarg($query));
            $output = trim(execCommand($cmd));
            $results[] = [
                'dnsbl'  => $dnsbl,
                'listed' => $output !== '' && $output !== ';; connection timed out; no servers could be reached',
                'result' => $output ?: null,
            ];
        }

        echo json_encode([
            'success' => true,
            'output'  => "Checked {$ip} against " . count($DNSBL_SERVERS) . " blacklists",
            'data'    => $results,
        ]);
        exit;

    // -----------------------------------------------------------------------
    // 10. SSL Certificate Check
    // -----------------------------------------------------------------------
    case 'ssl-check':
        $host = requireParam($input, 'host');
        if (!validateHost($host)) {
            respondError('Invalid hostname');
        }
        $port = isset($input['port']) ? (int) $input['port'] : 443;
        if (!validatePort($port)) {
            respondError('Invalid port number');
        }

        $cmd = sprintf(
            'timeout 10 openssl s_client -connect %s:%d -servername %s </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -dates -serial -fingerprint -ext subjectAltName 2>&1',
            escapeshellarg($host),
            $port,
            escapeshellarg($host)
        );
        respond(execCommand($cmd));
        break;

    // -----------------------------------------------------------------------
    // 11. SSL Expiry Check
    // -----------------------------------------------------------------------
    case 'ssl-expiry':
        $host = requireParam($input, 'host');
        if (!validateHost($host)) {
            respondError('Invalid hostname');
        }
        $port = isset($input['port']) ? (int) $input['port'] : 443;
        if (!validatePort($port)) {
            respondError('Invalid port number');
        }

        $cmd = sprintf(
            'timeout 10 openssl s_client -connect %s:%d -servername %s </dev/null 2>/dev/null | openssl x509 -noout -dates 2>&1',
            escapeshellarg($host),
            $port,
            escapeshellarg($host)
        );
        respond(execCommand($cmd));
        break;

    // -----------------------------------------------------------------------
    // 12. Security Headers
    // -----------------------------------------------------------------------
    case 'security-headers':
        $url = requireParam($input, 'url');
        if (!validateUrl($url)) {
            respondError('Invalid URL (must start with http:// or https://)');
        }

        $cmd = sprintf(
            'timeout 10 curl -sI -L --max-redirs 5 %s',
            escapeshellarg($url)
        );
        respond(execCommand($cmd));
        break;

    // -----------------------------------------------------------------------
    // 13. HTTP Headers
    // -----------------------------------------------------------------------
    case 'http-headers':
        $url = requireParam($input, 'url');
        if (!validateUrl($url)) {
            respondError('Invalid URL (must start with http:// or https://)');
        }

        $cmd = sprintf(
            'timeout 10 curl -sI -L --max-redirs 5 %s',
            escapeshellarg($url)
        );
        respond(execCommand($cmd));
        break;

    // -----------------------------------------------------------------------
    // 14. SEO Analysis (fetch HTML)
    // -----------------------------------------------------------------------
    case 'seo':
        $url = requireParam($input, 'url');
        if (!validateUrl($url)) {
            respondError('Invalid URL (must start with http:// or https://)');
        }

        $cmd = sprintf(
            'timeout 15 curl -sL --max-redirs 5 -A %s %s',
            escapeshellarg('Mozilla/5.0 (compatible; dTerm SEO Checker)'),
            escapeshellarg($url)
        );
        respond(execCommand($cmd));
        break;

    // -----------------------------------------------------------------------
    // 15. Page Speed
    // -----------------------------------------------------------------------
    case 'page-speed':
        $url = requireParam($input, 'url');
        if (!validateUrl($url)) {
            respondError('Invalid URL (must start with http:// or https://)');
        }

        $format = 'DNS: %{time_namelookup}s\nConnect: %{time_connect}s\nTLS: %{time_appconnect}s\nFirst Byte: %{time_starttransfer}s\nTotal: %{time_total}s\nSize: %{size_download} bytes\nHTTP Code: %{http_code}\nRedirects: %{num_redirects}';

        $cmd = sprintf(
            'timeout 15 curl -o /dev/null -s -L --max-redirs 5 -w %s %s',
            escapeshellarg($format),
            escapeshellarg($url)
        );
        $raw = execCommand($cmd);

        // Parse into structured data
        $data = [];
        foreach (explode("\n", $raw) as $line) {
            $parts = explode(': ', $line, 2);
            if (count($parts) === 2) {
                $data[trim($parts[0])] = trim($parts[1]);
            }
        }

        echo json_encode(['success' => true, 'output' => $raw, 'data' => $data]);
        exit;

    // -----------------------------------------------------------------------
    // 16. Broken Links Checker
    // -----------------------------------------------------------------------
    case 'broken-links':
        $url = requireParam($input, 'url');
        if (!validateUrl($url)) {
            respondError('Invalid URL (must start with http:// or https://)');
        }

        // Fetch the HTML
        $cmd = sprintf(
            'timeout 15 curl -sL --max-redirs 5 -A %s %s',
            escapeshellarg('Mozilla/5.0 (compatible; dTerm Link Checker)'),
            escapeshellarg($url)
        );
        $html = execCommand($cmd);

        // Extract href links from HTML
        $links = [];
        if (preg_match_all('/href=["\']([^"\']+)["\']/i', $html, $matches)) {
            $links = array_unique($matches[1]);
        }

        // Resolve relative URLs and filter
        $parsedBase = parse_url($url);
        $baseUrl = $parsedBase['scheme'] . '://' . $parsedBase['host'];
        $resolvedLinks = [];

        foreach ($links as $link) {
            $link = trim($link);
            // Skip anchors, javascript, mailto, tel
            if (preg_match('/^(#|javascript:|mailto:|tel:|data:)/i', $link)) {
                continue;
            }
            // Resolve relative URLs
            if (preg_match('#^//#', $link)) {
                $link = $parsedBase['scheme'] . ':' . $link;
            } elseif (preg_match('#^/#', $link)) {
                $link = $baseUrl . $link;
            } elseif (!preg_match('#^https?://#i', $link)) {
                // Relative path
                $path = isset($parsedBase['path']) ? dirname($parsedBase['path']) : '';
                $link = $baseUrl . $path . '/' . $link;
            }
            if (filter_var($link, FILTER_VALIDATE_URL)) {
                $resolvedLinks[] = $link;
            }
        }

        // Limit to 20 links
        $resolvedLinks = array_slice(array_unique($resolvedLinks), 0, 20);

        // Check each link
        $results = [];
        foreach ($resolvedLinks as $checkUrl) {
            $cmd = sprintf(
                'timeout 5 curl -o /dev/null -s -w "%%{http_code}" -L --max-redirs 3 %s',
                escapeshellarg($checkUrl)
            );
            $statusCode = trim(execCommand($cmd));
            $code = (int) $statusCode;
            $results[] = [
                'url'    => $checkUrl,
                'status' => $code,
                'ok'     => $code >= 200 && $code < 400,
            ];
        }

        echo json_encode([
            'success' => true,
            'output'  => 'Checked ' . count($results) . ' links',
            'data'    => $results,
        ]);
        exit;

    // -----------------------------------------------------------------------
    // 17. Open Graph Tags
    // -----------------------------------------------------------------------
    case 'open-graph':
        $url = requireParam($input, 'url');
        if (!validateUrl($url)) {
            respondError('Invalid URL (must start with http:// or https://)');
        }

        $cmd = sprintf(
            'timeout 10 curl -sL --max-redirs 5 -A %s %s',
            escapeshellarg('Mozilla/5.0 (compatible; dTerm OG Checker)'),
            escapeshellarg($url)
        );
        respond(execCommand($cmd));
        break;

    // -----------------------------------------------------------------------
    // 18. Meta Tags
    // -----------------------------------------------------------------------
    case 'meta-tags':
        $url = requireParam($input, 'url');
        if (!validateUrl($url)) {
            respondError('Invalid URL (must start with http:// or https://)');
        }

        $cmd = sprintf(
            'timeout 10 curl -sL --max-redirs 5 -A %s %s',
            escapeshellarg('Mozilla/5.0 (compatible; dTerm Meta Checker)'),
            escapeshellarg($url)
        );
        respond(execCommand($cmd));
        break;

    // -----------------------------------------------------------------------
    // 19. Robots.txt
    // -----------------------------------------------------------------------
    case 'robots':
        $host = requireParam($input, 'host');
        if (!validateHost($host)) {
            respondError('Invalid hostname');
        }
        // Determine the scheme
        $scheme = isset($input['scheme']) ? $input['scheme'] : 'https';
        if (!in_array($scheme, ['http', 'https'], true)) {
            $scheme = 'https';
        }

        $robotsUrl = $scheme . '://' . $host . '/robots.txt';
        $cmd = sprintf(
            'timeout 10 curl -sL --max-redirs 3 %s',
            escapeshellarg($robotsUrl)
        );
        respond(execCommand($cmd));
        break;

    // -----------------------------------------------------------------------
    // 20. Sitemap
    // -----------------------------------------------------------------------
    case 'sitemap':
        $host = requireParam($input, 'host');
        if (!validateHost($host)) {
            respondError('Invalid hostname');
        }
        $scheme = isset($input['scheme']) ? $input['scheme'] : 'https';
        if (!in_array($scheme, ['http', 'https'], true)) {
            $scheme = 'https';
        }

        $baseUrl = $scheme . '://' . $host;
        $candidates = [
            $baseUrl . '/sitemap.xml',
            $baseUrl . '/sitemap_index.xml',
            $baseUrl . '/sitemap/sitemap.xml',
        ];

        $found = false;
        foreach ($candidates as $sitemapUrl) {
            $cmd = sprintf(
                'timeout 10 curl -sL --max-redirs 3 -o /dev/null -w "%%{http_code}" %s',
                escapeshellarg($sitemapUrl)
            );
            $status = trim(execCommand($cmd));
            if ((int) $status >= 200 && (int) $status < 400) {
                $cmd = sprintf(
                    'timeout 10 curl -sL --max-redirs 3 %s',
                    escapeshellarg($sitemapUrl)
                );
                $content = execCommand($cmd);
                echo json_encode([
                    'success' => true,
                    'output'  => $content,
                    'data'    => ['url' => $sitemapUrl, 'status' => (int) $status],
                ]);
                $found = true;
                break;
            }
        }

        if (!$found) {
            echo json_encode([
                'success' => true,
                'output'  => 'No sitemap found',
                'data'    => ['checked' => $candidates],
            ]);
        }
        exit;

    // -----------------------------------------------------------------------
    // 21. Domain Expiry (via WHOIS)
    // -----------------------------------------------------------------------
    case 'domain-expiry':
        $host = requireParam($input, 'host');
        if (!validateHost($host)) {
            respondError('Invalid hostname');
        }

        $cmd = sprintf('timeout 10 whois %s', escapeshellarg($host));
        respond(execCommand($cmd));
        break;

    // -----------------------------------------------------------------------
    // 22. API Tester
    // -----------------------------------------------------------------------
    case 'api-tester':
        $url = requireParam($input, 'url');
        if (!validateUrl($url)) {
            respondError('Invalid URL (must start with http:// or https://)');
        }

        $method = isset($input['method']) ? strtoupper(trim($input['method'])) : 'GET';
        if (!in_array($method, $ALLOWED_HTTP_METHODS, true)) {
            respondError('Invalid HTTP method. Allowed: ' . implode(', ', $ALLOWED_HTTP_METHODS));
        }

        // Build curl command
        $curlParts = ['timeout 15 curl -s'];

        // Response info format
        $curlParts[] = '-w ' . escapeshellarg("\n\n--- Response Info ---\nHTTP Code: %{http_code}\nTime: %{time_total}s\nSize: %{size_download} bytes");

        // Method
        $curlParts[] = '-X ' . escapeshellarg($method);

        // Custom headers
        if (isset($input['headers']) && is_array($input['headers'])) {
            foreach ($input['headers'] as $headerName => $headerValue) {
                // Validate header name/value - no newlines allowed
                $headerName = preg_replace('/[\r\n]/', '', (string) $headerName);
                $headerValue = preg_replace('/[\r\n]/', '', (string) $headerValue);
                if ($headerName !== '' && preg_match('/^[a-zA-Z0-9_-]+$/', $headerName)) {
                    $curlParts[] = '-H ' . escapeshellarg($headerName . ': ' . $headerValue);
                }
            }
        }

        // Request body
        if (isset($input['body']) && $input['body'] !== '' && in_array($method, ['POST', 'PUT', 'PATCH'], true)) {
            $body = (string) $input['body'];
            $curlParts[] = '-d ' . escapeshellarg($body);
        }

        // Include response headers
        $curlParts[] = '-i';

        // Follow redirects
        if (!empty($input['followRedirects'])) {
            $curlParts[] = '-L --max-redirs 5';
        }

        // URL (always last)
        $curlParts[] = escapeshellarg($url);

        $cmd = implode(' ', $curlParts);
        respond(execCommand($cmd));
        break;

    // -----------------------------------------------------------------------
    // 23. Ping Monitor (single ping)
    // -----------------------------------------------------------------------
    case 'ping-monitor':
        $host = requireParam($input, 'host');
        if (!validateHost($host)) {
            respondError('Invalid hostname or IP address');
        }

        $cmd = sprintf(
            'timeout 5 ping -c 1 -W 2 %s',
            escapeshellarg($host)
        );
        $output = [];
        $exitCode = 0;
        exec($cmd . ' 2>&1', $output, $exitCode);
        $raw = implode("\n", $output);

        // Try to extract the round-trip time
        $latency = null;
        if (preg_match('/time[=<]([\d.]+)\s*ms/i', $raw, $m)) {
            $latency = (float) $m[1];
        }

        echo json_encode([
            'success' => true,
            'output'  => $raw,
            'data'    => [
                'alive'   => $exitCode === 0,
                'latency' => $latency,
            ],
        ]);
        exit;

    // -----------------------------------------------------------------------
    // 24. Uptime Monitor
    // -----------------------------------------------------------------------
    case 'uptime-monitor':
        $url = requireParam($input, 'url');
        if (!validateUrl($url)) {
            respondError('Invalid URL (must start with http:// or https://)');
        }

        $cmd = sprintf(
            'timeout 10 curl -o /dev/null -s -L --max-redirs 5 -w "%%{http_code} %%{time_total}" %s',
            escapeshellarg($url)
        );
        $raw = trim(execCommand($cmd));
        $parts = explode(' ', $raw);

        $httpCode = isset($parts[0]) ? (int) $parts[0] : 0;
        $responseTime = isset($parts[1]) ? (float) $parts[1] : 0;

        echo json_encode([
            'success' => true,
            'output'  => $raw,
            'data'    => [
                'httpCode'     => $httpCode,
                'responseTime' => $responseTime,
                'up'           => $httpCode >= 200 && $httpCode < 400,
            ],
        ]);
        exit;

    // -----------------------------------------------------------------------
    // Unknown tool
    // -----------------------------------------------------------------------
    default:
        respondError("Unknown tool: {$tool}", 400);
        break;
}
