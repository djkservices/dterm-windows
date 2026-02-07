<?php
/**
 * dTerm Admin Panel
 * Central admin for managing dTerm: Messages, Backups
 */

require_once __DIR__ . '/../../config/init.php';

Auth::requireAdmin();

$pdo = getDbConnection();

// ============================================================
// MESSAGES - Data & Actions
// ============================================================

$pdo->exec("CREATE TABLE IF NOT EXISTS dterm_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    username VARCHAR(100),
    subject ENUM('Bug','Idea') NOT NULL,
    message TEXT NOT NULL,
    admin_reply TEXT DEFAULT NULL,
    replied_at DATETIME DEFAULT NULL,
    is_read TINYINT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$msgError = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && Csrf::validatePost()) {
    $action = $_POST['action'] ?? '';
    $section = $_POST['section'] ?? '';

    // --- Message actions ---
    if ($section === 'messages') {
        switch ($action) {
            case 'reply':
                $msgId = (int)($_POST['msg_id'] ?? 0);
                $reply = trim($_POST['admin_reply'] ?? '');
                if ($msgId && $reply !== '') {
                    $stmt = $pdo->prepare("UPDATE dterm_messages SET admin_reply = ?, replied_at = NOW(), is_read = 0 WHERE id = ?");
                    $stmt->execute([$reply, $msgId]);
                    setFlash('success', 'Reply sent successfully.');
                } else {
                    setFlash('error', 'Please provide a reply.');
                }
                redirect($_SERVER['REQUEST_URI']);
                break;

            case 'delete':
                $msgId = (int)($_POST['msg_id'] ?? 0);
                if ($msgId) {
                    $stmt = $pdo->prepare("DELETE FROM dterm_messages WHERE id = ?");
                    $stmt->execute([$msgId]);
                    setFlash('success', 'Message deleted.');
                }
                redirect($_SERVER['REQUEST_URI']);
                break;
        }
    }

    // --- Backup actions ---
    if ($section === 'backups') {
        $backupDir = realpath(__DIR__ . '/../../../..') . '/backups/dterm';

        switch ($action) {
            case 'delete_backup':
                $file = basename($_POST['file'] ?? '');
                if ($file && preg_match('/^dterm-backup-.*\.tar\.gz$/', $file)) {
                    $filePath = $backupDir . '/' . $file;
                    if (file_exists($filePath)) {
                        unlink($filePath);
                        setFlash('success', 'Deleted: ' . $file);
                    } else {
                        setFlash('error', 'File not found.');
                    }
                }
                redirect($_SERVER['REQUEST_URI']);
                break;

            case 'delete_selected':
                $files = $_POST['files'] ?? [];
                $deleted = 0;
                foreach ($files as $file) {
                    $file = basename($file);
                    if ($file && preg_match('/^dterm-backup-.*\.tar\.gz$/', $file)) {
                        $filePath = $backupDir . '/' . $file;
                        if (file_exists($filePath)) {
                            unlink($filePath);
                            $deleted++;
                        }
                    }
                }
                if ($deleted > 0) {
                    setFlash('success', "Deleted $deleted backup(s).");
                }
                redirect($_SERVER['REQUEST_URI']);
                break;
        }
    }
}

// --- Backup download ---
if (isset($_GET['download'])) {
    $backupDir = realpath(__DIR__ . '/../../../..') . '/backups/dterm';
    $file = basename($_GET['download']);
    if ($file && preg_match('/^dterm-backup-.*\.tar\.gz$/', $file)) {
        $filePath = $backupDir . '/' . $file;
        if (file_exists($filePath)) {
            header('Content-Type: application/gzip');
            header('Content-Disposition: attachment; filename="' . $file . '"');
            header('Content-Length: ' . filesize($filePath));
            readfile($filePath);
            exit;
        }
    }
    setFlash('error', 'File not found.');
    redirect(strtok($_SERVER['REQUEST_URI'], '?'));
}

// ============================================================
// Fetch data for both sections
// ============================================================

// Messages
$messages = $pdo->query("SELECT * FROM dterm_messages ORDER BY created_at DESC")->fetchAll(PDO::FETCH_ASSOC);
$totalMessages = count($messages);
$unreadCount = 0;
$repliedCount = 0;
foreach ($messages as $m) {
    if ($m['admin_reply'] === null) $unreadCount++;
    else $repliedCount++;
}

// Backups
$backupDir = realpath(__DIR__ . '/../../../..') . '/backups/dterm';
$backups = [];
$totalSize = 0;
$versions = [];

if (is_dir($backupDir)) {
    $files = glob($backupDir . '/dterm-backup-*.tar.gz');
    foreach ($files as $filePath) {
        $name = basename($filePath);
        $size = filesize($filePath);
        $modified = filemtime($filePath);
        $totalSize += $size;

        $version = '';
        $date = '';
        if (preg_match('/dterm-backup-v([\d.]+)-(\d{8}-\d{6})/', $name, $m2)) {
            $version = $m2[1];
            $dt = DateTime::createFromFormat('Ymd-His', $m2[2]);
            $date = $dt ? $dt->format('M j, Y g:i A') : $m2[2];
        }

        $backups[] = [
            'name' => $name,
            'size' => $size,
            'modified' => $modified,
            'version' => $version,
            'date' => $date,
        ];
    }
    usort($backups, function($a, $b) { return $b['modified'] - $a['modified']; });

    foreach ($backups as $b) {
        $v = $b['version'] ?: 'Unknown';
        if (!isset($versions[$v])) $versions[$v] = 0;
        $versions[$v]++;
    }
}

$totalBackups = count($backups);

function formatBytes($bytes) {
    if ($bytes >= 1073741824) return number_format($bytes / 1073741824, 2) . ' GB';
    if ($bytes >= 1048576) return number_format($bytes / 1048576, 1) . ' MB';
    if ($bytes >= 1024) return number_format($bytes / 1024, 1) . ' KB';
    return $bytes . ' B';
}

// Current tab
$tab = $_GET['tab'] ?? 'messages';
if (!in_array($tab, ['messages', 'backups'])) $tab = 'messages';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>dTerm Admin - <?php echo h(APP_NAME); ?></title>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Open+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/assets/css/style.css?v=<?php echo defined('ASSET_VERSION') ? ASSET_VERSION : time(); ?>">
    <style>
        :root {
            --bg-light: #ffffff;
            --bg-section: #f5f5f5;
            --bg-card: #ffffff;
            --bg-input: #f0f2f5;
            --primary: #1a3a5c;
            --primary-light: #2a5a8c;
            --accent: #c8a415;
            --accent-hover: #d4b020;
            --accent-dim: rgba(200,164,21,0.1);
            --text-dark: #1a1a1a;
            --text-body: #444444;
            --text-muted: #777777;
            --border: #e0e0e0;
            --border-light: #eeeeee;
            --danger: #e74c3c;
            --danger-hover: #c0392b;
            --success: #27ae60;
            --info: #2980b9;
            --radius: 8px;
            --shadow: 0 2px 20px rgba(0,0,0,0.06);
            --shadow-hover: 0 8px 30px rgba(0,0,0,0.12);
            --font-heading: 'Montserrat', sans-serif;
            --font-body: 'Open Sans', Arial, sans-serif;
        }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: var(--font-body); background: var(--bg-section); color: var(--text-body); line-height: 1.6; }

        /* ---- Admin Header / Nav ---- */
        .admin-header {
            background: var(--primary);
            color: #fff;
            padding: 0 2rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            height: 56px;
            position: sticky;
            top: 0;
            z-index: 100;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        .admin-header .logo {
            font-family: var(--font-heading);
            font-size: 1.1rem;
            font-weight: 800;
            letter-spacing: .5px;
            display: flex;
            align-items: center;
            gap: .6rem;
        }
        .admin-header .logo .logo-icon {
            background: var(--accent);
            color: var(--primary);
            width: 32px;
            height: 32px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1rem;
            font-weight: 800;
        }
        .admin-header .header-right {
            display: flex;
            align-items: center;
            gap: 1rem;
        }
        .admin-header .header-right a {
            color: rgba(255,255,255,0.7);
            text-decoration: none;
            font-size: .82rem;
            font-weight: 600;
            transition: color .2s;
        }
        .admin-header .header-right a:hover { color: #fff; }

        /* ---- Nav bar with dropdown ---- */
        .admin-nav {
            background: #fff;
            border-bottom: 1px solid var(--border);
            padding: 0 2rem;
            display: flex;
            align-items: center;
            height: 48px;
            gap: .25rem;
        }
        .nav-item {
            position: relative;
        }
        .nav-btn {
            font-family: var(--font-heading);
            font-size: .8rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: .5px;
            color: var(--text-muted);
            background: none;
            border: none;
            padding: .75rem 1rem;
            cursor: pointer;
            transition: all .2s;
            display: flex;
            align-items: center;
            gap: .35rem;
            border-bottom: 2px solid transparent;
            margin-bottom: -1px;
        }
        .nav-btn:hover { color: var(--primary); }
        .nav-btn.active {
            color: var(--primary);
            border-bottom-color: var(--accent);
        }
        .nav-btn .arrow { font-size: .6rem; transition: transform .2s; }
        .nav-item:hover .arrow { transform: rotate(180deg); }

        /* Dropdown */
        .nav-dropdown {
            display: none;
            position: absolute;
            top: 100%;
            left: 0;
            background: #fff;
            border: 1px solid var(--border);
            border-radius: var(--radius);
            box-shadow: 0 8px 24px rgba(0,0,0,0.12);
            min-width: 200px;
            padding: .4rem 0;
            z-index: 200;
        }
        .nav-item:hover .nav-dropdown { display: block; }
        .nav-dropdown a {
            display: flex;
            align-items: center;
            gap: .6rem;
            padding: .65rem 1.1rem;
            color: var(--text-body);
            text-decoration: none;
            font-size: .88rem;
            font-weight: 500;
            transition: all .15s;
        }
        .nav-dropdown a:hover {
            background: var(--accent-dim);
            color: var(--primary);
        }
        .nav-dropdown a.active {
            background: var(--accent-dim);
            color: var(--primary);
            font-weight: 700;
        }
        .nav-dropdown .dd-icon {
            width: 20px;
            text-align: center;
            font-size: .95rem;
        }
        .nav-dropdown .dd-badge {
            margin-left: auto;
            background: var(--danger);
            color: #fff;
            font-size: .68rem;
            font-weight: 700;
            padding: 1px 7px;
            border-radius: 10px;
        }

        /* ---- Content ---- */
        .admin-main { padding: 2rem; max-width: 1200px; margin: 0 auto; }

        .card { background: var(--bg-card); border: 1px solid var(--border); border-top: 3px solid var(--accent); border-radius: var(--radius); padding: 2rem; box-shadow: var(--shadow); margin-bottom: 1.5rem; }
        .card h2 { font-family: var(--font-heading); color: var(--primary); font-size: 1.3rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 1.5rem; padding-bottom: .75rem; border-bottom: 1px solid var(--border-light); }

        .btn { display: inline-flex; align-items: center; justify-content: center; padding: .6rem 1.25rem; font-size: .85rem; font-weight: 700; border: none; border-radius: 6px; cursor: pointer; text-decoration: none; transition: all .2s; font-family: inherit; gap: .4rem; text-transform: uppercase; letter-spacing: .5px; }
        .btn-primary { background: var(--accent); color: #fff; }
        .btn-primary:hover { background: var(--accent-hover); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(200,164,21,0.3); }
        .btn-danger { background: var(--danger); color: #fff; }
        .btn-danger:hover { background: var(--danger-hover); }
        .btn-outline { background: transparent; color: var(--primary); border: 1px solid var(--primary); }
        .btn-outline:hover { background: var(--primary); color: #fff; }
        .btn-sm { padding: .35rem .85rem; font-size: .78rem; }
        .btn-icon { padding: .35rem .5rem; min-width: 32px; }

        .badge { display: inline-block; padding: 2px 10px; border-radius: 10px; font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .3px; }
        .badge-danger { background: #fdecea; color: var(--danger); }
        .badge-info { background: #e8f4fd; color: var(--info); }
        .badge-success { background: #eafaf1; color: var(--success); }
        .badge-warning { background: #fef9e7; color: #b7950b; }

        .stats-row { display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
        .stat-card { flex: 1; min-width: 150px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.25rem; text-align: center; }
        .stat-card .stat-value { font-family: var(--font-heading); font-size: 2rem; font-weight: 800; color: var(--primary); }
        .stat-card .stat-label { font-size: .78rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: .5px; font-weight: 600; }

        .table { width: 100%; border-collapse: collapse; }
        .table th, .table td { padding: .75rem 1rem; text-align: left; border-bottom: 1px solid var(--border-light); font-size: .88rem; }
        .table th { background: var(--bg-section); color: var(--primary); font-family: var(--font-heading); font-size: .78rem; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; }
        .table tr:hover { background: rgba(200,164,21,0.03); }
        .table tr.pending { border-left: 3px solid var(--accent); }
        .table .cb-col { width: 40px; text-align: center; }

        .msg-detail-panel { display: none; background: var(--bg-section); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.5rem; margin: .5rem 0 1rem; }
        .msg-detail-panel.open { display: block; }
        .msg-full-text { background: var(--bg-light); padding: 1rem; border-radius: 6px; border-left: 3px solid var(--accent); white-space: pre-wrap; line-height: 1.7; color: var(--text-body); margin: .75rem 0; }
        .msg-reply-text { background: #eafaf1; padding: 1rem; border-radius: 6px; border-left: 3px solid var(--success); white-space: pre-wrap; line-height: 1.7; color: var(--text-body); margin: .75rem 0; }
        .msg-detail-row { margin-bottom: .5rem; font-size: .9rem; }
        .msg-detail-row strong { color: var(--primary); display: inline-block; min-width: 100px; }

        textarea { width: 100%; padding: .65rem .85rem; background: var(--bg-input); border: 1px solid var(--border); border-radius: 6px; color: var(--text-dark); font-size: .9rem; font-family: inherit; resize: vertical; }
        textarea:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 2px rgba(200,164,21,.12); }

        .alert { padding: .75rem 1.25rem; border-radius: var(--radius); font-size: .9rem; font-weight: 500; margin-bottom: 1rem; }
        .alert-success { background: #f0fdf4; border: 1px solid var(--success); color: var(--success); }
        .alert-error { background: #fef2f2; border: 1px solid var(--danger); color: var(--danger); }

        .empty-state { text-align: center; padding: 3rem; color: var(--text-muted); }

        .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: .5rem; }
        .toolbar-left { display: flex; align-items: center; gap: .75rem; }
        .toolbar-right { display: flex; align-items: center; gap: .5rem; }

        .filter-select { padding: .4rem .75rem; font-size: .85rem; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-input); color: var(--text-body); font-family: inherit; cursor: pointer; }
        .filter-select:focus { outline: none; border-color: var(--accent); }

        .size-text { font-family: 'SF Mono', 'Fira Code', monospace; font-size: .82rem; color: var(--text-muted); }

        .page-title {
            font-family: var(--font-heading);
            color: var(--primary);
            font-size: 1.5rem;
            font-weight: 800;
            margin-bottom: 1.5rem;
            display: flex;
            align-items: center;
            gap: .6rem;
        }
        .page-title .title-icon {
            font-size: 1.3rem;
        }

        @media (max-width: 768px) {
            .admin-header { padding: 0 1rem; }
            .admin-nav { padding: 0 1rem; overflow-x: auto; }
            .admin-main { padding: 1rem; }
            .card { padding: 1.25rem; }
            .stats-row { flex-direction: column; }
            .table { font-size: .8rem; }
            .table th, .table td { padding: .5rem .65rem; }
            .toolbar { flex-direction: column; align-items: stretch; }
        }
    </style>
</head>
<body>

    <!-- ===== Header ===== -->
    <header class="admin-header">
        <div class="logo">
            <div class="logo-icon">d</div>
            dTerm Admin
        </div>
        <div class="header-right">
            <a href="/admin/">Site Admin</a>
            <a href="/admin/logout.php">Logout</a>
        </div>
    </header>

    <!-- ===== Navigation ===== -->
    <nav class="admin-nav">
        <div class="nav-item">
            <button class="nav-btn active">
                Software <span class="arrow">&#9660;</span>
            </button>
            <div class="nav-dropdown">
                <a href="/dterm/admin/" class="<?php echo $tab === 'messages' ? 'active' : ''; ?>">
                    <span class="dd-icon">&#9002;</span>
                    dTerm
                    <?php if ($unreadCount > 0): ?>
                        <span class="dd-badge"><?php echo $unreadCount; ?></span>
                    <?php endif; ?>
                </a>
                <a href="?tab=backups" class="<?php echo $tab === 'backups' ? 'active' : ''; ?>">
                    <span class="dd-icon">&#128190;</span>
                    File Backup
                    <span style="margin-left: auto; font-size: .75rem; color: var(--text-muted);"><?php echo $totalBackups; ?></span>
                </a>
            </div>
        </div>
    </nav>

    <!-- ===== Main Content ===== -->
    <main class="admin-main">

        <?php displayFlash(); ?>

        <?php if ($tab === 'messages'): ?>
        <!-- ============================================================ -->
        <!-- MESSAGES TAB -->
        <!-- ============================================================ -->
        <div class="page-title">
            <span class="title-icon">&#9993;</span> Messages
        </div>

        <div class="stats-row">
            <div class="stat-card">
                <div class="stat-value"><?php echo $totalMessages; ?></div>
                <div class="stat-label">Total Messages</div>
            </div>
            <div class="stat-card">
                <div class="stat-value"><?php echo $unreadCount; ?></div>
                <div class="stat-label">Unread (No Reply)</div>
            </div>
            <div class="stat-card">
                <div class="stat-value"><?php echo $repliedCount; ?></div>
                <div class="stat-label">Replied</div>
            </div>
        </div>

        <div class="card">
            <h2>All Messages</h2>

            <?php if (empty($messages)): ?>
                <div class="empty-state">
                    <p>No messages yet. Bug reports and ideas from dTerm users will appear here.</p>
                </div>
            <?php else: ?>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Username</th>
                            <th>Subject</th>
                            <th>Message</th>
                            <th>Date</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($messages as $msg): ?>
                            <?php
                                $isPending = $msg['admin_reply'] === null;
                                $truncated = mb_strlen($msg['message']) > 100
                                    ? mb_substr($msg['message'], 0, 100) . '...'
                                    : $msg['message'];
                            ?>
                            <tr class="<?php echo $isPending ? 'pending' : ''; ?>" style="cursor: pointer;" onclick="toggleDetail(<?php echo (int)$msg['id']; ?>)">
                                <td><?php echo h($msg['username'] ?? 'Unknown'); ?></td>
                                <td>
                                    <?php if ($msg['subject'] === 'Bug'): ?>
                                        <span class="badge badge-danger">Bug</span>
                                    <?php else: ?>
                                        <span class="badge badge-info">Idea</span>
                                    <?php endif; ?>
                                </td>
                                <td><?php echo h($truncated); ?></td>
                                <td><?php echo h(formatDate($msg['created_at'])); ?></td>
                                <td>
                                    <?php if ($isPending): ?>
                                        <span class="badge badge-warning">Pending</span>
                                    <?php else: ?>
                                        <span class="badge badge-success">Replied</span>
                                    <?php endif; ?>
                                </td>
                                <td>
                                    <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); toggleDetail(<?php echo (int)$msg['id']; ?>)">View</button>
                                </td>
                            </tr>
                            <tr>
                                <td colspan="6" style="padding: 0; border: none;">
                                    <div class="msg-detail-panel" id="detail-<?php echo (int)$msg['id']; ?>">
                                        <div class="msg-detail-row"><strong>Username:</strong> <?php echo h($msg['username'] ?? 'Unknown'); ?></div>
                                        <div class="msg-detail-row"><strong>User ID:</strong> <?php echo (int)$msg['user_id']; ?></div>
                                        <div class="msg-detail-row">
                                            <strong>Subject:</strong>
                                            <?php if ($msg['subject'] === 'Bug'): ?>
                                                <span class="badge badge-danger">Bug</span>
                                            <?php else: ?>
                                                <span class="badge badge-info">Idea</span>
                                            <?php endif; ?>
                                        </div>
                                        <div class="msg-detail-row"><strong>Sent:</strong> <?php echo h(formatDate($msg['created_at'])); ?></div>

                                        <div style="margin-top: 1rem;">
                                            <strong style="color: var(--primary); font-size: .85rem; text-transform: uppercase; letter-spacing: .3px;">Message:</strong>
                                            <div class="msg-full-text"><?php echo h($msg['message']); ?></div>
                                        </div>

                                        <?php if ($msg['admin_reply']): ?>
                                            <div style="margin-top: 1rem;">
                                                <strong style="color: var(--success); font-size: .85rem; text-transform: uppercase; letter-spacing: .3px;">Admin Reply (<?php echo h(formatDate($msg['replied_at'])); ?>):</strong>
                                                <div class="msg-reply-text"><?php echo h($msg['admin_reply']); ?></div>
                                            </div>
                                        <?php endif; ?>

                                        <!-- Reply Form -->
                                        <div style="margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid var(--border-light);">
                                            <form method="POST" onclick="event.stopPropagation();">
                                                <?php echo Csrf::field(); ?>
                                                <input type="hidden" name="section" value="messages">
                                                <input type="hidden" name="action" value="reply">
                                                <input type="hidden" name="msg_id" value="<?php echo (int)$msg['id']; ?>">
                                                <div style="margin-bottom: .75rem;">
                                                    <label style="display: block; font-size: .78rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: .5px; margin-bottom: .35rem;">
                                                        <?php echo $msg['admin_reply'] ? 'Update Reply' : 'Reply'; ?>
                                                    </label>
                                                    <textarea name="admin_reply" rows="4" placeholder="Type your reply..."><?php echo h($msg['admin_reply'] ?? ''); ?></textarea>
                                                </div>
                                                <button type="submit" class="btn btn-primary btn-sm">
                                                    <?php echo $msg['admin_reply'] ? 'Update Reply' : 'Send Reply'; ?>
                                                </button>
                                            </form>
                                        </div>

                                        <!-- Delete -->
                                        <div style="margin-top: 1rem; padding-top: .75rem; border-top: 1px solid var(--border-light);">
                                            <form method="POST" onclick="event.stopPropagation();" onsubmit="return confirm('Delete this message? This cannot be undone.');">
                                                <?php echo Csrf::field(); ?>
                                                <input type="hidden" name="section" value="messages">
                                                <input type="hidden" name="action" value="delete">
                                                <input type="hidden" name="msg_id" value="<?php echo (int)$msg['id']; ?>">
                                                <button type="submit" class="btn btn-danger btn-sm">Delete Message</button>
                                            </form>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            <?php endif; ?>
        </div>

        <?php elseif ($tab === 'backups'): ?>
        <!-- ============================================================ -->
        <!-- BACKUPS TAB -->
        <!-- ============================================================ -->
        <div class="page-title">
            <span class="title-icon">&#128190;</span> Source Backups
        </div>

        <div class="stats-row">
            <div class="stat-card">
                <div class="stat-value"><?php echo $totalBackups; ?></div>
                <div class="stat-label">Total Backups</div>
            </div>
            <div class="stat-card">
                <div class="stat-value"><?php echo formatBytes($totalSize); ?></div>
                <div class="stat-label">Total Size</div>
            </div>
            <div class="stat-card">
                <div class="stat-value"><?php echo count($versions); ?></div>
                <div class="stat-label">Versions</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" style="font-size: <?php echo $totalBackups > 0 ? '1rem' : '2rem'; ?>;"><?php echo $totalBackups > 0 ? $backups[0]['date'] : 'N/A'; ?></div>
                <div class="stat-label">Latest Backup</div>
            </div>
        </div>

        <div class="card">
            <h2>Backup Files</h2>

            <?php if (empty($backups)): ?>
                <div class="empty-state">
                    <p>No backups found. Backups are created automatically when dTerm launches.</p>
                </div>
            <?php else: ?>
                <form method="POST" id="bulkForm">
                    <?php echo Csrf::field(); ?>
                    <input type="hidden" name="section" value="backups">
                    <input type="hidden" name="action" value="delete_selected">

                    <div class="toolbar">
                        <div class="toolbar-left">
                            <label style="font-size: .85rem; cursor: pointer;">
                                <input type="checkbox" id="selectAll" onchange="toggleSelectAll(this)" style="margin-right: .35rem;">
                                Select All
                            </label>
                            <button type="submit" class="btn btn-danger btn-sm" id="deleteSelectedBtn" style="display: none;" onclick="return confirm('Delete selected backups? This cannot be undone.');">
                                Delete Selected
                            </button>
                        </div>
                        <div class="toolbar-right">
                            <label style="font-size: .8rem; color: var(--text-muted); font-weight: 600;">Version:</label>
                            <select class="filter-select" id="versionFilter" onchange="filterByVersion(this.value)">
                                <option value="">All</option>
                                <?php foreach ($versions as $v => $count): ?>
                                    <option value="<?php echo h($v); ?>">v<?php echo h($v); ?> (<?php echo $count; ?>)</option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                    </div>

                    <table class="table" id="backupsTable">
                        <thead>
                            <tr>
                                <th class="cb-col"></th>
                                <th>Filename</th>
                                <th>Version</th>
                                <th>Date</th>
                                <th>Size</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($backups as $b): ?>
                                <tr data-version="<?php echo h($b['version']); ?>">
                                    <td class="cb-col">
                                        <input type="checkbox" name="files[]" value="<?php echo h($b['name']); ?>" class="file-cb" onchange="updateBulkBtn()">
                                    </td>
                                    <td style="font-family: 'SF Mono', 'Fira Code', monospace; font-size: .82rem;">
                                        <?php echo h($b['name']); ?>
                                    </td>
                                    <td><span class="badge badge-info">v<?php echo h($b['version']); ?></span></td>
                                    <td><?php echo h($b['date']); ?></td>
                                    <td class="size-text"><?php echo formatBytes($b['size']); ?></td>
                                    <td style="white-space: nowrap;">
                                        <a href="?tab=backups&download=<?php echo urlencode($b['name']); ?>" class="btn btn-primary btn-sm btn-icon" title="Download">&#8595;</a>
                                        <button type="button" class="btn btn-danger btn-sm btn-icon" title="Delete"
                                            onclick="if(confirm('Delete <?php echo h($b['name']); ?>?')) { deleteSingleFile('<?php echo h($b['name']); ?>'); }">&#10005;</button>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </form>

                <!-- Hidden single-delete form -->
                <form method="POST" id="singleDeleteForm" style="display: none;">
                    <?php echo Csrf::field(); ?>
                    <input type="hidden" name="section" value="backups">
                    <input type="hidden" name="action" value="delete_backup">
                    <input type="hidden" name="file" id="singleDeleteFile">
                </form>
            <?php endif; ?>
        </div>

        <?php endif; ?>

    </main>

    <script>
    // Messages
    function toggleDetail(id) {
        var panel = document.getElementById('detail-' + id);
        if (!panel) return;
        document.querySelectorAll('.msg-detail-panel.open').forEach(function(el) {
            if (el.id !== 'detail-' + id) el.classList.remove('open');
        });
        panel.classList.toggle('open');
    }

    // Backups
    function toggleSelectAll(el) {
        document.querySelectorAll('.file-cb').forEach(function(cb) {
            if (cb.closest('tr').style.display !== 'none') cb.checked = el.checked;
        });
        updateBulkBtn();
    }

    function updateBulkBtn() {
        var checked = document.querySelectorAll('.file-cb:checked').length;
        var btn = document.getElementById('deleteSelectedBtn');
        if (btn) {
            btn.style.display = checked > 0 ? '' : 'none';
            btn.textContent = 'Delete Selected (' + checked + ')';
        }
    }

    function filterByVersion(version) {
        document.querySelectorAll('#backupsTable tbody tr').forEach(function(row) {
            row.style.display = (!version || row.dataset.version === version) ? '' : 'none';
            if (row.style.display === 'none') {
                var cb = row.querySelector('.file-cb');
                if (cb) cb.checked = false;
            }
        });
        var sa = document.getElementById('selectAll');
        if (sa) sa.checked = false;
        updateBulkBtn();
    }

    function deleteSingleFile(name) {
        document.getElementById('singleDeleteFile').value = name;
        document.getElementById('singleDeleteForm').submit();
    }
    </script>
</body>
</html>
