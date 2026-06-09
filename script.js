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
var filter = 'all';
var globalAchievements = [];

function loadData() {
  try { trackers = JSON.parse(localStorage.getItem('chronos_trackers')) || []; }
  catch(e) { trackers = []; }
  try { globalAchievements = JSON.parse(localStorage.getItem('chronos_global_ach')) || []; }
  catch(e) { globalAchievements = []; }
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

// ── PER-EVENT ACHIEVEMENTS ──
// Each tracker gets its own set of these based on progress
var EVENT_ACHIEVEMENTS = [
  { id: 'started',    icon: '🚀', name: 'Journey Begun',   desc: 'You started tracking this event',      threshold: 0   },
  { id: 'quarter',    icon: '🥉', name: '25% Milestone',   desc: '25% of the journey complete',          threshold: 25  },
  { id: 'half',       icon: '🥈', name: 'Halfway Hero',    desc: '50% of the journey complete',          threshold: 50  },
  { id: 'threequart', icon: '🥇', name: '75% Warrior',     desc: '75% of the journey complete',          threshold: 75  },
  { id: 'week_away',  icon: '⚡', name: 'Final Week',      desc: 'Only 7 days remaining',                threshold: null, daysCheck: 7  },
  { id: 'three_away', icon: '🔥', name: 'Final 3 Days',    desc: 'Only 3 days remaining',                threshold: null, daysCheck: 3  },
  { id: 'tomorrow',   icon: '🌅', name: 'Eve of the Day',  desc: 'Tomorrow is your target day',          threshold: null, daysCheck: 1  },
  { id: 'complete',   icon: '🏆', name: 'Goal Achieved!',  desc: '100% — you reached your target',       threshold: 100 },
];

// ── GLOBAL ACHIEVEMENTS (across all trackers) ──
var GLOBAL_ACHIEVEMENTS = [
  { id: 'g_first',     icon: '🌟', name: 'First Tracker',   desc: 'Added your first event tracker' },
  { id: 'g_five',      icon: '💫', name: 'Five Events',      desc: 'Tracking 5 events at once' },
  { id: 'g_allcolors', icon: '🌈', name: 'Rainbow',          desc: 'Used all 6 color themes' },
  { id: 'g_pinned',    icon: '📌', name: 'Pinned It',        desc: 'Pinned an event to the top' },
  { id: 'g_complete3', icon: '👑', name: 'Triple Crown',     desc: 'Completed 3 events' },
];

// ── BROWSER NOTIFICATIONS ──
function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function sendNotification(title, body, icon) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  new Notification(title, {
    body: body,
    icon: icon || '',
    badge: '',
    tag: title // prevents duplicate notifications
  });
}

// ── GET PER-EVENT UNLOCKED ACHIEVEMENTS ──
function getEventAch(trackerIdx) {
  var t = trackers[trackerIdx];
  if (!t.achievements) t.achievements = [];
  return t.achievements;
}

// ── CHECK PER-EVENT ACHIEVEMENTS ──
function checkEventAchievements(trackerIdx) {
  var t    = trackers[trackerIdx];
  var s    = getStats(t);
  var pct  = s.pct;
  var dl   = s.daysLeft;

  if (!t.achievements) t.achievements = [];

  var newly = [];

  for (var i = 0; i < EVENT_ACHIEVEMENTS.length; i++) {
    var a = EVENT_ACHIEVEMENTS[i];

    // already unlocked for this tracker?
    if (t.achievements.indexOf(a.id) !== -1) continue;

    var unlock = false;

    // progress-based
    if (a.threshold !== null) {
      if (a.threshold === 0)   unlock = true;           // 'started' — always unlock when tracker exists
      else if (pct >= a.threshold) unlock = true;
    }

    // days-based
    if (a.daysCheck !== undefined) {
      if (dl >= 0 && dl <= a.daysCheck) unlock = true;
    }

    if (unlock) {
      t.achievements.push(a.id);
      newly.push(a);
    }
  }

  if (newly.length > 0) {
    save();
    for (var j = 0; j < newly.length; j++) {
      (function(ach, tName) {
        setTimeout(function() {
          showToast('🏆 ' + tName + ': ' + ach.name + ' ' + ach.icon);
          launchConfetti();
          sendNotification(
            '🏆 Badge Unlocked — ' + tName,
            ach.icon + ' ' + ach.name + '\n' + ach.desc,
            ''
          );
        }, j * 1400);
      })(newly[j], t.name);
    }
  }
}

// ── CHECK GLOBAL ACHIEVEMENTS ──
function checkGlobalAchievements() {
  var newly = [];

  function tryUnlock(id) {
    if (globalAchievements.indexOf(id) !== -1) return;
    var found = null;
    for (var i = 0; i < GLOBAL_ACHIEVEMENTS.length; i++) {
      if (GLOBAL_ACHIEVEMENTS[i].id === id) { found = GLOBAL_ACHIEVEMENTS[i]; break; }
    }
    if (!found) return;
    globalAchievements.push(id);
    newly.push(found);
  }

  if (trackers.length >= 1) tryUnlock('g_first');
  if (trackers.length >= 5) tryUnlock('g_five');

  var colors = {}, completedCount = 0;
  for (var i = 0; i < trackers.length; i++) {
    colors[trackers[i].color] = 1;
    if (trackers[i].pinned) tryUnlock('g_pinned');
    if (getStats(trackers[i]).pct >= 100) completedCount++;
  }
  if (Object.keys(colors).length >= 6) tryUnlock('g_allcolors');
  if (completedCount >= 3) tryUnlock('g_complete3');

  if (newly.length > 0) {
    saveGlobalAch();
    for (var j = 0; j < newly.length; j++) {
      (function(a) {
        setTimeout(function() {
          showToast('🌟 Global Achievement: ' + a.name + ' ' + a.icon);
          launchConfetti();
          sendNotification('🌟 Global Achievement!', a.icon + ' ' + a.name + '\n' + a.desc);
        }, j * 1400);
      })(newly[j]);
    }
  }
}

// ── COUNTDOWN NOTIFICATIONS (days remaining alerts) ──
function checkCountdownNotifications() {
  for (var i = 0; i < trackers.length; i++) {
    var t  = trackers[i];
    var dl = getStats(t).daysLeft;
    var base = 'notif_' + t.name + '_' + t.targetDate + '_';

    // Only fire each alert once per day using localStorage keys
    if (dl === 30 && !localStorage.getItem(base + '30')) {
      sendNotification('📅 ' + t.name, '30 days to go! Keep it up.');
      localStorage.setItem(base + '30', '1');
    }
    if (dl === 14 && !localStorage.getItem(base + '14')) {
      sendNotification('📅 ' + t.name, '2 weeks remaining — stay focused!');
      localStorage.setItem(base + '14', '1');
    }
    if (dl === 7 && !localStorage.getItem(base + '7')) {
      sendNotification('⚡ ' + t.name, 'Only 7 days left — final stretch!');
      localStorage.setItem(base + '7', '1');
    }
    if (dl === 3 && !localStorage.getItem(base + '3')) {
      sendNotification('🔥 ' + t.name, 'Just 3 days remaining — you got this!');
      localStorage.setItem(base + '3', '1');
    }
    if (dl === 1 && !localStorage.getItem(base + '1')) {
      sendNotification('🌅 ' + t.name, 'Tomorrow is the day — get ready!');
      localStorage.setItem(base + '1', '1');
    }
    if (dl === 0 && !localStorage.getItem(base + '0')) {
      sendNotification('🎯 ' + t.name, "Today is your target day — you made it!");
      localStorage.setItem(base + '0', '1');
    }
  }
}

// ── DATE UTILITIES ──
function daysBetween(a, b) {
  var da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  var db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((db - da) / 86400000);
}

function formatDate(dateStr) {
  var p = dateStr.split('-');
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[parseInt(p[1]) - 1] + ' ' + parseInt(p[2]) + ', ' + p[0];
}

function getStats(t) {
  var now    = new Date();
  var today  = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var tp     = t.targetDate.split('-');
  var target = new Date(parseInt(tp[0]), parseInt(tp[1]) - 1, parseInt(tp[2]));
  var daysLeft  = daysBetween(today, target);
  var totalDays = null, elapsed = null, pct = 0;

  if (t.startDate) {
    var sp    = t.startDate.split('-');
    var start = new Date(parseInt(sp[0]), parseInt(sp[1]) - 1, parseInt(sp[2]));
    totalDays = daysBetween(start, target);
    elapsed   = daysBetween(start, today);
    pct = totalDays > 0 ? Math.min(100, Math.max(0, (elapsed / totalDays) * 100)) : 0;
  }

  if (daysLeft <= 0) pct = 100;

  return { daysLeft: daysLeft, totalDays: totalDays, elapsed: elapsed, pct: pct };
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
  var m = { violet:'#a78bfa', cyan:'#22d3ee', green:'#34d399', amber:'#fbbf24', pink:'#f472b6', red:'#f87171' };
  return m[c] || '#a78bfa';
}
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── PER-EVENT ACHIEVEMENT BADGES HTML ──
function getEventBadgesHTML(trackerIdx) {
  var t       = trackers[trackerIdx];
  var unlocked = t.achievements || [];
  if (unlocked.length === 0) return '';

  var html = '<div class="event-ach-row">';
  for (var i = 0; i < EVENT_ACHIEVEMENTS.length; i++) {
    var a  = EVENT_ACHIEVEMENTS[i];
    var on = unlocked.indexOf(a.id) !== -1;
    html +=
      '<div class="event-ach-badge ' + (on ? 'unlocked' : 'locked') + '" title="' + a.name + ': ' + a.desc + '">' +
        '<span class="eab-icon">' + (on ? a.icon : '🔒') + '</span>' +
        '<span class="eab-name">' + a.name + '</span>' +
      '</div>';
  }
  html += '</div>';
  return html;
}

// ── STATUS + MILESTONE BADGES ──
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

// ── BUILD CARD ──
function buildCard(t, realIdx) {
  var s         = getStats(t);
  var daysLeft  = s.daysLeft;
  var totalDays = s.totalDays;
  var elapsed   = s.elapsed;
  var pct       = s.pct;

  var el = document.createElement('div');
  el.className = 'tracker-card';

  var milestonesHTML = '';
  var mArr = [25, 50, 75];
  for (var mi = 0; mi < mArr.length; mi++) {
    var mv = mArr[mi];
    milestonesHTML +=
      '<div class="milestone-mark ' + (pct >= mv ? 'reached' : '') + '" style="left:' + mv + '%">' +
        '<div class="tick"></div><div class="mlabel">' + mv + '%</div>' +
      '</div>';
  }

  var progressLabel = totalDays !== null
    ? 'Progress · ' + Math.max(0, elapsed) + ' of ' + totalDays + ' days'
    : 'Add a start date for accurate progress';

  el.innerHTML =
    '<div class="card-header">' +
      '<div class="card-left">' +
        '<div class="category-icon">' + (CATEGORY_ICONS[t.category] || '📅') + '</div>' +
        '<div class="card-title-row">' +
          '<div class="card-title">' + escHtml(t.name) + '</div>' +
          '<div class="card-dates">Target: ' + formatDate(t.targetDate) +
            (t.startDate ? ' · Start: ' + formatDate(t.startDate) : '') + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="card-actions">' +
        '<button class="btn-icon pin-btn ' + (t.pinned ? 'pinned' : '') + '" onclick="togglePin(' + realIdx + ')" title="Pin">📌</button>' +
        '<button class="btn-icon del-btn" onclick="removeTracker(' + realIdx + ')" title="Delete">✕</button>' +
      '</div>' +
    '</div>' +

    '<div class="stats-grid">' +
      '<div class="stat"><div class="stat-value" style="color:' + colorHex(t.color) + '">' + Math.abs(daysLeft) + '</div><div class="stat-label">' + (daysLeft >= 0 ? 'Days Left' : 'Days Past') + '</div></div>' +
      '<div class="stat"><div class="stat-value">' + (totalDays !== null ? totalDays : '—') + '</div><div class="stat-label">Total Days</div></div>' +
      '<div class="stat"><div class="stat-value">' + weeksLeft(daysLeft) + '</div><div class="stat-label">Weeks Left</div></div>' +
      '<div class="stat"><div class="stat-value">' + monthsLeft(daysLeft) + '</div><div class="stat-label">Months Left</div></div>' +
    '</div>' +

    '<div class="progress-section">' +
      '<div class="progress-meta"><span>' + progressLabel + '</span><span class="progress-pct">' + pct.toFixed(2) + '%</span></div>' +
      '<div class="progress-wrapper">' +
        '<div class="progress-track"><div class="progress-fill color-' + t.color + '" style="width:' + pct + '%"></div></div>' +
        '<div class="milestone-marks">' + milestonesHTML + '</div>' +
      '</div>' +
    '</div>' +

    '<div class="badges-row">' + getStatusBadgesHTML(pct, daysLeft, totalDays) + '</div>' +

    // Per-event achievement badges
    '<div class="event-ach-section">' +
      '<div class="event-ach-title">Event Badges</div>' +
      getEventBadgesHTML(realIdx) +
    '</div>' +

    '<div class="ticker" id="ticker-' + realIdx + '"></div>';

  return el;
}

// ── RENDER ──
function render() {
  var container = document.getElementById('trackers');
  var empty     = document.getElementById('empty');

  var indexed = [];
  for (var i = 0; i < trackers.length; i++) {
    var obj = { _realIdx: i };
    var keys = Object.keys(trackers[i]);
    for (var k = 0; k < keys.length; k++) obj[keys[k]] = trackers[i][keys[k]];
    indexed.push(obj);
  }

  indexed.sort(function(a, b) {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return getStats(a).daysLeft - getStats(b).daysLeft;
  });

  var filtered = [];
  for (var f = 0; f < indexed.length; f++) {
    var st = getStats(indexed[f]);
    if (filter === 'upcoming' && !(st.daysLeft > 0 && st.pct === 0)) continue;
    if (filter === 'active'   && !(st.daysLeft > 0 && st.pct > 0))   continue;
    if (filter === 'done'     && !(st.daysLeft <= 0))                  continue;
    filtered.push(indexed[f]);
  }

  container.innerHTML = '';

  if (filtered.length === 0) {
    empty.style.display = '';
    container.appendChild(empty);
    renderGlobalAchievements();
    return;
  }

  empty.style.display = 'none';
  for (var j = 0; j < filtered.length; j++) {
    container.appendChild(buildCard(filtered[j], filtered[j]._realIdx));
  }

  // Check achievements for every tracker after render
  for (var ci = 0; ci < trackers.length; ci++) {
    checkEventAchievements(ci);
  }
  checkGlobalAchievements();
  checkCountdownNotifications();
  renderGlobalAchievements();
  updateTickers();
}

// ── RENDER GLOBAL ACHIEVEMENTS PANEL ──
function renderGlobalAchievements() {
  var grid = document.getElementById('achievements-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (var i = 0; i < GLOBAL_ACHIEVEMENTS.length; i++) {
    var a = GLOBAL_ACHIEVEMENTS[i];
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

// ── LIVE TICKERS ──
function updateTickers() {
  var now = new Date();
  for (var i = 0; i < trackers.length; i++) {
    var el = document.getElementById('ticker-' + i);
    if (!el) continue;
    var d = getStats(trackers[i]).daysLeft;
    if (d > 0) {
      var sec = d * 86400 - (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds());
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

// ── LIVE CLOCK ──
function updateClock() {
  var now    = new Date();
  var days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var el;

  el = document.getElementById('cl-date');
  if (el) el.textContent = days[now.getDay()] + ', ' + months[now.getMonth()] + ' ' + now.getDate() + ' ' + now.getFullYear();

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

// ── ADD TRACKER ──
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

// ── REMOVE TRACKER ──
function removeTracker(realIdx) {
  if (realIdx < 0 || realIdx >= trackers.length) return;
  var name = trackers[realIdx].name;
  if (!confirm('Remove "' + name + '"?')) return;
  trackers.splice(realIdx, 1);
  save();
  render();
  showToast('🗑️ "' + name + '" removed');
}

// ── TOGGLE PIN ──
function togglePin(realIdx) {
  if (realIdx < 0 || realIdx >= trackers.length) return;
  trackers[realIdx].pinned = !trackers[realIdx].pinned;
  save();
  render();
  showToast(trackers[realIdx].pinned ? '📌 Pinned' : 'Unpinned');
}

// ── FILTER ──
function setFilter(f, btn) {
  filter = f;
  var all = document.querySelectorAll('.filter-btn');
  for (var i = 0; i < all.length; i++) all[i].classList.remove('active');
  btn.classList.add('active');
  render();
}

// ── EXPORT CSV ──
function exportCSV() {
  if (!trackers.length) { showToast('No trackers to export.'); return; }
  var rows = [['Name','Category','Start Date','Target Date','Color','Days Left','Progress %','Badges Earned']];
  for (var i = 0; i < trackers.length; i++) {
    var t  = trackers[i];
    var s  = getStats(t);
    var ach = (t.achievements || []).join(' | ');
    rows.push([t.name, t.category||'', t.startDate||'', t.targetDate, t.color, s.daysLeft, s.pct.toFixed(2), ach]);
  }
  var csv = '';
  for (var r = 0; r < rows.length; r++) {
    csv += rows[r].map(function(v){ return '"' + v + '"'; }).join(',') + '\n';
  }
  var blob = new Blob([csv], { type: 'text/csv' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'chronos_trackers.csv';
  a.click();
  showToast('📥 Exported!');
}

// ── TOAST ──
function showToast(msg) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._tid);
  t._tid = setTimeout(function(){ t.classList.remove('show'); }, 3500);
}

// ── CONFETTI ──
function launchConfetti() {
  var colors = ['#a78bfa','#22d3ee','#34d399','#fbbf24','#f472b6','#f87171'];
  var c = document.getElementById('confetti-container');
  if (!c) return;
  for (var i = 0; i < 70; i++) {
    var p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.cssText =
      'left:' + (Math.random()*100) + 'vw;' +
      'background:' + colors[Math.floor(Math.random()*colors.length)] + ';' +
      'width:' + (Math.random()*8+4) + 'px;height:' + (Math.random()*8+4) + 'px;' +
      'border-radius:' + (Math.random()>0.5?'50%':'2px') + ';' +
      'animation-duration:' + (Math.random()*2+2) + 's;' +
      'animation-delay:' + (Math.random()*0.8) + 's;';
    c.appendChild(p);
    (function(el){ setTimeout(function(){ el.remove(); }, 4000); })(p);
  }
}

// ── HELPER ──
function addDaysFromNow(n) {
  var d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// ── INIT ──
loadData();
requestNotificationPermission();

if (trackers.length === 0) {
  var yr = new Date().getFullYear();
  trackers = [
    { name: 'New Year ' + (yr+1), targetDate: (yr+1) + '-01-01', color: 'violet', category: 'event',    pinned: false, achievements: [] },
    { name: 'Summer Vacation',    targetDate: addDaysFromNow(45), color: 'cyan',   category: 'travel',   pinned: false, achievements: [] },
    { name: 'Semester Exam',      targetDate: addDaysFromNow(18), color: 'amber',  category: 'academic', pinned: true,  startDate: addDaysFromNow(-30), achievements: [] },
    { name: 'Fitness Goal',       targetDate: addDaysFromNow(90), color: 'green',  category: 'health',   pinned: false, startDate: addDaysFromNow(-10), achievements: [] },
  ];
  save();
}

render();
renderGlobalAchievements();