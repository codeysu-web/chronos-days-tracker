// ─────────────────────────────────────────────
//  CHRONOS — Days Tracker  |  script.js
// ─────────────────────────────────────────────

// ── STARS ──
(function () {
  var c = document.getElementById('stars');
  for (var i = 0; i < 130; i++) {
    var s = document.createElement('div');
    s.className = 'star';
    var size = Math.random() * 2 + 0.5;
    s.style.cssText =
      'width:' + size + 'px;height:' + size + 'px;' +
      'top:' + (Math.random() * 100) + '%;left:' + (Math.random() * 100) + '%;' +
      '--d:' + (Math.random() * 4 + 2).toFixed(1) + 's;' +
      '--delay:' + (Math.random() * 5).toFixed(1) + 's;' +
      '--min-op:' + (Math.random() * 0.1 + 0.05).toFixed(2) + ';' +
      '--max-op:' + (Math.random() * 0.6 + 0.2).toFixed(2) + ';';
    c.appendChild(s);
  }
})();

// ── STATE ──
var trackers = [];
var currentFilter = 'all';
var globalAchievements = [];

// ── LOAD DATA ──
function loadData() {
  try {
    var t = localStorage.getItem('chronos_trackers');
    trackers = t ? JSON.parse(t) : [];
    // make sure every tracker has achievements array
    for (var i = 0; i < trackers.length; i++) {
      if (!trackers[i].achievements) trackers[i].achievements = [];
    }
  } catch(e) { trackers = []; }

  try {
    var a = localStorage.getItem('chronos_global_ach');
    globalAchievements = a ? JSON.parse(a) : [];
  } catch(e) { globalAchievements = []; }
}

function save() {
  localStorage.setItem('chronos_trackers', JSON.stringify(trackers));
}

function saveGlobalAch() {
  localStorage.setItem('chronos_global_ach', JSON.stringify(globalAchievements));
}

// ── CATEGORY ICONS ──
var CATEGORY_ICONS = {
  personal: '🧘', academic: '📚', work: '💼',
  health: '❤️', travel: '✈️', event: '🎉'
};

// ── PER EVENT ACHIEVEMENTS ──
var EVENT_ACHIEVEMENTS = [
  { id: 'started',    icon: '🚀', name: 'Journey Begun',  desc: 'Started tracking this event'    },
  { id: 'quarter',    icon: '🥉', name: '25% Milestone',  desc: '25% of the journey complete'    },
  { id: 'half',       icon: '🥈', name: 'Halfway Hero',   desc: '50% of the journey complete'    },
  { id: 'threequart', icon: '🥇', name: '75% Warrior',    desc: '75% of the journey complete'    },
  { id: 'week_away',  icon: '⚡', name: 'Final Week',     desc: 'Only 7 days remaining'          },
  { id: 'three_away', icon: '🔥', name: 'Final 3 Days',   desc: 'Only 3 days remaining'          },
  { id: 'tomorrow',   icon: '🌅', name: 'Eve of the Day', desc: 'Tomorrow is your target day'    },
  { id: 'complete',   icon: '🏆', name: 'Goal Achieved',  desc: 'You reached your target!'       },
];

// ── GLOBAL ACHIEVEMENTS ──
var GLOBAL_ACHIEVEMENTS = [
  { id: 'g_first',     icon: '🌟', name: 'First Tracker',  desc: 'Added your first event'      },
  { id: 'g_five',      icon: '💫', name: 'Five Events',    desc: 'Tracking 5 events at once'   },
  { id: 'g_allcolors', icon: '🌈', name: 'Rainbow',        desc: 'Used all 6 color themes'     },
  { id: 'g_pinned',    icon: '📌', name: 'Pinned It',      desc: 'Pinned an event to the top'  },
  { id: 'g_complete3', icon: '👑', name: 'Triple Crown',   desc: 'Completed 3 events'          },
];

// ─────────────────────────────────────────────
//  SERVICE WORKER — background notifications
// ─────────────────────────────────────────────


// ── SEND NOTIFICATION via SW or fallback ──
function sendNotification(title, body, tag) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  // Try Service Worker first (works with tab closed on Android)
  if (window._swReg && window._swReg.active) {
    window._swReg.active.postMessage({
      type: 'SHOW_NOTIFICATION',
      title: title,
      body: body,
      icon: 'icon.png',
      tag: tag || title
    });
  } else {
    // Fallback to regular notification
    new Notification(title, {
      body: body,
      icon: 'icon.png',
      tag: tag || title
    });
  }
}

function requestNotificationPermission(callback) {
  if (!('Notification' in window)) {
    if (callback) callback(false);
    return;
  }
  if (Notification.permission === 'granted') {
    if (callback) callback(true);
    return;
  }
  Notification.requestPermission(function(result) {
    if (callback) callback(result === 'granted');
  });
}

// ─────────────────────────────────────────────
//  BADGE NOTIFICATION QUEUE
//  Shows badges ONE BY ONE with delay
// ─────────────────────────────────────────────
var notifQueue = [];
var notifBusy  = false;

function queueNotification(title, body, tag) {
  notifQueue.push({ title: title, body: body, tag: tag });
  processQueue();
}

function processQueue() {
  if (notifBusy || notifQueue.length === 0) return;
  notifBusy = true;
  var item = notifQueue.shift();

  // Show in-app banner
  showPersistentBanner(item.title, item.body);

  // Show system notification
  sendNotification(item.title, item.body, item.tag);

  // Wait 4 seconds before next one
  setTimeout(function() {
    notifBusy = false;
    processQueue();
  }, 4000);
}

// ─────────────────────────────────────────────
//  PER-EVENT ACHIEVEMENT CHECK
// ─────────────────────────────────────────────
function checkEventAchievements(realIdx) {
  var t  = trackers[realIdx];
  if (!t) return;
  if (!t.achievements) t.achievements = [];

  var s    = getStats(t);
  var pct  = s.pct;
  var dl   = s.daysLeft;
  var hasSt = !!t.startDate;

  var rules = [
    { id: 'started',    cond: true                      },
    { id: 'quarter',    cond: hasSt && pct >= 25        },
    { id: 'half',       cond: hasSt && pct >= 50        },
    { id: 'threequart', cond: hasSt && pct >= 75        },
    { id: 'week_away',  cond: dl >= 0 && dl <= 7        },
    { id: 'three_away', cond: dl >= 0 && dl <= 3        },
    { id: 'tomorrow',   cond: dl === 1                  },
    { id: 'complete',   cond: dl <= 0                   },
  ];

  for (var i = 0; i < rules.length; i++) {
    var rule = rules[i];
    if (!rule.cond) continue;
    if (t.achievements.indexOf(rule.id) !== -1) continue;

    // Unlock it
    t.achievements.push(rule.id);

    // Find achievement details
    var achDef = null;
    for (var j = 0; j < EVENT_ACHIEVEMENTS.length; j++) {
      if (EVENT_ACHIEVEMENTS[j].id === rule.id) {
        achDef = EVENT_ACHIEVEMENTS[j];
        break;
      }
    }
    if (!achDef) continue;

    // Queue notification — one by one
    queueNotification(
      achDef.icon + ' Badge Unlocked — ' + t.name,
      achDef.name + ': ' + achDef.desc,
      'ach_' + realIdx + '_' + rule.id
    );
  }
}

// ─────────────────────────────────────────────
//  GLOBAL ACHIEVEMENT CHECK
// ─────────────────────────────────────────────
function checkGlobalAchievements() {
  var toUnlock = [];

  function tryUnlock(id) {
    if (globalAchievements.indexOf(id) !== -1) return;
    for (var i = 0; i < GLOBAL_ACHIEVEMENTS.length; i++) {
      if (GLOBAL_ACHIEVEMENTS[i].id === id) {
        toUnlock.push(GLOBAL_ACHIEVEMENTS[i]);
        globalAchievements.push(id);
        break;
      }
    }
  }

  if (trackers.length >= 1) tryUnlock('g_first');
  if (trackers.length >= 5) tryUnlock('g_five');

  var colors = {};
  var doneCount = 0;
  for (var i = 0; i < trackers.length; i++) {
    colors[trackers[i].color] = 1;
    if (trackers[i].pinned) tryUnlock('g_pinned');
    if (getStats(trackers[i]).pct >= 100) doneCount++;
  }
  if (Object.keys(colors).length >= 6) tryUnlock('g_allcolors');
  if (doneCount >= 3) tryUnlock('g_complete3');

  if (toUnlock.length > 0) {
    saveGlobalAch();
    for (var j = 0; j < toUnlock.length; j++) {
      queueNotification(
        '🌟 Global Achievement!',
        toUnlock[j].icon + ' ' + toUnlock[j].name + ' — ' + toUnlock[j].desc,
        'global_' + toUnlock[j].id
      );
    }
  }
}

// ─────────────────────────────────────────────
//  COUNTDOWN NOTIFICATIONS — one by one
// ─────────────────────────────────────────────
function checkCountdownNotifications() {
  for (var i = 0; i < trackers.length; i++) {
    var t   = trackers[i];
    var dl  = getStats(t).daysLeft;
    var key = 'cd_' + t.name + '_' + t.targetDate + '_';

    var alerts = [
      { days: 30, icon: '📅', msg: '30 days to go — keep it up!'         },
      { days: 14, icon: '📅', msg: '2 weeks remaining — stay focused!'    },
      { days: 7,  icon: '⚡', msg: 'Only 7 days left — final stretch!'    },
      { days: 3,  icon: '🔥', msg: 'Just 3 days remaining — you got this!'},
      { days: 1,  icon: '🌅', msg: 'Tomorrow is the day — get ready!'     },
      { days: 0,  icon: '🎯', msg: 'TODAY IS THE DAY — You made it!'      },
    ];

    for (var j = 0; j < alerts.length; j++) {
      var al = alerts[j];
      if (dl === al.days && !localStorage.getItem(key + al.days)) {
        localStorage.setItem(key + al.days, '1');
        queueNotification(
          al.icon + ' ' + t.name,
          al.msg,
          key + al.days
        );
        if (dl === 0) launchConfetti();
      }
    }
  }
}

// ─────────────────────────────────────────────
//  STORE NOTIFICATIONS IN LOCALSTORAGE
//  So they fire even after tab was closed
// ─────────────────────────────────────────────
function saveScheduledNotifications() {
  var scheduled = [];
  for (var i = 0; i < trackers.length; i++) {
    var t  = trackers[i];
    var dl = getStats(t).daysLeft;
    var checkDays = [30, 14, 7, 3, 1, 0];
    for (var j = 0; j < checkDays.length; j++) {
      var cd  = checkDays[j];
      var key = 'cd_' + t.name + '_' + t.targetDate + '_' + cd;
      if (dl > cd && !localStorage.getItem(key)) {
        // Calculate the future date when notification should fire
        var fireDate = new Date();
        fireDate.setDate(fireDate.getDate() + (dl - cd));
        fireDate.setHours(9, 0, 0, 0); // Fire at 9 AM
        scheduled.push({
          key: key,
          fireTimestamp: fireDate.getTime(),
          title: '⏰ ' + t.name,
          body: getCountdownMessage(cd, t.name)
        });
      }
    }
  }
  localStorage.setItem('chronos_scheduled', JSON.stringify(scheduled));
}

function getCountdownMessage(days, name) {
  if (days === 30) return '30 days to go — keep it up!';
  if (days === 14) return '2 weeks remaining — stay focused!';
  if (days === 7)  return 'Only 7 days left — final stretch!';
  if (days === 3)  return 'Just 3 days remaining — you got this!';
  if (days === 1)  return 'Tomorrow is the day — get ready!';
  if (days === 0)  return 'TODAY IS THE DAY — You made it!';
  return days + ' days remaining!';
}

// Check scheduled notifications on app open
function checkScheduledOnOpen() {
  var raw = localStorage.getItem('chronos_scheduled');
  if (!raw) return;
  var scheduled = [];
  try { scheduled = JSON.parse(raw); } catch(e) { return; }

  var now = Date.now();
  var remaining = [];

  for (var i = 0; i < scheduled.length; i++) {
    var item = scheduled[i];
    if (now >= item.fireTimestamp && !localStorage.getItem(item.key)) {
      localStorage.setItem(item.key, '1');
      queueNotification(item.title, item.body, item.key);
    } else if (now < item.fireTimestamp) {
      remaining.push(item);
    }
  }
  localStorage.setItem('chronos_scheduled', JSON.stringify(remaining));
}

// ─────────────────────────────────────────────
//  DATE UTILITIES
// ─────────────────────────────────────────────
function daysBetween(a, b) {
  var da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  var db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((db - da) / 86400000);
}

function formatDate(str) {
  var p = str.split('-');
  var months = ['Jan','Feb','Mar','Apr','May','Jun',
                'Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[parseInt(p[1]) - 1] + ' ' + parseInt(p[2]) + ', ' + p[0];
}

function getStats(t) {
  var now    = new Date();
  var today  = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var tp     = t.targetDate.split('-');
  var target = new Date(parseInt(tp[0]), parseInt(tp[1])-1, parseInt(tp[2]));
  var daysLeft  = daysBetween(today, target);
  var totalDays = null, elapsed = null, pct = 0;

  if (t.startDate) {
    var sp    = t.startDate.split('-');
    var start = new Date(parseInt(sp[0]), parseInt(sp[1])-1, parseInt(sp[2]));
    totalDays = daysBetween(start, target);
    elapsed   = daysBetween(start, today);
    if (totalDays > 0) {
      pct = (elapsed / totalDays) * 100;
      if (pct < 0)   pct = 0;
      if (pct > 100) pct = 100;
    }
  }

  // ── THE FILTER FIX ──
  // upcoming = has future target, no start date set (pct stays 0)
  // active   = has start date AND target is in future (pct > 0 and < 100)
  // done     = target date passed
  var status;
  if (daysLeft < 0) {
    status = 'done';
    pct = 100;
  } else if (t.startDate && totalDays !== null && elapsed !== null && elapsed >= 0) {
    status = 'active';
  } else {
    status = 'upcoming';
  }

  return {
    daysLeft:  daysLeft,
    totalDays: totalDays,
    elapsed:   elapsed,
    pct:       pct,
    status:    status
  };
}

function yearProgress() {
  var now   = new Date();
  var start = new Date(now.getFullYear(), 0, 1);
  var end   = new Date(now.getFullYear() + 1, 0, 1);
  return ((now - start) / (end - start)) * 100;
}

function weeksLeft(d)  { return d > 0 ? Math.ceil(d / 7) : 0; }
function monthsLeft(d) { return d > 0 ? (d / 30.4375).toFixed(1) : '0'; }

function colorHex(c) {
  var m = {
    violet: '#a78bfa', cyan:  '#22d3ee',
    green:  '#34d399', amber: '#fbbf24',
    pink:   '#f472b6', red:   '#f87171'
  };
  return m[c] || '#a78bfa';
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
}

// ─────────────────────────────────────────────
//  BUILD CARD
// ─────────────────────────────────────────────
function getStatusBadgesHTML(pct, daysLeft, totalDays) {
  var html = '';
  if (daysLeft < 0) {
    html += '<span class="badge badge-done">✅ Done · ' + Math.abs(daysLeft) + 'd ago</span>';
  } else if (daysLeft === 0) {
    html += '<span class="badge badge-today">🎯 Today!</span>';
  } else if (daysLeft <= 3) {
    html += '<span class="badge badge-milestone">🔥 ' + daysLeft + 'd left!</span>';
  } else if (daysLeft <= 7) {
    html += '<span class="badge badge-milestone">⚡ Final week · ' + daysLeft + 'd</span>';
  } else {
    html += '<span class="badge badge-upcoming">🕐 ' + daysLeft + ' days left</span>';
  }
  if (totalDays !== null) {
    if (pct >= 100)     html += '<span class="badge badge-complete">🏆 100%</span>';
    else if (pct >= 75) html += '<span class="badge badge-three-q">🥇 75%</span>';
    else if (pct >= 50) html += '<span class="badge badge-half">🥈 50%</span>';
    else if (pct >= 25) html += '<span class="badge badge-quarter">🥉 25%</span>';
  }
  return html;
}

function getEventBadgesHTML(realIdx) {
  var t        = trackers[realIdx];
  var unlocked = t.achievements || [];
  var html     = '<div class="event-ach-row">';
  for (var i = 0; i < EVENT_ACHIEVEMENTS.length; i++) {
    var a  = EVENT_ACHIEVEMENTS[i];
    var on = unlocked.indexOf(a.id) !== -1;
    html +=
      '<div class="event-ach-badge ' + (on ? 'unlocked' : 'locked') + '" ' +
           'title="' + a.name + ': ' + a.desc + '">' +
        '<span class="eab-icon">' + (on ? a.icon : '🔒') + '</span>' +
        '<span class="eab-name">' + a.name + '</span>' +
      '</div>';
  }
  return html + '</div>';
}

function buildCard(t, realIdx) {
  var s         = getStats(t);
  var daysLeft  = s.daysLeft;
  var totalDays = s.totalDays;
  var elapsed   = s.elapsed;
  var pct       = s.pct;

  var el = document.createElement('div');
  el.className = 'tracker-card';
  // Store real index as data attribute — avoids closure index bug
  el.setAttribute('data-idx', realIdx);

  var milestones = '';
  var mArr = [25, 50, 75];
  for (var mi = 0; mi < mArr.length; mi++) {
    var mv = mArr[mi];
    milestones +=
      '<div class="milestone-mark ' + (pct >= mv ? 'reached' : '') +
           '" style="left:' + mv + '%">' +
        '<div class="tick"></div>' +
        '<div class="mlabel">' + mv + '%</div>' +
      '</div>';
  }

  var progressLabel = totalDays !== null
    ? 'Progress · ' + Math.max(0, elapsed) + ' of ' + totalDays + ' days'
    : 'Add start date for progress bar';

  el.innerHTML =
    '<div class="card-header">' +
      '<div class="card-left">' +
        '<div class="category-icon">' + (CATEGORY_ICONS[t.category] || '📅') + '</div>' +
        '<div class="card-title-row">' +
          '<div class="card-title">' + escHtml(t.name) + '</div>' +
          '<div class="card-dates">Target: ' + formatDate(t.targetDate) +
            (t.startDate ? ' · Start: ' + formatDate(t.startDate) : '') +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="card-actions">' +
        '<button class="btn-icon pin-btn ' + (t.pinned ? 'pinned' : '') + '" ' +
          'onclick="togglePin(' + realIdx + ')" title="Pin">📌</button>' +
        '<button class="btn-icon del-btn" ' +
          'onclick="removeTracker(' + realIdx + ')" title="Delete">✕</button>' +
      '</div>' +
    '</div>' +

    '<div class="stats-grid">' +
      '<div class="stat">' +
        '<div class="stat-value" style="color:' + colorHex(t.color) + '">' +
          Math.abs(daysLeft) +
        '</div>' +
        '<div class="stat-label">' + (daysLeft >= 0 ? 'Days Left' : 'Days Past') + '</div>' +
      '</div>' +
      '<div class="stat">' +
        '<div class="stat-value">' + (totalDays !== null ? totalDays : '—') + '</div>' +
        '<div class="stat-label">Total Days</div>' +
      '</div>' +
      '<div class="stat">' +
        '<div class="stat-value">' + weeksLeft(daysLeft) + '</div>' +
        '<div class="stat-label">Weeks Left</div>' +
      '</div>' +
      '<div class="stat">' +
        '<div class="stat-value">' + monthsLeft(daysLeft) + '</div>' +
        '<div class="stat-label">Months Left</div>' +
      '</div>' +
    '</div>' +

    '<div class="progress-section">' +
      '<div class="progress-meta">' +
        '<span>' + progressLabel + '</span>' +
        '<span class="progress-pct">' + pct.toFixed(2) + '%</span>' +
      '</div>' +
      '<div class="progress-wrapper">' +
        '<div class="progress-track">' +
          '<div class="progress-fill color-' + t.color + '" style="width:' + pct + '%"></div>' +
        '</div>' +
        '<div class="milestone-marks">' + milestones + '</div>' +
      '</div>' +
    '</div>' +

    '<div class="badges-row">' + getStatusBadgesHTML(pct, daysLeft, totalDays) + '</div>' +

    '<div class="event-ach-section">' +
      '<div class="event-ach-title">Event Badges</div>' +
      getEventBadgesHTML(realIdx) +
    '</div>' +

    '<div class="ticker" id="ticker-' + realIdx + '"></div>';

  return el;
}

// ─────────────────────────────────────────────
//  RENDER — fixed filter logic
// ─────────────────────────────────────────────
function render() {
  var container = document.getElementById('trackers');
  var empty     = document.getElementById('empty');

  // Step 1 — tag with real index BEFORE any sort/filter
  var indexed = [];
  for (var i = 0; i < trackers.length; i++) {
    var copy = {};
    var keys = Object.keys(trackers[i]);
    for (var k = 0; k < keys.length; k++) {
      copy[keys[k]] = trackers[i][keys[k]];
    }
    copy._realIdx = i;
    indexed.push(copy);
  }

  // Step 2 — sort: pinned first, then soonest
  indexed.sort(function(a, b) {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return getStats(a).daysLeft - getStats(b).daysLeft;
  });

  // Step 3 — filter using status from getStats
  var filtered = [];
  for (var f = 0; f < indexed.length; f++) {
    var st = getStats(indexed[f]);
    if (currentFilter === 'all') {
      filtered.push(indexed[f]);
    } else if (currentFilter === 'upcoming' && st.status === 'upcoming') {
      filtered.push(indexed[f]);
    } else if (currentFilter === 'active' && st.status === 'active') {
      filtered.push(indexed[f]);
    } else if (currentFilter === 'done' && st.status === 'done') {
      filtered.push(indexed[f]);
    }
  }

  // Step 4 — paint
  container.innerHTML = '';

  if (filtered.length === 0) {
    var msg = document.createElement('div');
    msg.id = 'empty';
    msg.innerHTML =
      '<div class="empty-icon">🕐</div>' +
      '<p>No ' + currentFilter + ' events found</p>';
    container.appendChild(msg);
    renderGlobalAchievements();
    return;
  }

  for (var j = 0; j < filtered.length; j++) {
    container.appendChild(buildCard(filtered[j], filtered[j]._realIdx));
  }

  // Check achievements AFTER render
  for (var ci = 0; ci < trackers.length; ci++) {
    checkEventAchievements(ci);
  }
  save(); // save achievement updates
  checkGlobalAchievements();
  checkCountdownNotifications();
  saveScheduledNotifications();
  renderGlobalAchievements();
  updateTickers();
}

// ─────────────────────────────────────────────
//  GLOBAL ACHIEVEMENTS PANEL
// ─────────────────────────────────────────────
function renderGlobalAchievements() {
  var grid = document.getElementById('achievements-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (var i = 0; i < GLOBAL_ACHIEVEMENTS.length; i++) {
    var a  = GLOBAL_ACHIEVEMENTS[i];
    var on = globalAchievements.indexOf(a.id) !== -1;
    var card = document.createElement('div');
    card.className = 'achievement-card ' + (on ? 'unlocked' : 'locked');
    card.innerHTML =
      '<div class="ach-icon">' + (on ? a.icon : '🔒') + '</div>' +
      '<div class="ach-name">' + a.name + '</div>' +
      '<div class="ach-desc">' + a.desc + '</div>' +
      (on ? '<div class="ach-unlocked-label">✓ Unlocked</div>' : '');
    grid.appendChild(card);
  }
}

// ─────────────────────────────────────────────
//  IN-APP BANNER
// ─────────────────────────────────────────────
function showPersistentBanner(title, body) {
  var existing = document.getElementById('alert-banner');
  if (existing) existing.remove();

  var banner = document.createElement('div');
  banner.id = 'alert-banner';
  banner.style.cssText =
    'position:fixed;top:0;left:0;right:0;z-index:9999;' +
    'background:#0f0f1e;border-bottom:2px solid #a78bfa;' +
    'padding:14px 20px;display:flex;align-items:center;gap:12px;' +
    'animation:slideDown 0.4s cubic-bezier(0.16,1,0.3,1);';

  banner.innerHTML =
    '<div style="flex:1">' +
      '<div style="font-size:13px;font-weight:700;color:#a78bfa">' + escHtml(title) + '</div>' +
      '<div style="font-size:12px;color:rgba(240,240,255,0.6);margin-top:3px">' + escHtml(body) + '</div>' +
    '</div>' +
    '<button onclick="document.getElementById(\'alert-banner\').remove()" ' +
      'style="background:transparent;border:none;color:rgba(240,240,255,0.4);' +
             'font-size:20px;cursor:pointer;padding:4px;line-height:1">✕</button>';

  document.body.appendChild(banner);
  setTimeout(function() {
    var b = document.getElementById('alert-banner');
    if (b) b.remove();
  }, 6000);
}

// ─────────────────────────────────────────────
//  LIVE TICKERS
// ─────────────────────────────────────────────
function updateTickers() {
  var now = new Date();
  for (var i = 0; i < trackers.length; i++) {
    var el = document.getElementById('ticker-' + i);
    if (!el) continue;
    var d = getStats(trackers[i]).daysLeft;
    if (d > 0) {
      var sec = d * 86400 - (now.getHours()*3600 + now.getMinutes()*60 + now.getSeconds());
      var hh  = Math.floor(sec / 3600);
      var mm  = Math.floor((sec % 3600) / 60);
      var ss  = Math.floor(sec % 60);
      el.innerHTML = 'Countdown: <span>' + d + 'd ' + hh + 'h ' + mm + 'm ' + ss + 's</span>';
    } else if (d === 0) {
      el.innerHTML = '<span>🎯 Today is your target day!</span>';
    } else {
      el.innerHTML = 'Ended ' + Math.abs(d) + ' days ago';
    }
  }
}

// ─────────────────────────────────────────────
//  LIVE CLOCK
// ─────────────────────────────────────────────
function updateClock() {
  var now    = new Date();
  var days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var el;

  el = document.getElementById('cl-date');
  if (el) el.textContent =
    days[now.getDay()] + ', ' + months[now.getMonth()] + ' ' + now.getDate() + ' ' + now.getFullYear();

  el = document.getElementById('cl-time');
  if (el) el.textContent =
    String(now.getHours()).padStart(2,'0') + ':' +
    String(now.getMinutes()).padStart(2,'0') + ':' +
    String(now.getSeconds()).padStart(2,'0');

  el = document.getElementById('cl-doy');
  if (el) el.textContent = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);

  el = document.getElementById('cl-week');
  if (el) {
    var jan4 = new Date(now.getFullYear(), 0, 4);
    var sow  = new Date(jan4);
    sow.setDate(jan4.getDate() - (jan4.getDay() || 7) + 1);
    el.textContent = Math.ceil((now - sow) / 86400000 / 7) + 1;
  }

  el = document.getElementById('cl-yearpct');
  if (el) el.textContent = yearProgress().toFixed(2) + '%';
}

setInterval(function() { updateClock(); updateTickers(); }, 1000);
updateClock();

// ─────────────────────────────────────────────
//  ADD TRACKER
// ─────────────────────────────────────────────
function addTracker() {
  var name     = document.getElementById('inp-name').value.trim();
  var date     = document.getElementById('inp-date').value;
  var start    = document.getElementById('inp-start').value;
  var color    = document.getElementById('inp-color').value;
  var category = document.getElementById('inp-category').value;

  if (!name) { showToast('⚠️ Enter an event name.'); return; }
  if (!date) { showToast('⚠️ Pick a target date.');  return; }

  var obj = {
    name: name, targetDate: date,
    color: color, category: category,
    pinned: false, achievements: []
  };
  if (start) obj.startDate = start;

  trackers.push(obj);
  save();

  document.getElementById('inp-name').value  = '';
  document.getElementById('inp-date').value  = '';
  document.getElementById('inp-start').value = '';

  render();
  showToast('✅ "' + name + '" added!');
}

// ─────────────────────────────────────────────
//  REMOVE TRACKER — fixed
// ─────────────────────────────────────────────
function removeTracker(realIdx) {
  // Convert to number just in case
  realIdx = parseInt(realIdx, 10);

  if (isNaN(realIdx) || realIdx < 0 || realIdx >= trackers.length) {
    showToast('⚠️ Could not find tracker.');
    return;
  }

  var name = trackers[realIdx].name;
  if (!confirm('Remove "' + name + '"?')) return;

  // Remove ONLY the one at realIdx
  trackers.splice(realIdx, 1);
  save();
  render();
  showToast('🗑️ "' + name + '" removed');
}

// ─────────────────────────────────────────────
//  TOGGLE PIN
// ─────────────────────────────────────────────
function togglePin(realIdx) {
  realIdx = parseInt(realIdx, 10);
  if (isNaN(realIdx) || realIdx < 0 || realIdx >= trackers.length) return;
  trackers[realIdx].pinned = !trackers[realIdx].pinned;
  save();
  render();
  showToast(trackers[realIdx].pinned ? '📌 Pinned to top' : 'Unpinned');
}

// ─────────────────────────────────────────────
//  FILTER — fixed
// ─────────────────────────────────────────────
function setFilter(f, btn) {
  currentFilter = f;
  var all = document.querySelectorAll('.filter-btn');
  for (var i = 0; i < all.length; i++) all[i].classList.remove('active');
  btn.classList.add('active');
  render();
}

// ─────────────────────────────────────────────
//  EXPORT CSV
// ─────────────────────────────────────────────
function exportCSV() {
  if (!trackers.length) { showToast('No trackers to export.'); return; }
  var rows = [['Name','Category','Start','Target','Color','Days Left','Progress%','Badges']];
  for (var i = 0; i < trackers.length; i++) {
    var t = trackers[i];
    var s = getStats(t);
    rows.push([
      t.name, t.category||'', t.startDate||'',
      t.targetDate, t.color,
      s.daysLeft, s.pct.toFixed(2),
      (t.achievements||[]).join('|')
    ]);
  }
  var csv = '';
  for (var r = 0; r < rows.length; r++) {
    csv += rows[r].map(function(v){ return '"'+v+'"'; }).join(',') + '\n';
  }
  var blob = new Blob([csv], { type:'text/csv' });
  var a    = document.createElement('a');
  a.href   = URL.createObjectURL(blob);
  a.download = 'chronos.csv';
  a.click();
  showToast('📥 Exported!');
}

// ─────────────────────────────────────────────
//  TOAST
// ─────────────────────────────────────────────
function showToast(msg) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._tid);
  t._tid = setTimeout(function(){ t.classList.remove('show'); }, 3500);
}

// ─────────────────────────────────────────────
//  CONFETTI
// ─────────────────────────────────────────────
function launchConfetti() {
  var colors = ['#a78bfa','#22d3ee','#34d399','#fbbf24','#f472b6','#f87171'];
  var c = document.getElementById('confetti-container');
  if (!c) return;
  for (var i = 0; i < 70; i++) {
    var p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.cssText =
      'left:'+(Math.random()*100)+'vw;' +
      'background:'+colors[Math.floor(Math.random()*colors.length)]+';' +
      'width:'+(Math.random()*8+4)+'px;height:'+(Math.random()*8+4)+'px;' +
      'border-radius:'+(Math.random()>0.5?'50%':'2px')+';' +
      'animation-duration:'+(Math.random()*2+2)+'s;' +
      'animation-delay:'+(Math.random()*0.8)+'s;';
    c.appendChild(p);
    (function(el){ setTimeout(function(){ el.remove(); },4000); })(p);
  }
}

// ─────────────────────────────────────────────
//  TEST NOTIFICATION BUTTON
// ─────────────────────────────────────────────
function testNotification() {
  requestNotificationPermission(function(granted) {
    if (granted) {
      queueNotification('✅ Chronos', 'Notifications are working on your phone!', 'test');
      showToast('✅ Test notification sent!');
    } else {
      showToast('❌ Enable notifications in Settings → Apps → Chrome → Notifications');
    }
  });
}

// ─────────────────────────────────────────────
//  HELPER
// ─────────────────────────────────────────────
function addDaysFromNow(n) {
  var d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0,10);
}

// ─────────────────────────────────────────────
// // ─────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────
loadData();

// SW registered in index.html <head> — just get the reference here
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then(function(reg) {
    window._swReg = reg;
    requestNotificationPermission(function(granted) {
      if (granted) checkScheduledOnOpen();
    });
  });
}

// Load demo data only on first visit
if (trackers.length === 0) {
  var yr = new Date().getFullYear();
  trackers = [
    {
      name: 'New Year ' + (yr+1),
      targetDate: (yr+1) + '-01-01',
      color: 'violet', category: 'event',
      pinned: false, achievements: []
    },
    {
      name: 'Summer Vacation',
      targetDate: addDaysFromNow(45),
      color: 'cyan', category: 'travel',
      pinned: false, achievements: []
    },
    {
      name: 'Semester Exam',
      targetDate: addDaysFromNow(18),
      startDate:  addDaysFromNow(-30),
      color: 'amber', category: 'academic',
      pinned: true, achievements: []
    },
    {
      name: 'Fitness Goal',
      targetDate: addDaysFromNow(90),
      startDate:  addDaysFromNow(-10),
      color: 'green', category: 'health',
      pinned: false, achievements: []
    },
  ];
  save();
}

render();
renderGlobalAchievements();

// Check notifications every hour while app stays open
setInterval(function() {
  checkCountdownNotifications();
  saveScheduledNotifications();
}, 60 * 60 * 1000);
render();
renderGlobalAchievements();

// Check notifications every hour while app stays open
setInterval(function() {
  checkCountdownNotifications();
  saveScheduledNotifications();
}, 60 * 60 * 1000);