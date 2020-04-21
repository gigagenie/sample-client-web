const path = require('path');
const express = require('express');
const app = express();

app
.use(express.static(__dirname))
.get('/', (req, res) => res.sendfile(path.join(__dirname + '/index.html')));

app.listen(8000, () => console.log(`App listening on port 8000!`));
