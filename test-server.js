const http = require('http');
const s = http.createServer((req,res) => { res.end('ok'); });
s.listen(3002, () => console.log('listening on 3002'));
console.log('Script complete, server should stay running');
