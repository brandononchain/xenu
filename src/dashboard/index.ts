export const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Xenu — X Intelligence Agent</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--g:#00FF88;--bg:#050505;--card:rgba(255,255,255,0.02);--border:rgba(255,255,255,0.06);--t1:#fff;--t2:rgba(255,255,255,0.7);--t3:rgba(255,255,255,0.4);--t4:rgba(255,255,255,0.2);--mono:'JetBrains Mono',monospace;--sans:'Space Grotesk',sans-serif;--red:#FF4444;--blue:#00AAFF;--yellow:#FFAA00;--purple:#AA66FF}
body{background:var(--bg);color:var(--t1);font-family:var(--sans);line-height:1.6;min-height:100vh}
a{color:var(--g);text-decoration:none}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:2px}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}

header{padding:16px 24px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);backdrop-filter:blur(20px);position:sticky;top:0;z-index:50;background:rgba(5,5,5,.85)}
.logo{display:flex;align-items:center;gap:12px;font-size:16px;font-weight:700}
.logo-icon{width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,rgba(0,255,136,.13),rgba(0,255,136,.05));border:1px solid rgba(0,255,136,.2);display:flex;align-items:center;justify-content:center;font-size:16px}
.logo span{text-shadow:0 0 10px rgba(0,255,136,.27),0 0 20px rgba(0,255,136,.13)}
.status-dot{width:8px;height:8px;border-radius:50%}
.status-dot.on{background:var(--g);box-shadow:0 0 8px var(--g)}
.status-dot.off{background:var(--red)}

nav{padding:0 24px;border-bottom:1px solid var(--border);display:flex;gap:0;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none}
nav::-webkit-scrollbar{display:none}
nav button{padding:12px 16px;border:none;background:transparent;cursor:pointer;font-size:11px;font-family:var(--mono);letter-spacing:.05em;color:var(--t3);border-bottom:2px solid transparent;transition:all .2s;white-space:nowrap;flex-shrink:0}
nav button.active{color:var(--g);border-bottom-color:var(--g)}
nav button:hover{color:var(--t2)}

main{padding:24px 24px 80px;animation:fadeIn .3s ease}
footer{position:fixed;bottom:0;left:0;right:0;padding:8px 24px;background:rgba(5,5,5,.9);border-top:1px solid rgba(255,255,255,.04);display:flex;justify-content:space-between;align-items:center;backdrop-filter:blur(20px);z-index:50}
footer span{font-size:10px;font-family:var(--mono)}

.grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px 16px}
.stat{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px;position:relative;overflow:hidden}
.stat-label{font-size:10px;color:var(--t3);letter-spacing:.1em;text-transform:uppercase;font-family:var(--mono)}
.stat-value{font-size:24px;font-weight:700;margin-top:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.stat-sub{font-size:11px;color:var(--g);margin-top:4px;font-family:var(--mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.section-hdr{font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:var(--t3);font-family:var(--mono);margin:0 0 16px;padding:0 0 8px;border-bottom:1px solid var(--border)}
.empty{font-size:11px;color:var(--t4);font-family:var(--mono);padding:20px;text-align:center}
.loader{font-size:11px;color:var(--t4);font-family:var(--mono);padding:20px;text-align:center}
.insight{margin-top:16px;padding:12px 16px;background:rgba(0,255,136,.04);border-radius:8px;border:1px solid rgba(0,255,136,.08);font-size:11px;color:var(--g);font-family:var(--mono);line-height:1.6}

.bar-row{display:flex;align-items:center;gap:12px}
.bar-label{font-size:11px;color:var(--t3);font-family:var(--mono);width:80px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar-track{flex:1;height:6px;background:rgba(255,255,255,.04);border-radius:3px;overflow:hidden}
.bar-fill{height:100%;border-radius:3px}
.bar-val{font-size:10px;color:var(--t3);font-family:var(--mono);width:40px;text-align:right;flex-shrink:0}

.meter{display:flex;align-items:center;gap:12px}
.meter-label{font-size:11px;color:var(--t3);font-family:var(--mono);width:80px;flex-shrink:0;text-transform:capitalize}
.meter-track{flex:1;height:4px;background:rgba(255,255,255,.05);border-radius:2px;overflow:hidden}
.meter-fill{height:100%;background:linear-gradient(90deg,rgba(0,255,136,.27),var(--g));border-radius:2px}
.meter-val{font-size:11px;color:var(--g);font-family:var(--mono);width:30px;text-align:right;flex-shrink:0}

.collector-row{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--card);border-radius:8px;border:1px solid rgba(255,255,255,.04);flex-wrap:wrap;gap:8px}
.collector-name{display:flex;align-items:center;gap:10px;min-width:100px}
.collector-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.collector-meta{display:flex;align-items:center;gap:16px}

.tweet-card{padding:12px 14px;background:var(--card);border-radius:10px;border:1px solid rgba(255,255,255,.04);margin-bottom:10px}
.tweet-text{font-size:12px;color:var(--t2);line-height:1.5;margin-bottom:8px;word-break:break-word}
.tweet-stats{display:flex;gap:12px;flex-wrap:wrap}
.tweet-stats span{font-size:10px;color:var(--t3);font-family:var(--mono)}

.tag{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;background:rgba(0,255,136,.06);border:1px solid rgba(0,255,136,.12);color:var(--g);font-family:var(--mono);margin:3px}

.scan-input{display:flex;gap:10px;flex-wrap:wrap}
.scan-input input{flex:1;min-width:160px;padding:10px 14px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03);color:#fff;font-size:13px;font-family:var(--mono);outline:none}
.scan-input input:focus{border-color:rgba(0,255,136,.3)}
.btn{padding:10px 20px;border-radius:8px;border:none;cursor:pointer;font-size:12px;font-family:var(--mono);font-weight:600;transition:all .2s}
.btn-primary{background:var(--g);color:#050505}
.btn-primary:disabled{opacity:.4;cursor:wait}
.btn-secondary{background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);color:var(--t3)}
.btn-danger{background:rgba(255,68,68,.04);border:1px solid rgba(255,68,68,.15);color:var(--red);padding:6px 12px;font-size:10px}
.btn-trigger{padding:8px 12px;border-radius:6px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.02);color:var(--t3);font-size:11px;font-family:var(--mono);cursor:pointer;text-align:left;text-transform:capitalize;transition:all .15s;width:100%}
.btn-trigger:hover{background:rgba(0,255,136,.05);color:var(--g)}
.btn-trigger:disabled{cursor:wait;opacity:.5}

.profile-row{display:flex;align-items:center;gap:12px;padding:10px 12px;background:var(--card);border-radius:8px;border:1px solid rgba(255,255,255,.04);cursor:pointer;transition:all .15s;flex-wrap:wrap;margin-bottom:6px}
.profile-row:hover,.profile-row.active{background:rgba(0,255,136,.06);border-color:rgba(0,255,136,.12)}

.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-family:var(--mono)}

.auth-banner{padding:10px 24px;background:rgba(255,68,68,.06);border-bottom:1px solid rgba(255,68,68,.1);font-size:11px;font-family:var(--mono)}
.auth-banner a{color:var(--g)}

.ambient-1{position:fixed;top:-200px;right:-200px;width:600px;height:600px;background:radial-gradient(circle,rgba(0,255,136,.05),transparent 70%);pointer-events:none}
.ambient-2{position:fixed;bottom:-300px;left:-100px;width:500px;height:500px;background:radial-gradient(circle,rgba(0,170,255,.04),transparent 70%);pointer-events:none}

@media(max-width:768px){
  .grid-4{grid-template-columns:1fr 1fr}
  .grid-2{grid-template-columns:1fr}
  header{padding:12px 16px}
  main{padding:16px 16px 64px}
  footer{padding:8px 16px}
  nav{padding:0 12px}
  .stat-value{font-size:20px}
  .hide-mobile{display:none}
}
@media(max-width:480px){
  .grid-4{gap:8px}
  .stat{padding:12px}
  .stat-value{font-size:18px}
}
</style>
</head>
<body>
<div class="ambient-1"></div>
<div class="ambient-2"></div>

<header>
  <div class="logo">
    <div class="logo-icon">𝕏</div>
    <span>Xenu</span>
  </div>
  <div style="display:flex;align-items:center;gap:12px">
    <div class="status-dot" id="auth-dot"></div>
    <a href="/docs" style="font-size:11px;font-family:var(--mono);color:var(--t3)">Docs</a>
  </div>
</header>

<div class="auth-banner" id="auth-banner" style="display:none">
  <span style="color:var(--red)">Not authenticated.</span>
  <a href="/auth/login">Connect your X account</a>
</div>

<nav id="tabs"></nav>
<main id="content"></main>

<footer>
  <span style="color:var(--t4)">xenu v0.1.0</span>
  <span id="footer-status" style="color:var(--t4)">loading...</span>
</footer>

<script>
const API = '';
const XG = '#00FF88';

// ─── API ────────────────────────────────
async function api(path) {
  try { const r = await fetch(API + path); if (!r.ok) return null; return await r.json(); } catch { return null; }
}
async function apiPost(path, body) {
  try {
    const opts = { method: 'POST', headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(API + path, opts);
    if (!r.ok) return null; return await r.json();
  } catch { return null; }
}
async function apiDelete(path) {
  try { const r = await fetch(API + path, { method: 'DELETE' }); return await r.json(); } catch { return null; }
}
function fmtNum(n) { if (n == null) return '—'; if (n >= 1e6) return (n/1e6).toFixed(1)+'M'; if (n >= 1e3) return (n/1e3).toFixed(1)+'K'; return n.toLocaleString(); }
function timeAgo(d) { if (!d) return '—'; const ms = Date.now() - new Date(d).getTime(); const m = Math.floor(ms/60000); if (m<1) return 'just now'; if (m<60) return m+'m ago'; const h = Math.floor(m/60); if (h<24) return h+'h ago'; return Math.floor(h/24)+'d ago'; }

// ─── Components ─────────────────────────
function stat(label, value, sub, pulse) {
  return '<div class="stat">'+(pulse?'<div style="position:absolute;top:12px;right:12px;width:8px;height:8px;border-radius:50%;background:var(--g);animation:pulse 2s infinite"></div>':'')+
    '<div class="stat-label">'+label+'</div><div class="stat-value">'+value+'</div>'+(sub?'<div class="stat-sub">'+sub+'</div>':'')+
  '</div>';
}
function sectionHdr(t) { return '<h3 class="section-hdr">'+t+'</h3>'; }
function card(inner, style) { return '<div class="card"'+(style?' style="'+style+'"':'')+'>'+inner+'</div>'; }
function empty(msg) { return '<div class="empty">'+(msg||'No data yet — run collectors first')+'</div>'; }
function barRow(label, value, maxVal, color, lw) {
  const pct = maxVal > 0 ? (value/maxVal)*100 : 0;
  return '<div class="bar-row"><span class="bar-label" style="width:'+(lw||80)+'px">'+label+'</span><div class="bar-track"><div class="bar-fill" style="width:'+Math.min(100,pct)+'%;background:linear-gradient(90deg,'+color+'44,'+color+')"></div></div><span class="bar-val">'+value+'</span></div>';
}
function meter(label, value) {
  const pct = typeof value==='number'?(value>1?value:value*100):0;
  return '<div class="meter"><span class="meter-label">'+label+'</span><div class="meter-track"><div class="meter-fill" style="width:'+Math.min(100,pct)+'%"></div></div><span class="meter-val">'+Math.round(pct)+'</span></div>';
}
function tweetCard(t) {
  return '<div class="tweet-card"><div class="tweet-text">'+(t.text||'').substring(0,200)+'</div><div class="tweet-stats"><span>♥ '+(t.likes||0)+'</span><span>↻ '+(t.retweets||0)+'</span><span>👁 '+fmtNum(t.impressions)+'</span><span class="hide-mobile" style="margin-left:auto;color:var(--t4)">'+(t.tweet_type||'')+'</span></div></div>';
}
function insight(text) { return '<div class="insight">'+text+'</div>'; }

// ─── Tabs ───────────────────────────────
const TABS = [
  {id:'overview',label:'Overview'},
  {id:'behavior',label:'Behavior'},
  {id:'network',label:'Network'},
  {id:'voice',label:'Voice'},
  {id:'signals',label:'Signals'},
  {id:'scan',label:'Scan'},
  {id:'collectors',label:'Collectors'},
];
let activeTab = 'overview';

function renderTabs() {
  document.getElementById('tabs').innerHTML = TABS.map(t =>
    '<button class="'+(activeTab===t.id?'active':'')+'" onclick="switchTab(\x27'+t.id+'\x27)">'+t.label+'</button>'
  ).join('');
}

function switchTab(id) {
  activeTab = id;
  renderTabs();
  renderContent();
}

async function renderContent() {
  const el = document.getElementById('content');
  el.innerHTML = '<div class="loader">Loading...</div>';
  switch(activeTab) {
    case 'overview': el.innerHTML = await renderOverview(); break;
    case 'behavior': el.innerHTML = await renderBehavior(); break;
    case 'network': el.innerHTML = await renderNetwork(); break;
    case 'voice': el.innerHTML = await renderVoice(); break;
    case 'signals': el.innerHTML = await renderSignals(); break;
    case 'scan': el.innerHTML = await renderScan(); break;
    case 'collectors': el.innerHTML = await renderCollectors(); break;
  }
}

// ─── Tab: Overview ──────────────────────
async function renderOverview() {
  const [status, audience, tweets, patterns] = await Promise.all([
    api('/api/status'), api('/api/audience'), api('/api/tweets?limit=5&type=original'), api('/api/patterns?type=posting_time')
  ]);
  const counts = status?.counts || {};
  const total = status?.totalDataPoints || 0;
  const audData = audience?.data || [];
  const topTweets = tweets?.data || [];
  const latest = audData[0];
  const prev = audData[7] || audData[audData.length-1];
  const delta = latest && prev ? latest.followers - prev.followers : null;

  let html = '<div class="grid-4">';
  html += stat('Followers', latest?fmtNum(latest.followers):'—', delta!=null?(delta>=0?'+':'')+delta+' recent':null, true);
  html += stat('Tweets', fmtNum(counts.tweets), 'Collected');
  html += stat('Mentions', fmtNum(counts.mentions), 'Tracked');
  html += stat('Data Points', fmtNum(total), Object.keys(counts).length+' sources', true);
  html += '</div>';

  if (topTweets.length > 0) {
    html += '<div style="margin-top:20px">'+card(sectionHdr('Recent Tweets') + topTweets.map(tweetCard).join(''))+'</div>';
  } else {
    html += '<div style="margin-top:20px">'+empty('No tweets collected yet. Authorize and run collectors to start.')+'</div>';
  }
  return html;
}

// ─── Tab: Behavior ──────────────────────
async function renderBehavior() {
  const [contentPerf, hashP, replyP, timeP] = await Promise.all([
    api('/api/patterns?type=content_type'), api('/api/patterns?type=hashtag'), api('/api/patterns?type=reply_chain'), api('/api/patterns?type=posting_time')
  ]);
  const typePerf = contentPerf?.data?.find(p=>p.pattern_key==='performance')?.pattern_value||[];
  const hashFreq = hashP?.data?.find(p=>p.pattern_key==='frequency')?.pattern_value||[];
  const replyDepth = replyP?.data?.find(p=>p.pattern_key==='depth_distribution')?.pattern_value||{};
  const peakHours = timeP?.data?.find(p=>p.pattern_key==='peak_hours')?.pattern_value||[];
  const maxEng = Math.max(...typePerf.map(t=>t.engagementRate||0),1);

  let html = '';
  if (typePerf.length > 0) {
    html += card(sectionHdr('Content Type Performance') + '<div style="display:flex;flex-direction:column;gap:10px">' +
      typePerf.sort((a,b)=>(b.engagementRate||0)-(a.engagementRate||0)).map(ct=>
        barRow(ct.type, ct.engagementRate||0, maxEng, XG, 70)
      ).join('') + '</div>');
  } else html += empty('Run analysis to see content type performance');

  if (hashFreq.length > 0) {
    html += '<div style="margin-top:20px">'+card(sectionHdr('Hashtag Performance') + '<div style="display:flex;flex-direction:column;gap:8px">' +
      hashFreq.slice(0,10).map(h=>barRow('#'+h.tag, h.count, hashFreq[0]?.count||1, 'var(--blue)', 100)).join('') + '</div>')+'</div>';
  }
  if (replyDepth.distribution) {
    const maxD = Math.max(...Object.values(replyDepth.distribution));
    html += '<div style="margin-top:20px">'+card(sectionHdr('Reply Chain Depth') + '<div style="display:flex;flex-direction:column;gap:8px">' +
      Object.entries(replyDepth.distribution).map(([d,c])=>barRow('Depth '+d, c, maxD, 'var(--purple)', 60)).join('') +
      '</div><div style="margin-top:10px;font-size:10px;color:var(--t4);font-family:var(--mono)">Avg: '+replyDepth.avgDepth+' · Max: '+replyDepth.maxDepth+' · '+replyDepth.totalConversations+' conversations</div>')+'</div>';
  }
  if (peakHours.length>0) html += insight('PEAK HOURS: '+peakHours.map(h=>h.hour+':00 ('+h.count+' tweets)').join(', '));
  return html;
}

// ─── Tab: Network ───────────────────────
async function renderNetwork() {
  const [engGraph, changes, engP] = await Promise.all([
    api('/api/engagement-graph'), api('/api/following/changes'), api('/api/patterns?type=engagement_target')
  ]);
  const targets = engGraph?.data||[];
  const followChanges = changes?.data||[];
  const clusters = engP?.data?.find(p=>p.pattern_key==='clusters')?.pattern_value;
  const maxA = Math.max(...targets.map(t=>t.total_actions||0),1);

  let html = '';
  if (targets.length>0) {
    html += card(sectionHdr('Top Engagement Targets')+'<div style="display:flex;flex-direction:column;gap:8px">'+
      targets.slice(0,15).map(t=>barRow('@'+t.handle, t.total_actions, maxA, XG, 110)).join('')+'</div>');
  } else html += empty('No engagement data yet');

  if (clusters) {
    html += '<div class="grid-2" style="margin-top:20px">'+stat('Deep Relations', clusters.deepRelationships, (clusters.deepHandles||[]).slice(0,3).join(', '))+
      stat('One-Sided', clusters.oneSided, "You engage, they don't")+'</div>';
  }
  if (followChanges.length>0) {
    html += '<div style="margin-top:20px">'+card(sectionHdr('Recent Follow/Unfollow Activity')+'<div style="display:flex;flex-direction:column;gap:6px">'+
      followChanges.slice(0,10).map(c=>'<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border)"><div class="collector-dot" style="background:'+(c.change_type==='follow'?'var(--g)':'var(--red)')+'"></div><span style="font-size:11px;color:var(--t2);font-family:var(--mono)">'+(c.change_type==='follow'?'Followed':'Unfollowed')+'</span><span style="font-size:11px;color:var(--t1);font-family:var(--mono)">@'+(c.user_handle||c.user_id)+'</span><span style="font-size:10px;color:var(--t4);font-family:var(--mono);margin-left:auto">'+timeAgo(c.detected_at)+'</span></div>').join('')+'</div>')+'</div>';
  }
  return html;
}

// ─── Tab: Voice ─────────────────────────
async function renderVoice() {
  const voice = await api('/api/voice');
  const metrics = {};
  if (voice?.data) voice.data.forEach(m => metrics[m.metric] = m.value);
  const tone = metrics.tone||{};
  const vocab = metrics.vocabulary||{};
  const emoji = metrics.emoji_rate||{};
  const avgLen = metrics.avg_length||{};
  const structure = metrics.structure||{};
  if (!Object.keys(metrics).length) return empty('Run analysis engine to generate voice fingerprint');

  let html = card(sectionHdr('Voice Fingerprint')+'<div style="display:flex;flex-direction:column;gap:12px">'+
    ['directness','technical','hype','sarcasm'].map(k=>meter(k, tone[k]||0)).join('')+'</div>');

  html += '<div class="grid-2" style="margin-top:20px">';
  html += card(sectionHdr('Top Vocabulary')+(vocab.topWords?'<div style="display:flex;flex-wrap:wrap;gap:6px">'+vocab.topWords.slice(0,15).map(w=>'<span class="tag">'+(w.word||w)+'</span>').join('')+'</div>':empty('Not computed yet')));
  html += card(sectionHdr('Writing Metrics')+'<div style="display:flex;flex-direction:column;gap:10px">'+
    [['Avg length',(avgLen.average||'—')+' chars'],['Words/tweet',vocab.avgWordsPerTweet||'—'],['Emoji rate',(emoji.pctWithEmoji||0)+'%'],['Sentences/tweet',structure.avgSentencesPerTweet||'—'],['Lexical diversity',vocab.lexicalDiversity||'—']].map(([l,v])=>'<div style="display:flex;justify-content:space-between"><span style="font-size:11px;color:var(--t3);font-family:var(--mono)">'+l+'</span><span style="font-size:11px;color:var(--t1);font-family:var(--mono)">'+v+'</span></div>').join('')+'</div>');
  html += '</div>';

  if (emoji.topEmojis?.length) {
    html += '<div style="margin-top:20px">'+card(sectionHdr('Top Emojis')+'<div style="display:flex;gap:12px;flex-wrap:wrap">'+emoji.topEmojis.slice(0,8).map(e=>'<div style="text-align:center"><div style="font-size:24px">'+e.emoji+'</div><div style="font-size:9px;color:var(--t3);font-family:var(--mono);margin-top:4px">'+e.count+'x</div></div>').join('')+'</div>')+'</div>';
  }
  return html;
}

// ─── Tab: Signals ───────────────────────
async function renderSignals() {
  const sentiment = await api('/api/sentiment');
  const summary = sentiment?.summary||[];
  const recent = sentiment?.recent||[];
  const total = summary.reduce((s,r)=>s+r.count,0);
  const pos = summary.find(s=>s.sentiment==='positive')?.count||0;
  const neu = summary.find(s=>s.sentiment==='neutral')?.count||0;
  const neg = summary.find(s=>s.sentiment==='negative')?.count||0;
  const pp = total>0?Math.round(pos/total*100):0;
  const np = total>0?Math.round(neu/total*100):0;
  const ngp = total>0?Math.round(neg/total*100):0;

  let html = '';
  if (total > 0) {
    html += card(sectionHdr('Mention Sentiment')+
      '<div style="display:flex;gap:16px;margin-bottom:14px;flex-wrap:wrap">'+
      [{l:'Positive',v:pp,c:'var(--g)'},{l:'Neutral',v:np,c:'var(--t3)'},{l:'Negative',v:ngp,c:'var(--red)'}].map(s=>'<div style="display:flex;align-items:center;gap:6px"><div style="width:8px;height:8px;border-radius:2px;background:'+s.c+'"></div><span style="font-size:12px;color:'+s.c+';font-family:var(--mono);font-weight:600">'+s.v+'%</span><span style="font-size:10px;color:var(--t3);font-family:var(--mono)">'+s.l+'</span></div>').join('')+
      '</div><div style="display:flex;height:8px;border-radius:4px;overflow:hidden;gap:2px">'+
      (pp>0?'<div style="width:'+pp+'%;background:var(--g);border-radius:4px 0 0 4px"></div>':'')+
      (np>0?'<div style="width:'+np+'%;background:rgba(255,255,255,.12)"></div>':'')+
      (ngp>0?'<div style="width:'+ngp+'%;background:var(--red);border-radius:0 4px 4px 0"></div>':'')+
      '</div><div style="font-size:10px;color:var(--t4);font-family:var(--mono);margin-top:8px">'+total+' mentions analyzed</div>');
  } else html += empty('No sentiment data — run sentiment collector with ANTHROPIC_API_KEY set');

  if (recent.length > 0) {
    html += '<div style="margin-top:20px">'+card(sectionHdr('Recent Analyzed Mentions')+'<div style="display:flex;flex-direction:column;gap:8px">'+
      recent.slice(0,8).map(m=>{
        const sc = m.sentiment==='positive'?'var(--g)':m.sentiment==='negative'?'var(--red)':'var(--t3)';
        return '<div class="tweet-card"><div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="font-size:11px;color:var(--t1);font-family:var(--mono)">@'+(m.author_handle||'?')+'</span><div style="width:6px;height:6px;border-radius:50%;background:'+sc+'"></div><span style="font-size:10px;color:'+sc+';font-family:var(--mono)">'+m.sentiment+'</span><span style="font-size:9px;color:var(--t4);font-family:var(--mono);margin-left:auto">'+timeAgo(m.created_at)+'</span></div><div style="font-size:11px;color:var(--t3);line-height:1.4;word-break:break-word">'+(m.text||'').substring(0,140)+'</div></div>';
      }).join('')+'</div>')+'</div>';
  }
  return html;
}

// ─── Tab: Scan ──────────────────────────
let scanProfiles = [];
let selectedScan = null;

async function renderScan() {
  const scans = await api('/api/scans');
  scanProfiles = scans?.data || [];

  let html = card(sectionHdr('Scan External Profile')+
    '<div class="scan-input"><input id="scan-handle" placeholder="@handle" onkeydown="if(event.key===\x27Enter\x27)doScan()"><button class="btn btn-primary" id="scan-btn" onclick="doScan()">Scan</button></div>'+
    '<div id="scan-status"></div>');

  if (scanProfiles.length > 0) {
    html += '<div style="margin-top:20px">'+card(sectionHdr('Scanned Profiles ('+scanProfiles.length+')')+
      '<div id="scan-list">'+scanProfiles.map((p,i)=>
        '<div class="profile-row'+(selectedScan?.user_id===p.user_id?' active':'')+'" onclick="loadScanProfile(\x27'+p.user_id+'\x27)">'+
        '<div style="flex:1;min-width:100px"><div style="font-size:12px;color:var(--t1);font-family:var(--mono)">@'+p.handle+'</div><div style="font-size:10px;color:var(--t3);font-family:var(--mono)">'+(p.name||'')+'</div></div>'+
        '<div style="display:flex;gap:12px;align-items:center"><span style="font-size:10px;color:var(--t3);font-family:var(--mono)">'+fmtNum(p.followers)+' followers</span><span style="font-size:9px;color:var(--t4);font-family:var(--mono)">'+timeAgo(p.last_scanned)+'</span><div class="collector-dot" style="background:'+(p.status==='complete'?'var(--g)':p.status==='scanning'?'var(--yellow)':'var(--red)')+'"></div></div></div>'
      ).join('')+'</div>')+'</div>';
  }

  html += '<div id="scan-detail"></div>';
  return html;
}

async function doScan() {
  const input = document.getElementById('scan-handle');
  const handle = input.value.replace(/^@/,'').trim();
  if (!handle) return;
  const btn = document.getElementById('scan-btn');
  const status = document.getElementById('scan-status');
  btn.disabled = true; btn.textContent = 'Scanning...';
  status.innerHTML = '<div style="margin-top:12px;font-size:11px;color:var(--t3);font-family:var(--mono)">Fetching tweets and running analysis... 15-30 seconds.</div>';
  const res = await apiPost('/api/scan/'+handle);
  btn.disabled = false; btn.textContent = 'Scan';
  if (res?.scan?.status==='complete') {
    status.innerHTML = '<div class="insight">Collected '+res.scan.tweetsCollected+' tweets, computed '+(res.analysis?.patterns||0)+' patterns in '+(res.durationMs/1000).toFixed(1)+'s</div>';
    input.value = '';
    if (res.scan.userId) await loadScanProfile(res.scan.userId);
    // Refresh list
    const scans = await api('/api/scans');
    scanProfiles = scans?.data||[];
    switchTab('scan');
  } else {
    status.innerHTML = '<div style="margin-top:12px;padding:10px 14px;border-radius:8px;background:rgba(255,68,68,.04);border:1px solid rgba(255,68,68,.08);font-size:11px;color:var(--red);font-family:var(--mono)">Error: '+(res?.scan?.error||'Unknown error')+'</div>';
  }
}

async function loadScanProfile(userId) {
  const res = await api('/api/scans/'+userId);
  if (!res?.profile) return;
  selectedScan = res;
  const p = res.profile;
  const patterns = res.patterns||[];
  const voice = res.voice||[];
  const topTweets = res.topTweets||[];

  const gp = (type,key) => patterns.find(x=>x.pattern_type===type&&x.pattern_key===key)?.pattern_value;
  const gv = (metric) => voice.find(x=>x.metric===metric)?.value;

  const perf = gp('content_perf','summary');
  const typePerf = gp('content_type','performance')||[];
  const tone = gv('tone')||{};
  const vocab = gv('vocabulary')||{};
  const avgLen = gv('avg_length')||{};
  const emoji = gv('emoji_rate')||{};
  const hashFreq = gp('hashtag','frequency')||[];
  const peakHours = gp('posting_time','peak_hours')||[];
  const velocity = gp('velocity','analysis');
  const threads = gp('threads','analysis');

  let html = '<div style="margin-top:20px">';

  // Profile header
  html += card('<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:16px"><div>'+
    '<div style="font-size:16px;font-weight:600">'+p.name+'</div>'+
    '<div style="font-size:12px;color:var(--t3);font-family:var(--mono)">@'+p.handle+'</div>'+
    (p.bio?'<div style="font-size:11px;color:var(--t3);margin-top:6px;line-height:1.5;max-width:400px">'+p.bio+'</div>':'')+
    '</div><button class="btn-danger" onclick="deleteScanProfile(\x27'+p.user_id+'\x27)">Delete</button></div>'+
    '<div class="grid-4">'+stat('Followers',fmtNum(p.followers))+stat('Following',fmtNum(p.following))+stat('Tweets',fmtNum(p.tweet_count))+stat('Collected',fmtNum(res.tweetCount))+'</div>');

  // Engagement summary
  if (perf) {
    html += '<div class="grid-4" style="margin-top:12px">'+stat('Avg Likes',perf.avgLikes)+stat('Avg RTs',perf.avgRetweets)+stat('Avg Impressions',fmtNum(perf.avgImpressions))+stat('Eng Rate',perf.overallEngRate+'%',perf.totalTweets+' tweets')+'</div>';
  }

  // Velocity
  if (velocity) {
    const vc = velocity.trend==='accelerating'?'var(--g)':velocity.trend==='declining'?'var(--red)':'var(--t3)';
    html += '<div style="margin-top:12px">'+insight('VELOCITY: <span style="color:'+vc+'">'+velocity.trend.toUpperCase()+'</span> · Like ratio: '+velocity.ratio?.likes+'x · Stage: '+velocity.stage+(velocity.breakouts?.length?' · '+velocity.breakouts.length+' breakout tweets':''))+'</div>';
  }

  // Threads
  if (threads) {
    html += '<div style="margin-top:12px">'+insight('THREADS: '+threads.threadCount+' threads ('+threads.threadPct+'% of content) · Avg length: '+threads.avgThreadLength+' tweets · Thread multiplier: '+threads.threadMultiplier?.likes+'x likes')+'</div>';
  }

  // Voice
  if (tone.directness!=null) {
    html += '<div style="margin-top:20px">'+card(sectionHdr('Voice Fingerprint')+'<div style="display:flex;flex-direction:column;gap:10px">'+['directness','technical','hype','sarcasm'].map(k=>meter(k,tone[k]||0)).join('')+'</div>')+'</div>';
  }

  // Content types + hashtags
  html += '<div class="grid-2" style="margin-top:20px">';
  if (typePerf.length>0) {
    const maxE = Math.max(...typePerf.map(t=>t.engagementRate||0));
    html += card(sectionHdr('Content Types')+'<div style="display:flex;flex-direction:column;gap:8px">'+typePerf.sort((a,b)=>(b.engagementRate||0)-(a.engagementRate||0)).map(ct=>barRow(ct.type,ct.engagementRate||0,maxE,XG,60)).join('')+'</div>');
  }
  if (hashFreq.length>0) {
    html += card(sectionHdr('Top Hashtags')+'<div style="display:flex;flex-direction:column;gap:8px">'+hashFreq.slice(0,8).map(h=>barRow('#'+h.tag,h.count,hashFreq[0]?.count||1,'var(--blue)',90)).join('')+'</div>');
  }
  html += '</div>';

  // Vocab + metrics
  html += '<div class="grid-2" style="margin-top:12px">';
  if (vocab.topWords?.length) {
    html += card(sectionHdr('Top Vocabulary')+'<div style="display:flex;flex-wrap:wrap;gap:6px">'+vocab.topWords.slice(0,15).map(w=>'<span class="tag">'+(w.word||w)+'</span>').join('')+'</div>');
  }
  html += card(sectionHdr('Writing Metrics')+'<div style="display:flex;flex-direction:column;gap:8px">'+
    [['Avg length',(avgLen.average||'—')+' chars'],['Words/tweet',vocab.avgWordsPerTweet||'—'],['Emoji rate',(emoji.pctWithEmoji||0)+'%']].map(([l,v])=>'<div style="display:flex;justify-content:space-between"><span style="font-size:10px;color:var(--t3);font-family:var(--mono)">'+l+'</span><span style="font-size:10px;color:var(--t1);font-family:var(--mono)">'+v+'</span></div>').join('')+'</div>');
  html += '</div>';

  // Top tweets
  if (topTweets.length>0) {
    html += '<div style="margin-top:20px">'+card(sectionHdr('Top Tweets by Likes')+topTweets.map(tweetCard).join(''))+'</div>';
  }
  if (peakHours.length>0) html += insight('PEAK POSTING HOURS: '+peakHours.map(h=>h.hour+':00 UTC ('+h.count+')').join(', '));

  html += '</div>';
  document.getElementById('scan-detail').innerHTML = html;
}

async function deleteScanProfile(userId) {
  await apiDelete('/api/scans/'+userId);
  selectedScan = null;
  switchTab('scan');
}

// ─── Tab: Collectors ────────────────────
async function renderCollectors() {
  const status = await api('/api/status');
  const collectors = status?.collectors||[];
  const counts = status?.counts||{};
  const sc = {success:'var(--g)',running:'var(--yellow)',error:'var(--red)',partial:'var(--yellow)'};

  let html = card(sectionHdr('Collector Status')+'<div style="display:flex;flex-direction:column;gap:6px">'+
    (collectors.length>0?collectors.map(c=>
      '<div class="collector-row"><div class="collector-name"><div class="collector-dot" style="background:'+(sc[c.status]||'var(--t4)')+'"></div><span style="font-size:12px;font-family:var(--mono);text-transform:capitalize">'+c.collector+'</span></div><div class="collector-meta"><span style="font-size:11px;color:var(--t3);font-family:var(--mono)">'+fmtNum(c.records_collected)+'</span><span style="font-size:10px;color:var(--t4);font-family:var(--mono)">'+timeAgo(c.finished_at||c.started_at)+'</span></div></div>'
    ).join(''):empty('No collectors have run yet'))+'</div>');

  html += '<div class="grid-2" style="margin-top:20px">';
  html += card(sectionHdr('Record Counts')+'<div style="display:flex;flex-direction:column;gap:8px">'+
    Object.entries(counts).map(([k,v])=>'<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border)"><span style="font-size:11px;color:var(--t3);font-family:var(--mono);text-transform:capitalize">'+k.replace(/_/g,' ')+'</span><span style="font-size:11px;color:var(--t1);font-family:var(--mono)">'+fmtNum(v)+'</span></div>').join('')+'</div>');

  html += card(sectionHdr('Manual Triggers')+'<div style="display:flex;flex-direction:column;gap:6px" id="trigger-btns">'+
    ['all','timeline','engagement','mentions','audience','following','bookmarks','sentiment'].map(n=>
      '<button class="btn-trigger" onclick="triggerCollector(\x27'+n+'\x27,this)">▶ '+n+'</button>').join('')+
    '<div style="height:1px;background:var(--border);margin:4px 0"></div>'+
    '<button class="btn-trigger" style="border-color:rgba(0,255,136,.12);color:var(--g)" onclick="triggerAnalysis(this)">⚡ Run Analysis Engine</button></div>');
  html += '</div>';

  html += '<div style="margin-top:20px">'+card(sectionHdr('Cron Schedule')+'<div style="display:flex;flex-direction:column;gap:6px">'+
    [{j:'Timeline + Engagement + Mentions + Bookmarks',f:'Every 6h'},{j:'Sentiment + Analysis',f:'After collections'},{j:'Following + Audience',f:'Daily 6am'},{j:'Watch List Rescans',f:'Daily 6am'}].map(s=>
      '<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border)"><span style="font-size:10px;color:var(--t3);font-family:var(--mono)">'+s.j+'</span><span style="font-size:10px;color:var(--t4);font-family:var(--mono)">'+s.f+'</span></div>').join('')+'</div>')+'</div>';

  return html;
}

async function triggerCollector(name, btn) {
  btn.disabled = true; btn.textContent = 'Running '+name+'...';
  await apiPost('/api/collect/'+name);
  btn.disabled = false; btn.textContent = '▶ '+name;
  switchTab('collectors');
}

async function triggerAnalysis(btn) {
  btn.disabled = true; btn.textContent = 'Running analysis...';
  await apiPost('/api/analyze/all');
  btn.disabled = false; btn.textContent = '⚡ Run Analysis Engine';
  switchTab('collectors');
}

// ─── Init ───────────────────────────────
async function init() {
  renderTabs();
  const auth = await api('/auth/status');
  const dot = document.getElementById('auth-dot');
  const banner = document.getElementById('auth-banner');
  const footer = document.getElementById('footer-status');
  if (auth?.authenticated) {
    dot.className = 'status-dot on';
    banner.style.display = 'none';
    footer.textContent = 'connected';
    footer.style.color = 'rgba(0,255,136,.4)';
  } else {
    dot.className = 'status-dot off';
    banner.style.display = 'block';
    footer.textContent = 'disconnected';
    footer.style.color = 'rgba(255,68,68,.4)';
  }
  renderContent();
}

init();
</script>
</body>
</html>`;
