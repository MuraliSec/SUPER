const http = require('http');
const fs = require('fs');
const path = require('path');
const port = 3000;
const index = fs.readFileSync(path.join(__dirname,'public','index.html'));
const bundle = fs.readFileSync(path.join(__dirname,'src','App.js'));
http.createServer((req,res)=>{
  if (req.url === '/'){
    res.writeHead(200, {'Content-Type':'text/html'});
    res.end(index);
  } else if (req.url === '/app.js'){
    res.writeHead(200, {'Content-Type':'application/javascript'});
    res.end(bundle);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(port, ()=>console.log('Client running on', port));
