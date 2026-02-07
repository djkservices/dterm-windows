const API_BASE = 'https://mynetworktools.com/dterm/api';

async function apiRequest(endpoint, body, timeout = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(`${API_BASE}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    return await res.json();
  } catch (e) {
    if (e.name === 'AbortError') return { error: 'Request timed out' };
    return { error: 'Network error' };
  } finally {
    clearTimeout(timer);
  }
}

const api = {
  auth: {
    login(username, password) {
      return apiRequest('auth.php', { action: 'login', username, password });
    },
    register(username, email, password) {
      return apiRequest('auth.php', { action: 'register', username, email, password });
    },
    validate(token) {
      return apiRequest('auth.php', { action: 'validate', token });
    }
  },

  sync: {
    pullAll(token) {
      return apiRequest('sync.php', { action: 'pull_all', token });
    },
    push(token, dataType, dataJson) {
      return apiRequest('sync.php', { action: 'push', token, data_type: dataType, data_json: dataJson });
    }
  },

  messages: {
    send(token, subject, message) {
      return apiRequest('messages.php', { action: 'send_message', token, subject, message });
    },
    checkReplies(token) {
      return apiRequest('messages.php', { action: 'check_replies', token });
    },
    getMyMessages(token) {
      return apiRequest('messages.php', { action: 'get_my_messages', token });
    }
  },

  broadcast: {
    check(token) {
      return apiRequest('broadcast.php', { action: 'check', token });
    }
  },

  monitors: {
    list(token) {
      return apiRequest('monitors.php', { action: 'list', token });
    },
    add(token, type, target, label, alertDays) {
      return apiRequest('monitors.php', { action: 'add', token, type, target, label, alert_days: alertDays });
    },
    delete(token, monitorId) {
      return apiRequest('monitors.php', { action: 'delete', token, monitor_id: monitorId });
    },
    update(token, monitorId, data) {
      return apiRequest('monitors.php', { action: 'update', token, monitor_id: monitorId, ...data });
    }
  },

  push: {
    subscribe(token, subscription) {
      return apiRequest('push-subscribe.php', { action: 'subscribe', token, subscription });
    },
    unsubscribe(token, endpoint) {
      return apiRequest('push-subscribe.php', { action: 'unsubscribe', token, endpoint });
    }
  },

  collab: {
    request(token, targetUsername) {
      return apiRequest('collab.php', { action: 'request', token, target_username: targetUsername });
    },
    accept(token, requestId) {
      return apiRequest('collab.php', { action: 'accept', token, request_id: requestId });
    },
    decline(token, requestId) {
      return apiRequest('collab.php', { action: 'decline', token, request_id: requestId });
    },
    status(token) {
      return apiRequest('collab.php', { action: 'status', token });
    }
  },

  tools: {
    proxy(token, tool, params) {
      return apiRequest('tools-proxy.php', { tool, token, ...params }, 30000);
    }
  }
};
