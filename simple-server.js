const http = require('http');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data', 'plants.json');
const FAVORITES_FILE = path.join(__dirname, 'data', 'favorites.json');
const PORT = 3000;

function readJson(filePath) {
  try {
    const txt = fs.readFileSync(filePath, 'utf8') || '[]';
    return JSON.parse(txt);
  } catch (e) {
    return [];
  }
}

function writeJson(filePath, obj) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body);
}

function collectRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const buf = Buffer.concat(chunks);
      const txt = buf.toString();
      resolve(txt);
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  try {
    if (req.method === 'GET' && pathname === '/test') {
      return sendJson(res, 200, { message: 'Server is running!' });
    }

    if (req.method === 'GET' && pathname === '/history') {
      const data = readJson(DATA_FILE);
      return sendJson(res, 200, data);
    }

    if (req.method === 'GET' && pathname === '/stats') {
      const data = readJson(DATA_FILE);
      const total = data.length;
      const avgWater = total ? data.reduce((s, i) => s + Number(i.water || 0), 0) / total : 0;
      return sendJson(res, 200, { total, avgWater: Number(avgWater.toFixed(2)) });
    }

    if (req.method === 'POST' && pathname === '/favorite') {
      const bodyTxt = await collectRequestBody(req);
      let body;
      try { body = JSON.parse(bodyTxt); } catch { body = {}; }
      const favs = readJson(FAVORITES_FILE);
      favs.push(body);
      writeJson(FAVORITES_FILE, favs);
      return sendJson(res, 200, { success: true });
    }

    if (req.method === 'POST' && pathname === '/identify') {
      const bodyTxt = await collectRequestBody(req);
      let body = {};
      try { body = JSON.parse(bodyTxt); } catch { body = {}; }

      // Simple mocked identification + weather logic
      const plantName = body.plantName || 'Unknown Plant';
      const lat = Number(body.lat) || 0;
      const lon = Number(body.lon) || 0;

      // Mock weather values to keep behavior similar
      const temp = body.temp != null ? Number(body.temp) : 25 + Math.floor(Math.random() * 10) - 2;
      const humidity = body.humidity != null ? Number(body.humidity) : 45 + Math.floor(Math.random() * 40);
      const rain = body.rain != null ? Number(body.rain) : 0;
      const rainChance = body.rainChance != null ? Number(body.rainChance) : Math.round(Math.random() * 100);

      let water = 1;
      if (temp > 30) water += 0.5;
      if (humidity < 40) water += 0.3;
      if (rain > 0) water -= 0.7;
      if (water < 0) water = 0;

      let status = 'Good';
      if (temp > 32 && humidity < 50) status = 'Needs more water';
      else if (rainChance > 60) status = 'Do not water';

      const existing = readJson(DATA_FILE);
      existing.push({
        plant: plantName,
        temperature: temp,
        humidity,
        rainChance,
        water: Number(water.toFixed(2)),
        message: '',
        date: new Date().toISOString(),
      });
      writeJson(DATA_FILE, existing);

      let message = 'Water normally today.';
      if (temp > 32 && humidity < 50) message = "It's hot and dry — increase watering.";
      else if (humidity > 70) message = 'High humidity — reduce watering.';
      else if (rainChance > 60) message = 'Rain expected — skip watering today.';

      existing[existing.length - 1].message = message;
      writeJson(DATA_FILE, existing);

      return sendJson(res, 200, {
        plant: plantName,
        temperature: temp,
        humidity,
        rain: rain,
        rainChance,
        water: Number(water.toFixed(2)),
        status,
        message,
        lat,
        lon,
      });
    }

    // Serve frontend static file index.html if requested at root
    if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
      const f = path.join(__dirname, '..', 'frontend', 'index.html');
      if (fs.existsSync(f)) {
        const html = fs.readFileSync(f, 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end(html);
      }
    }

    // Not found
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: 'Internal server error' });
  }
});

server.listen(PORT, () => console.log(`Simple server running on http://localhost:${PORT}`));
