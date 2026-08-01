const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

const frontendPath = path.join(__dirname, '..', 'frontend');

app.use(express.static(frontendPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Frontend server running at http://localhost:${PORT}`);
});
